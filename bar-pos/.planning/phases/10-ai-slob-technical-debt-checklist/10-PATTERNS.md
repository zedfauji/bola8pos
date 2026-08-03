# Phase 10: AI Slob Technical Debt Checklist - Pattern Map

**Mapped:** 2026-08-03
**Files analyzed:** 5 (3 new tool-config files, 1 orchestration script, 1 output doc) + `package.json` script wiring
**Analogs found:** 5 / 5

This phase is dev-tooling + documentation only — no application source files are created or modified. All "files" below are root-level config/scripts consumed by CLI tools, plus a plain markdown deliverable.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|---------------|
| `bar-pos/knip.json` | config | batch (static-analysis scan → JSON report) | `bar-pos/eslint.config.js` (ignore-list shape, path-alias awareness) | role-match |
| `bar-pos/.jscpd.json` | config | batch | `bar-pos/eslint.config.js` (ignore-list shape) | role-match |
| `bar-pos/.madgerc` (or CLI flags only, no file) | config | batch | `bar-pos/tsconfig.json` (`paths` alias block madge consumes via `--ts-config`) | role-match |
| `bar-pos/scripts/run-tech-debt-audit.sh` | utility (orchestration script) | batch | `bar-pos/scripts/seed-dev-data.ts` / `bar-pos/scripts/setup-dev-users.ts` (existing root-level `scripts/` CLI utilities invoked via `npm run`) | role-match |
| `package.json` `scripts` block | config | request-response (npm CLI dispatch) | existing `scripts` entries (`lint`, `typecheck`, `test`, `test:e2e`) | exact |
| `.planning/phases/10-.../10-CHECKLIST.md` | (n/a — output doc, not source) | transform (JSON reports → grouped markdown) | prior audit precedent: `.planning/phases/11-ai-slob-technical-debt-audit-remediation/11-02-SUMMARY.md` et al. | role-match |

No `.gitignore` entry currently exists for a scratch/report output directory — if the plan chooses a committed (not `/tmp`) scratch dir (e.g. `.audit-tmp/`), it needs one new `.gitignore` line (see Shared Patterns below).

## Pattern Assignments

### `bar-pos/knip.json`, `.jscpd.json`, `.madgerc` (config, batch)

**Analog:** `bar-pos/eslint.config.js` (lines 19-30) — the project's existing convention for a root-scoped ignore/ignore list that new tool configs should mirror so exclusions stay consistent across all static-analysis tools.

**Ignore-list pattern to copy** (`eslint.config.js` lines 19-30):
```javascript
export default tseslint.config({
  ignores: [
    'node_modules',
    'dist',
    'build',
    'target',
    'src-tauri',
    '*.config.ts',
    '*.config.js',
    'vite-env.d.ts',
    'src/shared/lib/supabase.types.ts',
  ],
}, ...)
```
Apply the same generated/vendor exclusions (`src-tauri`, `supabase.types.ts`, plus the newly-untracked `graphify-out/**` and `src/graphify-out/**` per RESEARCH.md Pitfall 5) to `knip.json`'s `ignore`, `.jscpd.json`'s `ignore`, and madge's `--exclude` regex — do not invent a separate exclusion philosophy per tool.

**Path-alias pattern to copy** (`tsconfig.json` lines 26-34):
```json
"paths": {
  "@app/*": ["./src/app/*"],
  "@pages/*": ["./src/pages/*"],
  "@widgets/*": ["./src/widgets/*"],
  "@features/*": ["./src/features/*"],
  "@entities/*": ["./src/entities/*"],
  "@shared/*": ["./src/shared/*"]
}
```
madge's `--ts-config tsconfig.json` flag reads this directly (no separate alias file needed); knip's Vite/TS plugins resolve the same aliases automatically per RESEARCH.md Pattern 2 — no config duplication required in `knip.json` beyond `entry`/`project`/`ignore`.

**FSD boundary pattern to reference for triage, not copy verbatim** (`eslint.config.js` lines 70-77, 109-140):
```javascript
'boundaries/elements': [
  { type: 'app', pattern: 'src/app/**' },
  { type: 'pages', pattern: 'src/pages/**' },
  { type: 'widgets', pattern: 'src/widgets/**' },
  { type: 'features', pattern: 'src/features/**' },
  { type: 'entities', pattern: 'src/entities/**' },
  { type: 'shared', pattern: 'src/shared/**' },
],
```
When writing CHECKLIST.md, classify madge circular-dependency findings against this same layer list (per RESEARCH.md Pitfall 2: same-slice cycle = Low, cross-layer cycle = Blocking) — this is the authoritative layer definition already enforced by `boundaries/dependencies` (lines 109-140), don't redefine layer names independently.

---

### `bar-pos/scripts/run-tech-debt-audit.sh` (utility, batch orchestration)

**Analog:** existing root-level `scripts/` npm-invoked utilities, e.g. `scripts/seed-dev-data.ts` (invoked via `"seed:dev": "npx tsx scripts/seed-dev-data.ts"` in `package.json` line 26) and `scripts/setup-dev-users.ts` — both are standalone CLI scripts wired into `package.json` `scripts`, run via `npx`/`npm run`, not imported by application code.

**Pattern to copy — npm script wiring convention** (`package.json` lines 25-27):
```json
"setup:dev-users": "npx tsx scripts/setup-dev-users.ts",
"seed:dev": "npx tsx scripts/seed-dev-data.ts",
"setup:dev": "npm run setup:dev-users && npm run seed:dev",
```
Follow this exact shape for wiring the new audit script: a single `npm run` entry point (e.g. `"audit:tech-debt": "bash scripts/run-tech-debt-audit.sh"`) rather than inlining the 7-tool pipeline directly in `package.json`'s `scripts` string (keeps the orchestration logic in a readable `.sh` file, matching how `seed:dev`/`setup:dev-users` keep logic in `.ts` files, not inline npm script strings).

**Exit-code handling pattern (novel to this phase, not present elsewhere in the codebase):** every existing `npm run` script (`lint`, `typecheck`, `test`) is designed to propagate a non-zero exit as a real failure. This new script is the first place in the repo where non-zero exit from a subprocess is *expected and must be swallowed* (RESEARCH.md Pattern 1) — use `set -uo pipefail` (NOT `-e`) and `|| true` per-command, exactly as shown in RESEARCH.md's orchestration skeleton (RESEARCH.md lines 256-274). There is no existing analog for this in the codebase; this is genuinely new because every other script here treats tool failure as build failure.

---

### `10-CHECKLIST.md` (output doc, transform: JSON reports → severity-grouped markdown)

**Analog:** `.planning/phases/11-ai-slob-technical-debt-audit-remediation/11-02-SUMMARY.md` / `11-03-SUMMARY.md` / `11-04-SUMMARY.md` — prior-cycle precedent for what categories of findings this project has previously called "AI slob" and how they were reported back (typed agent queries, lint/test green baseline, CI pipeline, CVE risk docs). Read these for tone/structure precedent only; do not copy their exact heading names since D-06 requires a different structure (severity-first, category-nested) than whatever those summaries used.

**Structure to use (per CONTEXT.md D-06, not from an existing file — this is a new document shape):**
```markdown
## Blocking
### lint
- ...
### typecheck
- ...
### unit test
### e2e
### knip
### jscpd
### madge

## High
### lint
...

## Medium
...

## Low
...
```
Each finding cites `file_path:line_number` (CONTEXT.md "Integration Points" convention, line 73) and cross-references matching entries in `.planning/todos/pending/*.md` inline where applicable (RESEARCH.md Pitfall 4).

## Shared Patterns

### Root-level ignore-list convention
**Source:** `eslint.config.js` lines 19-30
**Apply to:** `knip.json`, `.jscpd.json`, madge's `--exclude` flag
All three new tool configs must exclude the same generated/vendor surfaces the project already excludes from ESLint: `node_modules`, `dist`, `src-tauri`, `src/shared/lib/supabase.types.ts`, plus `graphify-out/**` and `src/graphify-out/**` (new, per RESEARCH.md Pitfall 5 — these are untracked but present in the working tree today).

### npm script wiring convention
**Source:** `package.json` lines 6-33 (existing `scripts` block)
**Apply to:** the new `audit:tech-debt` (or similarly named) script entry
One `npm run <name>` entry point per logical operation, delegating to a `scripts/*.sh` or `scripts/*.ts` file for anything beyond a single command — never inline multi-step pipelines as a single long `package.json` string.

### FSD layer definitions for triage
**Source:** `eslint.config.js` lines 70-77 (`boundaries/elements`)
**Apply to:** CHECKLIST.md's classification of madge circular-dependency findings and jscpd duplicate-code findings (same-slice vs cross-layer)
Reuse the exact 6-layer taxonomy (`app`/`pages`/`widgets`/`features`/`entities`/`shared`) already enforced by ESLint's `boundaries` plugin — this is the project's one authoritative definition of "layer," do not invent a second one for the audit checklist.

### Gitignore for scratch/report artifacts
**Source:** `.gitignore` (existing `lint_output*.txt`, `tsc_errors.txt` entries)
**Apply to:** wherever the 7 tool-report JSON files are written
The project already has precedent for gitignoring throwaway lint/tsc output files at the repo root (`lint_output*.txt`, `tsc_errors.txt`). If the plan chooses a committed-but-ignored scratch dir (e.g. `.audit-tmp/`) rather than `/tmp`, add one matching `.gitignore` line following this existing precedent rather than `/tmp`-only (which risks disappearing between shells/sessions on some setups — Claude's Discretion per RESEARCH.md).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Exit-code-swallowing (`|| true` / `set +e`) pattern in a shell script | utility | batch | No existing script in this repo treats subprocess non-zero exit as an expected, non-failure signal — every current `npm run` script (lint/typecheck/test) is failure-propagating by design. This phase introduces the first "expected non-zero exit" orchestration script; use RESEARCH.md's own skeleton (lines 256-274) directly as there's no in-repo precedent to point to instead. |

## Metadata

**Analog search scope:** repo root (`bar-pos/`) config files (`eslint.config.js`, `tsconfig.json`, `package.json`), `bar-pos/scripts/`, `bar-pos/eslint-rules/`, `.gitignore`, `.planning/phases/11-ai-slob-technical-debt-audit-remediation/`
**Files scanned:** `package.json`, `eslint.config.js`, `tsconfig.json`, `eslint-rules/no-ui-drift.js`, `.gitignore`
**Pattern extraction date:** 2026-08-03
