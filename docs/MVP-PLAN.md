# ReuseCheck: MVP plan

Goal: a GitHub Action + CLI that comments on a PR when new code duplicates code that already exists in the repo.

## Scope (v0.1)
- [x] Parse `.js .jsx .ts .tsx .mjs .cjs` with `@babel/parser` (TS + JSX).
- [x] Extract units: function declarations, `const x = () => {}` / function expressions, class methods, object methods. Tag each as component, hook or function.
- [x] Normalize: rename local bindings to placeholders, collapse literals, keep called APIs and member names.
- [x] Score pairs: structure (token shingle Jaccard) + API overlap. Skip tiny units (min token count).
- [x] PR mode: find units whose lines are mostly added in `git diff base...HEAD`, compare with every other unit in the repo.
- [x] Scan mode: `reusecheck scan` lists duplicate groups across the whole repo.
- [x] Output: Markdown PR comment (one comment, updated in place), text for terminal, `--json`.
- [x] Config: `.reusecheck.json` (threshold, minTokens, ignore globs, includeTests).
- [x] Action: `action.yml`, inputs threshold, fail-on-duplicate, comment.
- [x] Tests with a demo repo fixture (renamed rewrite of a hook and a util).
- [x] GitHub Pages site with a "paste two functions" demo.

## Later
- Embeddings mode for semantic matches.
- Suggest the import line for the existing function.
- Python / Go support.
