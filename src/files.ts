import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import picomatch from 'picomatch';
import { gitFiles } from './diff.js';
import { SOURCE_EXT } from './parse.js';

const DEFAULT_IGNORE = [
  '**/node_modules/**', '**/dist/**', '**/build/**', '**/out/**', '**/.next/**', '**/coverage/**',
  '**/vendor/**', '**/*.min.js', '**/*.d.ts', '**/*.bundle.js', '**/generated/**', '**/__generated__/**',
];
const TEST_GLOBS = ['**/*.{test,spec}.*', '**/__tests__/**', '**/test/**', '**/tests/**', '**/e2e/**', '**/*.stories.*'];
const MAX_BYTES = 512 * 1024;

function walk(root: string, dir = root, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(root, full, out);
    else if (entry.isFile()) out.push(relative(root, full).split(sep).join('/'));
  }
  return out;
}

export function makeFilter(ignore: string[], includeTests: boolean): (file: string) => boolean {
  const skip = picomatch([...DEFAULT_IGNORE, ...(includeTests ? [] : TEST_GLOBS), ...ignore], { dot: true });
  return (file) => SOURCE_EXT.test(file) && !skip(file);
}

/** Source files to scan, relative to `root`, with forward slashes. */
export function listSourceFiles(root: string, ignore: string[], includeTests: boolean): string[] {
  const keep = makeFilter(ignore, includeTests);
  const tracked = gitFiles(root);
  const all = tracked && tracked.length ? tracked : walk(root);
  return all.filter((f) => {
    if (!keep(f)) return false;
    try {
      return statSync(join(root, f)).size <= MAX_BYTES;
    } catch {
      return false; // deleted but still in the index
    }
  });
}

/** Bundled or minified output: long lines, few of them. Not worth comparing. */
export function isMinified(code: string): boolean {
  if (code.length < 2000) return false;
  const lines = code.split('\n');
  return code.length / lines.length > 250 || lines.some((l) => l.length > 3000);
}

export function readSource(root: string, file: string): string {
  return readFileSync(join(root, file), 'utf8');
}
