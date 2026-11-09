import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULTS, type Options } from './types.js';

export const CONFIG_FILE = '.reusecheck.json';

/** Defaults, then `.reusecheck.json`, then CLI overrides. */
export function loadOptions(root: string, overrides: Partial<Options> = {}): Options {
  let file: Partial<Options> = {};
  const path = join(root, CONFIG_FILE);
  if (existsSync(path)) {
    try {
      file = JSON.parse(readFileSync(path, 'utf8')) as Partial<Options>;
    } catch (err) {
      throw new Error(`Could not read ${CONFIG_FILE}: ${(err as Error).message}`);
    }
  }
  const merged = { ...DEFAULTS, ...file, ...Object.fromEntries(Object.entries(overrides).filter(([, v]) => v !== undefined)) } as Options;
  if (merged.threshold > 1) merged.threshold = merged.threshold / 100; // allow 80 as well as 0.8
  if (!(merged.threshold > 0 && merged.threshold <= 1)) throw new Error('threshold must be between 0 and 1 (or 1-100)');
  return merged;
}
