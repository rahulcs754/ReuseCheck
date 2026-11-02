import type { Match, Unit } from './types.js';

export const SHINGLE = 5;

/** Overlapping runs of `k` tokens. */
export function shingles(tokens: string[], k = SHINGLE): Set<string> {
  const out = new Set<string>();
  if (tokens.length <= k) {
    out.add(tokens.join(' '));
    return out;
  }
  for (let i = 0; i + k <= tokens.length; i++) out.add(tokens.slice(i, i + k).join(' '));
  return out;
}

export function bag(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

export function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  let inter = 0;
  for (const x of small) if (big.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Weighted Jaccard over token counts: ignores order, keeps amounts. */
export function bagSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let min = 0;
  let max = 0;
  for (const [k, va] of a) {
    const vb = b.get(k) ?? 0;
    min += Math.min(va, vb);
    max += Math.max(va, vb);
  }
  for (const [k, vb] of b) if (!a.has(k)) max += vb;
  return max === 0 ? 1 : min / max;
}

/** Common built-ins that say little about what a function does. */
const NOISE_APIS = new Set(['undefined', 'console', '.log', '.length', 'Object', 'Array', 'String', 'Number', 'Boolean', 'JSON']);

function meaningful(apis: Set<string>): Set<string> {
  return new Set([...apis].filter((a) => !NOISE_APIS.has(a)));
}

/** Score two units. Structure counts most; shared APIs confirm the match. */
export function compare(a: Unit, b: Unit): Match {
  const identical = a.hash === b.hash;
  const structure = identical ? 1 : 0.6 * jaccard(a.shingles, b.shingles) + 0.4 * bagSimilarity(a.bag, b.bag);
  const apisA = meaningful(a.apis);
  const apisB = meaningful(b.apis);
  const api = jaccard(apisA, apisB);
  const score = identical ? 1 : 0.7 * structure + 0.3 * api;
  const sharedApis = [...apisA].filter((x) => apisB.has(x)).sort();
  return { unit: a, other: b, score, structure, api, identical, sharedApis };
}

/** Quick upper bound: very different sizes can't be near-duplicates. */
export function sizeCompatible(a: Unit, b: Unit, minRatio = 0.5): boolean {
  const x = a.tokens.length;
  const y = b.tokens.length;
  return Math.min(x, y) / Math.max(x, y) >= minRatio;
}

/** Components compare with components; hooks and plain functions compare with each other. */
export function kindCompatible(a: Unit, b: Unit): boolean {
  return (a.kind === 'component') === (b.kind === 'component');
}
