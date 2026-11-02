import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const DEMO = join(import.meta.dirname, '..', 'examples', 'demo');

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } });

/** A git repo with demo/base on `main` and demo/pr added on top in HEAD. */
export function demoRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'reusecheck-'));
  git(dir, 'init', '-q', '-b', 'main');
  cpSync(join(DEMO, 'base'), dir, { recursive: true });
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'base');
  git(dir, 'checkout', '-qb', 'feature');
  cpSync(join(DEMO, 'pr'), dir, { recursive: true });
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'pr');
  return dir;
}
