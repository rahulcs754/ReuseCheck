import { extractUnits } from './parse.js';
import { compare, kindCompatible, sizeCompatible } from './similarity.js';
import type { Match, Options, Unit } from './types.js';

export interface SourceFile {
  file: string;
  code: string;
}

export function unitsOf(files: SourceFile[], minTokens: number): Unit[] {
  const units: Unit[] = [];
  for (const f of files) for (const u of extractUnits(f.code, f.file)) if (u.tokens.length >= minTokens) units.push(u);
  return units;
}

/** A unit is "new" when at least half of its lines were added in the diff. */
export function newUnits(units: Unit[], added: Map<string, Set<number>>): Unit[] {
  return units.filter((u) => {
    const lines = added.get(u.file);
    if (!lines || lines.size === 0) return false;
    let n = 0;
    for (let l = u.line; l <= u.endLine; l++) if (lines.has(l)) n++;
    return n / (u.endLine - u.line + 1) >= 0.5;
  });
}

export interface Finding {
  unit: Unit;
  matches: Match[];
}

/** Units that overlap in lines are the same code (e.g. a method inside a class). */
function overlaps(a: Unit, b: Unit): boolean {
  return a.file === b.file && a.line <= b.endLine && b.line <= a.endLine;
}

/**
 * For each new unit, the existing (or other new) units it looks like.
 * New-vs-new pairs are reported once, on the later unit.
 */
export function findReuse(all: Unit[], fresh: Unit[], opts: Options): Finding[] {
  const freshIds = new Set(fresh.map((u) => u.id));
  const order = new Map(fresh.map((u, i) => [u.id, i]));
  const findings: Finding[] = [];
  for (const unit of fresh) {
    const matches: Match[] = [];
    for (const other of all) {
      if (other.id === unit.id || overlaps(unit, other)) continue;
      if (freshIds.has(other.id) && (order.get(other.id) ?? 0) > (order.get(unit.id) ?? 0)) continue;
      if (!kindCompatible(unit, other) || !sizeCompatible(unit, other)) continue;
      const m = compare(unit, other);
      if (m.score >= opts.threshold) matches.push(m);
    }
    if (matches.length) {
      matches.sort((a, b) => b.score - a.score);
      findings.push({ unit, matches: matches.slice(0, opts.maxMatches) });
    }
  }
  return findings.sort((a, b) => b.matches[0]!.score - a.matches[0]!.score);
}

export interface Group {
  units: Unit[];
  score: number;
}

/** Whole-repo scan: groups of units that look alike. */
export function findGroups(all: Unit[], opts: Options): Group[] {
  const sorted = [...all].sort((a, b) => a.tokens.length - b.tokens.length);
  const parent = sorted.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  const best = new Map<number, number>();
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i]!;
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j]!;
      if (a.tokens.length / b.tokens.length < 0.5) break; // sorted by size: the rest are bigger
      if (overlaps(a, b) || !kindCompatible(a, b)) continue;
      const m = compare(a, b);
      if (m.score < opts.threshold) continue;
      const ra = find(i);
      const rb = find(j);
      if (ra !== rb) parent[rb] = ra;
      best.set(i, Math.max(best.get(i) ?? 0, m.score));
      best.set(j, Math.max(best.get(j) ?? 0, m.score));
    }
  }
  const groups = new Map<number, number[]>();
  for (let i = 0; i < sorted.length; i++) {
    if (!best.has(i)) continue;
    const r = find(i);
    groups.set(r, [...(groups.get(r) ?? []), i]);
  }
  return [...groups.values()]
    .map((idx) => ({
      units: idx.map((i) => sorted[i]!).sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line),
      score: Math.min(...idx.map((i) => best.get(i)!)),
    }))
    .sort((a, b) => b.units.length - a.units.length || b.score - a.score);
}
