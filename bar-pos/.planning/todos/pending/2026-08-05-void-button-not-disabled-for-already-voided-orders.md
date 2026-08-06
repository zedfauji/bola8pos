---
created: 2026-08-05T00:00:00.000Z
title: Void button stays enabled for an already-voided order; edge function has no re-void guard
area: void-order
severity: minor
files:
  - src/widgets/OrderPanel/ActiveTabSelector.tsx:140-172 (order-history void-button list)
  - supabase/functions/void-order/index.ts (no status check before update)
---

## Problem

Discovered during Phase 39's E2E triage of `e2e/18-void-order.spec.ts` V7 ("void an
already-voided order — button disabled or error shown"), traced with a live run +
source read (2026-08-05).

`ActiveTabSelector.tsx`'s order-history section (`currentTab.orders.map(order =>
...)`) renders a `void` button for **every** order in the tab regardless of
`order.status` — there is no `order.status !== 'voided'` filter or disabled
condition. The only gating applied is RBAC (`ProtectedAction action="void_order"`),
which controls *who* can click void, not *whether this particular order can still
be voided*. Confirmed live: seeding a tab whose only order is already
`status: 'voided'` still renders an enabled, clickable void button for it.

Server-side, `supabase/functions/void-order/index.ts` fetches the order's
`status` for the audit "before" snapshot but never checks it before proceeding —
it unconditionally runs `update({ status: 'voided' })`. Re-voiding an
already-voided order currently: (1) succeeds silently (200 response, no error
surfaced to the user), (2) writes a second `order.void` audit record indicating a
duplicate action, (3) re-triggers the client's `deplete_for_order_item(-1)`
inventory-reversal loop — which is idempotent at the DB level (`23505` on the
unique constraint, explicitly caught and ignored), so inventory is not actually
double-restored, but the redundant calls and audit noise are still a real gap.

Not a data-integrity risk (idempotent reversal), but a real UX/audit-trail gap: a
staff member can click void twice (e.g. on stale UI, double-tap, or a page that
didn't refresh) with zero feedback that the order was already voided.

## Solution

TBD. Options to evaluate:
- Client: skip rendering (or render disabled) the void button for orders whose
  `status === 'voided'` in `ActiveTabSelector.tsx`'s order-history list.
- Server: add a `beforeRow.status === 'voided'` check in
  `supabase/functions/void-order/index.ts` that returns a `400`/explicit error
  instead of silently re-succeeding, so the client's existing `toast.error(...)`
  path surfaces it if the client-side check is somehow bypassed.
