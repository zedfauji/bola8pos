# Phase 22: Edit Paid Ticket + History - Research

**Researched:** 2026-07-19
**Domain:** Supabase PL/pgSQL RPC design (whitelisted patch + optimistic concurrency + audit trail) and a React/TanStack Query dialog + read-only list view, on top of an existing FSD codebase.
**Confidence:** HIGH — every claim below is grounded in the actual current schema/RPC/component code read this session, not general Supabase/React knowledge.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (whitelist scope):** Broad, not narrow — item quantity/price edits, adding/removing `order_items`, and notes/discount fields are in scope. `edit_paid_tab` is closer to a full order-line edit than a cosmetic patch, but it operates on an already-paid/closed tab (payment status untouched), not a reopen. Exact whitelisted column set is research/planner's call.
- **D-02 (financial/caja impact):** Edits that change the tab total require an offsetting caja entry recording the delta — same pattern Phase 23 (`reopen_tab`) will need. No existing "offsetting entry" RPC precedent exists; `caja_entries` is the closest existing table. Research must flag (not implement) whether this belongs in a shared helper both phases call.
- **D-03 (edit eligibility):** No time or caja-session-state cap — any paid tab can be edited regardless of age or whether its original caja session has since closed. Direct implication for D-02: if the original session is closed, the offsetting entry must land in the CURRENT open caja session while referencing the original tab/session/date.
- **D-04 (`/edit-history` view):** Shows a before/after diff table — per edit: field changed, old value, new value, staff, timestamp, reason. Richer than the generic `AuditLogTable` (action/staff/timestamp/freeform-detail only). Research must evaluate whether the existing `audit_logs` schema (jsonb `before`/`after`) is sufficient, or whether a new dedicated table is needed, checking `JsonDiffViewer`'s actual contract.

### Claude's Discretion

- Exact whitelisted column list for `edit_paid_tab` (per D-01).
- Whether `/edit-history` is a fully separate route or reuses `AuditLogTable`'s shell with a specialized diff-rendering column (per D-04) — planner's call once research confirms schema feasibility.
- Whether the caja-offsetting mechanism (D-02) is a new dedicated RPC/table or extends `caja_entries` — research's call.
- RBAC gate: ROADMAP already states "managers" — use the existing `manager-pin-gate` feature pattern (manager+ per the bartender < manager < admin hierarchy), consistent with `process-refund`'s RefundSheet.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. Phase 23 (Reopen Closed Ticket) was referenced only as context for D-02's shared-mechanism question, not pulled into this phase's scope. Do not implement `reopen_tab`, the `reopened_void` status, or the 24h/2x cap here.
</user_constraints>

<phase_requirements>
## Phase Requirements

No `REQUIREMENTS.md` exists for this milestone (confirmed absent — consistent with every Phase 20-21 session log entry this session). Per ROADMAP.md and 22-CONTEXT.md, scope is defined entirely by the 4 Success Criteria below (copied verbatim from `.planning/ROADMAP.md` §"Phase 22"), used here as the requirement IDs the planner must trace tasks to:

| ID | Description | Research Support |
|----|-------------|------------------|
| SC-1 | `edit_paid_tab` RPC restricts edits to a whitelisted field set, requires manager PIN + reason, uses `p_expected_version` per Phase 15 pattern | See Standard Stack, Architecture Patterns (Pattern 1), Code Examples — exact `p_expected_version`/`FOR UPDATE`/P0V01/P0V02 template pulled from `process_payment_atomic`/`create_order_with_items` |
| SC-2 | Every edit writes an `audit_logs` row (Phase 14) with before/after diff | See D-04 resolution below — `audit_logs.before`/`after` jsonb is sufficient, no new table needed |
| SC-3 | `EditPaidTabDialog` UI: manager PIN gate → field edit → reason → confirm | See Architecture Patterns (Pattern 2), reusing `RefundSheet` + `ManagerPinDialog` exactly |
| SC-4 | `/edit-history` view lists edits with diff viewer (reuses Phase 14 `JsonDiffViewer`) | See Architecture Patterns (Pattern 3) — reuse `AuditLogTable`/`AuditLogDetailSheet` shell, pre-filtered |
</phase_requirements>

## Summary

This phase adds exactly one new RPC (`edit_paid_tab`), one new dialog (`EditPaidTabDialog`), and one new route (`/edit-history`) — and every piece it needs already has a working precedent in this codebase from Phases 14 (audit logs) and 15 (optimistic concurrency). There is no new infrastructure to invent: `audit_logs.before`/`after` (jsonb) plus the existing `JsonDiffViewer` component already satisfy D-04's "field changed, old value, new value" requirement without a new table — `JsonDiffViewer` computes the field-level diff client-side from two arbitrary JSON blobs via `diffJson()`, it does not require pre-computed per-field rows. The only genuine gap is `reason`, which has no dedicated column on `audit_logs` (nor on `caja_entries`) — the lazy, schema-consistent fix is to embed it as a synthetic key inside the `after` jsonb payload (the codebase already does this for `_truncated`), not add a migration column or a new table.

`edit_paid_tab` should follow the exact `p_expected_version` / `FOR UPDATE` / `P0V01`/`P0V02` template used by `process_payment_atomic` and `create_order_with_items` (Phase 15 Group A pattern) — lock the `tabs` row, assert the expected version, mutate `order_items`, then bump `tabs.version = version + 1` even though `tabs` itself may not change (this mirrors `create_order_with_items`, which only inserts into `order_items` but still bumps `tabs.version` at the end so the optimistic-concurrency contract holds for any UI that has the tab open).

The two things that need real design work (not reuse) are: (1) the exact whitelisted column list, because "discount fields" from D-01 do not map cleanly onto any `tabs`/`order_items` column — discount lives on `payments` (`discount_scope`/`discount_type`/`discount_value`/`discount_amount`), which is a different, immutable-history table that `edit_paid_tab` should NOT touch; and (2) the offsetting caja-entry mechanism (D-02), because `caja_entries` has no structural FK back to the tab/session it's correcting — only a free-text `concept TEXT` column — so Phase 22 and Phase 23 will each be gluing a reference into free text unless a shared helper is introduced now.

**Primary recommendation:** Whitelist `order_items.quantity`, `order_items.unit_price`, `order_items.notes`, add/soft-delete of `order_items` rows, and `tabs.notes` only — treat "discount fields" as satisfied by `unit_price` edits (no dedicated discount column exists on the paid-tab tables) and flag this interpretation to the user/planner rather than inventing a new `discount_amount` column. Build `edit_paid_tab` as a single new SECURITY DEFINER RPC copying the Phase 15 Group A version-guard template, compute `delta = new_total - old_total` from `order_items` before/after, and when `delta != 0` insert one `caja_entries` row (type `income` if delta > 0, `expense` if delta < 0) into the CURRENT open `caja_sessions` row, with `concept` encoding the original tab id/date in structured text (e.g. `Edit paid tab {short_id} ({orig_date}): {reason}`) since no FK column exists yet — and flag for Phase 23 that a `caja_entries.source_tab_id uuid` + `source_type text` pair of nullable columns would remove this text-encoding hack for both phases, without implementing it here.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Whitelisted field patch + version guard + audit write | API / Backend (Supabase RPC, `SECURITY DEFINER`) | — | Must be atomic (patch + version bump + audit + offsetting caja entry in one transaction); RLS alone can't express "whitelisted fields only, manager+ only, with an audit side-effect" |
| Manager PIN verification | Frontend Server / Client (existing `ManagerPinDialog`) | API (RPC re-validates role via `auth.uid()`) | PIN gate is a UX/authorization-intent check client-side (matches `process_refund`'s pattern: PIN correctness is checked against `profiles.pin` client-side, then the RPC independently re-checks `role IN ('manager','admin')` server-side — defense in depth, not double-trust) |
| Offsetting caja-entry insert | API / Backend (inside `edit_paid_tab` RPC, same transaction) | — | Must be atomic with the edit itself; a separate client-side `caja_entries` insert (like `register-caja-entry` does today) would allow the edit to succeed while the offsetting entry silently fails |
| `EditPaidTabDialog` field editing UI | Browser / Client | — | Pure UI state (selected items, new qty/price/notes, reason) until "Confirm" fires the mutation |
| `/edit-history` list + diff viewer | Browser / Client (TanStack Query read of `audit_logs`) | — | Read-only, reuses existing `useAuditLogs`/`JsonDiffViewer` — no new backend read path needed, just a filter |

## Standard Stack

No new libraries. This phase is 100% additive on the existing stack (React 19, TanStack Query v5, Zod v4, Supabase PL/pgSQL, shadcn/ui). All UI primitives it needs (`Sheet`, `Dialog`, `Checkbox`, `QuantityControl`, `MoneyDisplay`, `POSButton`, `DataTable`, `JsonDiffViewer`) already exist in `src/shared/ui/`.

### Core (existing, reused)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | ^5 (installed) | `useEditPaidTab` mutation hook, `/edit-history` infinite query | Already the project's sole server-state layer |
| `zod` | ^4.3.6 (installed) | Extend `domain.ts` with an `EditPaidTabInput`-shaped Zod schema if the planner wants client-side validation before the RPC call | Single source of truth per CLAUDE.md |
| Supabase PL/pgSQL (`plpgsql`, `SECURITY DEFINER`) | project-pinned via CLI | `edit_paid_tab` RPC | Matches every other sensitive mutation in this codebase (no ORM) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Embedding `reason` in `audit_logs.after` jsonb | `ALTER TABLE audit_logs ADD COLUMN reason text` | A dedicated column is queryable/indexable but touches a table used by 10+ other RPCs' `record_audit()` calls (all of which would need a `NULL` default) for a benefit only this phase needs today; jsonb embedding is a strictly additive, zero-risk change consistent with the existing `_truncated` marker precedent |
| Reusing `caja_entries` with a free-text `concept` reference | New `tab_edit_adjustments` table with a `tab_id` FK | Cleaner joins, but a brand-new table + RLS policies + report-query changes for a single-field gap; flag as a possible Phase 23-shared follow-up, don't build it now (see Open Questions) |
| Reusing `AuditLogTable` shell for `/edit-history` | Fully separate widget/table component | Duplicates ~150 lines of DataTable/infinite-scroll/filter wiring for a table that is structurally identical (same `audit_logs` rows, same `JsonDiffViewer`), just pre-filtered to `action = 'tab.edit_paid'` |

**Installation:** None — no `npm install` needed for this phase.

**Version verification:** N/A — no new packages.

## Package Legitimacy Audit

Not applicable — this phase introduces zero new npm/pip/cargo dependencies. All required primitives (`Sheet`, `DataTable`, `JsonDiffViewer`, `ManagerPinDialog`, TanStack Query, Zod) are already installed and in use elsewhere in this codebase.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
[EditPaidTabDialog opens for a status='paid' tab, tabId known]
        |
        v
[Load current order_items + tabs.notes]  --(reuse pattern from useOrderItemsByPayment,
        |                                    but query by tabId directly — 1 hop, not 3)
        v
[User edits: qty / unit_price / notes per item, add/remove rows, tab-level notes]
        |
        v
[Confirm] --> [ManagerPinDialog requiredAction="edit_paid_tab"] --(PIN match via profiles.pin)
        |
        v (onSuccess)
[useEditPaidTab mutation] --> supabase.rpc('edit_paid_tab', { p_tab_id, p_expected_version,
        |                                    p_order_item_patches[], p_notes, p_reason })
        v
+-------------------------- edit_paid_tab RPC (SECURITY DEFINER, one transaction) --------------------------+
| 1. SELECT role FROM profiles WHERE id = auth.uid() -> must be manager/admin (else AUTH_FORBIDDEN)          |
| 2. SELECT version, status FROM tabs WHERE id = p_tab_id FOR UPDATE                                         |
|    -> NOT FOUND: raise P0V02 (NOT_FOUND_VERSIONED)                                                          |
|    -> status NOT IN ('paid','closed'): return ok=false TAB_NOT_EDITABLE                                    |
|    -> version <> p_expected_version: raise P0V01 (STALE_VERSION)                                            |
| 3. Capture v_before = to_jsonb(tabs row) + jsonb_agg(order_items rows)                                      |
| 4. Apply whitelisted patches to order_items (update qty/unit_price/notes,                                   |
|    soft-delete via is_deleted=true, insert new rows) and tabs.notes                                         |
| 5. Compute v_old_total / v_new_total from order_items (same subtotal basis as                               |
|    process_payment_atomic: SUM(unit_price * quantity) WHERE parent_order_item_id IS NULL)                   |
| 6. IF v_new_total <> v_old_total:                                                                            |
|      SELECT id INTO v_open_caja FROM caja_sessions WHERE status='open' LIMIT 1                               |
|      IF NOT FOUND: raise exception 'NO_OPEN_CAJA' (blocks total-changing edits only)                        |
|      INSERT INTO caja_entries (caja_session_id, type, amount, concept, staff_id)                             |
|        VALUES (v_open_caja, delta>0?'income':'expense', abs(delta), <concept text>, auth.uid())              |
| 7. UPDATE tabs SET notes = ..., version = version + 1 WHERE id = p_tab_id                                    |
| 8. v_after = to_jsonb(tabs row) + jsonb_agg(order_items rows) || jsonb_build_object('reason', p_reason)      |
| 9. PERFORM record_audit('tab.edit_paid', 'tab', p_tab_id, v_before, v_after, 'rpc')                          |
| 10. RETURN jsonb_build_object('ok', true, 'newTotal', v_new_total, 'deltaRecorded', ...)                     |
+---------------------------------------------------------------------------------------------------------------+
        |
        v
[onError: STALE_VERSION/NOT_FOUND_VERSIONED -> handleVersionError() (existing helper);
 other codes -> toast via AppErrorCode mapping, same as useProcessRefund]
        |
        v
[onSuccess: invalidate tabKeys + auditKeys, toast success]


[/edit-history page]
        |
        v
[useAuditLogs({ action: 'tab.edit_paid' })]  <-- EXISTING hook, just pass the filter
        |
        v
[AuditLogTable-shaped DataTable, + a Reason column reading row.after?.reason]
        |
        v (row click)
[AuditLogDetailSheet -> JsonDiffViewer(before, after)]  <-- EXISTING component, unmodified
```

### Recommended Project Structure
```
src/
├── shared/lib/
│   └── audit-actions.ts          # ADD 'tab.edit_paid' to AuditActionSchema (Wave 0 — CI-gated)
│   └── rbac.ts                   # ADD 'edit_paid_tab' to STAFF_ACTIONS + MANAGER_EXTRA
├── features/edit-paid-tab/       # NEW FSD slice, mirrors features/process-refund/
│   ├── model/
│   │   └── useEditPaidTab.ts     # mutation hook, mirrors useProcessRefund.ts
│   ├── ui/
│   │   └── EditPaidTabDialog.tsx # mirrors RefundSheet.tsx's state machine
│   └── index.ts
├── widgets/EditHistoryTable/     # NEW widget, mirrors widgets/AuditLogTable/ closely
│   ├── EditHistoryTable.tsx      # AuditLogTable clone, hardcoded action filter + Reason column
│   └── index.ts
├── pages/edit-history/
│   └── index.tsx                 # mirrors pages/audit/index.tsx
├── app/
│   ├── router.tsx                 # ADD /edit-history route
│   └── edit-history-route.tsx     # mirrors audit-route.tsx, gate on 'view_audit_log' (reuse, no new action)
supabase/migrations/
└── <ts>_edit_paid_tab_rpc.sql     # NEW RPC, Group-A version-guard template
```

### Pattern 1: Group-A version-guarded whitelist-patch RPC
**What:** A `SECURITY DEFINER` RPC that locks the parent row `FOR UPDATE`, asserts `p_expected_version`, applies a whitelisted patch, bumps `version`, and calls `record_audit()` on the success path only (never inside the `EXCEPTION` block, since a raised exception rolls back the whole transaction including any audit insert attempted after it).
**When to use:** Exactly `edit_paid_tab`'s case — the source template is `create_order_with_items` (20260512000002_rpc_versioned_group_a.sql), which is the closest existing precedent because it also only mutates `order_items` primarily and bumps `tabs.version` as a secondary side-effect, not because it changes `tabs` fields directly.
**Example:**
```sql
-- Source: supabase/migrations/20260512000002_rpc_versioned_group_a.sql (create_order_with_items)
SELECT version INTO v_current FROM tabs WHERE id = p_tab_id FOR UPDATE;
IF v_current IS NULL THEN
  RAISE EXCEPTION 'NOT_FOUND_VERSIONED' USING ERRCODE = 'P0V02';
END IF;
IF p_expected_version IS NOT NULL AND v_current <> p_expected_version THEN
  RAISE EXCEPTION 'STALE_VERSION' USING ERRCODE = 'P0V01';
END IF;
-- ... mutate order_items ...
UPDATE tabs SET version = version + 1, updated_at = NOW() WHERE id = p_tab_id;
```
Re-raise both SQLSTATEs explicitly in the `EXCEPTION` block (do not let `WHEN OTHERS` swallow them into a generic `ok=false` shape) — see `process_payment_atomic`'s `WHEN sqlstate 'P0V01' THEN RAISE;` / `WHEN sqlstate 'P0V02' THEN RAISE;` blocks.

### Pattern 2: Manager-PIN-gated financial-correction Sheet
**What:** A right-side `Sheet` with a `SELECTING -> CONFIGURING -> PIN_MODAL -> SUBMITTING` state machine, deferring the actual mutation until `ManagerPinDialog`'s `onSuccess` fires.
**When to use:** `EditPaidTabDialog` — copy `RefundSheet.tsx`'s structure almost verbatim: local `overrides: Map<string, ItemOverride>` state for per-row edits, a required `reason`/`Select` field, disabled-until-valid Confirm button, `ManagerPinDialog` with `requiredAction="edit_paid_tab"` wrapping the actual submit.
**Example:**
```tsx
// Source: src/features/process-refund/ui/RefundSheet.tsx (structure to mirror)
<ManagerPinDialog
  open={pinOpen}
  onOpenChange={setPinOpen}
  requiredAction="edit_paid_tab"
  onSuccess={() => {
    setPinOpen(false);
    void handleSubmitEdit();
  }}
/>
```
Note `ManagerPinDialog`'s PIN check happens entirely client-side against `profiles.pin` fetched via `useStaffList()` — it does not itself call any RPC. The manager-role re-check happens a second time, server-side, inside `edit_paid_tab` (matching `process_refund`'s `SELECT id FROM profiles WHERE id = auth.uid() AND role IN ('manager','admin')` pattern) — do not skip the server-side check on the assumption the PIN dialog already verified it.

### Pattern 3: Filtered reuse of `AuditLogTable`'s shell
**What:** A new widget that reuses `useAuditLogs()`, `DataTable`, and `AuditLogDetailSheet`/`JsonDiffViewer` unchanged, but hardcodes `filters.action = 'tab.edit_paid'` (no user-facing action filter) and adds a `Reason` column that reads `row.after?.reason` (a plain field lookup on already-fetched jsonb, not a new query).
**When to use:** `/edit-history` (D-04's requirement). This directly answers D-04's open question: the existing `audit_logs` schema (columns: `actor_id`, `action`, `entity_type`, `entity_id`, `before jsonb`, `after jsonb`, `created_at`) is sufficient — `JsonDiffViewer` computes the field-level before/after diff client-side from the two jsonb blobs via `diffJson()`; the DB does not need to store a pre-computed per-field row. The only gap (`reason`) is closed by embedding it in `after` at write time (see Pattern 1's step 8/9).
**Example:**
```tsx
// Source: src/widgets/AuditLogTable/AuditLogTable.tsx (columns array to extend)
{
  id: 'reason',
  header: t('editHistoryTable.columnReason'),
  cell: ({ row }) => {
    const after = row.original.after as Record<string, unknown> | null;
    return typeof after?.['reason'] === 'string' ? after['reason'] : '—';
  },
},
```

### Anti-Patterns to Avoid
- **Mutating `payments.discount_*` retroactively:** `payments.amount` was fixed at capture time and is not recomputed from `discount_*` columns after the fact; editing those columns post-hoc would desync `amount` from the discount fields with no code path that reconciles them. Keep `edit_paid_tab` scoped to `order_items`/`tabs.notes` only — do not touch `payments`.
- **Calling `deplete_for_order_item(order_item_id, +1)` after a quantity edit:** its `p_direction` semantics deplete based on the order_item's CURRENT `quantity` value at call time, not a delta — calling it after already writing the new quantity would deplete/restock the wrong amount. If the planner decides inventory should react to quantity edits (not decided in CONTEXT.md — see Open Questions), it must compute `delta = new_qty - old_qty` itself and either call `record_stock_movement` per-ingredient (delta-based, see Code Examples) or extend `deplete_for_order_item` with an explicit delta parameter — do not call the existing function twice or with the raw new quantity.
- **Inserting the offsetting `caja_entries` row from the client** (mirroring `register-caja-entry`'s direct-insert pattern): that pattern is safe for genuinely manual entries because there's no compensating state elsewhere. Here the entry MUST be atomic with the `order_items` patch — insert it inside the RPC transaction, not as a second client call after the RPC returns.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Field-level before/after diff rendering | A new diff-computing component or a per-field DB table | `diffJson()` (`src/shared/lib/json-diff.ts`) + `JsonDiffViewer` | Already computes and renders exactly the "field changed, old value, new value" shape D-04 asks for, from two raw jsonb blobs |
| Manager PIN verification | A new PIN dialog/hook | `ManagerPinDialog` (`src/features/manager-pin-gate/`) | Already handles PIN entry, eligible-staff filtering via `canAccess(role, requiredAction)`, and error state |
| Optimistic-concurrency conflict UX (toast + refetch) | New conflict-toast logic | `handleVersionError()` (`src/shared/lib/version-error.ts`) | Already wired for the exact `STALE_VERSION`/`NOT_FOUND_VERSIONED` codes this RPC will raise |
| Infinite-scroll audit list + filter bar | A new paginated table for `/edit-history` | `AuditLogTable`'s composition (`DataTable` + `useAuditLogs`) | Same underlying table, same pagination/sort contract — only the filter and one column differ |

**Key insight:** Every piece of infrastructure this phase needs (audit trail, version guard, PIN gate, diff viewer, paginated table) was purpose-built in Phases 14 and 15 specifically so later phases like this one would not need to reinvent it. The actual new work is narrow: one RPC body, one dialog, one filtered list view, two enum additions (`audit-actions.ts`, `rbac.ts`).

## Common Pitfalls

### Pitfall 1: Adding the `PERFORM record_audit('tab.edit_paid', ...)` call before adding the action to `AuditActionSchema`
**What goes wrong:** `src/shared/lib/__tests__/audit-actions.test.ts` greps every migration file for `PERFORM record_audit('...'` and fails CI if the action string isn't in `AuditActionSchema.options`.
**Why it happens:** The natural order is "write the RPC, then remember to register the action" — but the enum lives in a TypeScript file the migration author isn't looking at.
**How to avoid:** Add `'tab.edit_paid'` to `src/shared/lib/audit-actions.ts` (both the `AuditActionSchema` enum array and the `AuditAction` const object) as a Wave-0 task, before the migration task.
**Warning signs:** `npm run test` fails on `audit-actions enforcement` after the migration lands.

### Pitfall 2: Treating "discount fields" (D-01) as a literal column that needs to be added
**What goes wrong:** Neither `tabs` nor `order_items` has any discount column today — only `payments.discount_scope/discount_type/discount_value/discount_amount`, which belong to the immutable payment-capture record, not the editable order lines. Adding a new `tabs.discount_amount` column to satisfy the literal word "discount" would create a second, disconnected discount mechanism from the one `process_payment_atomic` already uses at payment time.
**Why it happens:** D-01's CONTEXT.md wording says "notes/discount fields" as if both are simple existing columns; only `notes` actually is.
**How to avoid:** Interpret "discount" as covered by `order_items.unit_price` edits (a manager lowering a line's price after the fact IS the discount mechanism here) and confirm this interpretation with the user/planner rather than silently adding a new column.
**Warning signs:** Planner writes a task titled "add `tabs.discount_amount` column" — that's new schema surface CONTEXT.md never asked for.

### Pitfall 3: Computing the tab total the wrong way for the caja-offset delta
**What goes wrong:** There are at least two "total" concepts in this codebase — the item subtotal (`SUM(oi.unit_price * oi.quantity) WHERE parent_order_item_id IS NULL`, used by `process_payment_atomic`/`split_tab_evenly`) and the sum actually paid (`payments.amount + payments.tip_amount`, which can differ from the item subtotal if a discount or split was applied). Comparing the wrong pair (e.g. old item-subtotal vs. new paid-amount) will produce a nonsensical delta.
**Why it happens:** The codebase has no single "tab total" helper — every RPC recomputes it inline with a `SELECT SUM(...)` matching its own basis.
**How to avoid:** Compute `v_old_total`/`v_new_total` using the SAME basis (item subtotal, excluding priced combo children via `parent_order_item_id IS NULL`) on both sides, before and after the patch, inside the same RPC invocation — never compare against `payments.amount`.
**Warning signs:** The offsetting caja-entry amount doesn't match the actual dollar change a customer would see if re-billed.

### Pitfall 4: No open caja session when a total-changing edit is attempted
**What goes wrong:** D-03 explicitly allows editing a paid tab at any time, including after its original caja session (and potentially every later session) has closed. If the *current* caja is also closed (e.g., store fully closed for the night, no caja open at all), there is nowhere to record a required offsetting entry.
**Why it happens:** `caja_entries.caja_session_id` is `NOT NULL` — an offsetting entry cannot exist without SOME open session.
**How to avoid:** This is a genuine product decision, not a technical one — see Open Questions. Research recommends the RPC block ONLY total-changing edits when no caja is open (raise `NO_OPEN_CAJA`), while notes-only / non-financial edits proceed regardless — confirm this split with the user before planning locks it in.
**Warning signs:** A manager tries to fix a price at 3am when the caja was closed at midnight and gets a confusing error, or (worse) the edit silently succeeds with the delta unrecorded.

## Code Examples

### Delta-based inventory adjustment (if the planner decides to wire it in — not decided by CONTEXT.md)
```sql
-- Source: supabase/migrations/20260703000002_wire_transfer_tab_stock_movement_audit.sql
-- record_stock_movement is delta-based (p_delta numeric), unlike deplete_for_order_item
-- (which reads order_items.quantity directly) — this is the correct building block
-- for a quantity EDIT (new_qty - old_qty), not deplete_for_order_item.
SELECT record_stock_movement(
  p_ingredient_id => <ingredient_id>,
  p_delta         => <old_qty - new_qty> * <recipe_yield_per_unit>,  -- sign per existing convention
  p_reason        => 'correction',
  p_ref_type       => 'order_item',
  p_ref_id        => <order_item_id>
);
```

### Version-guard re-raise (do not let `WHEN OTHERS` swallow P0V01/P0V02)
```sql
-- Source: supabase/migrations/20260512000002_rpc_versioned_group_a.sql (process_payment_atomic)
EXCEPTION
  WHEN sqlstate 'P0V01' THEN
    RAISE;  -- STALE_VERSION — propagate SQLSTATE to PostgREST/client, don't wrap in ok=false
  WHEN sqlstate 'P0V02' THEN
    RAISE;  -- NOT_FOUND_VERSIONED
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INTERNAL', 'message', '...');
```

### Client-side error mapping for a new RPC (mirrors `useProcessRefund`)
```ts
// Source: src/features/process-refund/model/useProcessRefund.ts (pattern to replicate)
const { data, error } = await db.rpc('edit_paid_tab', {
  p_tab_id: input.tabId,
  p_expected_version: input.expectedVersion,
  p_order_item_patches: input.patches,
  p_notes: input.notes,
  p_reason: input.reason,
});
if (error) {
  if ((error.message as string).includes('STALE_VERSION')) {
    // handled by handleVersionError() in onError, not here — see Pitfall in version-error.ts usage
  }
  if ((error.message as string).includes('NO_OPEN_CAJA')) {
    return err({ code: 'CAJA_CLOSED' as AppErrorCode, message: i18n.t('featOrders:editPaidTab.noOpenCaja') });
  }
  // ... TAB_NOT_EDITABLE, AUTH_FORBIDDEN, etc.
}
```

## State of the Art

Not applicable in the "library upgraded" sense — this is entirely internal-pattern reuse. The one relevant internal evolution: Phase 15 (2026-04-28, commit history in STATE.md) moved the codebase from unguarded `UPDATE` statements to the `p_expected_version`/`FOR UPDATE` contract. Any new mutating RPC written after Phase 15 (this one included) must follow that contract — writing a plain `UPDATE tabs SET ... WHERE id = p_tab_id` without the version guard would be a regression to the pre-Phase-15 pattern the codebase has since eliminated everywhere else.

**Deprecated/outdated:** The legacy `audit_log` (singular) table referenced in `process_refund`'s step 9 (`-- 9. Legacy audit_log table (kept for backward compat; will be removed in Phase 22)`, in `20260708000003_fix_process_refund_audit_log_column.sql`) — a prior migration's comment explicitly earmarks its removal for "Phase 22." This is NOT part of the 22-CONTEXT.md scope (the user's discussion never raised it) — flagged here only so the planner is aware of this dangling reference and can make an explicit, deliberate decision to leave it (in scope creep to avoid) or clean it up as a small separate task. Recommend leaving it untouched unless the user confirms.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "Discount fields" (D-01) has no corresponding schema column on `tabs`/`order_items` and should be satisfied by `unit_price` edits rather than a new column | Summary, Pitfall 2 | If the user actually meant a structured discount concept (e.g. percentage + reason distinct from a raw price override), the whitelist and RPC shape would need a genuinely new column — medium risk, should be confirmed before planning locks the column list |
| A2 | Total-changing edits should block with `NO_OPEN_CAJA` when no caja session is open; non-financial edits (notes-only) should proceed regardless | Pitfall 4, Open Questions | If the product intent is "never block a correction, queue the offsetting entry for later instead," this blocks a legitimate manager action; low-medium risk, flagged explicitly as Open Question, not silently decided |
| A3 | `/edit-history` should reuse `view_audit_log` RBAC action (manager+) rather than a new dedicated action | Architecture Patterns (Pattern 3), Recommended Project Structure | Low risk — CONTEXT.md's Claude's Discretion section explicitly says the RBAC gate is "managers," and `view_audit_log` already means exactly that with zero extra code |
| A4 | Legacy `audit_log` (singular) table cleanup mentioned in a Phase-14/18 migration comment ("will be removed in Phase 22") is OUT of this phase's scope since 22-CONTEXT.md never raises it | State of the Art | Low risk if left alone (it's dead code, not breaking); medium risk of scope-creep if a planner takes the comment as an instruction and expands the phase unprompted |

## Open Questions

1. **Should inventory (`ingredients`/`stock_movements`) react to `order_items.quantity` changes on an edited paid tab?**
   - What we know: The existing depletion machinery (`deplete_for_order_item`, `record_stock_movement`) exists and could be wired in; refunds already do this via a `restock` checkbox per item.
   - What's unclear: 22-CONTEXT.md's D-01 discussion never mentions inventory — it's silent on whether a quantity DECREASE should restock ingredients or a quantity INCREASE should deplete them.
   - Recommendation: Default to NOT touching inventory in this phase (treat `edit_paid_tab` as a pure billing/paperwork correction, like fixing a typo'd price) unless the user confirms otherwise — this keeps the RPC's blast radius small and matches "correction tool for mistakes," not "redo the order." If the user wants inventory sync, it's a straightforward follow-up using `record_stock_movement`'s delta parameter (see Code Examples), not a redesign.

2. **Should `edit_paid_tab` block entirely when no caja session is open, or only block the offsetting-entry step?**
   - What we know: D-03 explicitly wants no time cap on edit eligibility; `caja_entries.caja_session_id` is `NOT NULL`, so an offsetting entry cannot exist without an open session.
   - What's unclear: whether a manager should be blocked from making a NON-financial correction (e.g., fixing a typo in `tabs.notes`) just because no caja happens to be open right now.
   - Recommendation: Split the guard — only require an open caja session when `delta != 0` (a total-changing edit); notes-only edits proceed unconditionally. Confirm with the user during planning/discuss-phase if this wasn't already implicitly decided.

3. **Should Phase 22 introduce `caja_entries.source_tab_id`/`source_type` columns now, anticipating Phase 23's identical need, or should each phase encode its reference in free text independently?**
   - What we know: D-02 explicitly asks research to flag (not decide/implement) whether the offsetting-entry mechanism should be a shared helper. `caja_entries` currently has no FK back to the tab/session being corrected — only `concept TEXT`.
   - What's unclear: whether adding two nullable columns now (low-risk, purely additive, doesn't change existing rows) is worth doing in Phase 22 to save Phase 23 from repeating the same free-text workaround, or whether that's scope creep on a phase that CONTEXT.md scoped narrowly.
   - Recommendation: Do NOT add the columns in Phase 22 unless the user explicitly asks — CONTEXT.md's "Deferred Ideas" section is explicit that Phase 23 is out of scope here. Leave a comment in the new migration noting the free-text encoding choice so Phase 23's research phase picks it up naturally (matches the existing `-- will be removed in Phase 22`-style forward-reference convention already used in this codebase).

## Environment Availability

Not applicable — this phase has no new external dependencies (no new CLI tools, services, or runtimes). It uses the existing Supabase CLI / remote project already configured for this codebase (`npx supabase db push`, confirmed working as of Phase 21).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.4 (unit/integration) + Playwright ^1.59.1 (E2E) |
| Config file | `bar-pos/vitest.config.ts` (unit), `bar-pos/playwright.config.ts` (E2E) — both pre-existing, no Wave 0 setup needed |
| Quick run command | `npx vitest run src/features/edit-paid-tab` (once created) |
| Full suite command | `npm run test` (unit), `npm run test:e2e` (E2E) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC-1 | `edit_paid_tab` RPC enforces whitelist + PIN/reason + version guard | integration (live Supabase, mirrors `process-refund-rpc.integration.test.ts`) | `npx vitest run src/features/edit-paid-tab/model/edit-paid-tab-rpc.integration.test.ts` | ❌ Wave 0 |
| SC-2 | `audit_logs` row written with before/after diff on every edit | integration (same file as SC-1, assert `audit_logs` row post-call) | same as above | ❌ Wave 0 |
| SC-3 | `EditPaidTabDialog` PIN gate -> edit -> reason -> confirm flow | unit/RTL (mirrors process-refund's RefundSheet, no existing test file for RefundSheet itself — component-level coverage is via E2E) + E2E | `npx playwright test e2e/47-edit-paid-tab.spec.ts` (new) | ❌ Wave 0 |
| SC-4 | `/edit-history` lists edits, diff viewer opens per row | E2E (mirrors `e2e/38-audit-logs.spec.ts`'s DOM contract) | `npx playwright test e2e/47-edit-paid-tab.spec.ts` (same spec, extra test block) or a new `48-edit-history.spec.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched test file>`
- **Per wave merge:** `npm run typecheck && npm run lint && npm run test`
- **Phase gate:** Full suite green (`npm run test` + targeted `npm run test:e2e -- e2e/47-edit-paid-tab.spec.ts`) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/features/edit-paid-tab/model/edit-paid-tab-rpc.integration.test.ts` — covers SC-1, SC-2 (mirror `process-refund-rpc.integration.test.ts`'s live-Supabase pattern: happy path, STALE_VERSION, AUTH_FORBIDDEN, whitelist-violation rejection)
- [ ] `e2e/47-edit-paid-tab.spec.ts` — covers SC-3, SC-4
- Framework install: none — Vitest/Playwright already fully configured

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Existing Supabase Auth session (`auth.uid()`) reused, no new auth surface |
| V3 Session Management | no | No change |
| V4 Access Control | yes | Two layers, both required (defense-in-depth, matches `process_refund`): (1) client-side `ManagerPinDialog` filters eligible staff via `canAccess(role, 'edit_paid_tab')`; (2) RPC re-checks `role IN ('manager','admin')` server-side via `auth.uid()` — never trust the PIN dialog alone, since a compromised/DevTools client could call the RPC directly |
| V5 Input Validation | yes | Zod schema for the patch payload before the RPC call (reject non-whitelisted fields client-side as UX, but the RPC itself is the actual security boundary — it must only ever `UPDATE` the whitelisted columns, never accept a dynamic column-name parameter) |
| V6 Cryptography | no | No new cryptographic surface |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client sends a patch payload with extra/unexpected fields hoping the RPC blindly applies them | Tampering | RPC signature uses NAMED, individually-typed parameters for each whitelisted field (`p_order_item_patches jsonb` containing only `id`/`quantity`/`unit_price`/`notes` keys, explicitly destructured — never `UPDATE order_items SET %s = %s` with a dynamic column name) — this is the same discipline already used by every existing RPC in this codebase (no dynamic SQL anywhere in the migrations read this session) |
| A non-manager calls `edit_paid_tab` directly via the Supabase client (bypassing the UI's `ManagerPinDialog`) | Elevation of Privilege | Server-side `SELECT id FROM profiles WHERE id = auth.uid() AND role IN ('manager','admin')` check inside the RPC, raising `AUTH_FORBIDDEN` — copy `process_refund`'s exact check |
| Two managers edit the same paid tab concurrently, one overwriting the other's correction | Tampering (data race) | `p_expected_version` + `FOR UPDATE` + `bump_version_on_update` trigger — copy Phase 15's Group A pattern exactly (Pattern 1 above) |
| Reason field used to inject content that breaks the `caja_entries.concept` free-text encoding scheme, corrupting the later Phase-23-style text parsing | Tampering | `caja_entries.concept` already has a `CHECK (char_length(concept) BETWEEN 1 AND 200)` constraint; if `edit_paid_tab` encodes a structured reference (tab id, date) into `concept`, sanitize/truncate `p_reason` before concatenation the same way `sanitizeSearch()` strips PostgREST metacharacters elsewhere in this codebase — don't let free-text reason break the encoding format if the planner later parses it back out |

## Sources

### Primary (HIGH confidence — read directly from this codebase this session)
- `.planning/phases/22-edit-paid-ticket-history/22-CONTEXT.md` — locked decisions
- `.planning/ROADMAP.md` §"Phase 22"/"Phase 23" — success criteria, dependency graph
- `supabase/migrations/20260511000001_audit_logs_table.sql` — `audit_logs` schema + `record_audit()`
- `supabase/migrations/20260511000002_rpc_audit_wiring.sql` — `record_audit()` call-site pattern across 4 RPCs
- `supabase/migrations/20260512000001_versioned_rows.sql` — `bump_version_on_update` trigger, P0V01 SQLSTATE
- `supabase/migrations/20260512000002_rpc_versioned_group_a.sql` — `p_expected_version`/`FOR UPDATE` template (`process_payment_atomic`, `create_order_with_items`)
- `supabase/migrations/20260421000003_caja_entries.sql`, `20260421000004_caja_report_entries.sql` — `caja_entries` schema, RLS, reporting integration
- `supabase/migrations/20260703000002_wire_transfer_tab_stock_movement_audit.sql` — `record_stock_movement` delta-based RPC
- `supabase/migrations/20260707000001_deplete_for_order_item_v4_fix_modifier_ingredient_collision.sql` — `deplete_for_order_item` direction semantics
- `supabase/migrations/20260708000003_fix_process_refund_audit_log_column.sql` — legacy `audit_log` table, "removed in Phase 22" comment (flagged, not actioned)
- `src/shared/lib/domain.ts` — `TabSchema`, `OrderItemSchema` (app-level shape)
- `src/shared/lib/supabase.types.ts` — `tabs`, `order_items`, `payments`, `refunds` actual DB column shapes
- `src/shared/lib/audit-actions.ts` — `AuditActionSchema` enum, CI-enforced
- `src/shared/lib/__tests__/audit-actions.test.ts` — CI enforcement mechanism
- `src/shared/lib/rbac.ts` — `STAFF_ACTIONS`, role sets
- `src/shared/lib/version-error.ts` — `handleVersionError()` helper
- `src/features/process-refund/ui/RefundSheet.tsx`, `src/features/process-refund/model/useProcessRefund.ts` — dialog + hook template
- `src/features/manager-pin-gate/ui/ManagerPinDialog.tsx` — PIN gate component
- `src/entities/audit-log/model/queries.ts` — `useAuditLogs()` hook
- `src/entities/payment/model/queries.ts` — `useOrderItemsByPayment()` query pattern
- `src/widgets/AuditLogTable/AuditLogTable.tsx`, `AuditLogDetailSheet.tsx` — list + diff Sheet shell to reuse
- `src/shared/ui/JsonDiffViewer/JsonDiffViewer.tsx` — diff rendering contract (`before`/`after`/`truncated` props, `diffJson()`)
- `src/app/audit-route.tsx`, `src/app/router.tsx` — route-guard pattern
- `.planning/config.json` — `nyquist_validation: true`, `security_enforcement` absent (treated enabled)

### Secondary (MEDIUM confidence)
None — all findings this session were grounded directly in primary sources (live codebase read), no external web/doc lookups were needed since this phase is 100% internal-pattern reuse.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, pure internal reuse verified by direct file reads
- Architecture: HIGH — every pattern cited (version guard, audit wiring, PIN gate, diff viewer) was read from its actual current implementation, not inferred
- Pitfalls: HIGH for schema-grounded pitfalls (1-3, based on actual column absence/RPC semantics); MEDIUM for Pitfall 4 (the caja-availability edge case is a genuine product-decision gap, not a code fact)

**Research date:** 2026-07-19
**Valid until:** Until the next migration touching `tabs`/`order_items`/`caja_entries`/`audit_logs` lands (internal-codebase research has no external staleness clock, but a schema change would invalidate the whitelist/pattern citations above)
