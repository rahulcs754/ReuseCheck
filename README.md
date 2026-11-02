# ReuseCheck

**Stop AI agents from rewriting code you already have.** ReuseCheck is a GitHub Action and CLI. On each PR it finds new functions, hooks and components that look like code already in your repo, even when the names and the line order changed, and tells the author what to reuse.

[![CI](https://github.com/rahulcs754/reusecheck/actions/workflows/ci.yml/badge.svg)](https://github.com/rahulcs754/reusecheck/actions/workflows/ci.yml)
· [Website + live demo](https://rahulcs754.github.io/reusecheck/)

## Benefits
- **Catches renamed rewrites.** Copy-paste tools (jscpd, CPD) match token runs, so a rewrite with new names slips through. ReuseCheck compares structure after renaming every local variable.
- **Only checks what the PR adds.** Old duplicates don't spam every PR. A function counts as new when most of its lines were added.
- **Tells you what to reuse.** Each match links to the existing function, with the score and why (same structure, both use `useState`, `setTimeout`...).
- **React aware.** Hooks, components (incl. `memo` / `forwardRef`), class and object methods. Components are only compared with components.
- **No AI, no server.** Babel AST + plain math. Fast, free, the same answer every time, and no code leaves CI.

## What the PR comment looks like
From the [demo](examples/demo): an agent added a search feature and rewrote three helpers that already existed.

> ### 🔁 ReuseCheck: 3 new functions look like code you already have
>
> | New in this PR | Looks like | Match | Why |
> |---|---|---|---|
> | `useDebouncedValue` (hook)<br>`src/features/search/useDebouncedValue.ts:4` | `useDebounce`<br>`src/hooks/useDebounce.ts:4` | **100%** | Same code after renaming; both use `clearTimeout`, `setTimeout`, `useEffect`, `useState` |
> | `Loader` (component)<br>`src/components/Loader.tsx:6` | `Spinner`<br>`src/components/Spinner.tsx:3` | **94%** | Structure 91% alike after renaming; both use `<circle>`, `<div>`, `<span>`, `<svg>`, `@aria-live`, `@className` +9 |
> | `toDisplayDate` (function)<br>`src/lib/dates.ts:3` | `formatDate`<br>`src/utils/formatDate.ts:4` | **84%** | Structure 88% alike after renaming; both use `.getDate`, `.getFullYear`, `.getMonth`, `.getTime`, `.isNaN`, `Date` |

The new `searchProducts` and `CartTotal` are real new code, so they are not reported.

## How to use it

### 1. Add the workflow
Create `.github/workflows/reusecheck.yml` (also in [examples/workflow](examples/workflow/reusecheck.yml)):
```yaml
name: ReuseCheck
on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write

jobs:
  reusecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0   # needed to diff against the base branch
      - uses: rahulcs754/reusecheck@main
        with:
          fail-on-duplicate: false   # set true to block the merge
```

### 2. Open a PR
ReuseCheck posts one comment when it finds a duplicate, and updates the same comment on each push. The report is also in the job summary.

### Action inputs
| Input | Default | What it does |
|---|---|---|
| `threshold` | `0.8` | Report matches at or above this score (0-1 or 1-100). |
| `comment` | `true` | Post or update one PR comment. |
| `comment-on` | `duplicate` | `duplicate` = only comment when something is found. `always` = also post "no duplicates". |
| `fail-on-duplicate` | `false` | Fail the check when a duplicate is found. |
| `include-tests` | `false` | Also check test and story files. |
| `base` | PR base | Git ref to diff against. |
| `working-directory` | `.` | Folder to run in (monorepos). |

### Config file (optional)
Put `.reusecheck.json` in the repo root ([example](examples/reusecheck.json)):
```json
{
  "threshold": 0.8,
  "minTokens": 30,
  "ignore": ["src/legacy/**", "**/*.generated.ts"],
  "includeTests": false,
  "maxMatches": 3
}
```
`node_modules`, `dist`, `build`, `.next`, `coverage`, `*.d.ts`, generated and minified files are always skipped.

## CLI
Needs Node 20+.
```bash
# PR mode: new code in HEAD vs the base branch
npx github:rahulcs754/reusecheck --base origin/main

# Whole repo: list groups of look-alike code (good for a first cleanup)
npx github:rahulcs754/reusecheck scan

# Options
--threshold 0.85   --min-tokens 30   --include-tests   --ignore "src/legacy/**"
--json             --markdown        --fail-on-duplicate
```

## How it works
1. **Parse** each `.js .jsx .ts .tsx .mjs .cjs` file with `@babel/parser`.
2. **Extract units**: function declarations, `const x = () => {}`, `memo(...)`/`forwardRef(...)` wrappers, class and object methods. Names starting with `use` are hooks; capitalized names that return JSX are components. Nested functions belong to their parent.
3. **Normalize**: every local name becomes `$`, strings/numbers become `STR`/`NUM`, TypeScript types and comments are dropped, and `() => x` equals `() => { return x; }`. Operators and called APIs stay.
4. **Score**: 70% structure (Jaccard of 5-token shingles, plus an order-free token count) + 30% overlap of used APIs. Identical after renaming = 100%.
5. **Report** pairs at or above the threshold, best match first, max 3 per new unit.

## Limits (v0.1)
- JS/TS only. Python and Go are planned.
- It finds code that is *built* the same way. Two functions that do the same job in a totally different way (a loop vs `reduce`) are not matched yet; an optional embeddings mode is planned for that.
- Very small functions (under 30 normalized tokens) are skipped to avoid noise.

## Develop
```bash
npm ci
npm test          # vitest
npm run typecheck
npm run build     # dist/cli.js + docs/reusecheck.js (commit both)
```
Enable the repo guard hook once: `git config core.hooksPath .githooks`.

## License
MIT
