---
phase: 23-reopen-closed-ticket
reviewed: 2026-07-20T00:00:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - e2e/48-reopen-closed-ticket.spec.ts
  - src/entities/payment/model/queries.ts
  - src/entities/payment/model/store.test.ts
  - src/entities/payment/model/types.ts
  - src/features/reopen-tab/index.ts
  - src/features/reopen-tab/model/reopen-tab-rpc.integration.test.ts
  - src/features/reopen-tab/model/useReopenTab.ts
  - src/features/reopen-tab/ui/ReopenTabDialog.tsx
  - src/shared/lib/audit-actions.ts
  - src/shared/lib/domain.ts
  - src/shared/lib/i18n/locales/en-US/featOrders.json
  - src/shared/lib/i18n/locales/en-US/wPanels.json
  - src/shared/lib/i18n/locales/es-MX/featOrders.json
  - src/shared/lib/i18n/locales/es-MX/wPanels.json
  - src/shared/lib/rbac.test.ts
  - src/shared/lib/rbac.ts
  - src/shared/lib/supabase.types.ts
  - src/widgets/PaymentPane/ui/PaymentPane.tsx
  - src/widgets/RBACDashboard/PermissionMatrix.test.tsx
  - supabase/migrations/20260720000002_payments_status_column.sql
  - supabase/migrations/20260720000003_tabs_reopen_columns.sql
  - supabase/migrations/20260720000004_reopen_tab_rpc.sql
  - supabase/migrations/20260720000005_fix_payment_sums_exclude_reopened_void.sql
findings:
  critical: 1
  warning: 4
  info: 1
  total: 6
status: issues_found
---

# Phase 23: Code Review Report

**Reviewed:** 2026-07-20T00:00:00Z
**Depth:** standard
**Files Reviewed:** 22 (23 listed; `supabase.types.ts` and `rbac.test.ts`/`rbac.ts` counted individually below)
**Status:** issues_found

## Summary

Reviewed the reopen-closed-ticket feature end-to-end: the `reopen_tab` RPC and its
four companion migrations, the `useReopenTab`/`ReopenTabDialog` client feature,
the `payments.status`/`tabs.reopen_count` schema additions, RBAC wiring, i18n
catalogs, and the E2E/integration test suites.

The overall shape is sound — the version-guard, 24h-window, 2x-cap, and
manager-role re-check inside `reopen_tab` are all correctly implemented and
exercised by the integration suite, and the migration that patches the five
pre-existing payment-summing sites (`process_payment_atomic`,
`process_split_payment_atomic`, `process_refund`, `get_caja_report`,
`close_caja_session`) to exclude `reopened_void` rows is thorough and
verified by a dedicated "double-count regression" test.

However, tracing `reopen_tab`'s own accounting logic against the feature's own
stated cap (2 reopens per tab) surfaces a real financial double-counting bug
(CR-01) that is not covered by the existing integration tests — every test in
the suite only exercises a *single* reopen per tab. Several smaller
consistency/quality issues in the client feature and shared schema are also
reported below.

## Critical Issues

### CR-01: `reopen_tab`'s offsetting caja expense double-counts on a tab's second reopen

**File:** `supabase/migrations/20260720000004_reopen_tab_rpc.sql:119-124`

**Issue:** The voided-payment total used to size the offsetting `caja_entries`
expense row is computed as the sum of **every** payment row currently marked
`reopened_void` for the tab, not just the rows this specific call just
transitioned:

```sql
UPDATE payments
SET status = 'reopened_void', updated_at = NOW()
WHERE tab_id = p_tab_id AND is_refund = false AND status = 'completed';

SELECT COALESCE(SUM(amount), 0) INTO v_voided_total
FROM payments WHERE tab_id = p_tab_id AND status = 'reopened_void';
```

`reopen_count` is capped at 2 (D-03), meaning a tab can legitimately go
through this flow twice. Trace the second reopen:

1. Tab X: payment A = $20, `completed`. Reopen #1 flips A → `reopened_void`.
   `v_voided_total` = SUM(status='reopened_void') = $20 (only A exists yet).
   Caja expense inserted: **$20** — correct.
2. Tab X is re-paid in full: payment B = $20, `completed`. Tab closes again.
3. Reopen #2 (`reopen_count` 1→2, still within the cap): the `UPDATE ...
   WHERE status = 'completed'` only matches B (A is already
   `reopened_void`, so the `status = 'completed'` filter correctly skips
   it). B → `reopened_void`.
4. The re-select `SUM(amount) WHERE status = 'reopened_void'` now returns
   **A + B = $40**, not B's $20. The caja expense inserted for reopen #2 is
   **$40** instead of $20.

Net effect across the two reopens: $20 (reopen #1) + $40 (reopen #2) = $60 in
recorded expense for a tab where only $40 of revenue was ever actually
reversed (two $20 payments, each voided once). `get_caja_report`'s
`totalExpenses`/`netBalance` — and by extension the daily caja reconciliation
a manager signs off on — is overstated by the amount of every prior reopen's
already-voided total, compounding with every subsequent reopen of the same
tab. This is exactly the class of bug the accompanying migration
(`20260720000005`) was written to prevent for the *other* payment-summing
sites, but this specific RPC's own new logic reintroduces it.

None of the existing tests catch this: `reopen-tab-rpc.integration.test.ts`'s
cap-exceeded test (`SC-3`) sets `reopen_count = 2` directly via the
service-role client rather than driving two real reopen+repay cycles, so the
double-count path is never exercised.

**Fix:** Capture the amount actually voided by *this* statement (e.g. via
`RETURNING`) instead of re-deriving it from a filter that also matches
previously-voided rows:

```sql
WITH newly_voided AS (
  UPDATE payments
  SET status = 'reopened_void', updated_at = NOW()
  WHERE tab_id = p_tab_id AND is_refund = false AND status = 'completed'
  RETURNING amount
)
SELECT COALESCE(SUM(amount), 0) INTO v_voided_total FROM newly_voided;
```

Recommend also adding an integration test that reopens the same tab twice
(reopen → repay in full → reopen again) and asserts the second reopen's
`voidedPaymentTotal` / caja expense equals only the second payment's amount.

## Warnings

### WR-01: `tabs.reopen_count` / `tabs.last_reopened_at` are selected but never mapped into `Tab`, making the new domain fields permanently `undefined`

**File:** `src/shared/lib/domain.ts:458-461`

**Issue:** `TabSchema` gained `reopenCount` and `lastReopenedAt` for this
phase. `entities/tab/model/queries.ts`'s `tabListSelect` uses `select('*', ...)`
so the raw `reopen_count`/`last_reopened_at` columns *are* fetched from
Postgres on every tab query, but `mapTabRow` (the sole function that
constructs a `Tab` from a raw row) never reads or passes them into
`TabSchema.parse(...)`. Since both fields are `.optional()`, this doesn't
throw — it just means every `Tab` object anywhere in the client is silently
missing this data, even though the RPC (`reopen_tab`) and DB
(`supabase.types.ts`) both fully support it. A regression check confirms
zero other read sites: `reopenCount`/`lastReopenedAt` only appear in
`domain.ts`, `supabase.types.ts`, and the integration test file.

**Fix:** If these fields are meant to back any current or near-term UI (e.g.
showing "reopened 1/2 times" or the remaining 24h window), wire them through
`mapTabRow` in `entities/tab/model/queries.ts`:

```ts
...(typeof (row as { reopen_count?: number }).reopen_count === 'number'
  ? { reopenCount: (row as { reopen_count?: number }).reopen_count }
  : {}),
...(row.last_reopened_at
  ? { lastReopenedAt: new Date(row.last_reopened_at) }
  : {}),
```

If no client surface currently needs them (D-06 says there is intentionally
no "reopened mode" UI), consider removing the two fields from `TabSchema`
until something actually consumes them, to avoid a schema that silently
implies data is available when it isn't.

### WR-02: `entities/payment/model/types.ts` hand-duplicates `domain.ts`'s `PaymentSchema` instead of deriving from it

**File:** `src/entities/payment/model/types.ts:7-27` vs `src/shared/lib/domain.ts:615-646`

**Issue:** The project convention (CLAUDE.md: "Types: Single source of truth
is `src/shared/lib/domain.ts` … Never manually write entity types — infer
from Zod") is violated here: `entities/payment/model/types.ts` defines its
own independent `PaymentSchema` rather than reusing/extending
`domain.ts`'s. This phase added the same `status: z.enum(['completed',
'reopened_void']).default('completed')` field by hand to *both* schemas.
They have already drifted in other ways (e.g. `entities/payment`'s
`method` enum omits nothing extra, but it's missing `paymentGroupId`,
`splitIndex`, and the discount fields that `domain.ts`'s `PaymentSchema` has
had since Phase 18/related work), so a future change to one copy (e.g. a
third `status` value, or a tightened `isRefund` default) can silently pass
one code path's validation while failing (or worse, quietly diverging from)
the other.

**Fix:** Not blocking for this phase, but flagging because this phase's diff
directly touched both copies in lockstep. Consider consolidating
`entities/payment/model/types.ts` to `import { PaymentSchema } from
'@shared/lib/domain'` (optionally `.pick`/`.omit` for the subset the entity
layer needs) in a follow-up cleanup phase.

### WR-03: `RefundButton` and `EditTicketButton` don't hide for `reopened_void` payments, unlike the new `ReopenTabButton`

**File:** `src/widgets/PaymentPane/ui/PaymentPane.tsx:25-67`

**Issue:** `ReopenTabButton` correctly hides once a payment is voided:

```ts
if (payment.isRefund === true) return null;
if (payment.status === 'reopened_void') return null;
```

but `RefundButton` (line 31) and `EditTicketButton` (line 54) only check
`payment.isRefund === true` — neither checks `payment.status ===
'reopened_void'`. After a tab is reopened, its payment history row still
renders active "Refund" and "Edit ticket" buttons for the now-voided
payment. Clicking either is guarded server-side (migration `20260720000005`
excludes `reopened_void` rows in `process_refund`'s lookup, and
`edit_paid_tab` requires the tab to be `closed`/`paid`, which it no longer
is post-reopen), so no double-action/financial bug results — but the user
gets a confusing generic error toast (`NOT_FOUND` / `TAB_NOT_EDITABLE`)
instead of the control simply not being offered.

**Fix:** Add the same `payment.status === 'reopened_void'` guard to both
components:

```ts
function RefundButton({ payment, onRefund }: RefundButtonProps) {
  ...
  if (payment.isRefund === true || payment.status === 'reopened_void' || isFullyRefunded) return null;
  ...
}

function EditTicketButton({ payment, onEdit }: EditTicketButtonProps) {
  ...
  if (payment.isRefund === true || payment.status === 'reopened_void') return null;
  ...
}
```

### WR-04: `ReopenTabDialog`'s Cancel/success/version-conflict paths bypass the local state-reset handler

**File:** `src/features/reopen-tab/ui/ReopenTabDialog.tsx:74-90, 125-137`

**Issue:** `handleOpenChange` (lines 84-90) is the only place `reason` (and
`pinOpen`) get reset, and it's wired to the `Sheet`'s own `onOpenChange` prop
(fired by Radix on Escape/backdrop-click). But three other close paths call
the raw `onOpenChange` prop directly instead of `handleOpenChange`:

- The Cancel button: `onClick={() => { onOpenChange(false); }}` (line 125)
- The version-conflict branch inside `handleSubmitReopen`: `onOpenChange(false); return;` (line 74)
- The success branch: `toast.success(...); onOpenChange(false);` (line 81)

Because `ReopenTabDialog` is a persistently-mounted component (only its
`open`/`tabId` props change as the parent — `PaymentPane` — retargets it),
none of these three paths clear `reason`. The next time this same component
instance is opened for a *different* tab (e.g. a manager reopens two
different tickets back-to-back), the reason `Input` will show the previous
ticket's leftover text rather than starting blank, and since the `isValid`
gate only checks for non-empty trimmed text (not "was this typed for the
current tab"), it's easy to submit a stale/wrong reason into the audit
trail. (Same pattern pre-exists in `EditPaidTabDialog`, which this file
explicitly mirrors — not newly invented here, but reproducible in the file
under review.)

**Fix:** Route all three call sites through `handleOpenChange(false)`
instead of the raw prop, e.g.:

```ts
onClick={() => { handleOpenChange(false); }}
```

and in `handleSubmitReopen`, replace both `onOpenChange(false)` calls with
`handleOpenChange(false)`.

## Info

### IN-01: Redundant default-fallback in `mapPaymentRow`

**File:** `src/entities/payment/model/queries.ts:46`

**Issue:** `status: row['status'] ?? 'completed'` is passed into
`PaymentSchema.parse(...)`, but `PaymentSchema.status` already declares
`.default('completed')`, so `undefined` would resolve to `'completed'`
without the explicit `?? 'completed'`. Harmless (belt-and-suspenders), just
noting for consistency with the rest of `mapPaymentRow`, which relies on
Zod defaults elsewhere (e.g. `isRefund`).

**Fix:** Optional cleanup — drop the `?? 'completed'` and let
`PaymentSchema`'s own default apply, or keep it if the team prefers
explicitness at the mapping boundary; not worth a dedicated change on its
own.

---

_Reviewed: 2026-07-20T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
