# ReuseCheck: MVP plan

Goal: a GitHub Action + CLI that comments on a PR when new code duplicates code that already exists in the repo.

## Scope (v0.1)
- [ ] Parse `.js .jsx .ts .tsx .mjs .cjs` with `@babel/parser` (TS + JSX).
- [ ] Extract units: function declarations, `const x = () => {}` / function expressions, class methods, object methods. Tag each as component, hook or function.
- [ ] Normalize: rename local bindings to placeholders, collapse literals, keep called APIs and member names.
- [ ] Score pairs: structure (token shingle Jaccard) + API overlap. Skip tiny units (min token count).
- [ ] PR mode: find units whose lines are mostly added in `git diff base...HEAD`, compare with every other unit in the repo.
- [ ] Scan mode: `reusecheck scan` lists duplicate groups across the whole repo.
- [ ] Output: Markdown PR comment (one comment, updated in place), text for terminal, `--json`.
- [ ] Config: `.reusecheck.json` (threshold, minTokens, ignore globs, includeTests).
- [ ] Action: `action.yml`, inputs threshold, fail-on-duplicate, comment.
- [ ] Tests with a demo repo fixture (renamed rewrite of a hook and a util).
- [ ] GitHub Pages site with a "paste two functions" demo.

## Later
- Embeddings mode for semantic matches.
- Suggest the import line for the existing function.
- Python / Go support.
