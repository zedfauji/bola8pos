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

## Task 2 — Remaining 29 findings across specs 03, 04, 06, 07, 09, 10, 11, 13, 14

Investigated spec-file-by-spec-file, grouping by error signature within each file before
classifying, per 39-RESEARCH.md Pitfall 3. Root-cause group counts stated per spec.

### e2e/03-tab-order.spec.ts — 1 root-cause group (3 findings: 1 failure, 2 skips)

| Spec Location | Test | Error Excerpt (from error.message/skip reason) | Root-Cause Group | Classification | Evidence | Action |
|---|---|---|---|---|---|---|
| e2e/03-tab-order.spec.ts:14 | Bartender creates a tab | expect(locator).toBeHidden() failed; getByRole('dialog') resolved to div role="dialog" aria-modal="false" aria-label="Asistente IA" | 03-A: unscoped getByRole('dialog') now matches the always-mounted AgentPanel | harness | Live re-run's accessibility snapshot confirms src/features/agent-chat/ui/AgentPanel.tsx renders role="dialog" (aria-modal="false") unconditionally, even while closed (only a CSS translate-x-full toggles visually) — a second role="dialog" element any unscoped getByRole('dialog') can match. Not in CLAUDE.md's Implemented Features (a Paperclip-injected feature, orthogonal to Phase 39). | Fixed: scoped the drawer locator to page.getByRole('dialog', { name: /open tabs/i }) (the drawer's real accessible name, confirmed via accessibility snapshot: dialog "1 open tabs"). Live re-run: passed. |
| e2e/03-tab-order.spec.ts:138 | T7: open tab with notes — notes visible in tab detail | Runtime test.skip(true, 'UI not implemented — EXPECTED FAIL: notes field in open tab dialog'), gated by a notesVisible probe | n/a (not run) | conditional | grep -rn "note" src/features/open-tab/ — zero hits; no notes field exists on the open-tab dialog anywhere in the current codebase, and CLAUDE.md's Implemented Features doesn't list one. Live re-run this session: still skips (feature genuinely absent). | No un-skip. No code change. |
| e2e/03-tab-order.spec.ts:163 | T8: per-item notes saved with order | Runtime test.skip(true, 'UI not implemented — EXPECTED FAIL: per-item notes field not present'), gated by a hasItemNotes probe | n/a (not run) | conditional | Same absence confirmed as above — no per-item notes field anywhere in cart/order UI. Live re-run this session: still skips. | No un-skip. No code change. |

### e2e/04-pool-timer.spec.ts — 1 root-cause group (5 findings: 1 failure, 4 skips — the same pool-table-availability infra cause already routed for this file's other 5 findings in Task 1)

| Spec Location | Test | Error Excerpt (from error.message/skip reason) | Root-Cause Group | Classification | Evidence | Action |
|---|---|---|---|---|---|---|
| e2e/04-pool-timer.spec.ts:189 | T10: Start Session dialog shows rate as dollar amount pattern | TimeoutError: locator.click: Timeout 15000ms exceeded, waiting for getByRole('button', { name: 'Start Session' }).first() | Group A (same signature as the 5 findings routed in Task 1) | infra | Identical error signature to 04-pool-timer.spec.ts:38/50/65/81/97, already confirmed Phase 38 item 2 (no pool table left in "available" seed state) — shares that cause, not new/independent. | Route to Phase 38 alongside the Task-1 rows. No code change. |
| e2e/04-pool-timer.spec.ts:117 | T8: maintenance table — Start Session button absent or disabled | Runtime test.skip(true, 'No available table to set to maintenance'), gated by a pool_tables status='available' query returning null | Same as above | conditional | Skip guard queries pool_tables for an available row directly — same query shape/condition as the routed findings and 39-02-LEDGER.md's Group B. Un-skipping changes nothing (Pitfall 4: data-dependent). | No un-skip. Route to Phase 38 alongside Group A. No code change. |
| e2e/04-pool-timer.spec.ts:160 | T9: reserved table — card shows Reserved badge or label | Runtime test.skip(true, 'No available table to set to reserved'), same guard shape | Same as above | conditional | Same query shape as above. | No un-skip. Route to Phase 38. No code change. |
| e2e/04-pool-timer.spec.ts:205 | T11: carom table billed at its own rate (not global default) | Runtime test.skip(true, 'No available table found for carom rate test'), same guard shape | Same as above | conditional | Same query shape as above. | No un-skip. Route to Phase 38. No code change. |
| e2e/04-pool-timer.spec.ts:309 | T12: firstHourMode=full charges full hour for sub-60-min session | Runtime test.skip(true, 'No available table found for T12'), same guard shape | Same as above | conditional | Same query shape as above. | No un-skip. Route to Phase 38. No code change. |

### e2e/06-transfer.spec.ts — 1 root-cause group (2 findings, both failures)

| Spec Location | Test | Error Excerpt (from error.message) | Root-Cause Group | Classification | Evidence | Action |
|---|---|---|---|---|---|---|
| e2e/06-transfer.spec.ts:60 | Transfer pool session preserves started_at | TimeoutError: locator.click: Timeout 15000ms exceeded, waiting for getByRole('button', { name: 'Start Session' }).first() | Same pool-table-availability Group A as 04-pool-timer's routed findings | infra | Identical error signature — a pool-session test can't start a session because no table is available, same underlying seed-state cause Phase 38 already owns. | Route to Phase 38. No code change. |
| e2e/06-transfer.spec.ts:155 | T5: transfer tab with pool session — pool charge preserved | TimeoutError: locator.click: Timeout 15000ms exceeded, waiting for getByRole('button', { name: 'Start Session' }).first() | Same as above | infra | Identical error signature. | Route to Phase 38. No code change. |

### e2e/07-reports.spec.ts — 2 root-cause groups (3 findings: 2 harness copy/selector drift, 1 infra)

| Spec Location | Test | Error Excerpt (from error.message) | Root-Cause Group | Classification | Evidence | Action |
|---|---|---|---|---|---|---|
| e2e/07-reports.spec.ts:247 | Cash reconciliation variance displayed | strict mode violation: getByText('Variance') resolved to 2 elements: button role="tab">Recipe Variance</button>; span>Variance</span> | 07-A: a "Recipe Variance" report tab was added since this test was written, making the substring match getByText('Variance', { exact: false }) ambiguous | harness | Playwright's own error names both matched elements; "Recipe Variance" is a genuinely new tab not in this test's original design. | Fixed: { exact: false } to { exact: true }, disambiguating from the new tab's label. Live re-run: passed. |
| e2e/07-reports.spec.ts:320 | Product Sales: date range filter to far past shows empty state | Locator: getByRole('status').filter({ hasText: /No sales data/i }); Error: element(s) not found | 07-B: Phase 21's i18n migration reworded this panel's empty-state copy | harness | productSalesPanel.emptyTitle in src/shared/lib/i18n/locales/en-US/wAdmin.json is "No sales in this range", not "No sales data" — grep -rn "No sales data" src/ returns zero hits anywhere in the current codebase. ProductSalesPanel.tsx still uses the shared EmptyState component (same role="status"), only the text changed. | Fixed: updated the matcher to /No sales in this range/i. Live re-run: passed. |
| e2e/07-reports.spec.ts:878 | Phase 24: bartender-initiated reason-required removal succeeds (no AUTH_FORBIDDEN) and appears in Eliminaciones | Error: seedRemovableItem: no available table - Could not find the table 'public.pool_tables' in the schema cache | Group B (same PGRST205 schema-cache defect 39-02-LEDGER.md documented and independently reproduced against the live remote Supabase project) | infra | Identical PGRST205 error shape to 39-02-LEDGER.md's Group B (seedOccupiedTableDirect/seedRemovableItem both query pool_tables directly and hit the same schema-cache miss). | Route to Phase 38 alongside 39-02's Group B findings. No code change. |

### e2e/09-rbac.spec.ts — 4 findings (1 harness fix, 3 still-valid conditional/env skips)

| Spec Location | Test | Error Excerpt (from error.message/skip reason) | Root-Cause Group | Classification | Evidence | Action |
|---|---|---|---|---|---|---|
| e2e/09-rbac.spec.ts:75 | Bartender B does not see Bartender A's tab in drawer | test.skip gated on !process.env.E2E_BARTENDER_B_NAME or !process.env.E2E_BARTENDER_B_PIN | n/a | valid-skip | grep count for E2E_BARTENDER_B_NAME/E2E_BARTENDER_B_PIN in .env.local returns 0 — genuinely not configured in this project's E2E credential set (separate from the primary bartender/manager/admin credentials, which are present). | No un-skip possible without provisioning a second bartender's test credentials — out of this triage plan's scope. No code change. |
| e2e/09-rbac.spec.ts:91 | T7: admin deletes a tab — tab deleted toast, tab no longer in list | Runtime test.skip(true, 'UI not implemented — EXPECTED FAIL: delete tab button not visible to admin'), gated by a hasDelete probe | n/a (not run) | conditional | grep for "delete tab"/"Delete Tab"/"deleteTab" in src/ — the only hit (PoolTablesSettingsTab.tsx) is about deleting a pool-table configuration, unrelated to deleting a customer order tab. No delete-order-tab UI exists anywhere. delete_tab exists only as an RBAC permission-model entry (rbac.ts), with no corresponding button. | No un-skip. No code change. |
| e2e/09-rbac.spec.ts:152 | T9: manager can void an order — success | Runtime test.skip(true, 'UI not implemented — EXPECTED FAIL: void order button not visible to manager'), gated by a voidVisible probe | n/a (not run) | conditional | void-order IS a documented Implemented Feature (CLAUDE.md), so this skip is not "feature doesn't exist" but "void button isn't visible in this exact flow/moment" (immediately after placing an order, on /pos, as manager). Live re-run this session (clean, non-flaky attempt): still skips — condition genuinely still holds for this specific flow. | No un-skip — void-order clearly works elsewhere in the app (documented feature, other flows exercise it), but this test's specific "right after Place Order" moment doesn't show the button; investigating the correct trigger point is out of this triage plan's scope. No code change. |
| e2e/09-rbac.spec.ts:250 | T-RP-01: Admin sees permission matrix on /rbac page | expect(locator).toHaveCount(expected) failed; Locator: getByRole('switch'); Expected: 96; Received: 104 | 09-A: STAFF_ACTIONS grew from 24 to 26 entries | harness | src/shared/lib/rbac.ts's STAFF_ACTIONS array has 26 entries (counted directly), not 24 — Phase 22 added edit_paid_tab and Phase 23 added reopen_tab (both documented CLAUDE.md Implemented Features) after this test's hardcoded 96 (24x4 roles) was written. 26x4 = 104, exactly matching the observed count. | Fixed: updated the hardcoded expectation from 96 to 104 (and the stale "24 action rows" comment to 26). Live re-run: passed. |

### e2e/10-inventory.spec.ts — 2 root-cause groups (5 findings: 4 infra seed-data gap, 1 harness)

Shared-cause hypothesis for the 4-failure cluster (16, 36, 52, 94): CONFIRMED. All four import
and depend on getInventoryQty('Budweiser') / setInventoryQty('Budweiser', ...)
(e2e/helpers/supabase.ts:183-202), and the live remote test project's inventory table has no row
for the Budweiser product — reproduced live, consistently, across the direct-throw case (test 16)
and inferred for the silent-no-op cases (36, 52, 94: setInventoryQty's .update() does not check
whether any row matched, so it silently no-ops against a nonexistent inventory row rather than
throwing, producing a different downstream symptom — a low-stock alert or a post-adjustment
quantity check that never resolves — from the same root cause).

| Spec Location | Test | Error Excerpt (from error.message) | Root-Cause Group | Classification | Evidence | Action |
|---|---|---|---|---|---|---|
| e2e/10-inventory.spec.ts:16 | Inventory decrements after order | Error: getInventoryQty: no inventory row for "Budweiser" | 10-A: missing inventory row for Budweiser on the shared remote test DB | infra | Thrown directly by getInventoryQty (e2e/helpers/supabase.ts:192); reproduced live, this session, consistently. This is a seed-data gap on the shared test project, matching the same category (test-DB seed-data reliability) Phase 38 already owns. | Route to Phase 38 alongside its existing seed-data findings. No code change. |
| e2e/10-inventory.spec.ts:36 | Low stock alert visible to manager | Locator: getByRole('status', { name: /low stock/i }); Error: element(s) not found (30s timeout) | 10-A (same root cause, different symptom) | infra | setInventoryQty('Budweiser', 1) (line 37) silently no-ops if there's no matching inventory row (its .update() doesn't check row-count) — inventory never actually reaches the low-stock threshold, so the alert never renders. Same missing-row cause as :16, manifesting as a UI-timeout instead of a thrown error because this helper doesn't surface the zero-row-matched condition. | Route to Phase 38 alongside :16. No code change. |
| e2e/10-inventory.spec.ts:52 | T4: manager adjusts inventory UP by 5 (delivery reason) | Error: getInventoryQty: no inventory row for "Budweiser" | 10-A | infra | Same thrown error and cause as :16 (calls getInventoryQty for its before baseline). | Route to Phase 38 alongside :16. No code change. |
| e2e/10-inventory.spec.ts:94 | T5: manager adjusts inventory DOWN by 2 (waste reason) | Error: getInventoryQty: no inventory row for "Budweiser" | 10-A | infra | Same thrown error and cause as :16. | Route to Phase 38 alongside :16. No code change. |
| e2e/10-inventory.spec.ts:131 | T6: bartender navigates to /inventory — redirected or read-only view | expect(locator).toHaveCount(expected) failed; Locator: getByRole('button', { name: /adjust/i }).first(); Expected: 0; Received: 1 | 10-B: test assumed RBAC-denied buttons are unmounted; the actual pattern renders them disabled | harness | src/shared/ui/ProtectedAction.tsx (used to gate the Adjust button, InventoryPagePanel.tsx:248,260) deliberately renders denied actions as a disabled button + tooltip, not as absent — confirmed by reading the component (allowed branch returns the child; denied branch clones the child with disabled:true and wraps it in a Tooltip — no branch ever omits the child), and by ProtectedAction.test.tsx existing as this pattern's own established unit-test coverage. Not a security regression: the button is genuinely non-interactive for the bartender. | Fixed: changed the assertion from toHaveCount(0) to toBeDisabled() (guarded — if the button truly isn't rendered at all, e.g. a future redirect-based implementation, the test still passes). Live re-run: passed. |

### e2e/11-offline.spec.ts — 2 findings (1 still-valid documented skip, 1 real regression)

| Spec Location | Test | Error Excerpt (from error.message/skip reason) | Root-Cause Group | Classification | Evidence | Action |
|---|---|---|---|---|---|---|
| e2e/11-offline.spec.ts:65 | T4: offline pool session start — syncs after reconnect | Hardcoded test.skip(true, 'Skipped — Playwright setOffline stalls fetch() indefinitely on pool session mutations. See feedback-offline-mutation-guard.md. Fix requires isOnline() early-exit in mutationFn.') | n/a (not run) | valid-skip | Identical documented Playwright/mutation-hook limitation to 39-02-LEDGER.md's T14 finding in 16-table-status.spec.ts (same page.context().setOffline(true) + mutation-hook interaction) — still a structural Playwright limitation, not stale. | No un-skip. No code change. |
| e2e/11-offline.spec.ts:69 | T5: three offline actions — no error toasts, sync on reconnect | expect(received).toBeGreaterThanOrEqual(expected); Expected: >= 2; Received: 1; Timeout 60000ms exceeded while waiting on the predicate | 11-A: only one of two orders queued offline against the same tab syncs on reconnect | real-regression | Reproduced live twice (initial attempt + Playwright's automatic retry, both failed identically — not a one-off flake). Traced to a plausible mechanism: OfflineQueueProcessor.replayQueue silently drops queued actions on STALE_VERSION, and useMutationAddOrder's offline path (queries.ts:726-745) captures each queued action's expectedVersion from the tab's pre-offline cached version — if the first queued order bumps tabs.version server-side, the second order (captured with the same stale pre-offline version, since both were queued back-to-back while still offline) would be discarded on replay without a distinguishable error surfaced to the user. Directly touches this project's stated core value (order correctness under flaky connectivity). Root cause not fully confirmed (would require reading the add_order RPC to verify it bumps tabs.version) — that confirmation and any fix are explicitly D-03's job for a future plan, not this triage plan. | Filed as .planning/todos/pending/2026-08-04-offline-queue-drops-second-order-on-reconnect.md per D-03. No code change (D-03 prohibits inline fixes for real regressions found during this phase). |

### e2e/13-tauri-build.spec.ts and e2e/14-manual-stubs.spec.ts — 5 findings, all still-valid platform-gated/manual skips

| Spec Location | Test | Skip reason | Root-Cause Group | Classification | Evidence | Action |
|---|---|---|---|---|---|---|
| e2e/13-tauri-build.spec.ts:14 | npm run tauri build exits 0 and MSI exists (Windows) | test.skip gated on !process.env.RUN_TAURI_E2E (opt-in env var, unset), and test.skip(true, 'MSI bundle path is Windows-specific; run on win32 for full check.') on non-win32 | n/a | valid-skip | CLAUDE.md: "Release builds and code signing stay on Windows." — this project's own documented constraint; running on Ubuntu is expected to skip. RUN_TAURI_E2E unset confirms the heavy-build opt-in gate is also intentionally not enabled here. | No un-skip. No code change. |
| e2e/14-manual-stubs.spec.ts:4 | Day 1 — Tauri window + physical PIN + Supabase console | Hardcoded test.skip(true, 'Manual: Run npm run tauri dev...') | n/a | valid-skip | Explicitly a manual-verification stub by design (physical PIN keypad, native window — not automatable via Playwright). | No un-skip. No code change. |
| e2e/14-manual-stubs.spec.ts:11 | Day 2 — Storybook at localhost:6006 without console errors | Hardcoded test.skip(true, 'Manual: Run npm run storybook...') | n/a | valid-skip | Same — manual visual/console spot-check by design. | No un-skip. No code change. |
| e2e/14-manual-stubs.spec.ts:18 | Day 2 — Zustand store spot-check beyond automated unit run | Hardcoded test.skip(true, 'Manual: npm run test is covered in CI Checks...') | n/a | valid-skip | Explicitly references the already-automated npm run test coverage as sufficient; this stub is for supplementary manual spot-checks only. | No un-skip. No code change. |
| e2e/14-manual-stubs.spec.ts:25 | Day 7 — Tauri production build (duplicate of automated opt-in) | Hardcoded test.skip(true, 'Manual: Run npm run tauri build...Automated variant: e2e/13-tauri-build.spec.ts with RUN_TAURI_E2E=1.') | n/a | valid-skip | Explicitly a duplicate/manual fallback of the already-classified 13-tauri-build.spec.ts:14 above. | No un-skip. No code change. |

Total Task 2: 29/29 findings classified — 5 harness (fixed), 9 infra (routed to Phase 38,
including 5 conditional skips sharing 04-pool-timer's existing infra cause), 4 conditional
(genuinely-still-unimplemented UI, no code change), 1 valid-skip (missing test credentials),
1 real-regression (filed as a todo), 9 valid-skip (platform-gated/manual/documented-limitation).
