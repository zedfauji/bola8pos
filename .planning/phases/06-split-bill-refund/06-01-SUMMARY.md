---
phase: 06-split-bill-refund
plan: "01"
subsystem: database-migrations
tags: [split-bill, refund, schema, migrations, postgresql]
dependency_graph:
  requires: []
  provides: [split-bill-schema, refund-schema, tab-status-split-enum]
  affects: [tabs, payments, refunds, refund_items]
tech_stack:
  added: []
  patterns: [no-transaction-enum-migration, rls-manager-only-insert]
key_files:
  created:
    - bar-pos/supabase/migrations/20260427000000_tab_status_split_enum.sql
    - bar-pos/supabase/migrations/20260427000001_split_bill_schema.sql
  modified: []
decisions:
  - "ALTER TYPE ADD VALUE migration has no BEGIN/COMMIT wrapper (PostgreSQL restriction)"
  - "refunds INSERT RLS restricts to manager/admin via auth.uid() check on profiles"
  - "amount_positive CHECK allows negative amounts only when is_refund=true (tamper prevention)"
  - "closed_at_requires_closed_status CHECK recreated to allow status='split' with NULL closed_at"
metrics:
  duration: "2min"
  completed_date: "2026-04-24"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
---

# Phase 06 Plan 01: Split Bill + Refund Schema Migrations Summary

> **MANDATORY AGENT GUARDRAIL — E2E runs and browser console**
>
> On **every** E2E test run (Playwright, CI, or agent retry loops), **tail or otherwise capture the browser console for that run** (project-standard: trace/console events, reporter output, headed DevTools, or equivalent) and **read it before concluding why a test failed or before re-running the same spec**. Failures are often explained only in the console (uncaught exceptions, failed network calls, React errors, hydration warnings). **Do not** repeatedly execute the same failing E2E in a tight loop without console evidence — that burns tokens and time while the real signal sits in logs the agent never opened. Treat “console captured and reviewed for this run” as **non-optional** and part of the same step as “test run completed.”

Two SQL migration files extend the PostgreSQL schema for Split Bill + Refund: a no-transaction ENUM extension for `tab_status` and a transactional DDL migration adding sub-tab columns, refund tables, and CHECK constraint fixes.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | ENUM extension migration (no transaction) | e967165 | `20260427000000_tab_status_split_enum.sql` |
| 2 | Main schema migration | c6ed964 | `20260427000001_split_bill_schema.sql` |

## What Was Built

### Migration 1: `20260427000000_tab_status_split_enum.sql`
- Extends `tab_status` ENUM with `'split'` value using `IF NOT EXISTS`
- Intentionally has no `BEGIN`/`COMMIT` wrapper — PostgreSQL does not allow `ALTER TYPE ADD VALUE` inside a transaction block
- Must be applied before `20260427000001`

### Migration 2: `20260427000001_split_bill_schema.sql`
Six DDL sections inside a single `BEGIN/COMMIT` transaction:

1. **tabs sub-tab columns** — `parent_tab_id` (self-referencing FK with `ON DELETE RESTRICT`), `split_mode` (checked enum: item/evenly/by_person/by_amount), `split_label` text; partial index on `parent_tab_id`
2. **CHECK constraint fix** — `closed_at_requires_closed_status` dropped and recreated to allow `status IN ('open', 'split')` when `closed_at IS NULL`
3. **`refunds` table** — `id`, `original_payment_id` (FK to payments), `reason` (enum-checked text), `amount` (positive), `created_by` (FK to profiles), `created_at`; RLS: authenticated SELECT, manager/admin INSERT
4. **`refund_items` table** — `refund_id` (FK to refunds, cascade delete), `order_item_id` (FK to order_items), `qty`, `amount`, `restock` boolean; same RLS pattern; two indexes
5. **payments columns** — `is_refund boolean NOT NULL DEFAULT false`, `refund_id uuid REFERENCES refunds`
6. **CHECK constraint fix** — `amount_positive` dropped and recreated as `CHECK (amount > 0 OR is_refund = true)` to allow negative payment amounts on refund rows

## Deviations from Plan

None - plan executed exactly as written.

## Threat Model Coverage

| Threat ID | Disposition | Implementation |
|-----------|-------------|----------------|
| T-06-01 | mitigated | `refunds_insert_manager` RLS policy: `role IN ('manager', 'admin')` checked via `auth.uid()` join on profiles |
| T-06-02 | mitigated | `amount_positive` CHECK: `amount > 0 OR is_refund = true` — only RPC-inserted refund rows can have negative amounts |
| T-06-03 | mitigated | `closed_at_requires_closed_status` correctly excludes 'split' from the `closed_at IS NOT NULL` branch |

## Known Stubs

None.

## Self-Check: PASSED

- `bar-pos/supabase/migrations/20260427000000_tab_status_split_enum.sql` exists
- `bar-pos/supabase/migrations/20260427000001_split_bill_schema.sql` exists
- Commit `e967165` exists (Task 1)
- Commit `c6ed964` exists (Task 2)
- ENUM file contains no `BEGIN;` or `COMMIT;` statements (only in comment text)
- Schema file contains: `parent_tab_id`, `is_refund`, `refund_items`, `closed_at_requires_closed_status`, `amount_positive` (22 grep hits)
