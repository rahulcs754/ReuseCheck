// Powers the "Try it" box on the GitHub Pages site. Runs fully in the browser.
import { findReuse, unitsOf } from './check.js';
import { compare } from './similarity.js';
import { why } from './report.js';
import { DEFAULTS } from './types.js';

export interface PairResult {
  a: string;
  b: string;
  score: number;
  structure: number;
  api: number;
  identical: boolean;
  why: string;
}

/** Compare every function in snippet A (new code) with every function in snippet B (existing code). */
export function compareSnippets(newCode: string, existingCode: string): { pairs: PairResult[]; error?: string } {
  const a = unitsOf([{ file: 'new.tsx', code: newCode }], 1);
  const b = unitsOf([{ file: 'existing.tsx', code: existingCode }], 1);
  if (!a.length || !b.length) return { pairs: [], error: 'Could not find a function in one of the boxes (or it did not parse).' };
  const pairs: PairResult[] = [];
  for (const x of a) for (const y of b) {
    const m = compare(x, y);
    pairs.push({ a: x.name, b: y.name, score: m.score, structure: m.structure, api: m.api, identical: m.identical, why: why(m).replace(/`/g, '') });
  }
  return { pairs: pairs.sort((p, q) => q.score - p.score) };
}

export { findReuse, unitsOf, DEFAULTS };
