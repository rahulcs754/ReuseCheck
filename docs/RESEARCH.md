# ReuseCheck: research notes

## The problem
- AI coding agents write new code fast, but they rarely search the repo first. They write a second `formatDate`, a second `useDebounce`, a second `<Spinner>`, with new names and a slightly different shape.
- Each copy is fine alone. Together they make the codebase bigger, bugs get fixed in one copy and not the others, and new people do not know which one to use.
- Reviewers miss it, because the duplicate lives in a file the PR did not touch.

## Why current tools miss it
- Copy-paste detectors (jscpd, PMD CPD, SonarQube duplication) compare token runs. They catch copy-paste, but a rewrite with new variable names and a different order of lines slips through.
- Linters check one file at a time. They do not compare new code with the rest of the repo.
- AI review bots sometimes notice it, but not reliably, and they cost money per PR.

## The gap
A PR check that looks only at **new** functions, hooks and components in the PR, compares each one with the code already in the repo **after normalizing names**, and says: "this looks like `useDebounce` in `src/hooks/useDebounce.ts`, reuse that instead".

## Approach
1. Parse JS/TS/JSX with an AST parser.
2. Pull out units: functions, arrow functions, class methods, React components, hooks.
3. Normalize each unit: local names become placeholders (`$1`, `$2`), literals become their type, but the APIs it calls (`useState`, `fetch`, `.map`) stay.
4. Compare structure (shingles of the normalized token stream) and API usage (set of calls). Score 0 to 100%.
5. Report only pairs where one side is new in the PR.

Later: optional embeddings for "same job, different code" matches.
