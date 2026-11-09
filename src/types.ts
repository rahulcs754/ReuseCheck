export type UnitKind = 'component' | 'hook' | 'function';

/** One function, hook, component or method found in a source file. */
export interface Unit {
  /** `file:line:name`, unique per repo. */
  id: string;
  file: string;
  name: string;
  kind: UnitKind;
  line: number;
  endLine: number;
  /** Normalized token stream (local names replaced, literals collapsed). */
  tokens: string[];
  /** Hashed shingles of `tokens`, used for order-aware similarity. */
  shingles: Set<string>;
  /** Count of each token, used for order-free similarity. */
  bag: Map<string, number>;
  /** APIs the unit uses: free identifiers, member names, JSX tags. */
  apis: Set<string>;
  /** Same value for units that are identical after renaming. */
  hash: string;
}

export interface Match {
  unit: Unit;
  other: Unit;
  /** 0..1 overall score. */
  score: number;
  /** 0..1 structure score (shingles + token bag). */
  structure: number;
  /** 0..1 overlap of used APIs. */
  api: number;
  /** True when both are the same code after renaming. */
  identical: boolean;
  sharedApis: string[];
}

export interface Options {
  /** 0..1, report pairs at or above this score. Default 0.8. */
  threshold: number;
  /** Skip units with fewer normalized tokens. Default 30. */
  minTokens: number;
  /** Glob patterns of files to skip. */
  ignore: string[];
  /** Also scan test files. Default false. */
  includeTests: boolean;
  /** Max matches shown per new unit. Default 3. */
  maxMatches: number;
}

export const DEFAULTS: Options = {
  threshold: 0.8,
  minTokens: 30,
  ignore: [],
  includeTests: false,
  maxMatches: 3,
};
