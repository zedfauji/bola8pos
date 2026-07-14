---
phase: 06-split-bill-refund
plan: 11
subsystem: e2e
tags: [e2e, split-bill, refund, playwright, test]
dependency_graph:
  requires: [06-07, 06-08, 06-09, 06-10]
  provides: [E2E spec 34-split-bill, E2E spec 35-refund]
  affects: [CI test suite, Phase 6 acceptance gate]
tech_stack:
  added: []
  patterns:
    - seedOpenTab / seedPaidTab local helpers (service client, shift reuse)
    - enterManagerPin via PINKeypad button clicks (aria-label "Key N")
    - selectTabByName navigation helper (Switch Tab drawer)
    - DB-seeded state + UI-driven assertions (hybrid E2E pattern)
key_files:
  created:
    - bar-pos/e2e/34-split-bill.spec.ts
    - bar-pos/e2e/35-refund.spec.ts
  modified: []
decisions:
  - autonomous=false plan: specs written fully but need human E2E run with dev server to verify
  - seedOpenTab creates shift if none exist (resetTestState closes all shifts)
  - enterManagerPin clicks PINKeypad buttons by aria-label (button-based keypad, no text input)
  - T3+T4 uses direct DB payment seeding + DB assertion rather than full UI payment flow
  - T5 (by-person) confirms with 2 person columns minimum (isValid requires >= 2)
  - Refund T5 guard: dual-path test — disabled checkboxes OR RPC error toast
metrics:
  duration: 25min
  completed: 2026-04-24
  tasks_completed: 2
  files_created: 2
---

# Phase 06 Plan 11: E2E Specs (34-split-bill + 35-refund) — Summary

**One-liner:** Two Phase 6 E2E specs covering split-bill (evenly/by-item/by-person/guard) and refund (PIN gate, double-refund block, partial restock) with DB-seed helpers and Playwright UI assertions.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write E2E 34-split-bill.spec.ts | 5e444d8 | bar-pos/e2e/34-split-bill.spec.ts |
| 2 | Write E2E 35-refund.spec.ts | 24963f6 | bar-pos/e2e/35-refund.spec.ts |

## What Was Built

### 34-split-bill.spec.ts (Task 1)

Five tests following 33-ingredients.spec.ts header/pattern:

**T1: Evenly split 3 ways** — Seeds 6 items at $10 each ($60 total). Opens SplitTabSheet, clicks "Split 3 ways" button (aria-label), confirms split. Verifies toast "Tab split 3 ways" and DB: 3 payment rows summing to $60.

**T2: By-item split** — Seeds 6 items. Opens "By Item" tab in SplitTabSheet. Adds 3 columns. Uses tap-to-assign: clicks unassigned items (role="option" li) then target column (role="option" SubTabColumn). Confirms split. DB: 3 sub-tab rows with split_mode='item', parent.status='split'.

**T3+T4: Auto-close trigger** — Seeds 3 items. Attempts split via RPC (`split_tab_by_item`), falls back to direct DB sub-tab insert if RPC fails. Pays each sub-tab via DB inserts (payment rows + tab.status='paid'). Asserts parent.status='paid' after trigger fires.

**T5: By-person with unassigned** — Seeds 6 items. Opens "By Person" tab. Default 2 person columns (isValid=true with ≥2). Confirms split without assigning items (By Person allows unassigned). DB: ≥2 sub-tabs.

**T6: Split guard** — Seeds open tab, sets status='split' via DB. Navigates to /pos, selects tab. Asserts "Split bill" button is NOT visible (OrderPanel guards on status='open').

### 35-refund.spec.ts (Task 2)

Three tests:

**T1-T4: Process refund with PIN** — Seeds paid tab (5 items × $10). Goes to /payments. Clicks "Refund" button. Opens RefundSheet. Selects 2 non-disabled checkboxes. Sets reason via Select#refund-reason. Clicks "Request approval". Manager PIN dialog (AlertDialog) appears. Enters admin PIN via PINKeypad buttons (aria-label "Key N"). DB: refunds row with amount≈$20, negative payment row (is_refund=true, amount≈-$20). Optional: Refunds tab check.

**T5: Double-refund guard** — Seeds paid tab (2 items). Pre-inserts full refund via DB (refunds + refund_items + negative payment). Goes to /payments → Refund button → RefundSheet. Dual-path: if checkboxes disabled → asserts "Request approval" is disabled. If checkboxes enabled → submits and expects `REFUND_EXCEEDS_ORIGINAL` toast.

**T6: Partial refund with restock=false** — Seeds paid tab (5 items). Pre-inserts partial refund (items[0,1] via DB). Goes to /payments → Refund → selects only non-disabled checkboxes (3 remaining items). Unchecks all Restock checkboxes. Submits with PIN. DB: second refund row ~$30, all refund_items have restock=false.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan template used `qty` for order_items; correct column is `quantity`**
- **Found during:** Task 1 implementation
- **Issue:** The plan's seedPaidTab template used `qty: 1` in order_items inserts but the DB column and existing helpers (seedVoidableOrder) use `quantity: 1`
- **Fix:** Used `quantity: 1` in seedOpenTab and seedPaidTab helpers
- **Files modified:** 34-split-bill.spec.ts, 35-refund.spec.ts

**2. [Rule 1 - Bug] Plan template used `pinInput.fill('0000')` for manager PIN; actual UI is button-based PINKeypad**
- **Found during:** Task 2 implementation (reading RefundSheet and ManagerPinDialog source)
- **Issue:** PINKeypad has no text input — it uses buttons (aria-label "Key 0"–"Key 9") and a window keydown listener. `pinInput.fill()` would not work.
- **Fix:** Created `enterManagerPin()` helper that clicks PINKeypad buttons by aria-label. Falls back to `page.keyboard.type()` if buttons not visible.
- **Files modified:** 35-refund.spec.ts

**3. [Rule 2 - Missing] getServiceClient() imported from helpers/supabase instead of redefined locally**
- **Found during:** Task 1 implementation
- **Issue:** supabase.ts already exports `getServiceClient()` — no need to redefine locally (saves duplication)
- **Fix:** Used `import { getServiceClient } from './helpers/supabase'`
- **Files modified:** 34-split-bill.spec.ts, 35-refund.spec.ts

**4. [Rule 2 - Missing] resetTestState closes all shifts; seedOpenTab must create a new shift**
- **Found during:** Task 1 analysis of resetTestState()
- **Issue:** `resetTestState()` runs `shifts.update({ clock_out: now }).is('clock_out', null)` — all shifts are closed. Tab inserts require a valid shift_id.
- **Fix:** seedOpenTab reuses any remaining open shift or creates a fresh one.
- **Files modified:** 34-split-bill.spec.ts, 35-refund.spec.ts

## Known Stubs

None. Tests are fully written with complete assertions. They require a running dev server and Supabase with Phase 6 migrations applied to actually pass.

## Checkpoint Required

### What Needs Human Verification

Plan is `autonomous: false` — the following require a running dev server to verify:

```bash
cd bar-pos

# 1. Split bill E2E
npx playwright test e2e/34-split-bill.spec.ts --headed

# 2. Refund E2E
npx playwright test e2e/35-refund.spec.ts --headed

# 3. Regression check
npx playwright test e2e/05-payments.spec.ts e2e/03-tab-order.spec.ts
```

**Manual smoke test checklist:**
- [ ] Open a tab, add items, tap "Split bill" → SplitTabSheet opens in Evenly mode
- [ ] Select 3 → preview shows correct amounts → "Confirm Split" → toast "Tab split 3 ways"
- [ ] "By Item" mode: assign all items → "Confirm Split" → sub-tabs in OrderPanel
- [ ] /payments → "Refund" button visible on paid row → RefundSheet opens
- [ ] Select 2 items, set reason, "Request approval" → PIN dialog with button keypad
- [ ] Enter admin PIN → refund processed toast → Refunds tab shows new row

**Important PIN note:** `ManagerPinDialog` uses `PINKeypad` with default `maxLength=6`. If the `E2E_ADMIN_PIN` is 4 digits (e.g., "0000"), the PIN will auto-submit only after 6 button presses. Either:
  - Set `E2E_ADMIN_PIN` to a 6-digit value
  - OR add `maxLength={4}` to ManagerPinDialog's `<PINKeypad>` call

## Threat Flags

None. E2E spec files add no new network endpoints or auth paths. Service role key is already documented in T-06-24 (accept disposition).

## Self-Check: PASSED

- [x] `bar-pos/e2e/34-split-bill.spec.ts` — exists, 459 lines, 5 tests (T1, T2, T3+T4, T5, T6)
- [x] `bar-pos/e2e/35-refund.spec.ts` — exists, 497 lines, 3 tests (T1-T4, T5, T6)
- [x] Commit 5e444d8 — 34-split-bill.spec.ts ✓
- [x] Commit 24963f6 — 35-refund.spec.ts ✓
- [x] Both files follow 33-ingredients.spec.ts header/structure pattern ✓
- [x] Each test has requirement annotation ✓
- [x] `page.getByRole()` / `page.getByLabel()` selectors only (no CSS class selectors) ✓
- [x] No `waitForTimeout` (uses `expect(...).toBeVisible()` for waiting) ✓
- [x] Each test has independent beforeEach setup ✓
