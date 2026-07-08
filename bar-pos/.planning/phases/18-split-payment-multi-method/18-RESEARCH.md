# Phase 18: Split Payment (Multi-Method) - Research

**Researched:** 2026-07-07
**Domain:** Supabase Postgres RPC + Edge Function + React payment UI (internal codebase extension, no new external packages)
**Confidence:** HIGH (all findings verified by reading live migration files, RPC bodies, and current source — this is a pure code-archaeology research task, not a third-party library task)

## Summary

This phase extends an already-multi-payment-capable schema (the `UNIQUE(tab_id)` constraint on `payments` was **already dropped** in migration `20260424000005_payments_constraint.sql`, titled "S1-05: Allow multiple payments per tab" — CONTEXT.md's D-10 instruction to "drop the UNIQUE(tab_id) constraint" is **stale**; that work is already done). What's actually missing is (1) the `payment_group_id`/`split_index` columns to tag which rows belong to one atomic split-checkout, and (2) a genuinely **atomic** multi-leg RPC — the existing `useSplitEvenly` precedent (`src/features/split-tab/model/useSplitTab.ts`) calls `callProcessPayment` N times **sequentially in a loop**, which is explicitly NOT atomic (a mid-loop failure leaves the tab partially paid). This directly conflicts with CONTEXT.md D-08's "all-or-nothing" requirement, so Phase 18 cannot reuse that pattern — it needs a new single-transaction RPC that inserts all legs in one `plpgsql` function body, following the exact structural precedent already used by `split_tab_by_item`/`split_tab_by_amount` (both accept a `jsonb` array parameter and loop with `FOR ... IN SELECT * FROM jsonb_array_elements(...)`).

The recommended shape: a new migration adds `payment_group_id UUID` + `split_index SMALLINT` (both nullable, no backfill) to `payments`; a new RPC `process_split_payment_atomic(p_tab_id, p_staff_id, p_legs jsonb, p_idempotency_key, p_expected_total, p_discount_*, p_expected_version)` validates 1–4 legs, validates `SUM(leg.amount) == p_expected_total` (±0.01, same tolerance pattern as the existing `v_paid_line + 0.0001 >= v_owed` check), inserts N payment rows sharing one `payment_group_id`, and closes the tab using the exact same "sum of all non-refund payments ≥ item subtotal" logic already in `process_payment_atomic` (this logic is unchanged and untouched — multi-row inserts already work against it because the `UNIQUE(tab_id)` constraint is already gone). A new edge function `process-split-payment` mirrors `process-payment/index.ts` structurally (JWT verify → admin.rpc → per-leg receipt assembly) rather than extending the existing edge function, to guarantee D-11's "single-method close continues to work unchanged" with zero risk of regression to the existing Zod `BodySchema`/`superRefine` validation.

**Primary recommendation:** New migration (columns + RPC) → new edge function `process-split-payment` → new `processSplitPayment` wrapper in `payment-processor.ts` → `PaymentForm.tsx` gets a `isSplitMode` toggle that swaps the single method-selector section for a 2–4 row list, reusing all existing per-row field components (`MoneyInput`, card `Input` ref field) and the existing `ReceiptPreview` component looped over a receipt queue.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Split-leg validation (sum == total, ≤4 legs, per-method field rules) | Database / Postgres RPC | API / Backend (edge function) | Money-moving invariants must be enforced in the atomic transaction, not just client-side; edge function does a thin pre-validation pass (Zod) before calling the RPC, exactly like `process-payment` does today |
| Atomic multi-row insert + tab-close decision | Database / Postgres RPC | — | `process_split_payment_atomic` must run as ONE transaction; Postgres is the only tier that can guarantee all-or-nothing across 4 inserts + 1 conditional UPDATE |
| Receipt assembly (items, pool charges, cashier/bar name) per leg | API / Backend (edge function) | — | Existing `process-payment` edge function already owns this responsibility server-side using the service-role client; the split edge function should do the same per leg to avoid duplicating item/pool-session query logic client-side |
| Split-row UI state (add/remove row, per-row method/amount/tip, live remaining balance) | Browser / Client (`PaymentForm.tsx`) | — | Pure UI state, no server round-trip needed until submit |
| Print/cash-drawer side effects (loop per leg) | Browser / Client (Tauri IPC via `pos-printer.ts`) | — | Existing single-payment flow already does this client-side post-success; split flow loops the same call |
| Refund of an individual split leg | Database / Postgres RPC (`process_refund`, unchanged) | — | `process_refund` operates on `payments.id` only — completely indifferent to `payment_group_id`/`split_index`; D-12 confirmed no code change needed |

## Project Constraints (from CLAUDE.md)

- FSD import boundaries enforced by `eslint-plugin-boundaries`: `app → pages → widgets → features → entities → shared`. `PaymentForm.tsx` lives in `widgets/PaymentModal/ui/` — it may import from `features/`, `entities/`, `shared/` but not the reverse.
- `exactOptionalPropertyTypes: true` — new split-leg mutation input types must write `field: T | undefined`, never `field?: T`.
- `noUncheckedIndexedAccess: true` — any `legs[i]` array access in the new RPC's TypeScript callers (or the Zod-parsed leg array in the edge function) returns `T | undefined` and must be checked.
- Single source of truth for types is `src/shared/lib/domain.ts` Zod schemas — new `SplitPaymentLeg`/`PaymentSchema.paymentGroupId`/`splitIndex` fields must be added there, never as hand-written interfaces.
- `src/shared/lib/supabase.types.ts` is generated — must be regenerated via `npx supabase gen types typescript --local` or, if Docker is unavailable (confirmed unavailable in this environment as of this research session — see Environment Availability below), manually extended per the documented workaround (`const db = supabase as any` + file-level eslint-disable, used repeatedly across Phases 1–17 per STATE.md decisions).
- New error codes must be added to the `AppErrorCode` union in `src/shared/lib/result.ts` before use (see `## Don't Hand-Roll` / `## Code Examples`).
- Commit convention: Conventional Commits `<type>(<phase>): <description>`, no `--no-verify`.

<phase_requirements>
## Phase Requirements

No `.planning/REQUIREMENTS.md` file exists in this repository and `POS-COMPARISON.md §18` (the originally-cited source doc) is no longer present. Per `18-CONTEXT.md`'s canonical-refs section, **18-CONTEXT.md is the scope source of record**, and `.planning/ROADMAP.md` §"Phase 18" success criteria are the closest thing to formal requirement IDs. Mapping them here as pseudo-requirements for planner traceability:

| ID | Description (from ROADMAP.md success criteria) | Research Support |
|----|-------------|------------------|
| SC-1 | `payments.payment_group_id` + `payments.split_index` columns added | See `## Standard Stack` migration recommendation and `## Code Examples` |
| SC-2 | Payment RPC accepts up to 4 method/amount rows per close, sum must equal tab total | See `process_split_payment_atomic` design in `## Architecture Patterns` |
| SC-3 | `PaymentPane`/`PaymentForm` UI supports adding/removing payment rows, live remaining-balance display | See `## Architecture Patterns` → PaymentForm split-mode branch |
| SC-4 | Single-method close (existing flow) continues to work unchanged | See `## Summary` — recommendation to add a NEW edge function/RPC rather than modify `process_payment_atomic`/`process-payment` |
</phase_requirements>

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Add a "Split payment" toggle inside the existing `PaymentForm` (`src/widgets/PaymentModal/ui/PaymentForm.tsx`) — no separate dedicated screen/flow.
- **D-02:** Any enabled method (cash / card / rappi) can appear in any row, including multiple rows of the same method (e.g. two card charges). Up to 4 rows total.
- **D-03:** Each split row keeps the same per-method fields as the single-payment flow today: cash row = own tendered-amount input + own change-due display; card row = own optional reference # field; each row also has its own per-row tip field (not one tip on the whole tab).
- **D-04:** Discount and tax are still computed **once** on the full tab subtotal (same as today) — not per row.
- **D-05:** The value each row's cashier enters is toward **subtotal + tax** (the same base total computed once, same as the current single-payment flow). The sum of all row amounts must equal that single subtotal+tax total.
- **D-06:** Each row's tip is separate and additive — tips do **not** count toward the required split-total sum. A row's actual charge = its amount (portion of subtotal+tax) + its own tip.
- **D-07:** Live remaining-balance display shows `(subtotal+tax) - sum(row amounts so far)` as rows are filled in.
- **D-08:** Cashier fills in all rows first (method, amount, tip, and method-specific fields per row), then submits once. Backend processes all legs in a single atomic transaction — the tab only closes if all legs succeed together (all-or-nothing, no partial-charge state).
- **D-09:** After a successful submit, receipts print/display one after another in sequence, one receipt per leg (not one combined receipt).
- **D-10:** Drop the `UNIQUE(tab_id)` constraint on `payments` — **RESEARCH FINDING: already done, see `## Summary`.** Add `payment_group_id UUID` (shared across all legs of one split) and `split_index SMALLINT` (0-based row order within the group) columns.
- **D-11:** Single-method payments still work unchanged — for a single-method close, `payment_group_id` can be a fresh UUID with one row at `split_index = 0` (or null/omitted per planner's schema design — the acceptance bar is "existing single-payment tests and flows keep passing unchanged").
- **D-12:** Refunds continue to operate per-leg — `RefundSheet`/refund RPC already takes a single `paymentId` and needs no interface change; each split leg is independently refundable. **RESEARCH CONFIRMED:** `process_refund` reads/writes only `payments.id`/`tab_id`/`amount`/`is_refund` — zero interaction with `payment_group_id`/`split_index`.

### Claude's Discretion

- Exact UI layout for adding/removing rows within `PaymentForm` (inline stacked rows vs. accordion, etc.) — no specific visual reference was given.
- Whether `payment_group_id` is nullable for single-method payments or always populated — planner/researcher should pick based on migration simplicity and query patterns. **Research recommendation: nullable, populate only on new-code paths going forward (both single via an updated `process_payment_atomic` grant of a fresh UUID+0, and split via the new RPC); do NOT backfill historical rows.** See `## Architecture Patterns`.
- Idempotency-key strategy for multi-leg atomic RPC calls (single key for the whole group vs. per-leg keys) — follow the existing `process_payment_atomic` idempotency pattern as closely as possible. **Research recommendation: single caller-supplied idempotency key for the whole checkout; RPC derives per-row storage keys (`{key}-leg{i}`) to satisfy the existing `UNIQUE(idempotency_key)` index, and does resubmission-detection by looking up the `-leg0` sentinel.** See `## Architecture Patterns`.
- Whether the new multi-row RPC is a new function (e.g. `process_split_payment_atomic`) or an extension of `process_payment_atomic` — researcher should evaluate both against the existing edge function contract. **Research recommendation: new RPC + new edge function.** See `## Summary` and `## Architecture Patterns` for the full tradeoff analysis.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope (per 18-CONTEXT.md `<deferred>`).
</user_constraints>

## Standard Stack

This phase introduces **zero new npm/PyPI/cargo packages**. It is a pure extension of the existing Postgres/Supabase/React/Zod stack already in use. No `npm install` is required.

### Core (existing, reused)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zod | v4 (existing) | New `SplitPaymentLeg`/split-request schemas in `domain.ts` + `edge-function-contracts.ts` | Already the project's single source of truth for validation |
| Supabase JS client / Edge Functions (Deno) | existing (`@supabase/supabase-js@2.49.1` pinned in edge fn imports) | New `process-split-payment` edge function, same import pins as `process-payment/index.ts` | Matches existing deployed edge function pin exactly — do not bump |
| PostgreSQL `plpgsql` | Supabase-managed | New `process_split_payment_atomic` RPC | Existing convention for all money-moving atomic operations |

### Package Legitimacy Audit

Not applicable — no external packages are installed by this phase. All work is new SQL migrations, a new Deno edge function using already-pinned imports, and new TypeScript/React code in the existing repo.

## Architecture Patterns

### System Architecture Diagram

```
PaymentForm.tsx (split mode ON)
  │  cashier fills rows: [{method, amount, tip, tenderedAmount?, cardReference?}, ...] (1-4)
  │  client computes: subtotalWithTax (once, existing logic) + remaining = subtotalWithTax - Σ(row.amount)
  │  submit disabled until remaining === 0 and each row's per-method validity holds
  ▼
processSplitPayment(tabId, legs[], expectedVersion?)   [shared/lib/payment-processor.ts — NEW]
  │  generates ONE idempotencyKey via generateIdempotencyKey('payment_split')
  ▼
callProcessSplitPayment(request)   [shared/lib/edge-function-contracts.ts — NEW]
  │  Zod-validates ProcessSplitPaymentRequestSchema (tabId, legs[1..4], idempotencyKey, expectedTotal)
  │  fetch() → POST /functions/v1/process-split-payment  (Bearer <user JWT>)
  ▼
supabase/functions/process-split-payment/index.ts   [NEW — mirrors process-payment/index.ts]
  │  1. verify JWT via /auth/v1/user (same ES256 workaround as process-payment)
  │  2. admin.rpc('process_split_payment_atomic', { p_tab_id, p_staff_id, p_legs: legs, p_idempotency_key, p_expected_total, ... })
  ▼
process_split_payment_atomic(...)   [NEW Postgres RPC — supabase/migrations]
  │  FOR UPDATE lock tabs row (same p_expected_version guard as process_payment_atomic)
  │  validate: 1 ≤ jsonb_array_length(p_legs) ≤ 4
  │  validate: Σ(leg.amount) == p_expected_total (±0.01)
  │  per-leg: validate method-specific fields (cash tendered≥amount+tip; card/rappi forbid tendered)
  │  v_group_id := gen_random_uuid()
  │  FOR i, leg IN ... LOOP  INSERT INTO payments (..., payment_group_id=v_group_id, split_index=i) END LOOP
  │  reuse EXISTING close-tab logic: v_paid_line (SUM all non-refund payments for tab) vs v_owed (item subtotal)
  │  RETURN { ok: true, paymentGroupId, paymentIds: [...] }
  ▼
process-split-payment/index.ts (continued)
  │  for each inserted paymentId: query payments/tabs/orders/pool_sessions (same shape as process-payment)
  │  build receiptData[] — ONE ReceiptData per leg
  │  RETURN { success: true, paymentGroupId, paymentIds, receipts: ReceiptData[] }
  ▼
PaymentForm.tsx
  │  setReceiptQueue(receipts); setReceiptIndex(0); setStep('receipt')
  │  post-success side-effect loop: for each receipt → printReceipt(receipt); if any leg.method==='cash' → openCashDrawer() ONCE
  ▼
ReceiptPreview (existing component, REUSED unchanged)
  │  onDone → advance to next queued receipt, or onClose() when queue exhausted
```

### Recommended Project Structure

```
supabase/migrations/
├── 20260707000001_split_payment_columns_and_rpc.sql   # NEW — ALTER TABLE payments + CREATE process_split_payment_atomic
supabase/functions/
├── process-split-payment/
│   └── index.ts                                        # NEW — mirrors process-payment/index.ts structure
src/shared/lib/
├── domain.ts                                            # EXTEND — PaymentSchema +2 fields, new SplitPaymentLegSchema
├── edge-function-contracts.ts                           # EXTEND — ProcessSplitPaymentRequestSchema/SuccessSchema/EnvelopeSchema + callProcessSplitPayment
├── payment-processor.ts                                 # EXTEND — processSplitPayment() wrapper
├── result.ts                                             # EXTEND — AppErrorCode + 'SPLIT_AMOUNT_MISMATCH' (or reuse VALIDATION_ERROR — see Pitfall 1)
├── supabase.types.ts                                     # EXTEND (generated, manual fallback) — payments.payment_group_id/split_index
src/widgets/PaymentModal/ui/
├── PaymentForm.tsx                                       # EXTEND — isSplitMode toggle + row-list branch + receipt queue
```

### Pattern 1: Multi-leg `jsonb` array RPC parameter (established precedent)

**What:** Accept a variable-length array of structured leg data as a single `jsonb` parameter, loop with `FOR ... IN SELECT * FROM jsonb_array_elements(...)`.
**When to use:** Any RPC that must process 1-N related sub-records atomically in one transaction.
**Example (existing precedent — `split_tab_by_amount`, `supabase/migrations/20260427000002_split_tab_rpcs.sql` lines 261-378):**
```sql
CREATE OR REPLACE FUNCTION split_tab_by_amount(
  p_parent_tab_id uuid,
  p_amounts       jsonb   -- [{sub_tab_label: text, amount: numeric}, ...]
) RETURNS uuid[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_amount_row jsonb;
BEGIN
  -- validate sum, then:
  FOR v_amount_row IN SELECT * FROM jsonb_array_elements(p_amounts) LOOP
    -- per-row INSERT logic
  END LOOP;
END;
$$;
```
This is the exact pattern `process_split_payment_atomic` should follow for `p_legs jsonb`.

### Pattern 2: Versioned tab-lock guard (Phase 15 protocol — MUST be preserved)

**What:** Every RPC that mutates `tabs` (directly or via a dependent close-check) locks the row with `FOR UPDATE`, compares `p_expected_version`, and raises `STALE_VERSION`/`P0V01` or `NOT_FOUND_VERSIONED`/`P0V02` before any write.
**When to use:** `process_split_payment_atomic` (new RPC) — it closes tabs exactly like `process_payment_atomic` does, so it must participate in the same optimistic-concurrency contract.
**Example (current live signature, `supabase/migrations/20260512000002_rpc_versioned_group_a.sql` lines 101-119):**
```sql
SELECT status, rappi_order_id, version
INTO v_tab_status, v_rappi_tab, v_current
FROM tabs WHERE id = p_tab_id FOR UPDATE;

IF NOT FOUND THEN
  RAISE EXCEPTION 'NOT_FOUND_VERSIONED' USING ERRCODE = 'P0V02';
END IF;

IF p_expected_version IS NOT NULL AND v_current <> p_expected_version THEN
  RAISE EXCEPTION 'STALE_VERSION' USING ERRCODE = 'P0V01';
END IF;
```
Then, in the `EXCEPTION` block: `WHEN sqlstate 'P0V01' THEN RAISE;` and `WHEN sqlstate 'P0V02' THEN RAISE;` (re-raise, do NOT swallow into `ok=false` — this is required so PostgREST/the edge function propagates the SQLSTATE to `handleVersionError` client-side).

### Pattern 3: Idempotency-key resubmission detection (adapt for multi-row)

**What:** Look up an existing row by idempotency key before inserting; if found, return the same success payload instead of re-processing.
**Problem for split payments:** `payments.idempotency_key` has a `UNIQUE` index (`idx_payments_idempotency_key`, `20260417000001_payment_processing.sql` line 22). A single split checkout inserts up to 4 rows — they **cannot share one literal idempotency_key string**, or the 2nd INSERT hits `unique_violation`.
**Recommended fix:** RPC receives ONE `p_idempotency_key` from the caller (one per checkout, matching the single-payment convention), but stores `p_idempotency_key || '-leg' || i` as each row's `idempotency_key` column value. Resubmission detection queries for the sentinel `p_idempotency_key || '-leg0'`:
```sql
SELECT id, payment_group_id INTO v_existing_id, v_existing_group
FROM payments
WHERE idempotency_key = p_idempotency_key || '-leg0'
LIMIT 1;

IF v_existing_id IS NOT NULL THEN
  -- re-fetch all rows in v_existing_group and return them as idempotent replay
  RETURN jsonb_build_object('ok', true, 'idempotent', true, 'paymentGroupId', v_existing_group, ...);
END IF;
```
Max key length: `payments.idempotency_key VARCHAR(255)`, and `generateIdempotencyKey()` (`src/shared/lib/domain-helpers.ts` line 309) produces `{prefix}_{timestamp}_{8charRandom}` — roughly 30-40 chars for `prefix='payment_split'`; `+'-leg3'` adds 5 more, comfortably under 255.

### Pattern 4: Discount/tax computed once, trusted from client (existing precedent — reuse, do not re-derive)

The existing `process_payment_atomic` (since `20260421000001_payments_discount_columns.sql`) explicitly does **NOT** recompute `AMOUNT_MISMATCH` server-side — the comment reads: *"No AMOUNT_MISMATCH check: the client-provided amount already reflects any discount applied... Accept the client amount as authoritative."* This is directly reusable for split payments: the RPC should validate `Σ(leg.amount) == p_expected_total` (a client-computed `subtotalWithTax` value passed through), but should NOT attempt to recompute discount/tax server-side from `order_items`/`pool_sessions` — that would duplicate logic that already lives in `PaymentForm.tsx`'s `useMemo` chain and risk drifting out of sync with the single-payment path.

### Anti-Patterns to Avoid

- **Sequential per-leg `callProcessPayment()` calls (the `useSplitEvenly` pattern):** Explicitly NOT atomic — `src/features/split-tab/model/useSplitTab.ts` lines 90-119 documents this exact tradeoff for the *even-split* feature (a different, pre-existing feature from Phase 6, not to be confused with this phase). Do NOT reuse this pattern for Phase 18 — D-08 requires genuine all-or-nothing atomicity, which only a single Postgres transaction can guarantee.
- **Extending `process_payment_atomic`'s signature to accept an optional legs array:** Rejected — would require restructuring the well-tested single-payment code path (idempotency, close logic, discount handling, all currently exercised by `PaymentForm.test.tsx` + `payment-processor.test.ts` + `05-payments.spec.ts`/`23-payment-edge-cases.spec.ts` E2E specs) purely to add a branch that's only exercised in split mode. Directly risks D-11 ("single-method close continues to work unchanged").
- **Reusing the same idempotency-key literal across all N leg rows:** Will hit `unique_violation` on `idx_payments_idempotency_key` on the 2nd INSERT. See Pattern 3.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-row atomic array processing in Postgres | A hand-rolled loop with ad-hoc error accumulation | The `jsonb_array_elements` + `FOR ... LOOP` pattern already proven in `split_tab_by_item`/`split_tab_by_amount` | Same codebase, same reviewers already understand this idiom; consistent error-message conventions (`'CODE: message'` strings raised via `RAISE EXCEPTION`) |
| Optimistic-concurrency version guard | A custom `SELECT ... FOR UPDATE` + manual version compare written from scratch | Copy the exact block from `process_payment_atomic` (Pattern 2 above) verbatim | The `P0V01`/`P0V02` SQLSTATE codes are wired all the way through to `src/shared/lib/version-error.ts`'s `handleVersionError` — a differently-shaped guard would silently bypass that plumbing |
| Split-row remaining-balance math | Manual float subtraction across N inputs | `Math.round((subtotalWithTax - rows.reduce((s,r)=>s+r.amount,0)) * 100) / 100` — same rounding idiom already used throughout `PaymentForm.tsx` (`taxAmount`, `tipAmount`, `runningTotal` all use this exact `Math.round(x * 100) / 100` pattern) | Consistency with the existing file's float-cent handling; avoids a second, subtly different rounding convention living in the same component |
| Receipt formatting per leg | A new receipt template | `buildThermalReceiptText` (`src/shared/lib/receipt-format.ts`) + `ReceiptPreview` component, called once per leg's `ReceiptData` | Already handles thermal formatting, `printReceipt`/`openCashDrawer` Tauri IPC dispatch, and the email-receipt flow (`EmailReceiptDialog`) — reuse per D-09's explicit instruction |

**Key insight:** Every piece of this phase has a nearly-identical precedent already merged into this codebase (`split_tab_by_amount` for the jsonb-array RPC shape, `process_payment_atomic` for the version guard and idempotency pattern, `ReceiptPreview` for per-leg receipt display). The implementation task is almost entirely "adapt an existing pattern," not "design something new" — the planner should write tasks that explicitly reference these source files as the copy-from-here starting point.

## Common Pitfalls

### Pitfall 1: Reusing a single idempotency key literal across split-leg INSERTs
**What goes wrong:** 2nd of 4 `INSERT INTO payments (..., idempotency_key, ...)` statements raises `unique_violation` on `idx_payments_idempotency_key`.
**Why it happens:** The existing single-payment RPC's idempotency-key handling assumes exactly one row per key. A naive port of that logic to a loop breaks on the 2nd iteration.
**How to avoid:** Store `p_idempotency_key || '-leg' || i::text` per row (see Pattern 3). Add a corresponding `AppErrorCode` — actually not needed if this is caught by the `unique_violation` EXCEPTION handler and treated as an idempotent-replay signal, matching the existing `WHEN unique_violation THEN ... SELECT id INTO v_existing_id FROM payments WHERE idempotency_key = p_idempotency_key ...` fallback pattern in `process_payment_atomic`.
**Warning signs:** Integration test inserting the same split-payment request twice returns a `DUPLICATE`-style error instead of the expected idempotent replay.

### Pitfall 2: `payments.idempotency_key` is `NOT NULL` — new insert paths must always supply one
**What goes wrong:** A migration or code path that inserts into `payments` without `idempotency_key` fails the `NOT NULL` constraint (added in `20260417000001_payment_processing.sql` lines 19-20, with an explicit `UPDATE payments SET idempotency_key = 'legacy_' || id::text WHERE idempotency_key IS NULL` backfill for pre-existing rows).
**Why it happens:** Easy to forget when writing a brand-new INSERT statement inside the new RPC.
**How to avoid:** Every leg's INSERT must include a derived `idempotency_key` (Pitfall 1's fix covers this).
**Warning signs:** `null value in column "idempotency_key" violates not-null constraint` at RPC-execution time.

### Pitfall 3: `amount_positive CHECK (amount > 0)` on `payments` — a $0 leg is rejected at the DB level
**What goes wrong:** If the UI allows a row with `amount = 0` to reach submission (e.g., a cashier adds a 3rd row but never fills it in), the RPC's INSERT fails the table's `amount_positive` CHECK constraint (`20260414000006_payments.sql` line 17).
**Why it happens:** Client-side validation (`canSubmit`) must independently enforce `row.amount > 0` for every row BEFORE allowing submit — the DB constraint is a safety net, not the primary UX gate.
**How to avoid:** `PaymentForm.tsx`'s split-mode submit-enablement logic must check `rows.every(r => r.amount > 0)` in addition to the sum-equals-total check (D-05/D-07).
**Warning signs:** Generic `INTERNAL`/`Payment failed` error surfaced to the cashier with no indication which row was empty (the RPC's `WHEN OTHERS THEN RETURN jsonb_build_object('ok', false, 'code', 'INTERNAL', ...)` catch-all swallows the specific CHECK-constraint violation detail) — this is exactly why client-side pre-validation matters here.

### Pitfall 4: Cash-drawer-open side effect firing once per cash leg (unintended double/triple drawer pop)
**What goes wrong:** If the post-success side-effect loop (currently `if (method === 'cash') { openCashDrawer(); printReceipt(receipt); } else { printReceipt(receipt); }` in `PaymentForm.tsx` lines 271-279) is naively looped once per leg, a 2-cash-row split pops the physical cash drawer twice for what the cashier perceives as one checkout.
**Why it happens:** The single-payment code path was written assuming exactly one leg; a literal "loop the same block N times" port carries this assumption forward incorrectly.
**How to avoid:** Open the drawer **once** if `legs.some(l => l.method === 'cash')`, but still call `printReceipt(receipt)` once **per leg** (D-09 is explicit that receipts print one-per-leg; CONTEXT.md is silent on drawer-open count, so treat "once per checkout" as the safer default and flag it in the plan for human confirmation if uncertain).
**Warning signs:** E2E/manual test with 2 cash rows shows the drawer physically opening twice.

### Pitfall 5: `supabase.types.ts` Docker regeneration will likely be unavailable (confirmed this session)
**What goes wrong:** `npx supabase gen types typescript --local` requires a running local Supabase stack (Docker). This research session confirmed `docker info` fails in the current environment (`docker NOT available`), matching the repeatedly-documented STATE.md pattern across Phases 1-17 ("Docker unavailable", "Docker WSL pipe unavailable").
**Why it happens:** Windows/WSL Docker Desktop not running in this dev environment.
**How to avoid:** Attempt regeneration first (environment may differ at execution time); if it fails, manually transcribe the two new `payments` Row/Insert/Update fields (`payment_group_id: string | null`, `split_index: number | null`) into `src/shared/lib/supabase.types.ts` at the existing `payments` block (currently lines 864-888+), following the exact manual-extension precedent documented in `CLAUDE.md`'s "Missing generated types workaround" and STATE.md's repeated decisions (e.g., "[Phase 17-modifier-inventory-rules 17-03]: ... manually extended").
**Warning signs:** `supabase start` hangs or errors; `docker info` returns connection refused.

### Pitfall 6: New AppErrorCode must be added to the union BEFORE use, and mapped in the edge-error translator
**What goes wrong:** Using `code: 'SPLIT_AMOUNT_MISMATCH' as AppErrorCode` without first adding it to the `AppErrorCode` union in `src/shared/lib/result.ts` (lines 165-204) technically compiles (due to the `as AppErrorCode` cast pattern already used elsewhere in the codebase for new codes) but breaks type safety for every downstream `switch`/exhaustiveness check on `AppErrorCode`.
**Why it happens:** CLAUDE.md explicitly documents the required order: "When adding a new error code, add it to that union first, then use `const appErr: AppError = { code: 'YOUR_CODE' as AppErrorCode, ... }`."
**How to avoid:** Add `| 'SPLIT_AMOUNT_MISMATCH'` (or reuse the existing generic `'VALIDATION_ERROR'` — see Open Questions) to the union in the same task/commit that introduces the new RPC's error-code mapping, mirroring how `'PARENT_TAB_PAID'`/`'ITEM_ASSIGNED_TWICE'` were added alongside the split-tab-by-item/by-person RPCs in Phase 6.
**Warning signs:** ESLint `@typescript-eslint/no-unnecessary-condition` or exhaustive-switch lint failures on any file that switches over `AppErrorCode`.

## Code Examples

### Existing single-payment RPC signature to mirror (do not modify — use as a template)
```sql
-- Source: supabase/migrations/20260512000002_rpc_versioned_group_a.sql (current live signature)
CREATE OR REPLACE FUNCTION public.process_payment_atomic(
  p_tab_id UUID, p_staff_id UUID, p_amount NUMERIC, p_tip_amount NUMERIC,
  p_method TEXT, p_idempotency_key TEXT,
  p_tendered_amount NUMERIC DEFAULT NULL, p_reference_number TEXT DEFAULT NULL,
  p_rappi_order_id TEXT DEFAULT NULL, p_discount_scope TEXT DEFAULT NULL,
  p_discount_type TEXT DEFAULT NULL, p_discount_value NUMERIC DEFAULT NULL,
  p_discount_amount NUMERIC DEFAULT NULL, p_expected_version INT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
```

### Recommended new RPC signature
```sql
-- NEW — supabase/migrations/20260707000001_split_payment_columns_and_rpc.sql
CREATE OR REPLACE FUNCTION public.process_split_payment_atomic(
  p_tab_id UUID,
  p_staff_id UUID,
  p_legs JSONB,              -- [{method, amount, tip_amount, tendered_amount, reference_number, rappi_order_id}, ...] 1..4 entries
  p_expected_total NUMERIC,  -- client-computed subtotalWithTax; Σ(leg.amount) must equal this (±0.01)
  p_idempotency_key TEXT,
  p_discount_scope TEXT DEFAULT NULL,
  p_discount_type TEXT DEFAULT NULL,
  p_discount_value NUMERIC DEFAULT NULL,
  p_discount_amount NUMERIC DEFAULT NULL,
  p_expected_version INT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
```

### Column addition (exact ALTER TABLE, following the additive-column precedent)
```sql
-- Source pattern: supabase/migrations/20260421000001_payments_discount_columns.sql
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_group_id UUID,
  ADD COLUMN IF NOT EXISTS split_index SMALLINT CHECK (split_index >= 0 AND split_index <= 3);

CREATE INDEX IF NOT EXISTS idx_payments_payment_group_id
  ON payments(payment_group_id) WHERE payment_group_id IS NOT NULL;

-- Optional but recommended: prevent duplicate split_index within one group
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_group_split_unique
  ON payments(payment_group_id, split_index) WHERE payment_group_id IS NOT NULL;
```

### `record_audit` call signature to reuse for the new RPC's audit wiring
```sql
-- Source: supabase/migrations/20260703000001_record_audit_terminal_id.sql (current live signature, 8 params w/ defaults)
PERFORM record_audit(
  'payment.process_split',   -- new action string, consistent with 'payment.process' convention
  'payment',
  v_payment_group_id,        -- entity_id — use the group id, not a single payment id, since this is one logical event
  NULL,
  jsonb_build_object('paymentIds', v_payment_ids, 'legCount', jsonb_array_length(p_legs)),
  'rpc'
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `UNIQUE(tab_id)` on `payments` (one payment per tab) | Multiple payments per tab allowed | `20260424000005_payments_constraint.sql` (already applied) | Phase 18 does NOT need to touch this constraint — CONTEXT.md D-10's instruction to drop it is already satisfied; only the new columns are needed |
| `process_payment_atomic` closes tab on exact `p_amount == v_expected` match | Closes tab when `SUM(all non-refund payments for tab) >= item subtotal` (multi-pay/partial-pay aware) | `20260429000000_process_payment_close_when_fully_paid.sql` | This close-logic is ALREADY compatible with split payments inserting N rows — no change needed to it; the new split RPC's tab-close branch should copy this exact `v_owed`/`v_paid_line` computation verbatim |
| `process_payment_atomic` had no version guard | `p_expected_version` + `FOR UPDATE` + `P0V01`/`P0V02` | `20260512000002_rpc_versioned_group_a.sql` (Phase 15) | New split RPC must replicate this guard from day one — retrofitting it later would be a second migration |

**Deprecated/outdated:** None relevant — this is an actively-maintained internal codebase, not a third-party dependency with a changelog.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | New edge function (not extension of `process-payment`) is the correct architectural choice | Summary / Architecture Patterns | If the planner instead extends the existing edge function, D-11 ("single flow unchanged") becomes harder to guarantee-by-construction and needs extra regression test coverage on the existing `BodySchema.superRefine` branches — LOW risk since this is a recommendation, not a verified external fact, and both approaches are technically viable |
| A2 | Cash-drawer should open once per checkout (not once per cash leg) when a split includes ≥1 cash row | Pitfall 4 | CONTEXT.md is silent on this specific UX detail; if wrong, a plan task may need revision after human UAT feedback — LOW risk, easily correctable in code review |
| A3 | Minimum row count when split mode is toggled ON is 2 (not enforced by CONTEXT.md explicitly) | Open Questions | If the UI allows submitting with only 1 row in split mode, it functionally degenerates to the single-payment flow via a different code path — should be either disallowed by UI (min 2) or explicitly permitted as a no-op equivalent; LOW risk, cosmetic/UX only |

**All other claims in this research were verified directly by reading the live migration files, RPC bodies, and current source in this repository session** (package name provenance is N/A — no packages introduced).

## Open Questions

1. **Minimum split-row count**
   - What we know: D-02 caps the maximum at 4 rows. CONTEXT.md never states a minimum when the split toggle is ON.
   - What's unclear: Should the UI require ≥2 rows before allowing submit in split mode (since 1 row = functionally the single-payment flow), or is 1 row technically valid (just routed through the new split RPC)?
   - Recommendation: Planner should default to requiring ≥2 rows in split mode (disable submit / show a validation hint below 2 rows) since a 1-row "split" has no product meaning — but this is a 5-minute UI decision, not a schema/RPC decision, and doesn't block backend design either way (the RPC already validates `1 ≤ jsonb_array_length(p_legs) ≤ 4`, so 1-row split requests are technically safe to accept server-side even if the UI never produces them).

2. **New `AppErrorCode` vs. reuse `'VALIDATION_ERROR'` for split-specific failures**
   - What we know: Existing single-payment errors like `AMOUNT_MISMATCH`/`TENDERED_REQUIRED`/`INSUFFICIENT_TENDER` are all mapped to the generic `'VALIDATION_ERROR'` AppErrorCode in `mapProcessPaymentEdgeError` (`edge-function-contracts.ts` lines 200-223) — the codebase does NOT give every distinct backend error string its own `AppErrorCode`.
   - What's unclear: Whether split-specific errors (`SPLIT_TOTAL_MISMATCH`, `TOO_MANY_LEGS`, `EMPTY_LEG`) deserve dedicated codes or should fold into `'VALIDATION_ERROR'` like the single-payment errors do.
   - Recommendation: Follow the existing majority pattern — map all split-validation failures to `'VALIDATION_ERROR'` (zero new AppErrorCode entries needed), and rely on the human-readable `message` string (already the pattern for surfacing specifics to the cashier via `errorMessage` state in `PaymentForm.tsx`). This avoids Pitfall 6 entirely for the common case; only add a new code if the planner decides a split failure needs distinct client-side branching logic (unlikely — no evidence in the existing UI of branching on `AMOUNT_MISMATCH` vs `TENDERED_REQUIRED` differently).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker | `npx supabase gen types typescript --local` (type regeneration) | ✗ (confirmed this session: `docker info` fails) | — | Manual `supabase.types.ts` transcription (documented CLAUDE.md workaround, used repeatedly per STATE.md history) |
| Supabase CLI | `supabase db push` (migration apply) | ✓ | 2.91.1 | — |
| Node/npm | typecheck/lint/test/build | ✓ (project already running) | per `package.json` | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** Docker (type generation) — use manual transcription fallback, see Pitfall 5.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest v4 + React Testing Library v16 (unit); Playwright v1.59 (E2E) |
| Config file | `bar-pos/vitest.config.ts`; `bar-pos/playwright.config.ts` |
| Quick run command | `npx vitest run src/widgets/PaymentModal/ui/PaymentForm.test.tsx` |
| Full suite command | `npm run test` (unit); `npm run test:e2e` (Playwright, manual pre-release) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC-1 | `payment_group_id`/`split_index` columns exist with correct types/constraints | integration (live Supabase) | New `src/entities/payment/model/*.integration.test.ts` querying `to_regclass`/`information_schema.columns` — pattern per Phase 17-03's verification queries | ❌ Wave 0 |
| SC-2 | RPC accepts 1-4 legs, rejects 5, rejects sum≠total, atomic all-or-nothing on partial failure | unit (RPC-mocked) + integration (live Supabase RPC call) | `npx vitest run src/shared/lib/payment-processor.test.ts`; new integration test calling `process_split_payment_atomic` directly via anon client (mirrors `06-10` split-tab integration test pattern) | ❌ Wave 0 |
| SC-3 | `PaymentForm` split-mode toggle, add/remove row, live remaining-balance display, per-row validation | unit (RTL) | `npx vitest run src/widgets/PaymentModal/ui/PaymentForm.test.tsx` | ❌ Wave 0 (new `describe('PaymentForm — split mode')` block needed, following existing `describe('PaymentForm — discount section')`/`describe('PaymentForm — card charge override')` conventions already in the file) |
| SC-4 | Single-method close unchanged (regression) | unit + E2E | `npx vitest run src/widgets/PaymentModal/ui/PaymentForm.test.tsx`; `npx playwright test e2e/05-payments.spec.ts e2e/17-payment-pane.spec.ts e2e/23-payment-edge-cases.spec.ts` | ✅ (existing specs — run as regression gate, no new file needed) |

### Sampling Rate
- **Per task commit:** `npx vitest run src/widgets/PaymentModal/ui/PaymentForm.test.tsx src/shared/lib/payment-processor.test.ts`
- **Per wave merge:** `npm run test` (full unit suite — current baseline per STATE.md: 1187+ passing / documented pre-existing failures)
- **Phase gate:** Full suite green + `npx playwright test e2e/05-payments.spec.ts e2e/17-payment-pane.spec.ts e2e/23-payment-edge-cases.spec.ts e2e/34-split-bill.spec.ts` (regression check on the adjacent even-split feature, which shares no code but shares the `PaymentForm`/`payments` table surface) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] New `describe('PaymentForm — split mode')` block in existing `src/widgets/PaymentModal/ui/PaymentForm.test.tsx` — covers SC-3
- [ ] New integration test file for `process_split_payment_atomic` (live Supabase, following `src/features/split-tab/model/*.integration.test.ts` conventions referenced in STATE.md "Plan 06-10") — covers SC-1, SC-2
- [ ] New unit tests in `src/shared/lib/payment-processor.test.ts` for `processSplitPayment()` — covers SC-2
- [ ] New E2E spec `e2e/4X-split-payment.spec.ts` (next available number after `40-kds-bar`) — covers SC-2, SC-3, D-08, D-09 end-to-end
- [ ] Framework install: none — Vitest/Playwright already configured

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | yes | Existing JWT-via-`/auth/v1/user` verification in the edge function, reused as-is for `process-split-payment` |
| V3 Session Management | no | No new session concepts introduced |
| V4 Access Control | yes | Existing `close_tab` RBAC action + `ManagerPinDialog` gate at `PaymentPane` level (wraps `PaymentForm` regardless of split mode) — no new permission needed, confirmed by CONTEXT.md D-11-adjacent research question; `payments_insert_manager_admin` RLS policy is bypassed by the SECURITY DEFINER RPC called via the edge function's service-role client, exactly as `process_payment_atomic` already operates |
| V5 Input Validation | yes | Zod (`ProcessSplitPaymentRequestSchema` client + edge function) + Postgres-side re-validation (leg count, sum, per-method field requirements) — defense in depth matching existing `process-payment` two-layer validation |
| V6 Cryptography | no | No new cryptographic operations |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Idempotency-key collision/replay allowing double-charge | Repudiation / Tampering | Per-row derived idempotency keys (Pattern 3) + `unique_violation` EXCEPTION handler returning the existing group as an idempotent replay, matching `process_payment_atomic`'s existing behavior |
| Split total manipulated client-side to under-charge the tab | Tampering | Server-side `Σ(leg.amount) == p_expected_total` validation inside the RPC transaction (not just client-side UI validation) — `p_expected_total` itself is trusted from the client per the existing discount-amount precedent (Pattern 4), but the leg-sum-matches-total invariant is still enforced server-side, preventing a tampered request from submitting legs summing to less than the client's own displayed total |
| Partial-charge state from a non-atomic multi-call implementation | Tampering / Denial of Service (inconsistent tab state) | Single-transaction RPC (Pattern 1) — this IS the core architectural requirement of D-08 |

## Sources

### Primary (HIGH confidence — verified by direct file reads in this session)
- `supabase/migrations/20260414000006_payments.sql` — original `payments` table + `UNIQUE(tab_id)` constraint definition
- `supabase/migrations/20260424000005_payments_constraint.sql` — confirms `UNIQUE(tab_id)` already dropped (S1-05)
- `supabase/migrations/20260417000001_payment_processing.sql` — `idempotency_key` NOT NULL + UNIQUE index origin
- `supabase/migrations/20260421000001_payments_discount_columns.sql` — discount columns + AMOUNT_MISMATCH removal precedent
- `supabase/migrations/20260429000000_process_payment_close_when_fully_paid.sql` — multi-payment tab-close logic (`v_owed`/`v_paid_line`)
- `supabase/migrations/20260510000002_rpc_role_guards.sql`, `20260511000002_rpc_audit_wiring.sql`, `20260512000002_rpc_versioned_group_a.sql` — full evolution to the CURRENT live `process_payment_atomic` signature (14 params incl. `p_expected_version`)
- `supabase/migrations/20260427000002_split_tab_rpcs.sql` — jsonb-array RPC pattern precedent (`split_tab_by_item`/`by_amount`/`by_person`)
- `supabase/migrations/20260427000003_process_refund_rpc.sql` — confirms refund RPC is `payment_group_id`/`split_index`-agnostic (D-12)
- `supabase/migrations/20260703000001_record_audit_terminal_id.sql` — current live `record_audit` signature
- `supabase/migrations/20260703000004_close_tab_rpc.sql` — `close_tab` RPC, confirms version-guard idiom used across all Group A RPCs
- `supabase/migrations/20260510000001_rls_rewrite_phase13.sql` — current live `payments` RLS policies
- `supabase/functions/process-payment/index.ts` — full edge function to mirror structurally
- `src/shared/lib/edge-function-contracts.ts` — `ProcessPaymentRequestSchema`/`ProcessPaymentSuccessSchema`/`ProcessPaymentEnvelopeSchema`/`callProcessPayment` (full read)
- `src/shared/lib/payment-processor.ts` — `processCashPayment`/`processCardPayment`/`processRappiPayment` (full read)
- `src/widgets/PaymentModal/ui/PaymentForm.tsx` — full read, all state/calc/submit logic
- `src/widgets/PaymentPane/ui/PaymentPane.tsx` — full read, confirms PIN-gate wraps `PaymentForm` at a higher level (no split-specific RBAC needed)
- `src/features/split-tab/model/useSplitTab.ts` — full read, confirms the sequential-call anti-pattern (Anti-Patterns section)
- `src/shared/lib/domain.ts` (`PaymentSchema` block, lines 586-618) — current live Zod schema
- `src/shared/lib/supabase.types.ts` (`payments` block, lines 864+) — current live generated types
- `src/shared/lib/result.ts` (`AppErrorCode` union, lines 165-204) — current live error code list (note: broader than the list documented in CLAUDE.md — CLAUDE.md's documented union is stale/incomplete relative to the actual source)
- `src/features/process-refund/ui/RefundSheet.tsx`, `useProcessRefund.ts` — confirms per-payment-id refund flow unaffected
- `.agents/skills/bar-pos-feature/SKILL.md` — project feature-development workflow skill
- `.planning/config.json` — confirms `nyquist_validation: true` (Validation Architecture section required)
- Direct `docker info` / `npx supabase --version` execution in this session — Environment Availability findings

### Secondary (MEDIUM confidence)
- None — all findings in this research were verified directly against live repository source in this session; no unverified web/training-data claims were needed since this is a 100% internal-codebase research task.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no external packages, all internal code read directly
- Architecture: HIGH — every recommended pattern has a direct, verified precedent already merged in this repository
- Pitfalls: HIGH — all six pitfalls derived from reading actual constraint definitions (`UNIQUE` indexes, `CHECK` constraints, `NOT NULL`) and actual RPC/edge-function bodies, not speculation

**Research date:** 2026-07-07
**Valid until:** Effectively unbounded for the schema/RPC precedents (internal code, changes only via future migrations in this same repo) — re-verify only if another phase touches `payments`, `process_payment_atomic`, or `PaymentForm.tsx` before Phase 18 executes.
