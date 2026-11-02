import type { Finding, Group } from './check.js';
import type { Match, Unit } from './types.js';

export const MARKER = '<!-- reusecheck -->';

const pct = (x: number): string => `${Math.round(x * 100)}%`;

/** Link to a file line on GitHub, or just `file:line`. */
export type Linker = (u: Unit) => string;

export const plainLink: Linker = (u) => `\`${u.file}:${u.line}\``;

export function githubLinker(server: string, repo: string, sha: string): Linker {
  return (u) => `[\`${u.file}:${u.line}\`](${server}/${repo}/blob/${sha}/${u.file}#L${u.line}-L${u.endLine})`;
}

const kindLabel = (u: Unit): string => (u.kind === 'component' ? 'component' : u.kind === 'hook' ? 'hook' : 'function');

export function why(m: Match): string {
  const parts: string[] = [];
  if (m.identical) parts.push('Same code after renaming');
  else parts.push(`Structure ${pct(m.structure)} alike after renaming`);
  if (m.sharedApis.length) {
    const shown = m.sharedApis.slice(0, 6).map((a) => `\`${a}\``).join(', ');
    parts.push(`both use ${shown}${m.sharedApis.length > 6 ? ` +${m.sharedApis.length - 6}` : ''}`);
  }
  return parts.join('; ');
}

export function markdownReport(findings: Finding[], opts: { link?: Linker; checked: number; threshold: number }): string {
  const link = opts.link ?? plainLink;
  const lines = [MARKER];
  if (findings.length === 0) {
    lines.push(
      `### ✅ ReuseCheck: no duplicates found`,
      '',
      `Checked ${opts.checked} new or changed function${opts.checked === 1 ? '' : 's'} against the rest of the repo (threshold ${pct(opts.threshold)}).`,
    );
    return lines.join('\n');
  }
  const n = findings.length;
  lines.push(
    `### 🔁 ReuseCheck: ${n} new function${n === 1 ? '' : 's'} look${n === 1 ? 's' : ''} like code you already have`,
    '',
    'Before adding a second copy, check if the existing one can be reused or extended.',
    '',
    '| New in this PR | Looks like | Match | Why |',
    '|---|---|---|---|',
  );
  for (const f of findings) {
    f.matches.forEach((m, i) => {
      const left = i === 0 ? `\`${f.unit.name}\` (${kindLabel(f.unit)})<br>${link(f.unit)}` : '↳';
      lines.push(`| ${left} | \`${m.other.name}\`<br>${link(m.other)} | **${pct(m.score)}** | ${why(m)} |`);
    });
  }
  lines.push(
    '',
    `<sub>Checked ${opts.checked} new or changed function${opts.checked === 1 ? '' : 's'}. Threshold ${pct(opts.threshold)}. ` +
      'Not a real duplicate? Raise `threshold` or add the path to `ignore` in `.reusecheck.json`.</sub>',
  );
  return lines.join('\n');
}

export function textReport(findings: Finding[], checked: number): string {
  if (findings.length === 0) return `ReuseCheck: no duplicates found (${checked} new or changed functions checked).`;
  const out = [`ReuseCheck: ${findings.length} new function(s) look like existing code\n`];
  for (const f of findings) {
    out.push(`${f.unit.name} (${kindLabel(f.unit)})  ${f.unit.file}:${f.unit.line}`);
    for (const m of f.matches) out.push(`  ${pct(m.score).padStart(4)}  ${m.other.name}  ${m.other.file}:${m.other.line}  ${why(m).replace(/`/g, '')}`);
    out.push('');
  }
  return out.join('\n');
}

export function groupsText(groups: Group[]): string {
  if (groups.length === 0) return 'ReuseCheck scan: no duplicate groups found.';
  const out = [`ReuseCheck scan: ${groups.length} group(s) of look-alike code\n`];
  groups.forEach((g, i) => {
    out.push(`#${i + 1}  ${g.units.length} copies, at least ${pct(g.score)} alike`);
    for (const u of g.units) out.push(`  ${u.name}  ${u.file}:${u.line}`);
    out.push('');
  });
  return out.join('\n');
}

export function toJson(findings: Finding[]): unknown {
  const ref = (u: Unit) => ({ name: u.name, kind: u.kind, file: u.file, line: u.line, endLine: u.endLine });
  return findings.map((f) => ({
    unit: ref(f.unit),
    matches: f.matches.map((m) => ({
      ...ref(m.other),
      score: Number(m.score.toFixed(3)),
      structure: Number(m.structure.toFixed(3)),
      api: Number(m.api.toFixed(3)),
      identical: m.identical,
      sharedApis: m.sharedApis,
    })),
  }));
}
