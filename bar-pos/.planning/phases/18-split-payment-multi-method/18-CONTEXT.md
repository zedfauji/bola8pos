# Phase 18: Split Payment (Multi-Method) - Context

**Gathered:** 2026-07-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Allow closing a single tab with up to 4 payment rows (mixed methods) in one atomic checkout — e.g. half cash + half card, or cash + card + rappi legs. Add `payment_group_id` + `split_index` to `payments`, relax the current `UNIQUE(tab_id)` constraint, and extend the payment RPC + `PaymentForm` UI to support multi-row entry, submission, validation, and per-leg receipts. Single-method close (existing flow) must keep working unchanged.

</domain>

<decisions>
## Implementation Decisions

### Entry point & method mix
- **D-01:** Add a "Split payment" toggle inside the existing `PaymentForm` (`src/widgets/PaymentModal/ui/PaymentForm.tsx`) — no separate dedicated screen/flow.
- **D-02:** Any enabled method (cash / card / rappi) can appear in any row, including multiple rows of the same method (e.g. two card charges). Up to 4 rows total.

### Row fields & per-row behavior
- **D-03:** Each split row keeps the same per-method fields as the single-payment flow today:
  - Cash row: own tendered-amount input + own change-due display.
  - Card row: own optional reference # field.
  - Each row also has its own **tip** field (per-row tip entry, not a single tip on the whole tab).
- **D-04:** Discount and tax are still computed **once** on the full tab subtotal (same as today) — not per row.

### Split total validation
- **D-05:** The value each row's cashier enters is toward **subtotal + tax** (the same base total computed once, same as the current single-payment flow). The sum of all row amounts must equal that single subtotal+tax total.
- **D-06:** Each row's tip is separate and additive — tips do **not** count toward the required split-total sum. A row's actual charge = its amount (portion of subtotal+tax) + its own tip.
- **D-07:** Live remaining-balance display shows `(subtotal+tax) - sum(row amounts so far)` as rows are filled in.

### Submission flow
- **D-08:** Cashier fills in all rows first (method, amount, tip, and method-specific fields per row), then submits once. Backend processes all legs in a single atomic transaction — the tab only closes if all legs succeed together (all-or-nothing, no partial-charge state).
- **D-09:** After a successful submit, receipts print/display one after another in sequence, one receipt per leg (not one combined receipt).

### Schema & backend
- **D-10:** Drop the `UNIQUE(tab_id)` constraint on `payments` (currently enforces exactly one payment row per tab — see `supabase/migrations/20260414000006_payments.sql`). Add `payment_group_id UUID` (shared across all legs of one split) and `split_index SMALLINT` (0-based row order within the group) columns.
- **D-11:** Single-method payments still work unchanged — for a single-method close, `payment_group_id` can be a fresh UUID with one row at `split_index = 0` (or null/omitted per planner's schema design — the acceptance bar is "existing single-payment tests and flows keep passing unchanged").
- **D-12:** Refunds continue to operate per-leg — `RefundSheet`/refund RPC already takes a single `paymentId` and needs no interface change; each split leg is independently refundable.

### Claude's Discretion
- Exact UI layout for adding/removing rows within `PaymentForm` (inline stacked rows vs. accordion, etc.) — no specific visual reference was given.
- Whether `payment_group_id` is nullable for single-method payments or always populated — planner/researcher should pick based on migration simplicity and query patterns.
- Idempotency-key strategy for multi-leg atomic RPC calls (single key for the whole group vs. per-leg keys) — follow the existing `process_payment_atomic` idempotency pattern as closely as possible.
- Whether the new multi-row RPC is a new function (e.g. `process_split_payment_atomic`) or an extension of `process_payment_atomic` — researcher should evaluate both against the existing edge function contract (`src/shared/lib/edge-function-contracts.ts`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & requirements
- `.planning/ROADMAP.md` §"Phase 18: Split Payment (Multi-Method)" — success criteria (payment_group_id/split_index columns, RPC accepts up to 4 rows, PaymentPane multi-row UI, single-method flow unchanged). Note: original source doc `POS-COMPARISON.md §18` is no longer present in the repo — this CONTEXT.md is now the scope source of record.

### Existing payment schema & RPC
- `supabase/migrations/20260414000006_payments.sql` — current `payments` table definition, including the `UNIQUE(tab_id)` constraint that must be relaxed.
- `supabase/functions/process-payment/index.ts` — current single-payment edge function; calls `process_payment_atomic` RPC, builds receipt data (items, pool charges, tip, tax, tendered/change). Split flow's receipt-building logic should follow this same pattern per-leg.
- `src/shared/lib/edge-function-contracts.ts` (`ProcessPaymentRequestSchema`, `ProcessPaymentSuccessSchema`, `ProcessPaymentEnvelopeSchema`, `callProcessPayment`) — existing request/response contract for single payments; new split contract should follow the same conventions (Result<T>, error code mapping).

### Existing payment UI
- `src/widgets/PaymentModal/ui/PaymentForm.tsx` — the form being extended with the split toggle; contains current single-method state (method, tip, discount, tax, tendered, card reference, receipt step).
- `src/widgets/PaymentPane/ui/PaymentPane.tsx` — hosts `PaymentForm`, handles tab selection, PIN gate, and refund sheet; largely unaffected by split payment but confirms where `PaymentForm` is embedded.
- `src/features/process-refund` (`RefundSheet`) — existing per-payment refund flow; must continue working against individual split legs without modification.

### Related prior-phase context
- `.planning/phases/17-modifier-inventory-rules/17-CONTEXT.md` — most recent prior phase; no directly overlapping decisions but confirms current migration/RPC conventions (alphabetical type placement, single `db push` for combined migrations).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PaymentForm` (`src/widgets/PaymentModal/ui/PaymentForm.tsx`) — all single-payment state, tip/discount/tax calculation logic, and the `MoneyInput`/`POSButton` UI primitives are directly reusable per split row.
- `ReceiptPreview` (`src/features/process-payment/ui/ReceiptPreview.tsx`) — existing single-receipt display component; reuse per-leg since D-09 calls for one receipt per leg, shown in sequence.
- `payment-processor.ts` (`src/shared/lib/payment-processor.ts`) — `processCashPayment`/`processCardPayment`/`processRappiPayment` wrap `callProcessPayment`; a new `processSplitPayment`-style wrapper should follow the same `Result<T>` pattern.

### Established Patterns
- Edge function → Postgres RPC pattern: edge function validates request with Zod, verifies JWT via `/auth/v1/user`, calls a Postgres RPC (`process_payment_atomic`) that does the atomic write + tab-close, then edge function builds receipt data from separate `payments`/`tabs`/`orders`/`pool_sessions` queries. The new split RPC should follow this same split of responsibilities (RPC = atomic writes, edge function = receipt assembly).
- Idempotency: `process_payment_atomic` takes `p_idempotency_key`; the RPC layer treats resubmission as idempotent (`rpc.idempotent === true` in the edge function response). Preserve this for the split RPC.
- Optimistic concurrency: tabs use a `version` column + `STALE_VERSION` conflict handling (Phase 15) — the split RPC's tab-close step should participate in this same protocol.

### Integration Points
- `payments` table: needs `payment_group_id` + `split_index` columns and the `UNIQUE(tab_id)` constraint relaxed — this is the primary schema integration point (also touches `supabase/types.ts` regeneration per CLAUDE.md workflow).
- `PaymentForm.tsx`: split toggle changes render branch from single method-selection UI to a repeatable row list; `runPayment`/`handlePrimary` logic needs to branch into a new split-submit path calling the new RPC/edge function.
- `RefundSheet` / refund RPC: no code change expected, but planner should confirm refund queries (e.g. "payments for this tab") don't assume `UNIQUE(tab_id)` anywhere else in the codebase (worth a grep during research).

</code_context>

<specifics>
## Specific Ideas

- Example scenario from ROADMAP.md: "half cash, half card" — two rows, methods differ, amounts split the tab total.
- Up to 4 rows max (hard cap from ROADMAP.md success criteria).
- Receipts print in sequence, one per leg — matches how cash-drawer/print side effects already work per-payment in `PaymentForm.handlePrimary` today (drawer open + print for cash, print-only for other methods) — just needs to loop per leg.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 18-split-payment-multi-method*
*Context gathered: 2026-07-07*
