---
status: diagnosed
phase: 20-promotions-engine
source: [20-01-SUMMARY.md, 20-02-SUMMARY.md, 20-03-SUMMARY.md, 20-04-SUMMARY.md, 20-05-SUMMARY.md, 20-06-SUMMARY.md, 20-07-SUMMARY.md, 20-08-SUMMARY.md, 20-09-SUMMARY.md, 20-10-SUMMARY.md, 20-11-SUMMARY.md]
started: 2026-08-07T21:22:20Z
updated: 2026-08-07T21:22:20Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing paused — 3 issues found, blocked by G-20-2; proceeding to diagnosis/gap-closure planning]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running dev server, clear nothing else needed (no new seed/migration step for this phase), start the app fresh. It boots without errors and the POS page loads with live product/category data — no console errors about missing `promotions`/`promotion_availability`/`applied_promotions` tables or about dropped `happy_hour_*` columns.
result: pass

### 2. Create, Edit, and Delete a Promotion
expected: As admin/manager, go to Settings → Promotions. "+ Add promotion" opens a form with name, discount type (percentage/fixed amount/fixed price), discount value, target type (item/category/pool billing/pool grant) + picker, priority, and an Active toggle. Saving shows the new promotion in the list with a target-type badge and a plain-language discount summary. Toggling the inline Active switch flips it without opening the form. Editing re-opens the same form pre-filled, plus a day/time availability editor below it. Deleting asks for confirmation (mentions the audit trail) and removes the row.
result: issue
reported: "Its not passed. Its failing to create the promotion. I click on Add promotion and it failes and show a toast, promotion can't be created"
severity: major

### 3. Active Promotions Banner Appears on POS
expected: With at least one promotion active right now (active + within its availability window, or no window set), the POS order screen shows an amber "Promotions Active — {name(s)}" banner near the top of the product area. If every active promotion has a defined end time, the banner shows "Ends in…"; if any active promotion has no time window (always available), that suffix is omitted. The banner disappears when no promotion is currently active.
result: issue
reported: "failed. There are no promotions and i do not see any banner"
severity: major

### 4. Item/Category Discount Applies Automatically at Order Time
expected: With an active item- or category-targeted promotion, add an eligible product to a tab. No confirmation prompt appears — the line on the ticket already reflects the discounted price (server-applied), not the product's full base price.
result: blocked
blocked_by: prior-phase
reason: "Cannot create/activate a promotion (G-20-2) to exercise this path"

### 5. Pool Table Billing Discount Applies at Session Stop
expected: With an active pool-billing-targeted promotion, start and stop a pool table session. The final charge shown reflects the discount applied to the computed rate — not the undiscounted rate.
result: blocked
blocked_by: prior-phase
reason: "Cannot create/activate a promotion (G-20-2) to exercise this path"

### 6. Pool Bonus-Minute Grant Consumed at Session Stop
expected: Order an item tied to an active pool-grant promotion for a tab with a running pool session, then stop that session. The billed minutes/charge reflect the granted bonus minutes being deducted before the rate is applied.
result: blocked
blocked_by: prior-phase
reason: "Cannot create/activate a promotion (G-20-2) to exercise this path"

### 7. Happy-Hour Fields Removed from Product/Category Admin Forms
expected: In Settings/Inventory → manage a category or product, the edit forms no longer have "Happy hour start/end" or "Happy hour price" fields — pricing promotions are now configured only via Settings → Promotions.
result: pass
source: automated (Playwright — opened "Editar producto" and "Editar Beer" dialogs live, field labels enumerated via DOM query: product dialog has Nombre/Categoría/Precio base/SKU/Código de barras/Piezas por paquete/Paquete vinculado/URL de imagen/Activo/Modificadores only; category dialog has Nombre/Color/Estación de ruteo only — no Happy Hour fields in either)

### 8. No Legacy "Happy Hour" Badge Anywhere in the App
expected: Nowhere in the app (product grid cards, pool table status panel) does a "HAPPY HOUR" badge or "Happy Hour Active" indicator appear anymore. Any active discount is instead surfaced only through the Active Promotions banner.
result: pass
source: automated (Playwright text-search for /happy hour/i on live /pos and /pool-tables pages: 0 matches; corroborated by source: `TableStatusPanel/isHappyHourActive.ts` is deleted per Plan 20-11, and `grep -i happy` on ProductCard.tsx/TableStatusPanel/index.tsx returns 0 matches — the badge-rendering code no longer exists)

## Summary

total: 8
passed: 3
issues: 2
pending: 0
skipped: 0
blocked: 3

## Gaps

- gap_id: G-20-2
  truth: "Clicking \"+ Add promotion\", filling the form, and saving creates the promotion and shows it in the list."
  status: failed
  reason: "User reported: Its not passed. Its failing to create the promotion. I click on Add promotion and it failes and show a toast, promotion can't be created"
  severity: major
  test: 2
  root_cause: "useMutationCreatePromotion (src/entities/promotion/model/queries.ts:88-118) inserts a draft row with target_type:'item' but no target_product_id, to open the edit dialog with a real id. This violates the promotions_item_target_check CHECK constraint added in migration 20260710000001_promotions_schema.sql (target_type <> 'item' OR target_product_id IS NOT NULL). Reproduced live via Playwright: POST /rest/v1/promotions returns 400, Postgres error 23514 'violates check constraint promotions_item_target_check'. Every '+ Add promotion' click fails deterministically — the create-then-open-edit UI pattern from Plan 20-04 was never compatible with the target-consistency CHECK constraint from Plan 20-01."
  artifacts:
    - path: "src/entities/promotion/model/queries.ts"
      issue: "useMutationCreatePromotion's insert payload sets target_type:'item' without target_product_id, violating promotions_item_target_check"
    - path: "supabase/migrations/20260710000001_promotions_schema.sql"
      issue: "promotions_item_target_check CHECK constraint (correct, not the bug) — the insert must satisfy it"
  missing:
    - "Draft-row insert must either omit target_type (relying on a nullable/neutral default that satisfies the CHECK) or supply a valid target_product_id, or the create flow must stop pre-inserting a draft row and instead open the edit dialog with local unsaved state until first Save"
- gap_id: G-20-3
  truth: "With an active promotion, the POS shows an amber Active Promotions banner."
  status: failed
  reason: "User reported: failed. There are no promotions and i do not see any banner (downstream consequence of G-20-2 — no promotion could be created to activate)"
  severity: major
  test: 3
  root_cause: "Same root cause as G-20-2 — no promotion can be created via the UI, so none can ever become active, so the banner (which is otherwise correctly implemented per Plan 20-07) has nothing to display. Not a separate defect once G-20-2 is fixed."
  artifacts: []
  missing: []
- gap_id: G-20-4
  truth: "With an active item- or category-targeted promotion, adding an eligible product to a tab shows the server-discounted price with no client confirmation."
  status: failed
  reason: "Blocked by G-20-2 — cannot create/activate any promotion via the UI to exercise this path."
  severity: major
  test: 4
  root_cause: "Same root cause as G-20-2 (blocking dependency, not independently diagnosed)."
  artifacts: []
  missing: []
- gap_id: G-20-5
  truth: "With an active pool-billing promotion, stopping a pool session reflects the discount in the final charge."
  status: failed
  reason: "Blocked by G-20-2 — cannot create/activate any promotion via the UI to exercise this path."
  severity: major
  test: 5
  root_cause: "Same root cause as G-20-2 (blocking dependency, not independently diagnosed)."
  artifacts: []
  missing: []
- gap_id: G-20-6
  truth: "With an active pool-grant promotion, bonus minutes are consumed when the session stops."
  status: failed
  reason: "Blocked by G-20-2 — cannot create/activate any promotion via the UI to exercise this path."
  severity: major
  test: 6
  root_cause: "Same root cause as G-20-2 (blocking dependency, not independently diagnosed)."
  artifacts: []
  missing: []
