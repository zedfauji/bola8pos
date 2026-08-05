---
created: 2026-08-04T00:00:00.000Z
title: Admin cannot create any promotion — default draft insert violates a DB check constraint
area: promotions
severity: critical
files:
  - src/entities/promotion/model/queries.ts (useMutationCreatePromotion, lines 88-118)
  - supabase/migrations/20260710000001_promotions_schema.sql (promotions_item_target_check, line 26)
  - e2e/43-promotions.spec.ts (T1 — confirms the break; do not "fix" by relaxing this test)
---

## Problem

Clicking "+ Add promotion" in Settings → Promotions fails for every admin, every time.
Confirmed live via browser console capture during 39-07 (E2E triage):

```
useMutationCreatePromotion: insert failed {
  "error": {
    "code": "23514",
    "message": "new row for relation \"promotions\" violates check constraint \"promotions_item_target_check\""
  }
}
```

`useMutationCreatePromotion` (`src/entities/promotion/model/queries.ts:88-118`) inserts a new
draft row with `target_type: 'item'` but never sets `target_product_id`. The DB constraint added
in `supabase/migrations/20260710000001_promotions_schema.sql:26` —
`CHECK (target_type <> 'item' OR target_product_id IS NOT NULL)` — rejects that insert on every
attempt. There is no code path that lets an admin get past this: the "Edit Promotion" dialog never
opens because the mutation that's supposed to create the draft it edits always throws first.

## Solution

Pick one:
1. Insert with `target_type: null` (or another placeholder that satisfies both check constraints
   — `promotions_item_target_check` and `promotions_category_target_check`) and let the
   `PromotionBuilderForm` inside the edit dialog set a real `target_type` + target id on first save.
2. Insert with a minimal valid combination that already satisfies the constraint (e.g. omit
   `target_type` entirely so it falls back to whatever the column's own DB default is, if any —
   check the column definition), then require the form to select a real target before the first
   save succeeds.

Either way, add a regression test (unit test on the mutation, or re-verify via
`e2e/43-promotions.spec.ts` T1, which currently fails on this exact constraint and should start
passing once fixed — no test-side change is needed).
