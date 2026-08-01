# Phase 27: One-Shot Inventory (Cigarette-Box Pattern) - Pattern Map

**Mapped:** 2026-07-29
**Files analyzed:** 11
**Analogs found:** 11 / 11

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/<ts>_open_units_table.sql` | migration (table+RLS+index) | CRUD | `supabase/migrations/20260420000002_caja_sessions.sql` | exact (one-active-row partial unique index) |
| `supabase/migrations/<ts>_products_open_unit_columns.sql` | migration (ALTER TABLE) | CRUD | any `ALTER TABLE products ADD COLUMN` migration (e.g. `stock_threshold` add) | role-match |
| `supabase/migrations/<ts>_consume_open_unit_rpc.sql` | migration (SECURITY DEFINER RPC) | CRUD/event-driven | `supabase/migrations/20260426000003_record_stock_movement_rpc.sql` | exact (FOR UPDATE row-lock convention) |
| `supabase/migrations/<ts>_open_unit_lifecycle_rpcs.sql` (open/correct/void) | migration (3x SECURITY DEFINER RPC) | CRUD | `supabase/migrations/20260511000002_rpc_audit_wiring.sql` + `20260420000002_caja_sessions.sql`'s `close_caja_session` | exact (role guard + record_audit wiring) |
| `supabase/migrations/<ts>_deplete_for_order_item_v5_open_units.sql` | migration (function replace) | event-driven | `supabase/migrations/20260707000001_deplete_for_order_item_v4_fix_modifier_ingredient_collision.sql` | exact (same function, next version) |
| `src/entities/open-unit/model/types.ts` | model (types) | CRUD | `src/entities/inventory/model/types.ts` | exact |
| `src/entities/open-unit/model/queries.ts` | model (TanStack Query hooks) | CRUD | `src/entities/inventory/model/queries.ts` | exact |
| `src/entities/open-unit/model/store.ts` (optional) | store (Zustand) | event-driven | `src/entities/inventory/model/store.ts` | role-match |
| `src/features/open-open-unit/model/useOpenOpenUnit.ts` + `ui/` | feature (mutation hook + UI) | request-response | `src/features/manage-modifier-inventory-rules/model/useManageModifierInventoryRules.ts` | exact |
| `src/features/correct-open-unit/` , `src/features/void-open-unit/` | feature (manager+ gated dialog) | request-response | `src/features/manage-modifier-inventory-rules/ui/ModifierIngredientRulesDialog.tsx` | exact |
| `src/widgets/InventoryPagePanel.tsx` (edit — add Tabs wrapper + Open Units tab) | widget | request-response | `src/widgets/SettingsTabsPanel/index.tsx` | exact (Tabs primitive + role-gated tab list) |
| `src/shared/lib/audit-actions.ts` (edit — add 5 enum entries) | config (enum) | CRUD | itself — extend existing pattern, no separate analog needed | exact |

## Pattern Assignments

### `supabase/migrations/<ts>_open_units_table.sql` (migration, CRUD)

**Analog:** `supabase/migrations/20260420000002_caja_sessions.sql`

**Table + one-active-row partial unique index** (lines 8-25):
```sql
CREATE TABLE IF NOT EXISTS caja_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opened_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at     TIMESTAMPTZ,
  opened_by     UUID NOT NULL REFERENCES profiles(id),
  closed_by     UUID REFERENCES profiles(id),
  status        TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','closed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS caja_sessions_one_open
  ON caja_sessions (status)
  WHERE status = 'open';
```
For `open_units`, index on `product_id` (per-product, not global): `CREATE UNIQUE INDEX open_units_one_active_per_product ON open_units (product_id) WHERE status = 'active';` (already sketched in RESEARCH.md Code Examples — copy verbatim, just fix column names to match your final schema).

**RLS pattern** (lines 31-46):
```sql
ALTER TABLE caja_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read caja sessions"
  ON caja_sessions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can insert caja sessions"
  ON caja_sessions FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager', 'admin')
  );
```
Prefer `get_user_role()` helper (used everywhere post-Phase-14) over the inline `(SELECT role FROM profiles ...)` subquery style shown here — see Pattern 4 below.

---

### `supabase/migrations/<ts>_consume_open_unit_rpc.sql` (migration, CRUD/event-driven)

**Analog:** `supabase/migrations/20260426000003_record_stock_movement_rpc.sql`

**Row-lock + atomic decrement + guard** (lines 25-53):
```sql
-- SECURITY DEFINER: runs as function owner; auth.uid() is preserved by Supabase JWT.
...
SECURITY DEFINER
SET search_path = public
...
SELECT quantity_on_hand INTO v_current
FROM   ingredients
WHERE  id = p_ingredient_id
FOR UPDATE;

IF NOT FOUND THEN
  RAISE EXCEPTION 'INGREDIENT_NOT_FOUND: ingredient % does not exist', p_ingredient_id;
END IF;

v_new := v_current + p_delta;

IF v_new < 0 AND p_reason NOT IN ('correction', 'physical_count') THEN
  RAISE EXCEPTION 'INVENTORY_NEGATIVE: result would be % for ingredient %', v_new, p_ingredient_id;
END IF;
```
Full worked design (loop across units, auto-open on exhaustion, `p_allow_negative` bypass) is already sketched end-to-end in RESEARCH.md's "Code Examples" section — treat that sketch as the primary template, and this file as the proof that `FOR UPDATE` + `SECURITY DEFINER` + `RAISE EXCEPTION 'CODE: message'` is the house style for the exception string format (`AppErrorCode`-prefixed).

**RBAC guard style — from `deplete_for_order_item`** (Pattern 4 in RESEARCH.md, re-confirmed by grep):
```sql
IF get_user_role() IS NULL OR get_user_role() = 'kitchen' THEN
  RAISE EXCEPTION 'AUTH_FORBIDDEN: bartender or higher required to call deplete_for_order_item';
END IF;
```
`consume_open_unit` itself needs no independent guard when invoked from inside `deplete_for_order_item` (inherits its guard) — see Anti-Patterns in RESEARCH.md for why nesting (not a sibling client-callable RPC) is recommended.

---

### `supabase/migrations/<ts>_open_unit_lifecycle_rpcs.sql` (open/correct/void, migration, CRUD)

**Analog:** `supabase/migrations/20260511000002_rpc_audit_wiring.sql` (record_audit call site) + `close_caja_session` in `20260420000002_caja_sessions.sql` (role-guarded lifecycle RPC shape)

**record_audit call site pattern** (from `close_caja_session`, `20260511000002_rpc_audit_wiring.sql`):
```sql
SELECT to_jsonb(c) INTO v_after_row FROM caja_sessions c WHERE c.id = p_caja_id;
PERFORM record_audit(
  'caja.close',
  'caja_session',
  p_caja_id,
  v_before_row,
  v_after_row,
  'rpc'
);
```
Use this exact shape for `open_open_unit` → `record_audit('open_unit.open', 'open_unit', v_unit_id, NULL, v_after_row, 'rpc')`, and equivalently for `correct`/`void`.

**Manager+ role guard** (from `process_refund`, cited in RESEARCH.md Pattern 4):
```sql
IF get_user_role() NOT IN ('manager', 'admin') THEN
  RAISE EXCEPTION 'AUTH_FORBIDDEN: manager or admin role required';
END IF;
```
Use bartender+ guard (see above) for `open_open_unit` (D-11); use this manager+ guard for `correct_open_unit`/`void_open_unit` (D-12).

**Idempotency-via-unique-index-plus-catch** (D-08 friendly error) — `open_open_unit` should `INSERT` and catch `unique_violation` (SQLSTATE `23505`) rather than pre-checking, per RESEARCH.md Pattern 2 (mirrors `stock_movements`' idempotency-index catch pattern in `supabase/migrations/20260426000002_stock_movements_idempotency_index.sql`).

---

### `supabase/migrations/<ts>_deplete_for_order_item_v5_open_units.sql` (migration, event-driven)

**Analog:** `supabase/migrations/20260707000001_deplete_for_order_item_v4_fix_modifier_ingredient_collision.sql` (the current live version of the function you are replacing — `CREATE OR REPLACE FUNCTION deplete_for_order_item(...)`, same signature, add one new branch after the existing recipe/modifier loops)

**Extension point** (sketch from RESEARCH.md, confirmed against the v4 file's existing recipe/modifier loop structure):
```sql
-- Add after the existing modifier loop in deplete_for_order_item (v5):
IF EXISTS (SELECT 1 FROM products WHERE id = v_product_id AND parent_product_id IS NOT NULL) THEN
  PERFORM consume_open_unit(v_product_id, v_qty, p_order_item_id, p_direction, p_allow_negative);
END IF;
```
Read the full body of `20260707000001_...v4...sql` before writing v5 — copy its exact parameter list, `p_direction`/`p_allow_negative` handling, and the existing `stock_override` legacy-audit branch (do NOT copy that legacy `INSERT INTO audit_log` call for new open-unit events — see Shared Patterns below).

---

### `src/entities/open-unit/model/types.ts` (model, CRUD)

**Analog:** `src/entities/inventory/model/types.ts` (full file, 4 lines)
```typescript
export { InventoryAlertSchema, InventorySchema, InventoryLogSchema } from '@shared/lib/domain';
export type { Inventory, InventoryAlert, InventoryLog } from '@shared/lib/domain';
```
Mirror exactly: define `OpenUnitSchema` (and `OpenUnitCreate`/`OpenUnitCorrection` variants as needed) in `src/shared/lib/domain.ts` (single source of truth per CLAUDE.md), then re-export from `src/entities/open-unit/model/types.ts`.

---

### `src/entities/open-unit/model/queries.ts` (model, CRUD)

**Analog:** `src/entities/inventory/model/queries.ts` (full file, 511 lines)

**Pre-type-regen workaround** (lines 1-24) — apply verbatim since `open_units` won't be in `supabase.types.ts` yet:
```typescript
/* eslint-disable */
// TODO(...): Remove this eslint-disable and the `db` cast below once
// supabase.types.ts is regenerated (open_units table will appear in generated types).
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
...
const db = supabase as any;
```

**Query hook + Result mapping pattern** (lines 92-141, `useInventory`):
```typescript
export function useInventory() {
  const query = useQuery({
    queryKey: inventoryKeys.all,
    queryFn: async (): Promise<Result<Inventory[]>> => {
      const res = await supabaseQuery(() => supabase.from('inventory').select(`*, product:products(*, category:categories(*))`));
      if (!res.ok) { logger.error('inventory.fetch_failed', { message: res.error.message }); return res; }
      const list: Inventory[] = [];
      for (const row of res.data as InventoryRow[]) {
        const m = mapInventoryRow(row);
        if (!m.ok) { logger.error('inventory.map_failed', { message: m.error.message }); return m; }
        list.push(m.data);
      }
      return ok(list);
    },
    staleTime: 60 * 1000,
  });
  const r = query.data;
  return { ...query, data: r?.ok ? r.data : undefined, resultError: r && !r.ok ? r.error : undefined, isEmpty: query.isSuccess && !!r?.ok && r.data.length === 0, isIdleOrLoading: query.isPending || query.isLoading };
}
```
Use `db.from('open_units').select(...)` (not `supabase.from`, since the table isn't typed) for `useOpenUnits()`. Mutation hooks (`useMutationOpenOpenUnit`, `useMutationCorrectOpenUnit`, `useMutationVoidOpenUnit`) should call the corresponding RPC via `db.rpc('open_open_unit', {...})` rather than `.insert()`/`.update()` directly — since D-07's invariant and D-05's override logic live server-side in the RPCs, not as plain CRUD writes. `useMutationAdjustInventory` (lines 307-447) is the closest existing mutation-hook shape (optimistic update + rollback via `onMutate`/`onError`) if optimistic UI is desired, but a simpler `mutationFn` + `onSuccess: invalidateQueries` (no optimistic update) is likely sufficient here since open-unit counts aren't shown inline in the product grid (D-06 — no low-count UI).

---

### `src/features/open-open-unit/model/useOpenOpenUnit.ts` (feature, request-response)

**Analog:** `src/features/manage-modifier-inventory-rules/model/useManageModifierInventoryRules.ts` (full file, 33 lines)
```typescript
import { toast } from 'sonner';
import i18n from '@shared/lib/i18n';

export function useManageModifierInventoryRules() {
  const mutation = useMutationSaveModifierInventoryRules();
  const saveRules = async (input) => {
    const result = await mutation.mutateAsync(input);
    if (!result.ok) {
      toast.error(result.error.message);
      return null;
    }
    toast.success(i18n.t('featMgmt:manageModifierInventoryRules.rulesSaved'));
    return result.data;
  };
  return { saveRules, isSaving: mutation.isPending };
}
```
Mirror exactly for `useOpenOpenUnit`/`useCorrectOpenUnit`/`useVoidOpenUnit`: thin wrapper around the entity mutation hook, toast on error/success via `i18n.t(...)`, return `{ action, isSaving }`.

---

### `src/features/correct-open-unit/ui/`, `src/features/void-open-unit/ui/` (feature, request-response)

**Analog:** `src/features/manage-modifier-inventory-rules/ui/ModifierIngredientRulesDialog.tsx` (full file, 265 lines)

**Dialog shell + role-independent open/close** (lines 239-264):
```typescript
export function ModifierIngredientRulesDialog({ modifierId, modifierName, open, onOpenChange }) {
  const { t } = useTranslation('featMgmt');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg" showCloseButton>
        <DialogHeader><DialogTitle>{t('...dialogTitle', { name: modifierName })}</DialogTitle></DialogHeader>
        {open && modifierId != null ? <ModifierIngredientRulesForm key={modifierId} modifierId={modifierId} onOpenChange={onOpenChange} /> : null}
      </DialogContent>
    </Dialog>
  );
}
```
**Button pair pattern** (lines 204-227) — Cancel + primary action with `LoadingSpinner`/`disabled={isSaving}`:
```typescript
<POSButton type="button" variant="outline" touchSize="default" onClick={() => onOpenChange(false)} disabled={isSaving}>
  {t('common:actions.cancel')}
</POSButton>
<POSButton type="button" touchSize="default" onClick={() => void handleSave()} disabled={!state.isDirty || isSaving}>
  {isSaving ? <LoadingSpinner className="mr-2 size-4" /> : null}
  {isSaving ? t('common:actions.saving') : t('...saveRules')}
</POSButton>
```
For `correct-open-unit`/`void-open-unit`, wrap this dialog inside (or trigger it from behind) `ManagerPinDialog` with `requiredAction="adjust_inventory"` per D-12 — see Shared Patterns below. `open-open-unit` (bartender+, D-11) does NOT need the PIN wrapper — just a plain button triggering the dialog/action directly, same shell minus the PIN gate.

---

### `src/widgets/InventoryPagePanel.tsx` (widget edit, request-response)

**Analog:** `src/widgets/SettingsTabsPanel/index.tsx`

**Tabs wrapper + role-gated tab list** (lines 1-50):
```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/ui/tabs';
...
type TabItem = { key: string; label: string; render: () => ReactNode };

export function SettingsTabsPanel() {
  const { can } = usePermissions();
  const canManageSettings = can('manage_settings');
  const tabs = useMemo<TabItem[]>(() => {
    const out: TabItem[] = [{ key: 'language', label: t('tabs.language'), render: () => <LanguageSettingsTab /> }];
    if (canManageSettings) {
      out.push({ key: 'general', label: t('tabs.general'), render: () => <GeneralSettingsTab currentRole={currentRole} /> });
    }
    return out;
  }, [...]);
  ...
}
```
`InventoryPagePanel.tsx` currently has NO `Tabs` wrapper (per RESEARCH.md canonical-refs note) — wrap its existing content as the first tab ("Stock"/current behavior unchanged) and add a second "Open Units" tab. Both tabs are visible to bartender+ (since D-11 lets bartenders open units), but the correct/void controls inside the Open-Units tab content are individually gated via `ProtectedAction`/`can('adjust_inventory')` — `InventoryPagePanel.tsx` itself already imports `ProtectedAction` (see its own import block, line 15) for this exact per-control gating pattern; reuse it rather than gating the whole tab.

---

### `src/shared/lib/audit-actions.ts` (config, CRUD)

**Analog:** itself — extend the existing `AuditActionSchema` enum + `AuditAction` const map in place.

**Existing enum shape to extend** (lines 20-60):
```typescript
export const AuditActionSchema = z.enum([
  ...
  // Inventory
  'inventory.deplete',
  'inventory.manual_adjust',
  'inventory.physical_count',
  ...
]);
```
Add a new `// Open units` block with the 5 new entries: `'open_unit.open'`, `'open_unit.deplete'`, `'open_unit.exhaust'`, `'open_unit.void'`, `'open_unit.correct'` — and mirror each into the `AuditAction` const object below (e.g. `OPEN_UNIT_OPEN: 'open_unit.open'`). **Must land in the same commit/wave as the RPC migrations that call `record_audit('open_unit.*', ...)`** — `src/shared/lib/__tests__/audit-actions.test.ts` greps migrations and fails CI otherwise (Pitfall 5 in RESEARCH.md).

## Shared Patterns

### Row-locking (`SELECT ... FOR UPDATE` inside `SECURITY DEFINER`)
**Source:** `supabase/migrations/20260426000003_record_stock_movement_rpc.sql`
**Apply to:** `consume_open_unit`, `open_open_unit` (when auto-decrementing box `inventory`), `correct_open_unit`, `void_open_unit` — every mutating RPC touching `open_units` or `inventory` rows.

### `record_audit()` post-mutation call (never the legacy `audit_log` table)
**Source:** `supabase/migrations/20260511000002_rpc_audit_wiring.sql`
**Apply to:** all 3 new lifecycle RPCs + `consume_open_unit`'s deplete/exhaust events.
```sql
PERFORM record_audit('open_unit.open', 'open_unit', v_unit_id, NULL, v_after_row, 'rpc');
```
Do NOT copy `deplete_for_order_item`'s `stock_override`-branch raw `INSERT INTO audit_log (...)` — that targets the legacy singular table, deprecated since Phase 14 (see RESEARCH.md Pitfall 1).

### RBAC role guard inside the RPC body (defense-in-depth, not RLS-only)
**Source:** `deplete_for_order_item` (bartender+) / `process_refund` (manager+), both cited in RESEARCH.md Pattern 4
**Apply to:** `open_open_unit` (bartender+ per D-11), `correct_open_unit`/`void_open_unit` (manager+ per D-12).
```sql
IF get_user_role() IS NULL OR get_user_role() = 'kitchen' THEN
  RAISE EXCEPTION 'AUTH_FORBIDDEN: bartender or higher required';
END IF;
```

### Manager PIN gate on client side
**Source:** `src/features/manager-pin-gate` (`ManagerPinDialog`)
**Apply to:** `correct-open-unit`/`void-open-unit` UI, `requiredAction="adjust_inventory"` (deliberately, per D-12 and RESEARCH.md Pitfall 4 — do not default to `"void_order"` which is a pre-existing quirk elsewhere, not a convention to replicate here).

### Pre-type-regen untyped table access
**Source:** `src/entities/inventory/model/queries.ts` lines 1-24 (`db = supabase as any`)
**Apply to:** every client file touching `open_units` until `supabase.types.ts` is regenerated.

## No Analog Found

None — every planned file has a strong (exact or role-match) analog already in this codebase; this phase is pure composition of existing patterns (confirmed by RESEARCH.md's own "Don't Hand-Roll" table).

## Metadata

**Analog search scope:** `supabase/migrations/`, `src/entities/inventory/`, `src/entities/modifier-inventory-rule/` (implied), `src/features/manage-modifier-inventory-rules/`, `src/widgets/InventoryPagePanel.tsx`, `src/widgets/SettingsTabsPanel/`, `src/shared/lib/audit-actions.ts`, `src/shared/lib/rbac.ts`, `src/features/void-order/`
**Files scanned:** ~15 (migrations + entity/feature/widget source)
**Pattern extraction date:** 2026-07-29
