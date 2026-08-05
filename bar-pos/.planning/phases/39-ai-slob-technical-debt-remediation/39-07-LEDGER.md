# 39-07 Triage Ledger — specs 27 through 44 (tail batch)

**Plan:** 39-07 (Track A tail batch)
**Specs:** `e2e/27-inventory-intelligence.spec.ts`, `e2e/30-help-manual.spec.ts`,
`e2e/31-categories.spec.ts`, `e2e/36-recipes.spec.ts`, `e2e/37-analytics-reports.spec.ts`,
`e2e/38-audit-logs.spec.ts`, `e2e/43-promotions.spec.ts`, `e2e/44-focus-tab-order.spec.ts`
(22 of 147 Blocking-tier E2E findings: 17 failed + 5 skipped)
**Method:** D-04 — real per-test error output. Every row below is backed by either (a) a
fresh `npx playwright test e2e/<spec>.spec.ts` run against the live remote Supabase project in
this worktree (dev server + `node_modules` symlink + `.env.local` copy provisioned per the
environment-gap note established in 39-02-LEDGER.md/39-03-SUMMARY.md), or (b) the pre-existing
`.audit-tmp/e2e-per-spec/<spec>.json` (dated 2026-08-03, one day old) where the live run
reproduced an identical signature and a second live run added no new information. Every
non-obvious classification below was cross-checked by reading the actual source file the
failure points at — not just the error string — per this plan's `must_haves`.

## Environment setup note (methodology transparency, same pattern as 39-02/39-03)

This worktree started with no `node_modules`, no `bar-pos/.env.local`, and no
`.audit-tmp/e2e-per-spec/` (all gitignored, worktree-local artifacts). Provisioned: `node_modules`
symlinked to the main checkout's `node_modules`; `.env.local` copied from the main checkout;
the 8 relevant `.audit-tmp/e2e-per-spec/*.json` files copied from the main checkout (read-only
input, not modified). The dev server (`npm run dev`) was started fresh in this worktree on port
1420 after the one already running there from a prior session was found to have exited between
commands. None of this is a scope violation — test-side/tooling-only, zero `src/` changes from
setup, and all copied/symlinked paths are already `.gitignore`-excluded.

## Shared-cause hypotheses

Two distinct multi-finding root-cause groups were confirmed in this batch, plus two single-finding
real regressions discovered along the way (both filed as todos per D-03, not fixed here).

### Group 1 — `31-categories.spec.ts` T2–T5: AgentPanel `role="dialog"` collision (CONFIRMED, 4 findings)

`page.getByRole('dialog')` throughout T2–T5 was written before `src/features/agent-chat/ui/AgentPanel.tsx`
existed. That component renders a **permanently-mounted** `<div role="dialog" aria-modal="false"
aria-label="Asistente IA">` (the AI Assistant side panel) at the app root (`src/app/router.tsx:44-46`,
alongside `<HelpSheet/>`), toggled only via a CSS `transform: translateX(...)` — it is never
unmounted, never `display:none`, and never `visibility:hidden`, so Playwright's `toBeVisible()`
(which does not consider viewport-clipping transforms) always considers it "visible" once it is
the *only* element matching `role="dialog"`. Confirmed live for T2 — the actual category-creation
Radix dialog **does** close correctly after Save (the create succeeds), but the bare
`page.getByRole('dialog')` locator used in `not.toBeVisible()` re-resolves to the AgentPanel and
fails. Reproduced on a fresh live run, not just the stale JSON.
```
Locator:  getByRole('dialog')
Expected: not visible
Received: visible
    19 × locator resolved to <div role="dialog" aria-modal="false" aria-label="Asistente IA" ...
       translate-x-full">…</div>
```
**Classification: `harness`.** The create/edit/delete flow itself is unaffected — only the
assertion's selector is now ambiguous. Fix (Task 3): scope the dialog locator to
`page.getByRole('dialog').and(page.locator('[aria-modal="true"]'))` (Radix's own Dialog sets
`aria-modal="true"`; AgentPanel explicitly sets `aria-modal="false"`), or equivalently filter out
the AgentPanel by its `aria-label`.

### Group 2 — `27-inventory-intelligence.spec.ts` T1/T5/T6: Budweiser has no `inventory` row (CONFIRMED, 3 findings)

Direct service-role query against the live remote DB this session:
```
products matching "budweiser": [{"id":"712d...","name":"Budweiser"}]
inventory rows for that product id: []
total products in DB: 95
total inventory rows in DB: 2   (the only 2 SKUs the Inventory page itself ever shows:
                                  __test_alitas__ and "Rappi / external item")
```
93 of 95 products — including Budweiser, the fixed `E2E_INVENTORY_PRODUCT_NAME` default this spec
targets — have **no row at all** in `inventory`. `setInventoryQty()`/`setStockThreshold()`
(`e2e/helpers/supabase.ts:196-202,563-576`) silently no-op on `UPDATE ... WHERE product_id = X`
when zero rows match (Supabase returns no error for a 0-row update), so T1's threshold/qty setup
appears to succeed but never actually creates a low-stock alert row for the join in
`useInventoryAlerts()` (`src/entities/inventory/model/queries.ts:257-271`, an inner join on
`inventory`). T5's physical-count dialog can't show a "Budweiser" row for the identical reason
(no inventory row to enumerate). T6 self-skips ("Budweiser row not found in physical count form")
for the same underlying cause, just surfaced as a skip instead of a failure. This is a
shared-remote-test-DB seed-data gap, not application code — confirmed independently of Playwright
via a direct DB query, matching 39-02-LEDGER.md's established pattern (pool_tables schema-cache
gap) for routing to Phase 38.

**Classification: `infra`** for all three. Routed to Phase 38 ("E2E Test Infrastructure & Seed
Data Reliability" — seed data does not provision `inventory` rows for the vast majority of
`products`). No code change in this plan.

### Real regression #1 — `43-promotions.spec.ts` T1: promotion creation is broken for every admin

Live console capture on this session's run:
```
useMutationCreatePromotion: insert failed {
  "error": { "code": "23514", "message":
    "new row for relation \"promotions\" violates check constraint \"promotions_item_target_check\"" }
}
```
`src/entities/promotion/model/queries.ts:88-118` (`useMutationCreatePromotion`) inserts a new
draft row with `target_type: 'item'` but never sets `target_product_id`. The DB check constraint
added in `supabase/migrations/20260710000001_promotions_schema.sql:26` —
`CHECK (target_type <> 'item' OR target_product_id IS NOT NULL)` — rejects that insert every
single time. **The "+ Add promotion" button in Settings → Promotions cannot create a draft at
all, for any user, in the current codebase.** This is not a display bug or a stale test; it is a
100%-reproducible server-side rejection on the exact insert the UI issues on every click.

**Classification: `real-regression`.** Filed as a todo per D-03 (not fixed inline). T1 cannot
proceed past this point — everything downstream of dialog-open (edit fields, save, list-row
assertions, disable, delete) is unreachable and untestable until the insert is fixed.

### Real regression #2 — `44-focus-tab-order.spec.ts` B: inventory column headers render raw i18n keys

Live page-snapshot from this session's failing run (Tab press correctly landed focus on the
Product header — `[active]` marker below — but the accessible name is broken):
```
- columnheader "inventoryRow.columns.product" [ref=e66]:
  - button "inventoryRow.columns.product" [active] [ref=e67] [cursor=pointer]
- columnheader "inventoryRow.columns.category" [ref=e68]:
  - button "inventoryRow.columns.category" [ref=e69] [cursor=pointer]
```
Root cause: `src/widgets/InventoryPagePanel.tsx:98,114` calls `useTranslation('wAdmin')` and
passes that `wAdmin`-scoped `t` into `inventoryRowColumns(t, ...)`
(`src/entities/inventory/ui/InventoryRow.tsx:168`), which expects an `entities`-namespaced
`TFunction` (the `inventoryRow.columns.*` keys live only in `entities.json`, confirmed absent
from `wAdmin.json`). i18next falls back to the raw key string when the key is missing from the
active namespace. Every inventory column header ("Product", "Category", "Price", "Status",
"On hand", "Unit", "Threshold") is affected — a real, currently-visible product bug independent
of this spec.

**Classification: `real-regression`.** Filed as a todo per D-03. Critically, the DOM snapshot
above proves the **Tab-order contract itself still holds** — focus moved to the Product header
exactly where Phase 32 shipped it (`[active]` on the correct element in the correct sequence);
the test fails purely because `getByRole('button', { name: 'Product' })` can no longer match the
broken accessible name. No test assertion was relaxed. Once the i18n namespace bug is fixed, this
test requires no changes and should pass as written.

## Ledger

| Spec Location | Test | Error Excerpt (from `error.message`, not title) | Root-Cause Group | Classification | Evidence | Action |
|---|---|---|---|---|---|---|
| e2e/27-inventory-intelligence.spec.ts:32 | T1: low-stock badge is visible for manager when stock is below threshold | `Error: expect(locator).toBeVisible() failed — Locator: getByTestId('low-stock-badge') ... Error: element(s) not found` | Group 2 (Budweiser has no `inventory` row) | infra | Live run + direct DB query this session: Budweiser product exists, zero matching `inventory` rows; only 2 of 95 products have any `inventory` row at all (see "Real regression"-adjacent Group 2 writeup above). Page snapshot confirms "Total SKUs: 2, Low stock: 0". | Route to Phase 38 (seed-data reliability). No code change. |
| e2e/27-inventory-intelligence.spec.ts:151 | T5: physical count submit adjusts stock and writes stock_movements | `Error: expect(locator).toBeVisible() failed — Locator: getByRole('dialog').getByText('Budweiser').first() ... Error: element(s) not found` | Group 2 | infra | Live run reproduced identically to the stale JSON (2/2 attempts). Same root cause as T1 — no inventory row means Budweiser never renders as a row in the physical-count product list. | Route to Phase 38. No code change. |
| e2e/27-inventory-intelligence.spec.ts:236 | T6: variance report highlights negative rows with destructive styling | Runtime `test.skip(true, 'UI: Budweiser row not found in physical count form')` (fired at `27-inventory-intelligence.spec.ts:283`) | Group 2 | conditional | Skip reason is a seed-availability-shaped runtime condition (per 39-RESEARCH.md/39-02-LEDGER.md's playbook), not a hardcoded disable, and traces to the identical Group 2 cause as T1/T5 — surfaced as a self-skip instead of a thrown error because this call site checks row visibility before asserting. | Route to Phase 38 alongside T1/T5. No un-skip — condition is data-dependent (Pitfall 4). No code change. |
| e2e/30-help-manual.spec.ts:15 | F1 opens route-specific help on POS | `Error: expect(locator).toContainText(expected) failed — Locator: getByTestId('help-sheet-title') ... Received string: "Home — Help"` | n/a (single-finding) | harness | Live run (2/2, including a fresh single-test isolation run) shows the page snapshot is genuinely the Home dashboard (`Welcome, Taylor Brooks`, big-box nav) after `page.goto('/pos')`, not `/pos`. Root-caused to `src/pages/pos/index.tsx:53` passing `backTo="/home"` with `className="...p-0"` (zero padding) to `PageContainer`, which renders `SectionHeader`'s "← Home" `<Link>` at the literal top-left corner (`src/shared/ui/SectionHeader.tsx:58-65`, `-ml-2.5`). The test's `page.locator('body').click({ position: { x: 10, y: 10 } })` — meant only to defocus any input — lands on that link instead, navigating away before F1 is pressed. `/pool-tables` (this file's other test, which passes) uses the same `backTo` prop but default `p-6` padding, so (10,10) misses it. | Fix (Task 3): move the defocus click to a coordinate that cannot collide with the back-link, e.g. click the page's own `<h2>` title text instead of a raw `{x:10,y:10}` coordinate. |
| e2e/31-categories.spec.ts:169 | T2: admin creates root category "Beers" — visible in tree | `Error: expect(locator).not.toBeVisible() failed — Locator: getByRole('dialog') ... resolved to <div role="dialog" aria-label="Asistente IA" ... translate-x-full">` | Group 1 (AgentPanel `role="dialog"` collision) | harness | Live run confirms the actual create succeeds (Save closes the real dialog); the bare `getByRole('dialog')` locator re-resolves to the always-mounted AgentPanel. See Group 1 writeup above. | Fix (Task 3): scope dialog locator to exclude AgentPanel (filter on `[aria-modal="true"]`). |
| e2e/31-categories.spec.ts:193 | T3: admin creates child "Regular" under Beers | Same signature as T2 (this test also creates the root "Beers" category first, hitting the identical `not.toBeVisible()` assertion). | Group 1 | harness | Same cause as T2 — this test's root-category-creation step is byte-identical code to T2's. Chain hypothesis (39-RESEARCH.md Pitfall 3) confirmed: T3/T4/T5 all fail at the exact same line pattern as T2 because they each redo the root-creation step inline (not because a prior test's state leaked). | Same fix as T2 (shared locator scoping) resolves this row too. |
| e2e/31-categories.spec.ts:222 | T4: admin creates grandchild "Corona" under Regular | Same signature as T2/T3 (fails at the same `not.toBeVisible()` step, reached after redoing root+child creation inline). | Group 1 | harness | Same cause. | Same fix as T2 resolves this row. |
| e2e/31-categories.spec.ts:262 | T5: 4th-level creation blocked in UI — no "Add subcategory" button on grandchild | Same signature as T2/T3/T4 (fails while rebuilding the Beers→Regular→Corona tree inline before reaching the depth-gate assertion). | Group 1 | harness | Same cause. | Same fix as T2 resolves this row. |
| e2e/31-categories.spec.ts:318 | T6: combo_eligible flag — DB column writable and readable (service-role) | `Error: expect(received).toBeNull() — Received: {"code":"PGRST204","message":"Could not find the 'combo_eligible' column of 'categories' in the schema cache"}` (live re-check via direct query returned Postgres-native `42703: column categories.combo_eligible does not exist`) | n/a (single-finding) | obsolete | `supabase/migrations/20260424000004_product_combo_flags.sql:7-10` adds `combo_eligible`/`is_combo` to the **`products`** table only — `categories` has never had this column. The test's own header comment ("S1-01/S1-06... proves the migration column and schema are correct") appears to have targeted the wrong table from authoring; no migration ever added this to `categories`, so this is not a regression, it is an incorrect assumption baked into the test since it was written. | Justify + remove (Task 3): `categories.combo_eligible` was never implemented; this row asserts a schema shape that doesn't exist and never did. Product-level `combo_eligible` coverage is out of this spec's scope (it belongs to a products-focused spec, not touched here). |
| e2e/31-categories.spec.ts:363 | T7: bartender cannot write to modifier_groups (RLS) | Runtime `test.skip(true, 'Set E2E_BARTENDER_EMAIL and E2E_BARTENDER_PASSWORD to enable RLS test...')` | n/a | conditional | Skip fires only when `E2E_BARTENDER_EMAIL`/`E2E_BARTENDER_PASSWORD` env vars are absent — verified these are in fact unset in this worktree's `.env.local`. Runtime-conditional on env config, not a hardcoded disable. | No un-skip (would require provisioning bartender Auth credentials, out of this plan's scope). No code change. |
| e2e/31-categories.spec.ts:385 | T8: bartender cannot access Settings — redirected to /home | `Error: expect(page).toHaveURL(expected) failed — Expected pattern: /\/home/ — Received string: "http://localhost:1420/settings"` | n/a (single-finding, one of the two access-control findings requiring an explicit verdict) | obsolete | Live run + page snapshot: bartender **does** land on and stay at `/settings`, but the rendered page shows **exactly one tab** — "Idioma" (Language) — and its panel contains only the self-service language selector; no Categories/Products/Modifier-Groups/Hardware/etc. surface is present or reachable. `src/widgets/SettingsTabsPanel/index.tsx:33-43` deliberately pushes the `language` tab first and *outside* both the `canManageSettings`/`canManageProducts` permission gates specifically so "every authenticated role (incl. bartender) always has a non-empty tab list" (inline code comment) — this is Phase 21's documented, committed self-service-locale decision (CLAUDE.md "i18n / Multi-Language" section: "open to every authenticated role including bartender... always the first/default Settings tab"), not an accidental gate removal. **Written verdict:** the category/product-management access-control property this test aims to protect *still holds* (per-tab RBAC gating is intact and verified live — bartender sees zero sensitive tabs); only the outer route-level full-page redirect was deliberately replaced by per-tab gating in Phase 21, and this test predates that change. | Justify + remove/update (Task 3): update to assert the Phase 21 contract instead (bartender lands on `/settings`, sees only the Language tab, Products/Categories tab is absent) rather than an unconditional redirect that no longer matches an intentional, documented product decision. |
| e2e/36-recipes.spec.ts:21 | can open Recipe tab in product edit dialog | `Error: expect(locator).toBeVisible() failed — Locator: getByRole('button', { name: /edit/i }).first() ... Error: element(s) not found` | n/a (single shared cause with the next row) | harness | Live page snapshot confirms Settings' `tablist` now defaults to "Idioma" (Language) selected, with "Products" present but **unselected** — the test's own comment ("`/settings` already lands on the Products panel — no tab click needed") is stale since Phase 21 made Language the default/first tab (`src/widgets/SettingsTabsPanel/index.tsx:39,123`, `defaultTab = firstTab.key`). No product rows/Edit buttons are rendered because the Products tab was never clicked. | Fix (Task 3): click `page.getByRole('tab', { name: 'Products' })` before waiting on Edit buttons. |
| e2e/36-recipes.spec.ts:43 | can add ingredients to recipe and save | Same signature as line 21 (identical missing-Products-tab-click pattern, same file, same stale assumption). | Same cause as :21 | harness | Same cause — confirmed via the same live page snapshot. | Same fix as :21 resolves this row. |
| e2e/36-recipes.spec.ts:82 | INVENTORY_NEGATIVE shows toast and allows override with manager PIN | `Error: expect(locator).toBeVisible() failed — Locator: getByText('TestDepletionE2E') — Error: strict mode violation: resolved to 2 elements: 1) "Tab opened for TestDepletionE2E" (toast) 2) heading "TestDepletionE2E"` | n/a (single-finding) | harness | Live run confirms the tab opens correctly (both matched elements confirm the underlying feature works) — the locator is simply too broad, matching both the transient open-tab toast and the persistent tab-header heading simultaneously. | Fix (Task 3): scope to `page.getByRole('heading', { name: 'TestDepletionE2E' })` or add `.first()`. |
| e2e/36-recipes.spec.ts:144 | full depletion E2E: sell Alitas → verify stock ledger → void → verify reversal | Hardcoded `test.skip(...)`; inline comment: "MANUAL / INTEGRATION ONLY... Cannot be automated purely in Playwright... Covered by integration tests I1 and I2 in depletion.integration.test.ts." | n/a | valid-skip | Constraint is a structural test-infra limitation (needs DB-level assertion the E2E harness can't cleanly do inline) with a named alternate coverage path (`depletion.integration.test.ts` I1/I2) that still exists and is unrelated to any CLAUDE.md "Implemented Features" change. Still holds. | No un-skip. No code change. |
| e2e/37-analytics-reports.spec.ts:82 | T2: RecipeVarianceReport tab renders without crash | `Error: expect(locator).toBeVisible() failed — Locator: [data-testid="loading-spinner"], table, [data-testid="empty-state"] ... Timeout: 10000ms` (stale JSON only — not reproduced live) | n/a (single-finding) | flaky | Two consecutive fresh live runs (isolated `-g "T2"` and the full 5-test spec) both pass cleanly; the component (`src/widgets/RecipeVarianceReport/RecipeVarianceReport.tsx`) unconditionally renders one of `LoadingSpinner`/`EmptyState`/`Table`, all three of which carry the exact `data-testid`s the test waits on — no code path exists that renders none of them, consistent with the failure being a one-off timing/network hiccup on the original 2026-08-03 audit run, not a reproducible defect. | No code change — not currently reproducible. Re-flag if it recurs. |
| e2e/38-audit-logs.spec.ts:170 | bartender should be redirected away from /audit | `Error: expect(locator).toBeVisible() failed — Locator: getByText(/restricted to managers and admins/i) — Error: strict mode violation: resolved to 2 elements (both "This page is restricted to managers and admins." — duplicate-rendered toast)` | n/a (one of the two access-control findings requiring an explicit verdict) | harness | Live run: the preceding `expect(page).toHaveURL(/\/home/)` assertion (line 173) **passes** — only the *following* toast-text assertion (line 174) fails, and only because the identical toast string is rendered twice (a duplicate-toast render, not two different messages). **Written verdict: the `/audit` access-control gate holds** — bartender is genuinely redirected to `/home` before the toast assertion is even reached. | Fix (Task 3): scope to `.first()` on the toast-text locator. |
| e2e/38-audit-logs.spec.ts:184 | should open diff sheet on row click | Runtime `test.skip(true, 'No audit entries present — skip diff sheet click test.')` | n/a | conditional | The same spec's earlier "Happy path" tests (payment/void/refund) all passed in this run and do create audit-log rows, yet this later test's own runtime check (`page.getByRole('button', {name:/view diff for/}).first()`) still found zero rows at the moment it ran — consistent with a filter/date-window/pagination state that is genuinely per-test-run-dependent in this shared environment, not a hardcoded disable. T-39-20 requires this gap be recorded rather than assumed away: this is the sole automated coverage for the diff-viewer, and it is currently unverified in this run. | No un-skip (condition is data-dependent per-run; Pitfall 4). No code change. Recorded as an audit-trail coverage gap per T-39-20. |
| e2e/43-promotions.spec.ts:39 | T1: admin creates, edits (disables), and deletes a promotion via Settings -> Promotions | `Error: expect(locator).toBeVisible() failed — Locator: getByRole('dialog', { name: 'Edit Promotion' }) ... Error: element(s) not found` — live console: `useMutationCreatePromotion: insert failed {"error":{"code":"23514","message":"new row for relation \"promotions\" violates check constraint \"promotions_item_target_check\""}}` | n/a (single-finding real regression, see writeup above) | real-regression | Live run captured the exact Postgres 400/23514 rejection from the browser console — the "+ Add promotion" mutation's default insert (`target_type:'item'`, no `target_product_id`) violates the DB's own `promotions_item_target_check` constraint on every attempt. Promotion creation via the admin UI is completely broken. | Filed as todo per D-03. No inline fix — this is a real product bug, not a test defect. |
| e2e/43-promotions.spec.ts:96 | T2: an active item-target promotion auto-applies at order time with no confirmation step (D-02) | `Error: expect(locator).toBeVisible() failed — Locator: getByText(/tab opened/i) ... Timeout: 20000ms` — live console: `tabs.open.mutation_failed {"message":"No caja is open. Ask a manager to open the caja first."}` | n/a (single-finding) | harness | Live run captured the exact mutation-rejection reason. This spec's `beforeEach` (`e2e/43-promotions.spec.ts:33-37`) never calls `openCaja(...)` — every sibling spec that opens a tab as bartender/manager does (e.g. `38-audit-logs.spec.ts:24`, `44-focus-tab-order.spec.ts:76`). Opening a tab genuinely requires an open caja session; this spec's author omitted the call. | Fix (Task 3): add `await openCaja(<amount>)` to this spec's `beforeEach` (or immediately before the `New Tab` click in T2), matching the established pattern in every other spec that opens a POS tab. |
| e2e/44-focus-tab-order.spec.ts:81 | A: ManagerPinDialog Tab order follows the visual keypad layout (1-9, 0, Backspace, Cancel) | `TimeoutError: locator.click: Timeout 15000ms exceeded — waiting for getByRole('button', { name: 'Start Session' }).first()` | Group 2-adjacent (pool-table seed/session-start availability — same signature class as 39-02-LEDGER.md's Group A) | infra | Live run reproduces the identical "Start Session" button timeout during this test's own seed setup (`startSessionViaUI`, `e2e/44-focus-tab-order.spec.ts:43-53`), before the ManagerPinDialog is ever reached. This is the same pool-table-availability infra signature 39-02-LEDGER.md already routed to Phase 38 for `16-table-status.spec.ts`, now recurring in a different spec that shares the same seed helper. **Written verdict: the shipped Tab-order contract on ManagerPinDialog was not exercised by this run** — the test never got past setup, so this is neither a confirmed pass nor a confirmed regression of the contract itself. | Route to Phase 38 (same pool-table seed-availability infra as 39-02's Group A). No code change. Re-run once Phase 38 resolves seed availability to get an actual contract verdict. |
| e2e/44-focus-tab-order.spec.ts:144 | B: inventory category filter Tabs into the sortable column headers in visual order | `Error: expect(locator).toBeFocused() failed — Locator: getByRole('button', { name: 'Product', exact: true }) ... Error: element(s) not found` | n/a (single-finding real regression, see writeup above) | real-regression | Live page snapshot shows the Product column-header `<button>` **does** receive focus (`[active]` marker) in exactly the expected Tab position — the DOM/focus order is intact. The failure is solely because `src/widgets/InventoryPagePanel.tsx:98,114` passes a `wAdmin`-namespaced `t` into `inventoryRowColumns()` (which expects `entities`-namespaced keys), so every column header's accessible name renders as the raw i18n key (`"inventoryRow.columns.product"`) instead of "Product". **Written verdict: the shipped Tab-order/focus contract still holds** — this is a real, separate i18n-wiring regression, not an accessibility/focus-order regression, and no test assertion was relaxed to compensate for it. | Filed as todo per D-03. No inline fix and no test-side change — the test's selector is correct against the intended contract; it will pass unmodified once the i18n bug is fixed. |

**Total: 22 rows (17 failed + 5 skipped).**

## Root-cause group summary

- **Group 1 (`31-categories.spec.ts` T2–T5, 4 findings):** AgentPanel `role="dialog"` locator
  collision — `harness`, one fix resolves all 4.
- **Group 2 (`27-inventory-intelligence.spec.ts` T1/T5/T6, 3 findings; `44-focus-tab-order.spec.ts`
  A shares the same seed-availability infra class, 1 finding):** shared-remote-DB seed-data gaps —
  `infra`, routed to Phase 38, zero code changes in this plan.
- **2 real regressions, 1 finding each** (`43-promotions.spec.ts` T1 promotion-creation DB
  constraint violation; `44-focus-tab-order.spec.ts` B i18n namespace bug), both filed as todos
  per D-03.
- **8 remaining single-finding rows:** 5 `harness` (30-help-manual F1, 36-recipes ×3,
  38-audit-logs bartender-redirect), 2 `obsolete` (31-categories T6/T8, both justified in writing
  above), 1 `flaky` (37-analytics-reports T2, not reproducible), plus 3 `conditional` skips
  (31-categories T7, 38-audit-logs diff-sheet skip — already counted) and 1 `valid-skip`
  (36-recipes full-depletion).

## Final spec run stats (this session, live)

```
npx playwright test e2e/27-inventory-intelligence.spec.ts --reporter=list
  2 failed (T1, T5) / 1 skipped (T6) / 3 passed

npx playwright test e2e/30-help-manual.spec.ts --reporter=list
  1 failed (F1 POS) / 1 passed (F1 pool-tables)

npx playwright test e2e/31-categories.spec.ts --reporter=list
  6 failed (T2, T3, T4, T5, T6, T8) / 1 skipped (T7) / 1 passed (T1)

npx playwright test e2e/36-recipes.spec.ts --reporter=list
  3 failed / 1 skipped

npx playwright test e2e/37-analytics-reports.spec.ts --reporter=list
  5 passed (T2 not reproducible — see "flaky" row)

npx playwright test e2e/38-audit-logs.spec.ts --reporter=list
  1 failed (bartender redirect) / 1 skipped (diff sheet) / 4 passed

npx playwright test e2e/43-promotions.spec.ts --reporter=list
  2 failed (T1, T2)

npx playwright test e2e/44-focus-tab-order.spec.ts --reporter=list
  2 failed (A, B) / 1 passed (C)
```

Post-Task-3 spec-run results (after harness fixes) are recorded in a dedicated section below,
appended once Task 3 completes.
