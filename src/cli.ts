import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { findGroups, findReuse, newUnits, unitsOf } from './check.js';
import { loadOptions } from './config.js';
import { addedLines, gitDiff } from './diff.js';
import { isMinified, listSourceFiles, readSource } from './files.js';
import { prContext, upsertComment } from './github.js';
import { githubLinker, groupsText, markdownReport, textReport, toJson } from './report.js';

const HELP = `reusecheck: find new code that duplicates code you already have

Usage:
  reusecheck [--base <ref>] [options]   check new functions in HEAD vs base (PR mode)
  reusecheck scan [options]             list look-alike code across the whole repo

Options:
  --base <ref>          git ref to diff against (default: origin/<PR base> or origin/main)
  --threshold <n>       report matches at or above this score, 0-1 or 1-100 (default 0.8)
  --min-tokens <n>      skip functions smaller than this (default 30)
  --include-tests       also check test and story files
  --ignore <glob>       skip files matching glob (repeatable)
  --dir <path>          repo folder (default: current folder)
  --json                print JSON
  --markdown            print the PR comment Markdown
  --comment             post or update one PR comment (GitHub Actions)
  --comment-on <when>   "duplicate" (only when found, default) or "always"
  --fail-on-duplicate   exit 1 when duplicates are found
  -h, --help            show this help
`;

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      base: { type: 'string' },
      threshold: { type: 'string' },
      'min-tokens': { type: 'string' },
      'include-tests': { type: 'boolean' },
      ignore: { type: 'string', multiple: true },
      dir: { type: 'string' },
      json: { type: 'boolean' },
      markdown: { type: 'boolean' },
      comment: { type: 'boolean' },
      'comment-on': { type: 'string', default: 'duplicate' },
      'fail-on-duplicate': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    process.stdout.write(HELP);
    return 0;
  }
  const root = resolve(values.dir ?? '.');
  const cliIgnore = values.ignore ?? [];
  const opts = loadOptions(root, {
    threshold: values.threshold ? Number(values.threshold) : undefined,
    minTokens: values['min-tokens'] ? Number(values['min-tokens']) : undefined,
    includeTests: values['include-tests'] || undefined,
  });
  opts.ignore = [...opts.ignore, ...cliIgnore];

  const files = listSourceFiles(root, opts.ignore, opts.includeTests)
    .map((file) => ({ file, code: readSource(root, file) }))
    .filter((f) => !isMinified(f.code));
  const all = unitsOf(files, opts.minTokens);

  if (positionals[0] === 'scan') {
    const groups = findGroups(all, opts);
    if (values.json) {
      const out = groups.map((g) => ({ score: Number(g.score.toFixed(3)), units: g.units.map((u) => ({ name: u.name, kind: u.kind, file: u.file, line: u.line })) }));
      process.stdout.write(JSON.stringify(out, null, 2) + '\n');
    } else process.stdout.write(groupsText(groups) + '\n');
    return values['fail-on-duplicate'] && groups.length ? 1 : 0;
  }
  if (positionals.length) throw new Error(`Unknown command: ${positionals[0]}. Try --help.`);

  const pr = prContext();
  const base = values.base ?? (pr?.baseRef ? `origin/${pr.baseRef}` : 'origin/main');
  const fresh = newUnits(all, addedLines(gitDiff(base, root)));
  const findings = findReuse(all, fresh, opts);

  if (values.json) process.stdout.write(JSON.stringify(toJson(findings), null, 2) + '\n');
  else process.stdout.write(textReport(findings, fresh.length) + '\n');

  const repo = process.env.GITHUB_REPOSITORY;
  const link = pr?.headSha && repo ? githubLinker(pr.serverUrl, repo, pr.headSha) : undefined;
  const md = markdownReport(findings, { link, checked: fresh.length, threshold: opts.threshold });
  if (values.markdown) process.stdout.write(md + '\n');
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');

  if (values.comment) {
    const token = process.env.GITHUB_TOKEN;
    if (!pr) console.error('reusecheck: --comment needs a pull_request event; skipping comment.');
    else if (!token) console.error('reusecheck: GITHUB_TOKEN is not set; skipping comment.');
    else {
      try {
        const create = findings.length > 0 || values['comment-on'] === 'always';
        const res = await upsertComment(token, pr, md, create);
        console.error(`reusecheck: PR comment ${res}.`);
      } catch (err) {
        console.error(`reusecheck: could not post comment: ${(err as Error).message} (does the workflow have pull-requests: write?)`);
      }
    }
  }
  return values['fail-on-duplicate'] && findings.length ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(`reusecheck: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(2);
  },
);
