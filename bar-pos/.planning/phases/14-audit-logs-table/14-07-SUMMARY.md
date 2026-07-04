---
phase: 14-audit-logs-table
plan: 07
subsystem: api
tags: [supabase, edge-function, deno, audit, void]

requires:
  - phase: 14-audit-logs-table (14-01)
    provides: "Confirmed void-order Edge Function is NOT deployed remotely — build from scratch"
  - phase: 14-audit-logs-table (14-02)
    provides: "recordAudit()/_shared/audit.ts supports actorId + terminalId params"
provides:
  - "supabase/functions/void-order/index.ts — new Edge Function satisfying VoidOrderRequestSchema/VoidOrderResponseSchema"
  - "order.void audit row emitted on every successful void, actorId = staffId, source 'edge'"
affects: [14-08, 14-14]

tech-stack:
  added: []
  patterns:
    - "void-order Edge Function mirrors process-payment's Deno template (createClient esm.sh pin, zod deno.land pin, corsHeaders, jsonResponse, OPTIONS preflight, service-role client) — new edge functions should keep copying this skeleton for consistency"

key-files:
  created:
    - supabase/functions/void-order/index.ts
  modified: []

key-decisions:
  - "Void semantics use UPDATE orders SET status = 'voided' WHERE id = orderId (order_status enum: pending/served/voided, confirmed via supabase/migrations/20260414000001_enums.sql + 20260414000004_tabs_and_orders.sql) — no orders.is_voided boolean column exists, so the plan's alternative representation was not applicable"
  - "Inventory reversal deliberately NOT performed in the edge function — src/features/void-order/model/useVoidOrder.ts already calls deplete_for_order_item(-1) client-side after callVoidOrder succeeds; duplicating it server-side would double-reverse stock"
  - "before-state captured via a SELECT on orders (id, status, tab_id) prior to the UPDATE, passed to recordAudit's before param for the diff view built in 14-04"

patterns-established:
  - "recordAudit call sits directly after the mutation and before the success jsonResponse, outside any try/catch that could alter the response — matches the 14-02 pattern note that edge functions should pass actorId/terminalId explicitly since service-role clients bypass auth.uid()"

requirements-completed: [SC4]

duration: ~15min
completed: 2026-07-04
---

# Phase 14 Plan 07: void-order Edge Function + order.void audit wiring Summary

**New `supabase/functions/void-order/index.ts` Edge Function (built from scratch per 14-01) validates VoidOrderRequestSchema, flips `orders.status` to `'voided'`, and emits a fire-and-forget `recordAudit('order.void', actorId: staffId, source: 'edge')` on every successful void**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-04T20:10:00Z
- **Completed:** 2026-07-04T20:25:00Z
- **Tasks:** 2/2 complete
- **Files modified:** 1 (created)

## Accomplishments

- **Task 1** — Authored `supabase/functions/void-order/index.ts` from scratch (14-01 confirmed no live deployment to recover). Mirrors `process-payment/index.ts`'s Deno structure: `createClient` from the pinned `esm.sh/@supabase/supabase-js@2.49.1`, `z` from the pinned `deno.land/x/zod@v3.23.8`, shared `corsHeaders`/`jsonResponse`/OPTIONS-preflight handling, service-role client built from `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`. `BodySchema` matches `VoidOrderRequestSchema` field-for-field (`orderId` uuid, `reason` min(1)/max(500), `staffId` uuid, `amount?` non-negative money, `inventoryRestoreItems?` array of `{orderItemId, productId, quantity}`). Grepped `supabase/migrations` for the void representation: `orders.status order_status` enum (`'pending' | 'served' | 'voided'`, no `is_voided` boolean anywhere in the schema) — so void = `UPDATE orders SET status = 'voided' WHERE id = orderId`. Captures a before-state row (`id, status, tab_id`) prior to the update for the audit diff. Returns `{ success: true, voidedAt }` (200) on success, `{ success: false, error }` on validation failure (400) or internal error (500). Does not reverse inventory — confirmed from `useVoidOrder.ts` that the client performs `deplete_for_order_item(-1)` after `callVoidOrder()` succeeds.
- **Task 2** — Wired `recordAudit` from `../_shared/audit.ts`: on the success path (immediately after the `orders` UPDATE, before the 200 `jsonResponse`), calls `recordAudit(supabase, { action: 'order.void', entityType: 'order', entityId: orderId, before: beforeRow, after: { reason, voidedAt }, source: 'edge', actorId: staffId })`. `recordAudit` is fire-and-forget (internal try/catch swallows all errors) and is not inside any try/catch that would alter the 200 response. Used the enumerated label `'order.void'` (confirmed present in `src/shared/lib/audit-actions.ts` line 32/63) — did not touch `'tab.void'` (reserved for a future whole-tab void per RESEARCH.md Pitfall 7).

## Task Commits

Each task was committed atomically:

1. **Task 1: Author the void-order Edge Function satisfying the void contract** - `9277d14` (feat)
2. **Task 2: Wire recordAudit('order.void') into the void-order success path** - `8270c13` (feat)

**Plan metadata:** (this SUMMARY commit)

## Files Created/Modified

- `supabase/functions/void-order/index.ts` - New Deno Edge Function: validates VoidOrderRequestSchema, voids `orders.status = 'voided'`, records an `order.void` audit row, returns VoidOrderResponseSchema-shaped JSON

## Decisions Made

- Void representation confirmed as `orders.status = 'voided'` (enum), not a boolean flag — resolved the plan's "grep for is_voided or status" ambiguity by checking the actual migration files (`20260414000001_enums.sql`, `20260414000004_tabs_and_orders.sql`); no `is_voided` column exists anywhere in the schema.
- No inventory reversal logic added to the edge function — the client (`useVoidOrder.ts`) already owns that responsibility via `deplete_for_order_item(-1)`; duplicating it here would double-reverse stock. `inventoryRestoreItems` is accepted/validated in the request body (matching the contract) but intentionally unused inside the function body, consistent with the plan's explicit instruction.

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched their `<action>` and `<acceptance_criteria>` blocks; the void-representation grep confirmed the enum-based approach the plan anticipated as one of two possibilities.

## Issues Encountered

- Fresh worktree checkout had no `node_modules` — ran `npm install` (~1240 packages) to enable `npm run typecheck` verification. Not a plan deliverable, noted for visibility. `supabase/functions/**` is outside `tsconfig.json`'s `include` (`src`, `scripts`) and outside `npm run lint`'s target (`eslint src`), consistent with the existing `process-payment/index.ts` — so this new file is not linted/typechecked by the project's standard gates (matches existing precedent for Deno edge functions).
- `.planning/` is gitignored in this repo except for previously force-added files; this SUMMARY.md is being committed per the parallel-execution instructions despite that.

## User Setup Required

None - no external service configuration required. Deployment (`supabase functions deploy void-order`) happens in 14-14 per the plan's `<done>` note; this plan only authors the source.

## Next Phase Readiness

- 14-08's sensitive-edge coverage test (allowlist including void-order) can now assert against a real file.
- 14-14's E2E `order.void` filter test restoration is unblocked — the edge function exists and emits the expected audit action label.
- 14-14's deploy gate must include `supabase functions deploy void-order` (new function, never deployed before).

---
*Phase: 14-audit-logs-table*
*Completed: 2026-07-04*
