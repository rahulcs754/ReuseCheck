import { execFileSync } from 'node:child_process';

/** Lines added per file (new-side line numbers), from a unified diff. */
export function addedLines(diff: string): Map<string, Set<number>> {
  const out = new Map<string, Set<number>>();
  let file: string | undefined;
  let line = 0;
  for (const raw of diff.split('\n')) {
    if (raw.startsWith('+++ ')) {
      const path = raw.slice(4).trim();
      file = path === '/dev/null' ? undefined : path.replace(/^b\//, '');
      if (file && !out.has(file)) out.set(file, new Set());
      continue;
    }
    if (raw.startsWith('--- ')) continue;
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (hunk) {
      line = Number(hunk[1]);
      continue;
    }
    if (!file) continue;
    if (raw.startsWith('+')) {
      out.get(file)!.add(line);
      line++;
    } else if (raw.startsWith(' ')) {
      line++;
    }
  }
  return out;
}

export function gitDiff(base: string, cwd = process.cwd()): string {
  return execFileSync('git', ['diff', '--no-color', '--no-ext-diff', '-M', '--unified=0', `${base}...HEAD`], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
}

/** Tracked files (respects .gitignore), or undefined outside a git repo. */
export function gitFiles(cwd = process.cwd()): string[] | undefined {
  try {
    const out = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
      cwd,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.split('\0').filter(Boolean);
  } catch {
    return undefined;
  }
}
