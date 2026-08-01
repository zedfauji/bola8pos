# Phase 26: Floating Tables (`is_temp`) - Pattern Map

**Mapped:** 2026-07-28
**Files analyzed:** ~24 (rename sweep + schema additions + new UI action)
**Analogs found:** 24 / 24 (this phase is a same-codebase rename/extension — every touched file already exists)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/*_rename_pool_tables_to_resources.sql` | migration | batch DDL | `supabase/migrations/20260414000005_pool_tables.sql` + `20260510000001_rls_rewrite_phase13.sql` | exact (same table, rename operation) |
| `supabase/migrations/*_resources_is_temp_floating.sql` | migration | batch DDL | `supabase/migrations/20260421000002_pool_tables_type_column.sql` | exact (identical TEXT+CHECK convention) |
| `supabase/migrations/*_deactivate_floating_resource_trigger.sql` | migration/trigger | event-driven | `supabase/migrations/20260420000001_soft_delete.sql` + `supabase/migrations/20260710000006_stop_pool_session_rpc.sql` (SECURITY DEFINER trigger convention) | role-match |
| `src/shared/lib/domain.ts` (`PoolTableSchema` → `ResourceSchema`) | model (Zod) | CRUD | itself, lines 567-582 | exact (edit in place) |
| `src/entities/pool-table/` → `src/entities/resource/` (types.ts, queries.ts, store.ts, usePoolTimer.ts) | model/service | CRUD + realtime | itself (rename + literal-string sweep) | exact |
| `src/entities/pool-table/ui/PoolTableCard.tsx` → `resource/ui/ResourceCard.tsx` | component | request-response | itself, `TABLE_TYPE_LABEL_KEY`/`TABLE_TYPE_VARIANT` lookup tables (lines 31-41) | exact |
| `src/widgets/SettingsTabsPanel/tabs/PoolTablesSettingsTab.tsx` | component (controller-ish) | CRUD | itself, `handleAddTable` (lines 59-71) — numbering/rate logic reused verbatim | exact |
| `src/features/seat-waitlist-party/ui/SeatPartySheet.tsx` | component | request-response | itself, empty-state block (lines 124-130) + `usePoolTables()` inline query (lines 24-51) | exact |
| `src/features/seat-waitlist-party/model/useSeatWaitlistParty.ts` | service (mutation hook) | CRUD | itself, `useMutation` structure (lines 20-58) | exact |
| New: `useSeatAtNewTable` (or fold into `useSeatWaitlistParty`) | service (mutation hook) | CRUD | `PoolTablesSettingsTab.tsx handleAddTable` + `useMutationAddPoolTable` (grep target: `src/entities/pool-table/model/queries.ts`) | exact |
| `src/app/PoolRealtimeListener.tsx`, `src/app/WaitlistRealtimeListener.tsx` | provider | event-driven (realtime) | themselves, literal `'pool_tables'` channel/table refs | exact (rename sweep only) |
| `src/shared/lib/supabase-realtime.ts`, `src/shared/lib/supabase.ts`, `src/shared/lib/supabase-contracts.ts` | config/utility | request-response | themselves | exact (rename sweep only, watch Pitfall 2 settings-key collision) |
| `src/shared/lib/agent/tools/{guardTools,posTools}.ts` | utility | request-response | themselves | exact (rename sweep only) |
| `src/widgets/WaitlistQueue/ui/WaitlistQueue.tsx`, `src/widgets/PoolTableOccupancyPanel/ui/PoolTableOccupancyPanel.tsx` | component | request-response | themselves | exact (rename sweep only) |
| `src/features/stop-and-move-table/useStopAndMoveSession.ts` | service | CRUD | itself | exact (rename sweep only) |
| Test files (`queries.test.ts`, `useCloseTab.test.ts`, `pool-promotions-rpc.integration.test.ts`) | test | — | themselves | exact (rename sweep only) |
| `supabase/migrations/*_transfers.sql` refs (`pool_table_transfers`) | migration | batch DDL | `supabase/migrations/20260420000003_transfers.sql`, `20260713000002_fix_transfer_pool_session_version_bump.sql` | exact (Pitfall 4 — must recreate function bodies) |
| `supabase/migrations/20260710000006_stop_pool_session_rpc.sql` (recreate) | migration/RPC | request-response | itself — `CREATE OR REPLACE FUNCTION stop_pool_session` | exact |

## Pattern Assignments

### `supabase/migrations/*_rename_pool_tables_to_resources.sql` (migration)

**Analog:** existing rename convention — no prior full-table-rename migration exists in this repo, so RESEARCH.md's own worked example is the pattern of record (it was derived directly from this repo's naming conventions for indexes/constraints/triggers/RLS):

```sql
ALTER TABLE pool_tables RENAME TO resources;
ALTER INDEX idx_pool_tables_number RENAME TO idx_resources_number;
ALTER TABLE resources RENAME CONSTRAINT number_positive TO resources_number_positive;
ALTER TABLE resources RENAME CONSTRAINT fk_pool_tables_current_session TO fk_resources_current_session;
ALTER TRIGGER update_pool_tables_updated_at ON resources RENAME TO update_resources_updated_at;
ALTER POLICY "pool_tables_select_authenticated" ON resources RENAME TO "resources_select_authenticated";
-- ...repeat per policy (see 26-RESEARCH.md "Recommended Migration Sequencing" for full list)
```

**Critical companion (Pitfall 3):** in the SAME migration, `CREATE OR REPLACE FUNCTION` for the 3 function bodies that literally contain `pool_tables`/`pool_table` text (rename does not rewrite `pg_proc.prosrc`):
- `stop_pool_session` — source `supabase/migrations/20260710000006_stop_pool_session_rpc.sql`
- `transfer_tab`, `transfer_pool_session` — source `supabase/migrations/20260420000003_transfers.sql`, `20260713000002_fix_transfer_pool_session_version_bump.sql`

---

### `supabase/migrations/*_resources_is_temp_floating.sql` (migration)

**Analog:** `supabase/migrations/20260421000002_pool_tables_type_column.sql` (full file read above — this repo's canonical TEXT+CHECK-over-enum pattern)

```sql
-- Copy this exact shape:
ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS is_temp BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE resources DROP CONSTRAINT IF EXISTS pool_tables_table_type_check; -- confirm real name via \d first
ALTER TABLE resources ADD CONSTRAINT resources_table_type_check
  CHECK (table_type IN ('pool', 'carom', 'consumption', 'floating'));
```
Migration-comment convention to copy (from the analog's header): explain *why* TEXT+CHECK over enum, one-line default-preserves-existing-rows note.

---

### `supabase/migrations/*_deactivate_floating_resource_trigger.sql` (migration/trigger, event-driven)

**Analog A — soft-delete columns already exist:** `supabase/migrations/20260420000001_soft_delete.sql` (lines above) — `pool_tables`/soon-`resources` already has `deleted_at`/`is_deleted`, no ADD COLUMN needed here, just the UPDATE pattern:
```sql
ALTER TABLE pool_tables ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE pool_tables ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
```

**Analog B — SECURITY DEFINER RPC convention:** `stop_pool_session` (`20260710000006_stop_pool_session_rpc.sql`) establishes `SECURITY DEFINER` + `SET search_path = public` for any function that must run regardless of invoking role's RLS visibility — copy this pairing for the new trigger function exactly (this repo's established anti-search-path-hijack convention, called out explicitly in RESEARCH.md's Security Domain section).

**Core trigger pattern to write (from RESEARCH.md Pattern 2, code-grounded against the soft-delete analog):**
```sql
CREATE OR REPLACE FUNCTION deactivate_floating_resource()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stopped_at IS NOT NULL AND OLD.stopped_at IS NULL THEN
    UPDATE resources
    SET is_deleted = TRUE, deleted_at = NOW(), status = 'available', current_session_id = NULL
    WHERE id = NEW.table_id AND is_temp = TRUE AND is_deleted = FALSE;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER deactivate_floating_resource_on_session_stop
  AFTER UPDATE ON pool_sessions
  FOR EACH ROW
  EXECUTE FUNCTION deactivate_floating_resource();
```
Single trigger only — do not add a second trigger on `tabs` (Pitfall 1: `useCloseTab` already refuses to close a tab with a running session, so session-stop is the only real closure path).

---

### `src/shared/lib/domain.ts` — `PoolTableSchema` → `ResourceSchema` (model)

**Analog:** itself, lines 567-582 (edit in place, do not duplicate):
```typescript
export const PoolTableSchema = z.object({
  id: UuidSchema,
  number: z.number().int().min(1).max(30),   // Pitfall 5: REMOVE .max(30) entirely, keep .min(1)
  label: z.string().min(1).max(50),
  ratePerHour: MoneySchema,
  status: PoolTableStatusSchema,
  tableType: PoolTableTypeSchema.default('pool'),  // extend enum/union with 'floating'
  currentSessionId: UuidSchema.nullable(),
  currentSession: PoolSessionBaseSchema.optional(),
});
```
Add `isTemp: z.boolean().default(false)` field. Rename schema/type exports (`PoolTableSchema`→`ResourceSchema`, `PoolTable`→`Resource`, `PoolTableType`→`ResourceType`) per D-01; `PoolTableCreateSchema`/`PoolTableUpdateSchema` follow the same `.omit()`/`.partial().required()` pattern already used at lines 578-580 — copy verbatim, just renamed.

**Pitfall 2 guard:** do NOT touch `SettingsKeySchema`'s `'pool_tables'` literal (~line 833) — unrelated settings-row key, coincidental name collision.

---

### `src/entities/pool-table/` → `src/entities/resource/` (model/service, CRUD + realtime)

**Analog:** itself, `src/entities/pool-table/model/queries.ts` lines 1-80 (read above) — copy the exact structure per file, renaming identifiers:
```typescript
export const poolTableKeys = {
  all: ['pool-tables'] as const,
  detail: (id: string) => [...poolTableKeys.all, 'detail', id] as const,
};
// → resourceKeys = { all: ['resources'] as const, detail: ... }

type PoolTableRow = Tables<'pool_tables'> & { current_session: PoolSessionRowWithPrevious | null };
// → type ResourceRow = Tables<'resources'> & { ... }
```
Result/error handling pattern to copy: `mapPoolTableRow` returns `Result<PoolTable>` via `ok()`/`err(unknownError(e))` — this is the project's standard model-mapping shape (`src/shared/lib/result.ts`), reuse identically for `mapResourceRow`.

**Auto-create mutation (D-05/D-06):** new `addResource`/`useMutationAddResource` should mirror whatever `useMutationAddPoolTable` already does in this same file (grep target confirmed at `PoolTablesSettingsTab.tsx` line 5-6 import) — same insert shape, just called from a different feature.

---

### `src/entities/pool-table/ui/PoolTableCard.tsx` → `resource/ui/ResourceCard.tsx` (component)

**Analog:** itself, lines 30-41 (badge lookup tables — exact pattern for the new "floating" badge, Claude's Discretion item):
```typescript
const TABLE_TYPE_LABEL_KEY: Record<PoolTableType, string> = {
  pool: 'poolTableCard.tableType.pool',
  carom: 'poolTableCard.tableType.carom',
  consumption: 'poolTableCard.tableType.consumption',
  // + floating: 'resourceCard.tableType.floating',
};

const TABLE_TYPE_VARIANT: Record<PoolTableType, 'default' | 'secondary' | 'outline'> = {
  pool: 'default',
  carom: 'secondary',
  consumption: 'outline',
  // + floating: 'outline', // or distinct accent, planner's call
};
```
Imports pattern (lines 1-8) to copy verbatim (path aliases `@shared/lib/domain`, `@shared/ui`, relative `../model/usePoolTimer`).

---

### `src/widgets/SettingsTabsPanel/tabs/PoolTablesSettingsTab.tsx` — `handleAddTable` (D-03/D-06 source of truth)

**Analog:** itself, lines 59-71 — copy verbatim into the new waitlist auto-create path, per RESEARCH.md Pattern 3:
```typescript
const handleAddTable = async () => {
  const nextNumber = Math.max(0, ...sortedTables.map(table => table.number)) + 1;
  const result = await addTable.mutateAsync({
    number: nextNumber,
    label: `Table ${String(nextNumber)}`,
    ratePerHour: sortedTables[sortedTables.length - 1]?.ratePerHour ?? 12,
  });
  if (!result.ok) {
    toast.error(result.error.message);
    return;
  }
  toast.success(t('poolTablesSettingsTab.tableAdded'));
};
```
For the floating variant, additionally pass `tableType: 'floating', isTemp: true` (RESEARCH.md's worked example, lines 158-167 of 26-RESEARCH.md).

---

### `src/features/seat-waitlist-party/ui/SeatPartySheet.tsx` (component, request-response) — D-05 new action

**Analog:** itself. Two exact excerpts:

**Empty-state block to extend** (lines 124-130):
```typescript
{availableTables.length === 0 ? (
  <p className="text-sm text-muted-foreground">
    {t('seatWaitlistParty.noTablesAvailable')}
  </p>
) : (
  ...
)}
```
D-05 requires adding a distinct button/action *inside* this same branch (not replacing it) — "Seat at a new temporary table."

**Inline query pattern to reuse/replace** (lines 24-51) — this file currently hand-rolls its own `usePoolTables()` with a raw `supabase as any` query rather than importing from `entities/pool-table` ("pool-table entity not in this FSD slice" per its own comment). After D-01's rename, decide whether to keep this local inline query (renamed to `resources`) or switch to importing the renamed `entities/resource` query — either is consistent with existing conventions, but the literal-string sweep must at minimum rename `'pool_tables'`→`'resources'` in the `.from()` call and query key.

**Imports pattern** (lines 1-19) — copy the `db = supabase as any` + eslint-disable header convention used throughout this file for un-generated-type tables.

---

### `src/features/seat-waitlist-party/model/useSeatWaitlistParty.ts` (service, CRUD) — D-06 rate inheritance / new mutation

**Analog:** itself, lines 20-58 — copy the `useMutation` + `Result<T>` + toast + `queryClient.invalidateQueries` structure exactly for the new "seat at new temp table" mutation (likely composed from `useMutationAddResource` + this existing `seatParty` mutation, called sequentially or combined into one `mutationFn`):
```typescript
const mutation = useMutation({
  mutationFn: async (input): Promise<Result<void>> => {
    const { error } = await db.from('waitlist_entries').update({...}).eq('id', input.entryId);
    if (error) {
      logger.error('waitlist.seat.failed', { entryId: input.entryId, error });
      return err({ code: 'SUPABASE_ERROR', message: error.message });
    }
    logger.info('waitlist.seat.succeeded', { entryId: input.entryId, tableId: input.tableId });
    return ok(undefined);
  },
  onSuccess: (result, input) => {
    if (!result.ok) { toast.error(...); return; }
    toast.success(...);
    void queryClient.invalidateQueries({ queryKey: waitlistKeys.lists() });
  },
});
```

---

## Shared Patterns

### Result<T> error handling
**Source:** `src/shared/lib/result.ts`, used identically in `src/entities/pool-table/model/queries.ts` (`ok()`/`err(unknownError(e))`) and `src/features/seat-waitlist-party/model/useSeatWaitlistParty.ts` (`err({ code: 'SUPABASE_ERROR', message })`).
**Apply to:** every new/modified service/mutation file in this phase (entity queries, new auto-create mutation, trigger-adjacent client code).

### Soft-delete, never hard-delete
**Source:** `supabase/migrations/20260420000001_soft_delete.sql`
**Apply to:** the new `deactivate_floating_resource` trigger — must set `is_deleted=TRUE, deleted_at=NOW()`, never `DELETE FROM resources` (FK `pool_sessions.table_id ... ON DELETE RESTRICT` would reject a hard delete on any table that ever had a session).

### TEXT + CHECK over enum for schema growth
**Source:** `supabase/migrations/20260421000002_pool_tables_type_column.sql`
**Apply to:** adding `'floating'` to `table_type`; do not introduce a new Postgres `CREATE TYPE ... ENUM`.

### SECURITY DEFINER + SET search_path = public
**Source:** `supabase/migrations/20260710000006_stop_pool_session_rpc.sql`
**Apply to:** the new `deactivate_floating_resource()` trigger function — defense-in-depth against search-path hijacking, matches every existing elevated-privilege function in this repo.

### i18next/no-literal-string eslint-disable convention for wire identifiers
**Source:** `src/entities/pool-table/model/queries.ts` (top-of-file block comment), `src/features/seat-waitlist-party/ui/SeatPartySheet.tsx` (per-line disables around `.from('pool_tables')`)
**Apply to:** every renamed `'pool_tables'` → `'resources'` literal in `.from()`/query-key/channel-name calls — keep the existing disable-comment pattern, do not remove it, do not treat the enforced `i18next/no-literal-string` rule (CLAUDE.md D-05) as blocking wire-protocol identifiers, only user-facing copy.

### `handleAddTable` numbering/rate convention
**Source:** `src/widgets/SettingsTabsPanel/tabs/PoolTablesSettingsTab.tsx` lines 59-71
**Apply to:** any new floating-table creation call site (`SeatPartySheet`'s new action) — reuse `Math.max(0, ...numbers) + 1` and rate-carry-forward verbatim, per D-03/D-06 (no new numbering scheme).

## No Analog Found

None — every file this phase touches is a rename/extension of existing, already-read code. No net-new architectural pattern is introduced.

## Metadata

**Analog search scope:** `supabase/migrations/`, `src/entities/pool-table/`, `src/features/seat-waitlist-party/`, `src/widgets/SettingsTabsPanel/tabs/`, `src/shared/lib/domain.ts`
**Files scanned:** ~10 direct reads (migrations, domain.ts, queries.ts, PoolTableCard.tsx, PoolTablesSettingsTab.tsx, SeatPartySheet.tsx, useSeatWaitlistParty.ts) + RESEARCH.md's own already-code-grounded excerpts for the remaining ~14 rename-sweep-only files
**Pattern extraction date:** 2026-07-28
