---
phase: 06-split-bill-refund
plan: "02"
subsystem: database-migrations
tags: [split-bill, refund, rpcs, trigger, postgresql, security-definer]
dependency_graph:
  requires: [06-01]
  provides: [split-tab-rpcs, process-refund-rpc, parent-auto-close-trigger]
  affects: [tabs, orders, order_items, payments, refunds, refund_items]
tech_stack:
  added: []
  patterns: [security-definer-rpc, greedy-allocation, trigger-after-insert, exception-stub-pattern]
key_files:
  created:
    - bar-pos/supabase/migrations/20260427000002_split_tab_rpcs.sql
    - bar-pos/supabase/migrations/20260427000003_process_refund_rpc.sql
    - bar-pos/supabase/migrations/20260427000004_parent_auto_close_trigger.sql
  modified: []
decisions:
  - "Sub-tab INSERT uses split_label as customer_name to satisfy customer_name_or_table CHECK constraint"
  - "Sub-tab INSERT propagates parent.shift_id (NOT NULL) to all sub-tab rows"
  - "orders INSERT uses staff_id from parent tab (NOT NULL requirement); no label column exists on orders"
  - "order_items.quantity used (not qty — actual column name in this schema)"
  - "split_tab_evenly excludes combo children (parent_order_item_id IS NULL) to avoid double-counting"
  - "split_tab_by_amount greedy loop also skips combo children; they cascade via separate UPDATE"
  - "process_refund deplete_for_order_item call wrapped in EXCEPTION WHEN undefined_function (Phase 4 stub)"
  - "process_refund audit_log INSERT wrapped in EXCEPTION WHEN undefined_table (future migration)"
  - "DROP TRIGGER IF EXISTS before CREATE TRIGGER for idempotent re-application"
metrics:
  duration: "15min"
  completed_date: "2026-04-24"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 0
---

# Phase 06 Plan 02: Split Tab RPCs + process_refund + Auto-Close Trigger Summary

> **MANDATORY AGENT GUARDRAIL — E2E runs and browser console**
>
> On **every** E2E test run (Playwright, CI, or agent retry loops), **tail or otherwise capture the browser console for that run** (project-standard: trace/console events, reporter output, headed DevTools, or equivalent) and **read it before concluding why a test failed or before re-running the same spec**. Failures are often explained only in the console (uncaught exceptions, failed network calls, React errors, hydration warnings). **Do not** repeatedly execute the same failing E2E in a tight loop without console evidence — that burns tokens and time while the real signal sits in logs the agent never opened. Treat “console captured and reviewed for this run” as **non-optional** and part of the same step as “test run completed.”

Three SQL migration files implementing five SECURITY DEFINER RPCs (four split modes + refund) and one AFTER INSERT trigger for parent tab auto-close when all sub-tabs are paid.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Split tab RPCs migration (4 RPCs) | 1c8a0ba | `20260427000002_split_tab_rpcs.sql` |
| 2 | process_refund RPC + auto-close trigger | ce49092 | `20260427000003_process_refund_rpc.sql`, `20260427000004_parent_auto_close_trigger.sql` |

## What Was Built

### Migration 2: `20260427000002_split_tab_rpcs.sql`

Four SECURITY DEFINER RPCs inside a single BEGIN/COMMIT:

1. **`split_tab_by_item(p_parent_tab_id, p_assignments)`** — Creates one sub-tab per assignment. Validates parent is open, no item assigned twice (ITEM_ASSIGNED_TWICE), all items belong to parent (ITEM_NOT_IN_PARENT). Creates sub-tab + order row, reassigns order_items, cascades combo children via `parent_order_item_id`. Returns `uuid[]` of created sub-tab IDs. Marks parent `status='split'`.

2. **`split_tab_evenly(p_parent_tab_id, p_n)`** — No sub-tabs created. Computes parent total from top-level order_items only (excludes combo children). Returns `{per_payment_amount, cents_remainder}` for client-side N-payment loop. Floor-to-cent rounding; last payment absorbs remainder.

3. **`split_tab_by_person(p_parent_tab_id, p_n, p_assignments)`** — Like by_item but pads assignments array to p_n if fewer provided. Unassigned items remain in parent orders (reference only, not moved). Returns `uuid[]` of created sub-tab IDs.

4. **`split_tab_by_amount(p_parent_tab_id, p_amounts)`** — Validates `SUM(amounts) = parent_total ± 0.01`. Greedy proportional item allocation: items sorted DESC by line-value, each assigned to sub-tab with largest remaining bucket. Overflow falls to last sub-tab. Combo children cascade automatically. Returns `uuid[]`.

### Migration 3: `20260427000003_process_refund_rpc.sql`

`process_refund(p_original_payment_id, p_items, p_reason, p_manager_pin)`:
- Manager/admin role check via `auth.uid()` join on profiles (raises `AUTH_FORBIDDEN`)
- Fetches original payment, validates it is not itself a refund
- Computes already-refunded amount; raises `REFUND_EXCEEDS_ORIGINAL` if exceeded
- Inserts `refunds` row, then per-item `refund_items` rows
- For each item: `ITEM_NOT_IN_ORIGINAL_ORDER` check via `order_items → orders → tab_id`
- `restock=true` items call `deplete_for_order_item` wrapped in `EXCEPTION WHEN undefined_function` (Phase 4 stub)
- Inserts negative payment row: `amount = -v_refund_total, is_refund = true`
- Audit log insert wrapped in `EXCEPTION WHEN undefined_table`
- Returns `v_refund_id uuid`

### Migration 4: `20260427000004_parent_auto_close_trigger.sql`

`check_parent_tab_auto_close()` AFTER INSERT trigger on `payments`:
- First guard: `IF NEW.is_refund THEN RETURN NEW` — refund rows never trigger close logic
- Looks up `parent_tab_id` from the paid tab; returns if NULL (not a sub-tab)
- Counts unpaid sub-tabs (`status != 'paid'`) under the parent
- If count = 0: `UPDATE tabs SET status='paid', closed_at=now()` where `status='split'` (idempotent guard)
- `DROP TRIGGER IF EXISTS` before creation for safe re-application

## Deviations from Plan

### Auto-fixed Issues (Rule 1 - Bugs in Plan-Provided SQL)

**1. [Rule 1 - Bug] Wrong column name: `opened_by` does not exist on tabs**
- **Found during:** Task 1, examining the actual schema
- **Issue:** Plan SQL used `v_parent.opened_by` but the `tabs` table has `staff_id`, not `opened_by`
- **Fix:** Used `v_parent.staff_id` in all sub-tab INSERT statements
- **Files modified:** `20260427000002_split_tab_rpcs.sql`

**2. [Rule 1 - Bug] Missing required NOT NULL column: tabs.shift_id**
- **Found during:** Task 1, examining the actual schema
- **Issue:** Plan SQL did not include `shift_id` in sub-tab INSERT, but `shift_id UUID NOT NULL` is enforced
- **Fix:** Propagated `v_parent.shift_id` to all sub-tab INSERT statements
- **Files modified:** `20260427000002_split_tab_rpcs.sql`

**3. [Rule 1 - Bug] customer_name_or_table CHECK would block sub-tab INSERT**
- **Found during:** Task 1, examining the actual schema
- **Issue:** `tabs` has `CONSTRAINT customer_name_or_table CHECK (customer_name IS NOT NULL OR table_number IS NOT NULL)`; sub-tabs have neither
- **Fix:** Used `split_label` as `customer_name` for sub-tab INSERTs (always provided by caller)
- **Files modified:** `20260427000002_split_tab_rpcs.sql`

**4. [Rule 1 - Bug] orders.label column does not exist; staff_id is NOT NULL**
- **Found during:** Task 1, examining the actual schema
- **Issue:** Plan SQL used `INSERT INTO orders (tab_id, label, status)` but `orders` has no `label` column; `staff_id UUID NOT NULL` is required
- **Fix:** Used `INSERT INTO orders (tab_id, staff_id, status)` with `v_parent.staff_id`
- **Files modified:** `20260427000002_split_tab_rpcs.sql`

**5. [Rule 1 - Bug] order_items column is `quantity`, not `qty`**
- **Found during:** Task 1, verifying against actual schema in `20260414000004_tabs_and_orders.sql`
- **Issue:** Plan SQL used `oi.qty` but the actual column is `order_items.quantity`
- **Fix:** All references use `oi.quantity`
- **Files modified:** `20260427000002_split_tab_rpcs.sql`

## Threat Model Coverage

| Threat ID | Disposition | Implementation |
|-----------|-------------|----------------|
| T-06-04 | mitigated | `AUTH_FORBIDDEN` raised when `profiles WHERE id = auth.uid() AND role IN ('manager', 'admin')` finds no row |
| T-06-05 | mitigated | `REFUND_EXCEEDS_ORIGINAL` guard: `v_refund_total > (v_payment.amount - v_already_refunded)` |
| T-06-06 | mitigated | `ITEM_ASSIGNED_TWICE` tracked via `v_assigned_ids uuid[]` array in split_tab_by_item and split_tab_by_person |
| T-06-07 | mitigated | `ITEM_NOT_IN_ORIGINAL_ORDER` check: `order_items JOIN orders WHERE o.tab_id = v_payment.tab_id` |
| T-06-08 | mitigated | Negative payment only via `process_refund` which sets `is_refund=true`; DB CHECK enforces |
| T-06-09 | mitigated | Trigger first guard: `IF NEW.is_refund THEN RETURN NEW` — refund payments never trigger auto-close |

## Known Stubs

1. **deplete_for_order_item** (`20260427000003_process_refund_rpc.sql`, line ~82): Phase 4 inventory depletion function not yet built. Call is wrapped in `EXCEPTION WHEN undefined_function THEN NULL`. Will auto-activate when Phase 4 deploys the function.

2. **audit_log INSERT** (`20260427000003_process_refund_rpc.sql`, line ~95): audit_log table does not yet exist. INSERT wrapped in `EXCEPTION WHEN undefined_table THEN NULL`. Will auto-activate when audit_log migration is applied.

## Self-Check: PASSED

- `bar-pos/supabase/migrations/20260427000002_split_tab_rpcs.sql` exists with 4 CREATE OR REPLACE FUNCTION statements
- `bar-pos/supabase/migrations/20260427000003_process_refund_rpc.sql` exists with REFUND_EXCEEDS_ORIGINAL, AUTH_FORBIDDEN, undefined_function guard
- `bar-pos/supabase/migrations/20260427000004_parent_auto_close_trigger.sql` exists with check_parent_tab_auto_close function and trigger
- All three files have BEGIN/COMMIT wrappers
- Commit `1c8a0ba` exists (Task 1)
- Commit `ce49092` exists (Task 2)
