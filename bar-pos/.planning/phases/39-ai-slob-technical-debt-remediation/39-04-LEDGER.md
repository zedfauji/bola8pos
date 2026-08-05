# 39-04 Triage Ledger — e2e specs 01, 02(routed), 03, 04, 06, 07, 09, 10, 11, 13, 14

**Plan:** 39-04 (Track A — E2E triage, specs 01 through 14)
**Method:** D-04 — real per-test error output, read from `.audit-tmp/e2e-per-spec/<spec>.json`
(regenerated same-day audit snapshot) and, where a fix or un-skip decision was made, a live
`npm run test:e2e -- e2e/<spec>.spec.ts -g "<title>"` re-run in this worktree — not
10-CHECKLIST.md's digest titles. Row format inherited verbatim from 39-02-LEDGER.md.

## Environment setup note (methodology transparency)

This worktree started with no `node_modules` and no `bar-pos/.env.local` (both gitignored,
worktree-local, don't carry over — documented gap from 39-01-LEDGER.md/39-03-SUMMARY.md).
Provisioned both as symlinks to the main checkout's copies (same machine/user/project
credentials; neither committed, both already `.gitignore`-excluded): `node_modules` and
`.env.local`. A third, unrelated environment gap surfaced and was worked around during this
plan, documented in full below ("Environment blocker" section) since it materially affects how
much of this ledger's live-verification claims should be trusted.

## Environment blocker: Playwright browser launch initially failed in this worktree

Before any live re-run was possible, `npx playwright test <any spec requesting `page`>` failed
100% of the time with:

```
Error: browserType.launch: Executable doesn't exist at
/home/widowsvail/.cache/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-linux64/chrome-headless-shell
```

Root-caused (not a worktree-specific issue — reproduced identically from the main checkout at
`/mnt/ai/bola8pos-kiro/bar-pos` too): `@playwright/test`'s test-runner performs a stricter
browser-availability validation than `playwright-core`'s own `chromium.launch()` (verified via a
standalone `chromium.launch({ channel: 'chrome', headless: false })` script, which succeeded
immediately, `Google Chrome 150.0.7871.186`). The validation appears to require the
`chromium-headless-shell` revision pinned by the installed `@playwright/test@1.59.1` (revision
`1217`), which was not present — only revision `1234` was cached, and `npx playwright install`
itself fails outright on this host (`ERROR: Playwright does not support chromium on
ubuntu26.04-x64`). Worked around by symlinking the cached `chromium_headless_shell-1234` directory
to the expected `chromium_headless_shell-1217` path (a local, machine-only cache trick — no repo
files touched, does not affect the actual browser used for tests, which is `channel: 'chrome'`
per `playwright.config.ts`, i.e. the same system Google Chrome CLAUDE.md's Ubuntu dev notes
already document as required). Also required running via `npm run test:e2e --prefix
<worktree>/bar-pos -- <args>` rather than `npx playwright test` directly — the latter did not
reliably resolve `bar-pos/playwright.config.ts`'s own working directory (e.g. `dotenv`'s
`.env.local` resolution silently failed, reporting all `E2E_*` keys "missing" even though they
were present) from outside `bar-pos/`; `npm run` with `--prefix` reliably sets cwd for the
underlying script the way `npm run typecheck --prefix` already did successfully.

Once resolved, every live re-run in this ledger ran the real app against the live remote
Supabase project through a real (`headless: false`, `channel: 'chrome'`) browser — the same
setup CLAUDE.md documents as this repo's standard E2E execution path. No test outcome in this
ledger is inferred from a broken/skipped browser session.

## Task 1 — Route the 11 confirmed Phase 38 findings

No investigation performed on these 11 per D-05 — routing is the entire action. Root causes
(from 10-CHECKLIST.md's "Cross-check against existing trackers" Phase 38 row) restated for
context only, not re-derived:

| Spec Location | Test | Error Excerpt (from `error.message`, not title) | Root-Cause Group | Classification | Evidence | Action |
|---|---|---|---|---|---|---|
| e2e/02-caja.spec.ts:61 | Manager closes caja | (not opened — D-05 exempts re-triage) | Phase 38 item 1 — test-DB pollution (`OPEN_TABS_EXIST` from a stale prior-run caja) | infra | 10-CHECKLIST.md "Cross-check against existing trackers" Phase 38 row names this exact spec:line and root cause | ROUTED TO PHASE 38. No code change. |
| e2e/04-pool-timer.spec.ts:38 | Start session on available table | (not opened — D-05 exempts re-triage) | Phase 38 item 2 — no pool table left in "available" seed state | infra | 10-CHECKLIST.md Phase 38 row | ROUTED TO PHASE 38. No code change. |
| e2e/04-pool-timer.spec.ts:50 | Timer ticks | (not opened — D-05 exempts re-triage) | Phase 38 item 2 | infra | 10-CHECKLIST.md Phase 38 row | ROUTED TO PHASE 38. No code change. |
| e2e/04-pool-timer.spec.ts:65 | 15-minute minimum charge on stop | (not opened — D-05 exempts re-triage) | Phase 38 item 2 | infra | 10-CHECKLIST.md Phase 38 row | ROUTED TO PHASE 38. No code change. |
| e2e/04-pool-timer.spec.ts:81 | Start session auto-creates a New Tab | (not opened — D-05 exempts re-triage) | Phase 38 item 2 | infra | 10-CHECKLIST.md Phase 38 row | ROUTED TO PHASE 38. No code change. |
| e2e/04-pool-timer.spec.ts:97 | Charge recorded for linked tab after stop | (not opened — D-05 exempts re-triage) | Phase 38 item 2 | infra | 10-CHECKLIST.md Phase 38 row | ROUTED TO PHASE 38. No code change. |
| e2e/07-reports.spec.ts:621 | Sprint 10: Staff Performance tab shows column headers or empty state | (not opened — D-05 exempts re-triage) | Phase 38 item 3 — missing seeded date-ranged report data | infra | 10-CHECKLIST.md Phase 38 row | ROUTED TO PHASE 38. No code change. |
| e2e/07-reports.spec.ts:647 | Sprint 10: Staff Performance tab shows empty state for year 2020 date range | (not opened — D-05 exempts re-triage) | Phase 38 item 3 | infra | 10-CHECKLIST.md Phase 38 row | ROUTED TO PHASE 38. No code change. |
| e2e/07-reports.spec.ts:729 | Sprint 10: Tip Distribution tab shows column headers or empty state | (not opened — D-05 exempts re-triage) | Phase 38 item 3 | infra | 10-CHECKLIST.md Phase 38 row | ROUTED TO PHASE 38. No code change. |
| e2e/07-reports.spec.ts:752 | Sprint 10: Tip Distribution tab shows empty state for year 2020 date range | (not opened — D-05 exempts re-triage) | Phase 38 item 3 | infra | 10-CHECKLIST.md Phase 38 row | ROUTED TO PHASE 38. No code change. |
| e2e/07-reports.spec.ts:774 | Sprint 10: Export button appears in Staff Performance tab when data rows exist | (not opened — D-05 exempts re-triage) | Phase 38 item 3 | infra | 10-CHECKLIST.md Phase 38 row | ROUTED TO PHASE 38. No code change. |

**11/11 rows routed. No code change attributable to this block (`git diff` touches none of
`02-caja.spec.ts`/`04-pool-timer.spec.ts`/`07-reports.spec.ts` for these findings).**

## Task 1 — `e2e/01-ci.spec.ts`'s three findings: harness-environmental, not real

**Verdict: 100% harness-environmental.** All three failures shared one root cause, unrelated to
the audit's own clean tsc/eslint/vitest results, which this run reconfirms are genuinely clean.

Real per-test error output (`.audit-tmp/e2e-per-spec/01-ci.json`, all 6 attempts across 3 tests ×
2 attempts each — identical every time):

```
Error: spawnSync cmd.exe ENOENT
```

`e2e/01-ci.spec.ts`'s `run()` helper hardcoded `shell: process.env.ComSpec ?? 'cmd.exe'` —
a Windows-only shell invocation with no non-Windows fallback, left over from before Phase 36
migrated dev to Ubuntu. On this Ubuntu host `ComSpec` is unset and `cmd.exe` doesn't exist, so
every `execSync` call failed at the shell-spawn step, before the wrapped command (`npm run
typecheck` / `npm run lint` / `npx vitest run`) ever ran.

**Direct-run comparison (spec's spawned command vs. running the same command directly,
outside Playwright, in this same worktree):**

| Assertion | Spec's spawned result (before fix) | Direct run (this session) | Exit code |
|---|---|---|---|
| `npm run typecheck exits 0` | `spawnSync cmd.exe ENOENT` (never reached tsc) | `tsc --noEmit` — clean, no output | 0 |
| `npm run lint exits 0` | `spawnSync cmd.exe ENOENT` (never reached eslint) | `eslint src --max-warnings 0` — 2 non-blocking warnings printed (multi-project tsconfig notice, legacy boundaries selector syntax), zero errors | 0 |
| `npm run test exits 0 (unit project)` | `spawnSync cmd.exe ENOENT` (never reached vitest) | `vitest run` — 151 files passed, 2 skipped; 1391 tests passed, 15 todo | 0 |

A green direct run alongside a 100%-red spawned run, with an error message naming a
Windows-only executable, is exactly the harness-problem signature D-04 calls out — confirmed, not
inferred.

**Broader inference for Track A (recorded for the other 39-05/39-06/39-07 plans per the task's
own instruction):** `01-ci.spec.ts` failing for environmental (not application) reasons raises
the prior that other specs' failures in this phase may also be environmental — this run's
findings below bear that out further (see the AgentPanel `role="dialog"` and i18n-copy-drift
findings), though each remaining finding was still verified individually per D-04, not assumed.

| Spec Location | Test | Error Excerpt (from `error.message`) | Root-Cause Group | Classification | Evidence | Action |
|---|---|---|---|---|---|---|
| e2e/01-ci.spec.ts:13 | npm run typecheck exits 0 | `Error: spawnSync cmd.exe ENOENT` (both attempts) | 01-ci harness (Windows-only shell) | harness | Direct `npm run typecheck` run this session: 0 errors, exit 0 — matches 10-CHECKLIST.md's "0 tsc errors" | Fixed in `e2e/01-ci.spec.ts`'s `run()` helper — removed the `shell: process.env.ComSpec ?? 'cmd.exe'` override, letting Node's `execSync` use its own correct per-platform default. Verified: `npm run typecheck && npm run lint && npm run test` all pass directly; live spec re-run of the fixed file shows 2/3 assertions now pass (see final stats). |
| e2e/01-ci.spec.ts:17 | npm run lint exits 0 | `Error: spawnSync cmd.exe ENOENT` (both attempts) | 01-ci harness | harness | Direct `npm run lint` run this session: exit 0, 0 errors (2 non-blocking warnings) — matches 10-CHECKLIST.md's "0 eslint findings" | Same fix as above (shared `run()` helper). |
| e2e/01-ci.spec.ts:21 | npm run test exits 0 (unit project) | `Error: spawnSync cmd.exe ENOENT` (both attempts) | 01-ci harness | harness | Direct `npm run test` run this session: 1391/1406 passed, exit 0 — matches 10-CHECKLIST.md's "1391 passing unit tests" | Same fix as above. See "Known flake" note below — this assertion is real but the underlying `npm run test` invocation itself is not perfectly deterministic for an unrelated reason discovered during this verification. |

### Known flake surfaced while verifying the `01-ci.spec.ts` fix (out of this plan's scope — filed, not fixed)

While confirming `npm run test exits 0` genuinely passes once the harness fix removes the
`cmd.exe` blocker, one live spec run hit a **different, pre-existing, unrelated** failure: a
fast-check property test in `src/shared/lib/groupOrderItemsForReceipt.test.ts` ("total
conservation") occasionally fails when its generated input contains two rows sharing the same
`name` across different categories — a test-design bug (comparing two arrays sorted-by-`name`
for deep equality breaks down when `name` isn't unique, independent of `groupByCategory`'s actual
correctness). Confirmed via isolated re-run (`vitest run
src/shared/lib/groupOrderItemsForReceipt.test.ts` — 14/14 pass) that this is intermittent, not a
regression caused by anything in this plan; `src/` is untouched by this plan (`files_modified`
scope is `e2e/*.spec.ts` only). Filed as
`.planning/todos/pending/2026-08-04-flaky-property-test-total-conservation-duplicate-item-names.md`
per D-03 — this is a pre-existing test-code bug discovered incidentally, not something this
plan's `files_modified` scope permits fixing.
