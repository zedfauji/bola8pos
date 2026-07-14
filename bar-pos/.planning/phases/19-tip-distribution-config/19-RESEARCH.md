# Phase 19: Tip Distribution Config - Research

**Researched:** 2026-07-08
**Domain:** Supabase/PostgreSQL schema design (singleton config + immutable ledger row) + close-caja RPC extension + FSD Settings/Reports UI
**Confidence:** HIGH (all core findings verified by reading live migrations and source files, not inferred)

## Summary

This phase is smaller than the ROADMAP wording ("Add a singleton `tip_distribution_config` ... table") suggests once the codebase is actually inspected. The project already has an established generic singleton-config pattern — the `settings(key VARCHAR UNIQUE, value JSONB)` table — and `receipt_settings`/`billing`/`general`/`rappi`/`pool_tables` are all just rows in that one table, not separate tables. `tip_distribution_config` should be implemented the same way: a new `key='tip_distribution'` row, not a new table. This gets admin-only write enforcement for free (the existing `settings_update_manager_admin_scoped` RLS policy already restricts every key except `'billing'`/`'pool_tables'` to admin), gets settings-backup/restore for free (`settings-backup` edge function does `SELECT * FROM settings`, no hardcoded key list), and matches every existing Settings tab's implementation shape (`useSettings` / `useMutationUpdateSetting`).

`tip_distribution_entries`, by contrast, genuinely is a new dedicated table — one immutable row per `caja_sessions.id`, following the exact shape/RLS-omission pattern already used by `audit_logs` (append-only by omitting UPDATE/DELETE policies entirely) rather than `caja_entries` (which allows manager deletes — wrong precedent for this phase's D-04 "no manual edit" requirement).

The close-caja computation must be added to the **existing** `close_caja_session` RPC (not a new function) so the entries row and the session close happen in the same implicit PL/pgSQL transaction — this is what makes it atomic per D-03, with zero extra coordination. **Critical finding:** `close_caja_session`'s own `UPDATE caja_sessions` statement has never bumped `version`, and Phase 15's `trg_caja_sessions_version` trigger rejects *any* update to `caja_sessions` that doesn't advance `version` by exactly +1. Two nearly-identical bugs in this exact class (`split_tab_by_*` RPCs, `check_parent_tab_auto_close` trigger) were just fixed today (2026-07-08, commits for `20260708000001`/`20260708000002`). `close_caja_session` was never patched and appears to still have the bug — closing the caja today likely raises `STALE_VERSION` (P0V01) on every call. Because Phase 19 must do a `CREATE OR REPLACE FUNCTION close_caja_session(...)` anyway to add the tip computation, this fix is essentially free and should be bundled in — otherwise SC-4 ("Close-caja report reflects the computed distribution") cannot be verified because closing the caja may not work at all.

**Primary recommendation:** Store `tip_distribution_config` as a new `key='tip_distribution'` row in the existing `settings` table (JSONB `{floorPct, barPct, kitchenPct}`); add a new `tip_distribution_entries` table (one row per `caja_session_id`, UNIQUE constraint, audit_logs-style append-only RLS); extend `close_caja_session` in-place to read the config, compute the largest-remainder split over `SUM(payments.tip_amount)` for the session's tabs, write the entry row, and — while already touching this function — fix the pre-existing missing `version = version + 1` bump.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Store 3-way split percentages | Database (`settings` table row) | API/Backend (RLS enforces admin-only) | Matches every other singleton config (billing/receipt/general/rappi) -- no new table needed |
| Compute per-session bucket amounts | Database (PL/pgSQL, inside `close_caja_session`) | -- | Must be atomic with the close transition (D-03); RPC is the only writer (D-04) |
| Admin edits config percentages | Frontend Server/Client UI (Settings tab) | API/Backend (RLS gate + `record_audit`) | Settings tabs are client components calling `useMutationUpdateSetting`; admin-only enforced server-side |
| Display computed distribution per closed session | Frontend Client UI (Reports page, new panel) | API/Backend (RLS: manager+ SELECT) | Mirrors `CajaReportPanel`'s caja-session-selector pattern; read-only, no mutation surface |

## Package Legitimacy Audit

Not applicable -- this phase introduces no new npm/pip/cargo packages. All work is SQL migrations + existing React/Zod/TanStack Query stack already in `package.json`.

## Standard Stack

No new libraries. Reuses:

| Piece | Existing Location | Purpose |
|-------|-------------------|---------|
| `settings` table + RLS | `supabase/migrations/20260419000001_settings_and_backups.sql` | Singleton config storage (reuse, do not create new table) |
| `useSettings` / `useMutationUpdateSetting` | `src/entities/settings/model/queries.ts` | Fetch/save config rows |
| `record_audit` RPC (8-arg overload) | `supabase/migrations/20260703000001_record_audit_terminal_id.sql` | Audit trail for both the admin config edit and the automatic per-close entry write |
| `AuditActionSchema` | `src/shared/lib/audit-actions.ts` | Enum gate -- CI test asserts every `record_audit()` call site uses an enumerated action |
| `bump_version_on_update` trigger | `supabase/migrations/20260512000001_versioned_rows.sql` | Universal `caja_sessions` version guard -- must be respected by any `UPDATE caja_sessions` |
| `ProtectedAction` + `manage_settings` RBAC action | `src/shared/lib/rbac.ts`, `src/shared/ui` | Admin-only UI gate (matches ROADMAP SC-1) |

## Architecture Patterns

### System Architecture Diagram

```
[Admin] --(edit 3 %s)--> TipDistributionSettingsTab
                              |
                              v
                  useMutationUpdateSetting({key:'tip_distribution', value})
                              |
                              v (RLS: admin-only, key not in {'billing','pool_tables'})
                    settings table (key='tip_distribution', value jsonb)
                              |
                    client-side db.rpc('record_audit', {p_action:'settings.update', ...})
                              |
                              v
                        audit_logs (source='client')

[Manager/Admin closes caja] --> useMutationCloseCaja
                              |
                    (pre-RPC version probe, unchanged)
                              |
                              v
                 db.rpc('close_caja_session', {...})           <-- EXTENDED this phase
                              |
      +-----------------------------------------------------------+
      |  close_caja_session (SECURITY DEFINER, one transaction)   |
      |   1. permission + open-tab-count checks (existing)        |
      |   2. capture before-state (existing)                      |
      |   3. UPDATE caja_sessions SET status='closed', ...,        |
      |        version = version + 1   <-- BUG FIX (was missing)  |
      |   4. collect tab_ids for this caja (NEW, mirrors           |
      |        get_caja_report's v_tab_ids logic)                  |
      |   5. SUM(payments.tip_amount) over those tabs (NEW)        |
      |   6. SELECT value FROM settings WHERE key='tip_distribution'|
      |        (NEW, fallback to defaults if row absent)           |
      |   7. largest-remainder split -> floor/bar/kitchen amounts  |
      |   8. INSERT INTO tip_distribution_entries (NEW)            |
      |   9. record_audit('caja.close', ...)        (existing)     |
      |  10. record_audit('tip_distribution.compute', ...) (NEW)   |
      +-----------------------------------------------------------+
                              |
                              v
                   tip_distribution_entries (1 row, immutable)
                              |
                              v
     ReportsPage new tab --> TipBucketDistributionPanel
                    (reuses useCajaList session-selector pattern)
                              |
                    SELECT * FROM tip_distribution_entries
                      WHERE caja_session_id = :selected  (RLS: manager+)
```

### Recommended Project Structure

```
supabase/migrations/
├── 20260709000001_tip_distribution_entries_table.sql   # new table + RLS (audit_logs-style append-only)
└── 20260709000002_close_caja_session_tip_distribution.sql  # CREATE OR REPLACE close_caja_session
                                                              # (adds tip computation + version bump fix)

src/shared/lib/
├── domain.ts            # + SettingsKeySchema 'tip_distribution' literal
                          # + TipDistributionSettingsSchema (floorPct/barPct/kitchenPct)
                          # + TipDistributionEntrySchema (mirrors CajaEntrySchema shape)
├── audit-actions.ts      # + 'tip_distribution.compute' (config edit reuses existing 'settings.update')
└── supabase.types.ts     # manually extend: settings row already generic (no change needed for config);
                           # + tip_distribution_entries Row/Insert/Update block (new table)

src/entities/settings/model/
├── types.ts               # + TipDistributionSettings export
└── queries.ts              # + parseTipDistribution/DEFAULT_TIP_DISTRIBUTION, SettingsSnapshot.tipDistribution,
                             #   SETTINGS_KEYS += 'tip_distribution', useMutationUpdateSetting value union += type

src/entities/caja/  (or a new src/entities/tip-distribution/ slice -- see Open Questions)
└── model/queries.ts        # + useTipDistributionEntry(cajaSessionId) -- direct table select

src/widgets/SettingsTabsPanel/tabs/
└── TipDistributionSettingsTab.tsx   # new -- cloned from GeneralSettingsTab.tsx shape

src/widgets/SettingsTabsPanel/index.tsx   # register new tab in the `canManageSettings` array

src/widgets/TipBucketDistributionPanel/   # new widget -- cloned from CajaReportPanel's
├── TipBucketDistributionPanel.tsx        # session-selector pattern (reuses useCajaList)
└── index.ts

src/pages/reports/index.tsx   # + new TabsTrigger/TabsContent (name must NOT collide with
                                # existing "Tip Distribution" tab label -- see Open Questions)
```

### Pattern 1: Generic settings-table singleton config (reuse, don't create a table)

**What:** Every existing "config row" (`general`, `billing`, `rappi`, `email_receipts`, `pool_tables`, `receipt`, `payment_labels`) is a row in one `settings(key, value jsonb)` table, not a dedicated table per concern.

**Verified from:** `supabase/migrations/20260419000001_settings_and_backups.sql` (table definition + RLS) and `supabase/migrations/20260420000005_receipt_settings.sql` (the "receipt_settings" CONTEXT.md asked to check is literally `INSERT INTO settings (key, value) VALUES ('receipt', ...)` -- there is no `receipt_settings` table).

**RLS (verified, `20260419000001_settings_and_backups.sql` lines 41-71):**
```sql
CREATE POLICY "settings_update_manager_admin_scoped" ON settings
  FOR UPDATE TO authenticated
  USING (
    (get_user_role() = 'admin')
    OR (get_user_role() = 'manager' AND key IN ('billing', 'pool_tables'))
  )
  WITH CHECK ( ... same ... );
```
Any key not in `('billing','pool_tables')` -- including a new `'tip_distribution'` key -- is **already admin-only**, satisfying ROADMAP SC-1 with zero new RLS code.

**When to use:** Any future singleton admin config in this codebase should default to this pattern unless it needs a CHECK constraint the `jsonb` shape can't express, or genuinely needs its own table-level constraints (not the case here -- D-01 explicitly says no hard sum-to-100 rejection).

### Pattern 2: Client-side `record_audit` call from a mutation hook (non-RPC path)

**What:** When a mutation is a direct `.from(table).insert/update/delete()` call (not a SECURITY DEFINER RPC), audit is recorded via an explicit client-side `supabase.rpc('record_audit', {...})` call, best-effort (log a warning on failure, never fail the primary mutation).

**Source:** `src/features/toggle-permission/useMutationTogglePermission.ts` lines 46-62, 81-97 (verified, this is the only existing precedent for client-triggered `record_audit`).

```typescript
// Source: src/features/toggle-permission/useMutationTogglePermission.ts (existing pattern to clone)
const auditRes = await db.rpc('record_audit', {
  p_action: 'settings.update',       // already reserved in audit-actions.ts, unused until now
  p_entity_type: 'settings',
  p_entity_id: null,
  p_before: previousValue ?? null,
  p_after: newValue,
  p_source: 'client',
  p_terminal_id: TERMINAL_ID,
  p_user_id: null,
});
if (auditRes?.error) {
  logger.warn('tip_distribution.settings_update.audit_failed', { message: auditRes.error.message });
}
```

**Important:** `'settings.update'` already exists in `AuditActionSchema` (`src/shared/lib/audit-actions.ts` line 49) but has **zero call sites anywhere in `src/`** today (verified via grep). This strongly suggests it was reserved for exactly this kind of use case and can be adopted directly -- no enum change needed for the config-edit audit event. A **new** action, `'tip_distribution.compute'`, does need to be added for the automatic per-close entry write (see Pattern 3).

### Pattern 3: Extending an existing SECURITY DEFINER RPC in-place (not adding a second RPC)

**What:** `close_caja_session` already does permission checks, an open-tab-count guard, a before/after audit snapshot, and the actual `UPDATE caja_sessions`. CONTEXT.md's discretion note asks whether the tip computation should be inline or a separate function -- evidence strongly favors inline:

- The function body is one implicit PL/pgSQL transaction; anything done inside it is automatically atomic with the close (satisfies D-03 with no 2-phase-commit risk).
- Every prior "Phase X extends an existing RPC" case in this codebase (`process_payment_atomic` gaining split-payment fields, `add_combo_to_tab` gaining audit) used `CREATE OR REPLACE FUNCTION` in place rather than adding a second RPC the caller must sequence.

**Source RPC to extend (verified, current live body):** `supabase/migrations/20260511000002_rpc_audit_wiring.sql` lines 362-438 (`close_caja_session`).

### Pattern 4: Largest-remainder rounding in PL/pgSQL

**What:** D-02 requires: round each bucket down to the cent, then give the leftover cent(s) to the bucket with the largest configured percentage (tie-break: floor > bar > kitchen, per CONTEXT.md's discretion note).

```sql
-- Illustrative -- not yet in any migration, write fresh for this phase.
v_floor_amount   := trunc(v_total_tips * v_floor_pct   / 100, 2);
v_bar_amount     := trunc(v_total_tips * v_bar_pct     / 100, 2);
v_kitchen_amount := trunc(v_total_tips * v_kitchen_pct / 100, 2);
v_remainder := v_total_tips - (v_floor_amount + v_bar_amount + v_kitchen_amount);

IF v_remainder > 0 THEN
  IF v_floor_pct >= v_bar_pct AND v_floor_pct >= v_kitchen_pct THEN
    v_floor_amount := v_floor_amount + v_remainder;
  ELSIF v_bar_pct >= v_kitchen_pct THEN
    v_bar_amount := v_bar_amount + v_remainder;
  ELSE
    v_kitchen_amount := v_kitchen_amount + v_remainder;
  END IF;
END IF;
```
`trunc(numeric, int)` truncates toward zero, which is equivalent to floor for non-negative values (tips are always `>= 0` per the existing `payments.tip_amount_non_negative` CHECK, so this is safe). `>=` comparisons in that order implement the floor > bar > kitchen tie-break deterministically.

### Anti-Patterns to Avoid

- **Don't create a `tip_distribution_config` table.** It would duplicate RLS logic the `settings` table already has, break the settings-backup/restore edge functions' generic `SELECT * FROM settings` sweep (a separate table wouldn't be backed up), and contradict the codebase's own established convention.
- **Don't add a second RPC that the client must call after `close_caja_session` succeeds.** That reintroduces the exact "eventual consistency instead of atomicity" problem D-03 is explicit about avoiding.
- **Don't skip the `version = version + 1` fix "because it's out of scope."** It is in scope by necessity -- the plan must touch this function's body regardless, and the function is very likely non-functional without the fix (see Common Pitfalls).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Singleton admin config storage | New `tip_distribution_config` table + new RLS policies | Existing `settings` table, new `key='tip_distribution'` row | Zero new RLS code needed; admin-only already enforced by existing policy |
| Percent-of-total split with no lost pennies | Ad-hoc rounding in the frontend | PL/pgSQL `trunc(x,2)` + remainder-to-largest-bucket inside the RPC (Pattern 4) | Must happen server-side to be atomic with the close and to match D-02/D-03 exactly |
| Admin-only settings tab gating | New RBAC action | Existing `manage_settings` action (already admin-only per `ADMIN_EXTRA` in `rbac.ts`) | Exact fit -- no new RBAC surface needed |

**Key insight:** Nearly all of the "new infrastructure" this phase might appear to need (new config table, new RLS, new RBAC action, new audit action for the config edit) already exists in the codebase under names that don't obviously map to "tip distribution" (`settings`, `manage_settings`, `settings.update`). The actual new surface area is: one table (`tip_distribution_entries`), one RPC extension, one new audit action (`tip_distribution.compute`), one settings tab, one report panel.

## Common Pitfalls

### Pitfall 1: `close_caja_session` likely raises `STALE_VERSION` on every call today (pre-existing bug, not caused by this phase, but this phase must fix it)

**What goes wrong:** `close_caja_session`'s `UPDATE caja_sessions SET closed_at=..., closed_by=..., closing_cash=..., notes=..., status='closed' WHERE id=p_caja_id AND status='open'` never includes `version = version + 1`. Phase 15's `trg_caja_sessions_version` trigger (`bump_version_on_update()`, `supabase/migrations/20260512000001_versioned_rows.sql`) rejects **any** UPDATE to `caja_sessions` where `NEW.version IS DISTINCT FROM (OLD.version + 1)` -- including an UPDATE that doesn't touch `version` at all (in which case `NEW.version = OLD.version`, which is never `OLD.version + 1`).

**Why it happens:** `close_caja_session` predates Phase 15's version column (it was written in `20260420000002_caja_sessions.sql`, months before `20260512000001_versioned_rows.sql`) and was never migrated into the "every writer bumps version" contract the way `process_payment_atomic`/`create_order_with_items` were (`20260512000002_rpc_versioned_group_a.sql`). Two RPCs/triggers in the exact same situation (`split_tab_by_item/person/amount`, `check_parent_tab_auto_close`) were identified and fixed **today**, 2026-07-08, in `20260708000001_fix_split_tab_rpcs_version_bump.sql` and `20260708000002_fix_parent_auto_close_trigger_version_bump.sql`. `close_caja_session` was not included in either fix and still has the identical shape of bug (verified: no migration file sets `version` inside an `UPDATE caja_sessions` statement anywhere in `supabase/migrations/`).

**How to avoid:** Since Phase 19 must do `CREATE OR REPLACE FUNCTION close_caja_session(...)` anyway to add tip computation, add `version = version + 1` to its existing `UPDATE caja_sessions` statement in the same migration. This is a two-line change riding along with an already-required migration.

**Warning signs:** If the plan's verification step tries to close a caja end-to-end (E2E or integration test) and gets `STALE_VERSION` / SQLSTATE `P0V01`, this is the cause. The frontend hook's pre-RPC version probe (`useMutationCloseCaja` in `src/entities/caja/model/queries.ts`, lines ~213-229) makes this worse, not better: when a cached version exists, the probe UPDATE bumps `caja_sessions.version` once, and then the (unfixed) RPC's own UPDATE effectively asks the trigger to accept a *second*, unbumped update on top of that -- the trigger check fails identically either way.

### Pitfall 2: Existing "Tip Distribution" report tab name collision

**What goes wrong:** `src/pages/reports/index.tsx` already has a `TabsTrigger value="tips"` labeled **"Tip Distribution"** (the existing per-staff `TipDistributionPanel`, D-07 explicitly leaves this untouched). If the new bucket-distribution panel is also labeled "Tip Distribution," users and future maintainers will confuse the two features.

**Why it happens:** Both features legitimately involve "tips" and "distribution" as words, but they compute entirely different things (per-staff totals in a date range vs. per-caja-session floor/bar/kitchen buckets).

**How to avoid:** Give the new tab a visibly distinct label, e.g. "Tip Buckets" or "Tip Split (Floor/Bar/Kitchen)". Flagged as an Open Question below for the planner/user to confirm the exact label; this is a naming decision, not a technical one.

### Pitfall 3: Forgetting `tip_amount` is already summed uniformly across payment methods everywhere else in the codebase

**What goes wrong:** Introducing a method-based exclusion (e.g. "don't pool rappi tips") would be a **new** business rule with no precedent, and CONTEXT.md's Deferred Ideas section explicitly flags this as raised-but-unresolved.

**Why it happens:** It's tempting to special-case delivery-platform tips since they may already route to a driver outside the POS. But `get_caja_report`'s `v_total_revenue`/`v_cash_sales`/etc. and `useStaffTips`'s tip aggregation both sum `tip_amount` across cash/card/rappi uniformly today, with zero exclusion logic anywhere in the schema or RLS.

**How to avoid:** Default to pooling `SUM(payments.tip_amount)` across all methods for the session's tabs (matching every existing aggregation in the codebase), filtered the same way `get_caja_report` filters (`is_deleted = FALSE`). Treat any method-exclusion rule as an explicit future decision, not something to infer here.

### Pitfall 4: `settings.value` is untyped JSONB -- a missing `tip_distribution` row must not crash `close_caja_session`

**What goes wrong:** If no admin has ever saved the Tip Distribution settings tab, `SELECT value FROM settings WHERE key='tip_distribution'` returns no rows. The RPC must not error in this case -- it must fall back to some default split (or `0` tips distributed with a config-not-set marker) rather than raising an exception that rolls back the entire caja close.

**How to avoid:** `SELECT value INTO v_config FROM settings WHERE key = 'tip_distribution'; IF NOT FOUND THEN v_config := '{"floorPct":0,"barPct":0,"kitchenPct":0}'::jsonb; END IF;` -- or pick a more sensible default split (this needs an explicit product decision; flagged in Assumptions Log below since no default is specified anywhere in ROADMAP.md/CONTEXT.md).

### Pitfall 5: `tip_distribution_entries` must tolerate `total_tips = 0`

**What goes wrong:** A caja session with zero cash-tip activity (e.g. all card payments with `tipAmount=0`, or a very slow day) is a completely normal case, not an edge case to special-case away. The largest-remainder algorithm above naturally produces `0/0/0` when `v_total_tips = 0` -- verify the plan's tests cover this rather than assuming tips are always present.

## Code Examples

### Existing `close_caja_session` body to extend (verified current state)

```sql
-- Source: supabase/migrations/20260511000002_rpc_audit_wiring.sql lines 362-438 (current live version)
CREATE OR REPLACE FUNCTION close_caja_session(
  p_caja_id      UUID,
  p_closed_by    UUID,
  p_closing_cash NUMERIC(12,2),
  p_notes        TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_open_tab_count INT;
  v_caller_role TEXT;
  v_before_row jsonb;
  v_after_row  jsonb;
BEGIN
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF v_caller_role NOT IN ('manager', 'admin') THEN ... END IF;

  SELECT COUNT(*) INTO v_open_tab_count FROM tabs
  WHERE caja_session_id = p_caja_id AND status = 'open' AND is_deleted = FALSE;
  IF v_open_tab_count > 0 THEN ... END IF;

  SELECT to_jsonb(c) INTO v_before_row FROM caja_sessions c WHERE c.id = p_caja_id;

  UPDATE caja_sessions
  SET closed_at = now(), closed_by = p_closed_by, closing_cash = p_closing_cash,
      notes = COALESCE(p_notes, notes), status = 'closed'
      -- MISSING: version = version + 1  <-- add this (Pitfall 1)
  WHERE id = p_caja_id AND status = 'open';

  IF NOT FOUND THEN ... END IF;

  SELECT to_jsonb(c) INTO v_after_row FROM caja_sessions c WHERE c.id = p_caja_id;
  PERFORM record_audit('caja.close', 'caja_session', p_caja_id, v_before_row, v_after_row, 'rpc');
  -- INSERT tip_distribution_entries logic goes here, before this final RETURN

  RETURN json_build_object('ok', true);
END;
$$;
```

### `record_audit` 8-argument signature (current, verified live)

```sql
-- Source: supabase/migrations/20260703000001_record_audit_terminal_id.sql lines 47-56
record_audit(
  p_action      text,
  p_entity_type text,
  p_entity_id   uuid        DEFAULT NULL,
  p_before      jsonb       DEFAULT NULL,
  p_after       jsonb       DEFAULT NULL,
  p_source      text        DEFAULT 'rpc',
  p_terminal_id text        DEFAULT NULL,
  p_user_id     uuid        DEFAULT NULL
) RETURNS uuid
```

### Zod schema shape to add (`src/shared/lib/domain.ts`, follows `CajaEntrySchema` precedent)

```typescript
// Source: pattern from CajaEntrySchema (src/shared/lib/domain.ts lines 927-937)
export const TipDistributionSettingsSchema = z.object({
  floorPct: z.number().min(0).max(100),
  barPct: z.number().min(0).max(100),
  kitchenPct: z.number().min(0).max(100),
});
export type TipDistributionSettings = z.infer<typeof TipDistributionSettingsSchema>;

export const TipDistributionEntrySchema = z.object({
  id: UuidSchema,
  cajaSessionId: UuidSchema,
  floorPct: z.number().min(0).max(100),
  barPct: z.number().min(0).max(100),
  kitchenPct: z.number().min(0).max(100),
  totalTips: MoneySchema,
  floorAmount: MoneySchema,
  barAmount: MoneySchema,
  kitchenAmount: MoneySchema,
  createdAt: TimestampSchema,
});
export type TipDistributionEntry = z.infer<typeof TipDistributionEntrySchema>;
```

## State of the Art

Not applicable in the usual "library version drift" sense -- no external library is involved. The only "state of the art" consideration is internal: this phase should follow the **post-Phase-15** RPC-writing convention (explicit `version = version + 1` on every `caja_sessions`/`tabs`/`pool_sessions` UPDATE), not the pre-Phase-15 convention `close_caja_session` was originally written under.

| Old Approach (pre-Phase-15, still present in `close_caja_session`) | Current Approach (established by `20260512000002`, `20260708000001/2`) | When Changed | Impact |
|--------------|------------------|------|--------|
| RPCs `UPDATE caja_sessions`/`tabs` without touching `version` | Every UPDATE statement explicitly sets `version = version + 1` | Phase 15 (2026-04-28), with 2 follow-up fixes today (2026-07-08) | Any RPC not yet migrated (like `close_caja_session`) raises `STALE_VERSION` unconditionally |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Default floor/bar/kitchen percentages when no admin has ever configured them (e.g. `0/0/0`, or some non-zero split like `50/30/20`) -- no source specifies this. | Pitfall 4 / Recommended Approach | If wrong, first-ever caja close before any admin visits Settings could silently distribute $0 to all buckets (safe but maybe surprising) or use an unintended default split. Low risk either way since D-01 already allows non-100% sums; recommend `0/0/0` as the safest default (all zero is an obviously-unconfigured state, easy for the report to flag), pending planner/user confirmation. |
| A2 | Pool `tip_amount` uniformly across cash/card/rappi payment methods (no exclusion) for the per-session total. | Pitfall 3, Common Pitfalls | If the business actually wants rappi tips excluded, entries would be computed incorrectly and (per D-04) cannot be corrected without a DB-level fix. However this default is well-supported by existing codebase precedent (`get_caja_report`, `useStaffTips` both pool uniformly), so risk is LOW. |
| A3 | New Reports tab label should be distinct from the existing "Tip Distribution" (per-staff) tab -- exact wording not specified anywhere. | Pitfall 2 | Cosmetic only; wrong label doesn't break functionality but could confuse operators distinguishing the two "tip" features. |
| A4 | `tip_distribution_entries.caja_session_id` should have a `UNIQUE` constraint (one entry per close, ever) rather than allowing multiple rows per session. | Recommended Approach | If wrong (e.g. a future phase wants to allow re-computation), the UNIQUE constraint would need a migration to relax. Low risk -- D-04 explicitly says no manual correction path exists, so one-row-per-session is the correct interpretation of the current scope. |

**If this table is empty:** N/A -- see rows above. All other technical claims in this document (schema shapes, RLS policies, RPC bodies, bug diagnosis) are `[VERIFIED]` by direct file reads of the current migrations/source, not assumed.

## Open Questions (RESOLVED)

1. **RESOLVED (plan 19-05):** Chose "Tip Split" (tab key `tip-split`) instead of the recommended "Tip Buckets" -- still clearly distinct from the existing "Tip Distribution" per-staff tab, D-07 preserved untouched.
2. **RESOLVED (plans 19-02/19-04):** Pre-seeded default of 34/33/33 (not 0/0/0) -- sums to 100 so no first-view sum-warning, matches both the RPC fallback and the frontend default.
3. **RESOLVED (plan 19-04):** Extended `entities/caja/model/queries.ts` with `useTipDistributionEntry(cajaSessionId)`, per the research recommendation.

1. **Report tab/panel naming to avoid confusion with the existing per-staff "Tip Distribution" tab**
   - What we know: `ReportsPage` already has `<TabsTrigger value="tips">Tip Distribution</TabsTrigger>` for the unrelated per-staff `TipDistributionPanel` (D-07 keeps this as-is).
   - What's unclear: The exact label/tab-key the planner should use for the new floor/bar/kitchen bucket panel (D-06 requires it to be a separate tab).
   - Recommendation: Use a clearly distinct label such as "Tip Buckets" (tab key `tip-buckets`) -- surface this as a naming choice in the plan rather than silently picking one.

2. **Default percentages when `tip_distribution` settings row doesn't exist yet**
   - What we know: D-01 confirms no hard-sum-to-100 validation is required, so any default (including `0/0/0`) is schema-legal.
   - What's unclear: Whether the business wants a sensible non-zero starting default (e.g. even thirds, or floor-weighted) pre-seeded via the migration, vs. leaving it fully unset until an admin visits the new Settings tab.
   - Recommendation: Ship with no pre-seeded row, OR pre-seed a `0/0/0` row (obviously-unconfigured, safe). Planner should decide; flag for user confirmation if it matters to the business.

3. **Should the new entity slice be `src/entities/caja/` (extend) or a new `src/entities/tip-distribution/`?**
   - What we know: `tip_distribution_entries` is FK'd to `caja_sessions` and conceptually a caja-close artifact, similar to `caja_entries`. `entities/caja/model/queries.ts` already houses `useCajaReport`, `useCajaEntries`, etc.
   - What's unclear: FSD convention in this codebase sometimes creates a dedicated entity per concept (e.g. `entities/refund/`, `entities/rbac/`) even when tightly coupled to another entity, and sometimes extends an existing one (`caja_entries` living inside `entities/caja/`).
   - Recommendation: Given `tip_distribution_entries` is purely a read-side reporting artifact (no create/update/delete feature needed -- D-04), extending `entities/caja/model/queries.ts` with a `useTipDistributionEntry(cajaSessionId)` hook (mirroring `useCajaEntries`) is the lower-friction choice and keeps all caja-session-scoped reads in one place. A separate `entities/tip-distribution/` slice is equally valid FSD-wise if the planner prefers stronger separation.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest v4 + React Testing Library v16 (unit); Playwright v1.59 (E2E) |
| Config file | `vitest.config.ts`, `playwright.config.ts` |
| Quick run command | `npx vitest run src/entities/caja/model/queries.test.ts` |
| Full suite command | `npm run test` (unit); `npm run test:e2e` (Playwright, manual before release per CLAUDE.md) |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC-1 | `tip_distribution` settings row admin-only write | unit (RLS-style logic in mutation hook) + integration (live RLS denial for non-admin) | `npx vitest run src/widgets/SettingsTabsPanel/tabs/TipDistributionSettingsTab.test.tsx` | Wave 0 |
| SC-2 | `tip_distribution_entries` computed correctly, allocations sum to total tips (incl. largest-remainder edge cases) | unit/property (pure split function) + integration (live RPC call against remote DB) | `npx vitest run src/shared/lib/tip-distribution-math.test.ts` | Wave 0 |
| SC-3 | Settings panel edits 3-way split, warns but allows save when not 100% | unit (RTL) | `npx vitest run src/widgets/SettingsTabsPanel/tabs/TipDistributionSettingsTab.test.tsx` | Wave 0 |
| SC-4 | Close-caja report reflects computed distribution | E2E (extend `e2e/02-caja.spec.ts` or new spec) + unit (report panel RTL) | `npx playwright test e2e/02-caja.spec.ts` | needs new assertions |
| (regression) | `close_caja_session` version-bump fix doesn't break existing close flow | integration (live RPC call, assert `version` increments correctly and no `STALE_VERSION`) | live Supabase test, mirrors pattern in `src/entities/caja/model/queries.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched test file>`
- **Per wave merge:** `npm run test` + `npm run typecheck` + `npm run lint`
- **Phase gate:** Full suite green + live integration test proving `close_caja_session` no longer raises `STALE_VERSION` before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/shared/lib/tip-distribution-math.ts` + `.test.ts` -- pure largest-remainder split function, property-tested with `fast-check` (percentages summing to arbitrary values, zero-tip sessions, tie-break cases)
- [ ] `src/widgets/SettingsTabsPanel/tabs/TipDistributionSettingsTab.test.tsx` -- RTL, mirrors `BillingSettingsTab.test.tsx`
- [ ] Live integration test asserting `close_caja_session` succeeds without `STALE_VERSION` post-fix (this is effectively a regression test the phase MUST add given Pitfall 1)
- [ ] `tip_distribution_entries` RLS test (manager+ SELECT, no INSERT/UPDATE/DELETE for any role) -- mirrors the append-only pattern precedent used for `audit_logs`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Not touched by this phase |
| V3 Session Management | no | Not touched by this phase |
| V4 Access Control | yes | `settings` RLS (admin-only for `tip_distribution` key, verified existing policy) + new `tip_distribution_entries` RLS (manager+ SELECT only, no write policies -- SECURITY DEFINER RPC is sole writer) |
| V5 Input Validation | yes | Zod schemas (`TipDistributionSettingsSchema`, `TipDistributionEntrySchema`) validate percentages are 0-100; PL/pgSQL RPC re-validates server-side (never trust client-computed amounts) |
| V6 Cryptography | no | Not applicable |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Non-admin edits tip split via direct `supabase.from('settings').update()` bypassing the UI | Elevation of Privilege | Already mitigated by existing `settings_update_manager_admin_scoped` RLS policy -- verify the new key is NOT accidentally added to the manager-allowed list (`'billing','pool_tables'`) |
| Client sends manipulated `tip_distribution_entries` INSERT directly (bypassing `close_caja_session`) | Tampering | New table must have **no INSERT/UPDATE/DELETE RLS policy for any role** (append-only-by-omission, matching `audit_logs`); only the SECURITY DEFINER RPC bypasses RLS |
| Re-closing an already-closed caja re-triggers tip computation, creating duplicate entries | Tampering / Repudiation | `close_caja_session`'s existing `WHERE id = p_caja_id AND status = 'open'` + `IF NOT FOUND` guard already prevents re-close; additionally add `UNIQUE(caja_session_id)` on `tip_distribution_entries` as defense-in-depth |

## Sources

### Primary (HIGH confidence -- direct file reads of this repository)
- `supabase/migrations/20260419000001_settings_and_backups.sql` -- settings table + RLS
- `supabase/migrations/20260420000005_receipt_settings.sql` -- proof `receipt_settings` is a settings-table row, not a table
- `supabase/migrations/20260420000002_caja_sessions.sql` -- original `close_caja_session`
- `supabase/migrations/20260511000002_rpc_audit_wiring.sql` -- current live `close_caja_session` body (audit-wired)
- `supabase/migrations/20260703000001_record_audit_terminal_id.sql` -- `record_audit` 8-arg signature
- `supabase/migrations/20260512000001_versioned_rows.sql` -- `bump_version_on_update` trigger definition
- `supabase/migrations/20260708000001_fix_split_tab_rpcs_version_bump.sql`, `20260708000002_fix_parent_auto_close_trigger_version_bump.sql` -- proof of the exact bug class, fixed today for other RPCs but not `close_caja_session`
- `supabase/migrations/20260421000003_caja_entries.sql`, `20260421000004_caja_report_entries.sql`, `20260420000004_caja_report_rpc.sql` -- `caja_entries` shape + `get_caja_report` tab-id-collection pattern to mirror
- `supabase/migrations/20260511000001_audit_logs_table.sql` -- append-only RLS pattern to mirror for `tip_distribution_entries`
- `supabase/migrations/20260707000003_split_payment_columns_and_rpc.sql` -- most recent precedent for extending a payment-adjacent RPC in place
- `supabase/migrations/20260414000006_payments.sql` -- `payments.tip_amount NUMERIC(10,2)`, `tip_amount_non_negative` CHECK
- `src/entities/caja/model/queries.ts` -- `useMutationCloseCaja` (pre-RPC version probe), `useCajaReport`, `useCajaEntries` patterns
- `src/entities/settings/model/queries.ts`, `src/entities/settings/model/types.ts` -- settings snapshot pattern to extend
- `src/widgets/SettingsTabsPanel/index.tsx`, `.../tabs/GeneralSettingsTab.tsx`, `.../tabs/BillingSettingsTab.tsx` -- Settings tab registration + form pattern to clone
- `src/widgets/CajaReportPanel/CajaReportPanel.tsx` -- caja-session-selector pattern to reuse for the new report panel
- `src/widgets/TipDistributionPanel/TipDistributionPanel.tsx`, `src/entities/staff/model/queries.ts` (`useStaffTips`) -- existing per-staff tip pattern (not modified, but confirms uniform tip pooling across payment methods)
- `src/pages/reports/index.tsx` -- existing tab list, confirms naming collision risk (Pitfall 2)
- `src/shared/lib/domain.ts` -- `SettingsKeySchema`, `CajaSessionSchema`, `CajaEntrySchema`, `CajaReportSchema`, `MoneySchema` definitions
- `src/shared/lib/audit-actions.ts` -- confirms `'settings.update'` is reserved-but-unused
- `src/shared/lib/rbac.ts` -- confirms `manage_settings` is admin-only, `view_reports`/`manage_caja` are manager+
- `src/features/toggle-permission/useMutationTogglePermission.ts` -- client-side `record_audit` call pattern to clone
- `.planning/phases/19-tip-distribution-config/19-CONTEXT.md`, `.planning/ROADMAP.md`, `.planning/STATE.md` -- phase scope, decisions, and today's commit history confirming the version-bump bug class

### Secondary / Tertiary
None -- all findings in this document are grounded in direct reads of files in this repository (no external library documentation was needed; this phase is pure internal schema/RPC/UI work).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no external libraries involved, all patterns verified in-repo
- Architecture: HIGH -- settings-table reuse and RPC-extension approach both directly evidenced by multiple existing precedents in the same codebase
- Pitfalls: HIGH -- the `close_caja_session` version-bump bug is verified by absence-of-fix in a fully readable migration history, cross-checked against two sibling bugs fixed in the same codebase on the same day

**Research date:** 2026-07-08
**Valid until:** Should remain valid indefinitely for architecture/pattern findings (internal codebase conventions change slowly); re-verify the `close_caja_session` bug-fix status specifically if any other migration touches `caja_sessions` before this phase executes (check for new files dated after `20260708000003` in `supabase/migrations/`).

## RESEARCH COMPLETE
