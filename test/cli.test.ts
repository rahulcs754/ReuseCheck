import { execFileSync, spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { demoRepo } from './helpers.js';

const CLI = join(import.meta.dirname, '..', 'src', 'cli.ts');
const TSX = join(import.meta.dirname, '..', 'node_modules', '.bin', 'tsx');
const env = { ...process.env, GITHUB_EVENT_PATH: '', GITHUB_STEP_SUMMARY: '' };
const run = (cwd: string, ...args: string[]) => spawnSync(TSX, [CLI, ...args], { cwd, encoding: 'utf8', env });

let repo: string;
beforeAll(() => {
  repo = demoRepo();
});

describe('cli', () => {
  it('PR mode finds the three rewrites and nothing else', () => {
    const res = run(repo, '--base', 'main', '--json');
    expect(res.status).toBe(0);
    const findings = JSON.parse(res.stdout) as Array<{ unit: { name: string }; matches: Array<{ name: string; file: string }> }>;
    expect(findings.map((f) => [f.unit.name, f.matches[0]!.name]).sort()).toEqual([
      ['Loader', 'Spinner'],
      ['toDisplayDate', 'formatDate'],
      ['useDebouncedValue', 'useDebounce'],
    ]);
  });

  it('--fail-on-duplicate exits 1, and a high threshold finds less', () => {
    expect(run(repo, '--base', 'main', '--fail-on-duplicate').status).toBe(1);
    const strict = run(repo, '--base', 'main', '--threshold', '99', '--json');
    expect((JSON.parse(strict.stdout) as unknown[]).length).toBe(1); // only the identical hook
  });

  it('reads .reusecheck.json ignore globs', () => {
    writeFileSync(join(repo, '.reusecheck.json'), JSON.stringify({ ignore: ['src/components/**'] }));
    const res = run(repo, '--base', 'main', '--json');
    const names = (JSON.parse(res.stdout) as Array<{ unit: { name: string } }>).map((f) => f.unit.name);
    expect(names).not.toContain('Loader');
    execFileSync('rm', [join(repo, '.reusecheck.json')]);
  });

  it('prints the PR comment Markdown', () => {
    const res = run(repo, '--base', 'main', '--markdown');
    expect(res.stdout).toContain('<!-- reusecheck -->');
    expect(res.stdout).toContain('3 new functions look like code you already have');
  });

  it('scan mode lists groups', () => {
    const res = run(repo, 'scan');
    expect(res.stdout).toContain('3 group(s)');
  });
});
