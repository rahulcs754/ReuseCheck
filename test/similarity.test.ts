import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findGroups, unitsOf } from '../src/check.js';
import { compare } from '../src/similarity.js';
import { DEFAULTS } from '../src/types.js';
import { DEMO } from './helpers.js';

const walk = (d: string): string[] =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
const units = unitsOf(walk(DEMO).map((f) => ({ file: relative(DEMO, f), code: readFileSync(f, 'utf8') })), 1);
const get = (name: string) => units.find((u) => u.name === name)!;

describe('similarity on the demo', () => {
  it.each([
    ['useDebouncedValue', 'useDebounce'],
    ['toDisplayDate', 'formatDate'],
    ['Loader', 'Spinner'],
  ])('%s looks like %s', (a, b) => {
    expect(compare(get(a), get(b)).score).toBeGreaterThanOrEqual(0.8);
  });

  it('keeps unrelated code apart', () => {
    for (let i = 0; i < units.length; i++) {
      for (let j = i + 1; j < units.length; j++) {
        const pair = [units[i]!.name, units[j]!.name].sort().join('|');
        if (['Loader|Spinner', 'useDebounce|useDebouncedValue', 'formatDate|toDisplayDate'].includes(pair)) continue;
        expect(compare(units[i]!, units[j]!).score, pair).toBeLessThan(0.6);
      }
    }
  });

  it('scan mode groups the three copies', () => {
    const groups = findGroups(units.filter((u) => u.tokens.length >= 30), DEFAULTS);
    expect(groups.map((g) => g.units.map((u) => u.name).sort())).toEqual(
      expect.arrayContaining([['Loader', 'Spinner'], ['useDebounce', 'useDebouncedValue'], ['formatDate', 'toDisplayDate']]),
    );
    expect(groups).toHaveLength(3);
  });
});
