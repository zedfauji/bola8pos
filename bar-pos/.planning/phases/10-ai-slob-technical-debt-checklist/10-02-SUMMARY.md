---
phase: 10-ai-slob-technical-debt-checklist
plan: 02
subsystem: infra
tags: [knip, jscpd, madge, eslint, vitest, playwright, structural-smells, digests, tech-debt]

requires: [10-01]
provides:
  - "Three D-02 structural-smell probes (unjustified as-any, stale TODO/FIXME, oversized files) appended to scripts/run-tech-debt-audit.sh, all writing under $OUT with || true guards"
  - "One full whole-codebase audit run (D-01), all 11 expected reports present and parseable — 7 JSON + 4 text"
  - ".audit-tmp/digests/ — 11 compact per-category digests (exceeds the 10-category minimum), each stating an explicit total, small enough for Plan 03 to read in full without opening raw reports or source"
affects: [10-03]

actuals:
  tokens: n/a (orchestrator-completed after executor-agent resource exhaustion, see Deviations)
  tasks: 2
  commits: 1

tech-stack:
  patterns:
    - "Playwright's monolithic single-worker 374-test run was split into 59 per-spec-file invocations (one npx playwright test <file> --reporter=json per e2e/*.spec.ts), run sequentially, each writing its own JSON to .audit-tmp/e2e-per-spec/, then merged by a one-off node script into .audit-tmp/playwright-results.json (custom {stats, specFileSummaries, findings} shape — not Playwright's native aggregate-reporter schema, but valid JSON with equivalent finding-level data)"
    - "playwright.config.ts's three hardcoded headless:false sites were temporarily flipped to true for this run only (host desktop disruption), then git-checkout-reverted before this commit — the committed config is unchanged"

key-files:
  modified: []
  created: []

key-decisions:
  - "The plan's Task 2 precondition only anticipated a missing display/Chrome as a HALT condition; the actual failure mode encountered was the OS OOM-killing the monolithic single-worker Playwright run 4 times in a row within the first ~8 of 374 tests, under real desktop memory pressure (other apps/tabs, not a dedicated CI box). Root-caused via the detached run's log (`Killed` after 8 tests) rather than assumed. Fixed by splitting execution per spec file instead of retrying the same monolithic invocation — this is an execution-strategy change, not a script or plan change, so scripts/run-tech-debt-audit.sh's own logic (still one atomic `npx playwright test`) is untouched and will work correctly in a less memory-constrained environment."
    reversibility: "reversible — the split-and-merge approach is a one-off orchestration choice for this run, not committed to the repo; run-tech-debt-audit.sh itself is unchanged from Task 1"
  - "FAST_E2E=1 was tried once as a speed workaround by an earlier executor attempt and rejected: it measurably changed real test outcomes (a test that passed at normal speed failed instantly under FAST_E2E), so it is unsafe for audit findings and was not used in the run this digest reflects."
  - "vitest-results.json's one failure (queries.clock.test.ts, waitFor timeout, 2228ms) was captured during a concurrent multi-process audit run under the same host memory pressure that caused the Playwright OOMs. An isolated npm run test -- --run immediately after Wave 1's merge showed all 151 files / 1391 tests passing with 0 failures. Recorded as a finding per D-03 (tool output, not manual override) but flagged in the digest as likely a resource-contention flake pending isolated re-verification, not a confirmed regression."

deviations:
  - "Executor agent (gsd-executor, plan 10-02) burned 4 full-audit attempts and ~240K tokens without completing Task 2 — each attempt re-ran the entire audit:tech-debt script from scratch after the previous OOM kill, and the agent did not diagnose the OOM root cause on its own across the first 3 attempts. The orchestrator (this session) took over Task 2 directly after the 4th attempt, diagnosed the OOM via the attempt's own log output, and completed Task 2 using the split-per-spec-file approach after confirming it with the user (who also requested headless mode to stop disrupting their desktop)."

open-questions: []
---

# Plan 10-02 Summary

## What shipped

Task 1 (committed `fc0712a`): three structural-smell probes — `as-any.txt`, `todo-fixme.txt`, `file-sizes.txt` — appended to `scripts/run-tech-debt-audit.sh`, completing D-02's six-category coverage (dead code/unused deps via knip, duplication via jscpd, coupling via madge, `as any`/TODO-FIXME/oversized-files via the three new grep/wc probes).

Task 2 (no committed artifacts — `.audit-tmp/` is gitignored, per plan): one full whole-codebase audit executed. All 11 expected reports present and parse (7 JSON + 4 text). 11 digests written to `.audit-tmp/digests/`.

## Per-category totals (for Plan 03's reconciliation gate)

| Category | Digest file | Total |
|---|---|---|
| knip (default) | `knip-digest.txt` | 891 findings (files: 43, exports: 518, types: 273, deps: 10, devDeps: 10, unlisted: 34, duplicates: 3, unresolved: 0) |
| knip (production) | `knip-production-digest.txt` | 1102 findings (files: 63, exports: 685, deps: 11, + others) |
| jscpd | `jscpd-digest.txt` | 2657 clones, 41376 duplicated lines (10.22%) — **includes noise**: `.jscpd.json`'s ignore list doesn't yet exclude `.agents/skills/`, so many clones are vendored license/skill files, not app-code duplication (flagged in 10-01-SUMMARY.md, still unresolved) |
| madge | `madge-digest.txt` | 1 circular-dependency cycle (`entities/inventory/model/queries.ts` <-> `entities/inventory/model/store.ts`) |
| eslint | `eslint-digest.txt` | 0 (clean — 0 errors, 0 warnings) |
| typescript | `tsc-digest.txt` | 0 (clean) |
| vitest | `vitest-digest.txt` | 1406 total, 1390 passed, 1 failed (likely flake, see key-decisions), 15 todo |
| playwright (E2E) | `playwright-digest.txt` | 374 total across 59 spec files, 224 passed, 95 failed, 55 skipped |
| as-any probe | `as-any-digest.txt` | 144 occurrences |
| todo-fixme probe | `todo-fixme-digest.txt` | 9 occurrences |
| file-sizes probe | `file-sizes-digest.txt` | 741 files scanned, 73 over 300 lines |

## Deviations from the plan's literal Task 2 mechanics

The plan's `<action>` says "run `npm run audit:tech-debt` to completion" as one invocation. That failed 4 times via OS OOM-kill (not a script bug — confirmed via the failed run's own log, `Killed` after 8/374 Playwright tests, on a shared desktop with substantial other memory load). Per the user's direction, the E2E leg was instead run as 59 sequential `npx playwright test <spec-file> --reporter=json` invocations (headless, also per user request to stop disrupting their desktop — `playwright.config.ts`'s three `headless: false` sites were temporarily flipped for this run only and reverted via `git checkout` before this commit), each writing its own report, merged into `.audit-tmp/playwright-results.json` by a one-off script. The other 6 report categories + 3 probes ran via the unmodified `npm run audit:tech-debt` script and are untouched. `scripts/run-tech-debt-audit.sh` itself still contains one atomic `npx playwright test` invocation (Task 1's committed state) — this deviation was purely in how *this run* was executed, not a change to the committed script.

## For Plan 03

Read only `.audit-tmp/digests/*.txt` (11 files) — do not open `.audit-tmp/*.json` raw reports or any `src/` source file. `playwright-results.json` and `playwright-digest.txt` are non-standard structures unique to this run's merge script (documented in tech-stack above); their finding format (`file:line [status] title`) is compatible with what Plan 03 needs.
