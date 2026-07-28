# Phase 26: Floating Tables (`is_temp`) - Research

**Researched:** 2026-07-28
**Domain:** Postgres/Supabase schema rename + RLS/trigger design, React/TanStack Query entity rename, FSD refactor
**Confidence:** HIGH (all findings grounded in direct reads of this repo's migrations/source — no external library research needed; this phase introduces zero new dependencies)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Full rename: the DB table (`pool_tables` → `resources`), the FK relationship from `pool_sessions`, RLS policies, realtime wiring, the entity folder (`entities/pool-table` → `entities/resource`), and all ~18 internal call sites that reference `'pool_tables'` literally are renamed to the `resources`/`resource` concept. User explicitly chose the full rename over the smaller additive-column option (which would have kept the `pool_tables` name and just added `is_temp` + a `'floating'` value to the existing `table_type` CHECK constraint). — Reversibility: one-way.
- **D-02:** User-facing surface does NOT rename. Routes stay `/pool-tables`, nav label stays "Pool Tables", page titles/i18n copy unchanged. This is a schema/entity-level rename only.
- **D-03:** No reserved number range. A floating table gets the next available number, exactly the same way the existing admin "Add Table" flow already computes it (`max(existing numbers) + 1`, see `PoolTablesSettingsTab.tsx`'s `handleAddTable`). User explicitly rejected a reserved high-range block (e.g. 900+) — "don't overthink it." — Reversibility: reversible. Consequence: the current Zod `PoolTableSchema.number` cap (`z.number().int().min(1).max(30)`) needs to be raised or removed since floating tables push past a small fixed venue count over time — planner/research to confirm the right new bound (or removal).
- **D-04:** Deactivation happens the moment the floating table's pool session stops (or its tab closes, for non-timed/consumption-style use) — a DB trigger fires immediately on that event and soft-deletes the `resources` row, following the same soft-delete pattern this codebase already uses (`20260420000001_soft_delete.sql`). Chosen over an idle-timeout/cron-based approach. — Reversibility: costly.
- **D-05:** `SeatPartySheet` (currently shows "no tables available" and disables seating when `availableTables.length === 0`) gets a new, distinct "Seat at a new temporary table" action in that same empty state. Staff must explicitly click it — no silent/implicit auto-create. — Reversibility: reversible.
- **D-06:** The auto-created floating table inherits the same default `ratePerHour` the admin "Add Table" flow already carries forward (last table's rate, or a fixed fallback) — no separate/reduced rate tier for floating tables.

### Claude's Discretion

- Visual marker to distinguish a floating table from a real one at a glance (e.g. a "Temp"/"Floating" badge on `PoolTableCard`/the table grid) — the existing `is_temp` flag is sufficient signal to key a badge/style off of; exact styling is planner's call.
- Exact new upper bound (or removal) for `PoolTableSchema.number`'s current `.max(30)` cap.
- Whether the entity-folder/type rename (D-01) is done in one wave or split into schema-first / call-sites-after waves — sequencing is a planning concern, not a product decision.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. (4 loose keyword-match todos surfaced by `cross_reference_todos` were reviewed and scored ≤0.4 — unrelated repo-hygiene/testing concerns, not floating-tables scope, not presented as fold candidates.)
</user_constraints>

## Summary

This phase has no new external library surface — it is a same-codebase schema generalization (`pool_tables` → `resources`) plus one new DB trigger and one new UI affordance. All research below is code-grounded: every migration, RLS policy, RPC, entity file, and UI component named in 26-CONTEXT.md's canonical refs was read directly, plus several the CONTEXT.md did not enumerate but that the rename must also touch (`pool_table_status` enum, `pool_table_transfers` table, `posTools.ts` AI-agent tool defs, `stop_pool_session`/`transfer_tab`/`transfer_pool_session` RPC bodies).

**Primary recommendation:** Do the SQL rename as one migration using `ALTER TABLE ... RENAME TO` (Postgres preserves data, FKs, indexes, RLS policies and realtime-publication membership automatically — cheap and safe), then in the **same migration** `CREATE OR REPLACE FUNCTION` for the 3 PL/pgSQL functions whose body text literally contains `pool_tables`/`pool_table` (`stop_pool_session`, `transfer_tab`, `transfer_pool_session`) — Postgres does **not** rewrite function source on table rename, so skipping this silently breaks pool billing/transfer at runtime. Add `is_temp BOOLEAN NOT NULL DEFAULT FALSE` and extend the existing `table_type` TEXT+CHECK constraint with `'floating'` in a second migration (or same one), following this codebase's documented "TEXT+CHECK over new enum" convention. The auto-deactivate trigger only needs to fire `AFTER UPDATE ON pool_sessions/resources_sessions WHEN (OLD.stopped_at IS NULL AND NEW.stopped_at IS NOT NULL)` — see Pitfall 1, this single trigger covers 100% of real closure paths in the current codebase, because `useCloseTab` already refuses to close a tab while a linked pool session is still running.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `resources` table rename, `is_temp`/`FLOATING` schema, RLS, realtime publication | Database / Storage | — | Pure Postgres DDL; publication membership and RLS policies follow the table across rename automatically |
| Auto-deactivate on session/tab close | Database / Storage | — | Must be a DB trigger per D-04 (event-driven, not client-polled) — client never sees the deactivation happen, it's already gone from the next SELECT |
| Floating-table auto-create action in waitlist sheet | Frontend Server / API (React feature) | Database (INSERT via RLS) | `SeatPartySheet` triggers a client-side INSERT reusing `handleAddTable`'s numbering/rate logic; manager+ role already has direct `pool_tables_insert_manager_admin` INSERT rights, so no new RPC is required |
| Entity rename (`entities/pool-table` → `entities/resource`) | Frontend Server (FSD entity layer) | — | Types/queries/store live in `entities/`; no browser-only concern here (Zustand persist store is client-local but not tier-relevant) |
| Visual "Temp" badge on table card | Browser / Client | — | Pure presentational; reuses existing `Badge` + `TABLE_TYPE_VARIANT` pattern already in `PoolTableCard.tsx` |

## Standard Stack

This phase adds **zero new packages**. All work reuses the existing stack: Postgres 15 (Supabase-managed), Zod v4 (`^4.3.6`), TanStack Query v5, Zustand v5, react-i18next 17, shadcn/ui `Badge`.

### Package Legitimacy Audit

Not applicable — no external packages are installed or upgraded by this phase. Audit skipped per the protocol's own scope (`## Package Legitimacy Audit` section required only "whenever this phase installs external packages").

## Architecture Patterns

### System Architecture Diagram

```
[Admin: PoolTablesSettingsTab "Add Table"]         [Manager+: SeatPartySheet "Seat at new temp table"]
              │  handleAddTable()                              │  (D-05 new action, empty-state only)
              │  number = max(existing)+1                      │  reuses same numbering/rate logic
              │  ratePerHour = carry-forward                   │
              ▼                                                 ▼
        useMutationAddResource()  ──────────► INSERT INTO resources (..., table_type default 'pool'/'floating', is_temp)
                                                     │  RLS: pool_tables_insert_manager_admin (manager/admin only)
                                                     ▼
                                          resources row visible in grid (is_deleted=FALSE)
                                                     │
                              staff starts a session (existing flow, unchanged)
                                                     ▼
                                    INSERT INTO pool_sessions (table_id, tab_id)
                                    UPDATE resources SET status='occupied', current_session_id=...
                                                     │
                              staff stops session (existing stop_pool_session RPC, SECURITY DEFINER)
                                                     ▼
                              UPDATE pool_sessions SET stopped_at=now(), billed_minutes=..., total_charge=...
                                                     │
                              ── AFTER UPDATE trigger (NEW) ──
                                  IF NEW.stopped_at IS NOT NULL
                                     AND resources.is_temp = TRUE for NEW.table_id
                                  THEN UPDATE resources
                                       SET is_deleted=TRUE, deleted_at=now()
                                       WHERE id = NEW.table_id;
                                                     ▼
                              resources SELECT RLS (`is_deleted = FALSE`) now hides the row
                              — floating table vanishes from the grid, pool_sessions FK (ON DELETE RESTRICT)
                              stays intact because the row was soft-, not hard-, deleted
```

### Recommended Migration Sequencing

Per D-01's discretion note ("whether the rename is one wave or split — planner's call"), the dependency-safest split is:

```
Migration N   : ALTER TABLE pool_tables RENAME TO resources;
                ALTER TABLE pool_table_transfers RENAME TO resource_transfers;  -- see Pitfall 4
                ALTER TABLE resources RENAME COLUMN ... (none needed — no pool_table-prefixed columns)
                ALTER INDEX/CONSTRAINT renames for idx_pool_tables_*, fk_pool_tables_*, number_positive, rate_positive
                ALTER TRIGGER update_pool_tables_updated_at ON resources RENAME TO update_resources_updated_at;
                (RLS policies: DROP + CREATE under new names bound to `resources`, since Postgres does not auto-rename policy names on table rename — the policy itself stays attached, but a stale "pool_tables_select_authenticated" *name* on a `resources` table is confusing; rename for clarity, functionally optional)
                CREATE OR REPLACE FUNCTION stop_pool_session(...)      -- body: FROM pool_tables → FROM resources
                CREATE OR REPLACE FUNCTION transfer_tab(...)           -- body: pool_tables/pool_table_transfers refs
                CREATE OR REPLACE FUNCTION transfer_pool_session(...)  -- same
Migration N+1 : ALTER TABLE resources ADD COLUMN is_temp BOOLEAN NOT NULL DEFAULT FALSE;
                ALTER TABLE resources DROP CONSTRAINT ... ADD CHECK (table_type IN ('pool','carom','consumption','floating'));
                CREATE FUNCTION deactivate_floating_resource() ... AFTER UPDATE ON pool_sessions (renamed or not, see Pitfall 5)
Migration N+2 : ALTER TABLE waitlist_entries — FK already points at the renamed table by OID, no DDL needed,
                but the column is still literally `table_id uuid REFERENCES resources(id)` post-rename automatically.
```

Splitting rename (N) from schema-additions (N+1) lets the rename migration be independently verifiable (`npm run typecheck` + a smoke query) before layering the new `is_temp`/trigger logic on top — matches this repo's existing convention of one concern per migration file (see `20260421000002_pool_tables_type_column.sql` being separate from `20260414000005_pool_tables.sql`).

### Pattern 1: TEXT + CHECK over enum for new schema values
**What:** This codebase's established convention (see `20260421000002_pool_tables_type_column.sql`'s own migration comment) is additive `TEXT NOT NULL DEFAULT ... CHECK (col IN (...))` columns for post-launch schema growth, not new Postgres `CREATE TYPE ... AS ENUM`.
**When to use:** Adding `'floating'` to `table_type`.
**Example:**
```sql
-- Source: supabase/migrations/20260421000002_pool_tables_type_column.sql (existing pattern in this repo)
ALTER TABLE resources DROP CONSTRAINT IF EXISTS pool_tables_table_type_check;
ALTER TABLE resources ADD CONSTRAINT resources_table_type_check
  CHECK (table_type IN ('pool', 'carom', 'consumption', 'floating'));
```
Note: the original `table_type` CHECK was declared inline (`ADD COLUMN ... CHECK (...)`), which Postgres auto-names (typically `pool_tables_table_type_check`); confirm the actual generated constraint name via `\d resources` (or `information_schema.check_constraints`) before writing the `DROP CONSTRAINT` — don't guess it blind in the migration.

### Pattern 2: Soft-delete via existing `is_deleted`/`deleted_at` columns — already present
**What:** `pool_tables` (soon `resources`) **already has** `deleted_at TIMESTAMPTZ` and `is_deleted BOOLEAN NOT NULL DEFAULT FALSE` from `20260420000001_soft_delete.sql`. D-04's trigger does not need to add these columns — they exist today, unused by any pool-table code path yet (verified: no `is_deleted` reference anywhere in `entities/pool-table/`).
**When to use:** The auto-deactivate trigger's `UPDATE`.
**Example:**
```sql
-- Source: existing pattern from 20260420000001_soft_delete.sql, applied to a new trigger
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
`SECURITY DEFINER` is recommended even though `stop_pool_session` (the only realistic caller) is already `SECURITY DEFINER` itself (so the trigger already runs in an elevated context transitively) — making the trigger function itself `SECURITY DEFINER` too is defense-in-depth matching this repo's convention for RPCs that must always succeed regardless of the invoking role's RLS visibility.

### Pattern 3: Client-side INSERT reuse for numbering/rate, no new RPC
**What:** D-03/D-06 explicitly reuse `handleAddTable`'s `Math.max(0, ...sortedTables.map(t => t.number)) + 1` and rate-carry-forward logic.
**When to use:** The new waitlist auto-create action.
**Example:**
```typescript
// Source: src/widgets/SettingsTabsPanel/tabs/PoolTablesSettingsTab.tsx (existing, verbatim logic to port)
const nextNumber = Math.max(0, ...sortedTables.map(table => table.number)) + 1;
const result = await addResource.mutateAsync({
  number: nextNumber,
  label: `Table ${String(nextNumber)}`, // or a distinct i18n floating-table label — planner's call, D-03 doesn't mandate label text
  ratePerHour: sortedTables[sortedTables.length - 1]?.ratePerHour ?? 12,
  tableType: 'floating',
  isTemp: true,
});
```
Because `manage_waitlist` is already gated `manager+` (see `src/shared/lib/rbac.ts`) and `pool_tables_insert_manager_admin` RLS is also `manager+`-only, the roles align exactly — no RLS change and no new SECURITY DEFINER RPC needed for the INSERT path itself.

### Anti-Patterns to Avoid
- **Hard-deleting floating resources instead of soft-delete:** `pool_sessions.table_id ... ON DELETE RESTRICT` means a hard `DELETE` on a `resources` row that any session ever referenced raises a FK violation. The existing manual "Remove" button (`useMutationDeletePoolTable`) hard-deletes today, but it's guarded by `.eq('status','available').is('current_session_id', null)` — i.e. it only ever fires on a table that has *never* had a session. A floating table, once used, will always have had a session, so its lifecycle-end must go through the soft-delete trigger, not the existing hard-delete mutation. These two deletion mechanisms will coexist post-phase; do not try to unify them.
- **Correlating tab-close to a resource via `tabs.table_number`:** see Pitfall 1 below — there is no FK for this; don't add a second trigger path keyed on `tabs.table_number = resources.number`, it's unnecessary (see Pitfall 1) and would be fragile (ordinary non-pool dining tabs share the same `table_number` integer space).
- **Renaming the `pool_tables` SettingsKey/settings-row string:** `'pool_tables'` also appears as a `SettingsKeySchema` enum value / `SETTINGS_KEYS` array entry (`src/shared/lib/domain.ts:833`, `src/entities/settings/model/queries.ts:117`, `src/shared/lib/supabase-contracts.ts` `SETTINGS_KEYS`) — this is an unrelated `settings` table row key (generic list of valid settings blob keys for backup/restore), not a reference to the DB table being renamed. It is a coincidental name collision. See Pitfall 2.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auto-deactivation of unused temp rows | A cron job / idle-timeout scanner | The existing soft-delete columns + a single `AFTER UPDATE` trigger on `pool_sessions.stopped_at` | D-04 already chose event-driven over cron; the columns already exist, so this is a ~15-line trigger, not new infrastructure |
| "Next available table number" | A new sequence/counter table | `Math.max(0, ...numbers) + 1` client-side (existing `handleAddTable` logic) | D-03 explicitly rejected any new numbering scheme; reuse verbatim |
| Distinguishing floating vs. real tables in UI | A new component | Existing `Badge` + `TABLE_TYPE_VARIANT: Record<PoolTableType, ...>` pattern in `PoolTableCard.tsx` (already renders a type badge for pool/carom/consumption) | Add a 4th `floating` entry to the existing lookup tables — zero new UI plumbing |

**Key insight:** Every piece of mechanism this phase needs (soft-delete columns, TEXT+CHECK type extension, next-number computation, badge component) already exists in the codebase from prior phases. This phase is almost entirely a rename + two small additive columns + one trigger + one new INSERT call site — not new architecture.

## Runtime State Inventory

> Required — D-01 is a full DB table + FK + RLS + realtime + entity-folder rename.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `pool_tables` rows (existing real tables + their `is_deleted`/`table_type`/`number` values) — preserved automatically by `ALTER TABLE ... RENAME TO`, no data migration needed. `pool_sessions.table_id`, `waitlist_entries.table_id`, `pool_table_transfers.from/to_pool_table_id` FKs reference the table by OID, not name — survive the rename with zero code/data change. | None beyond the DDL rename itself (no `UPDATE`/backfill needed) |
| Live service config | None found not already in git — Supabase RLS policies, triggers, and the `supabase_realtime` publication membership are all defined via checked-in migrations in this repo (unlike n8n/Datadog-style external UIs), and Postgres carries publication membership + RLS policy attachment across a table rename automatically (verified: no `ALTER PUBLICATION supabase_realtime ADD TABLE pool_tables` migration exists — `pool_tables` realtime already works today, meaning it's covered by a `FOR ALL TABLES`-style default publication, which needs zero touch on rename) | None |
| OS-registered state | None — no OS task scheduling, no pm2/systemd units reference `pool_tables` | None |
| Secrets/env vars | None — no env var or SOPS key named after `pool_tables`/`resources` | None |
| Build artifacts | `src/shared/lib/supabase.types.ts` (generated) still has the pre-rename `pool_tables`/`pool_sessions` shape until regenerated. `src/shared/lib/supabase-contracts.ts` has a **hand-maintained** `Database['public']['Tables']['pool_tables']` type block (line ~99) used as a documentation/typing shim — this is NOT auto-generated and must be manually edited to `resources` alongside the real regen. | `npx supabase gen types typescript --local > src/shared/lib/supabase.types.ts` after migrations apply (per CLAUDE.md's documented workaround/regen step); manually update the `supabase-contracts.ts` shim block in the same commit |

**Nothing found in category:** OS-registered state and Secrets/env vars — verified via grep, no matches.

## Common Pitfalls

### Pitfall 1: `useCloseTab` already blocks closing a tab with a running pool session — "tab closes" and "session stops" are not two independent trigger paths today
**What goes wrong:** D-04's phrasing ("the moment the floating table's pool session stops (**or** its tab closes, for non-timed/consumption-style use)") reads as two separate trigger conditions, prompting a planner to build two triggers (one on `pool_sessions`, one on `tabs`).
**Why it happens:** `src/features/close-tab/index.ts`'s `useCloseTab` explicitly queries for any `pool_sessions` row with `tab_id = X AND stopped_at IS NULL` and **returns `sessionStillRunningError`, refusing to close the tab**, before any tab-close UPDATE is attempted. In the current codebase, a tab linked to a pool table can never reach `status='closed'` while its session is still running — the session must already be stopped first. There is also no code path anywhere (grepped `table_type` usage) where `'consumption'`-type tables skip `pool_sessions` entirely; `usePoolTimer`/`stop_pool_session` are agnostic to `table_type` (billing math only reads `ratePerHour`/`firstHourMode`), so consumption tables go through the exact same session-start/stop flow as pool/carom tables today.
**How to avoid:** A single trigger on `pool_sessions` (`AFTER UPDATE ... WHEN stopped_at transitions NULL → NOT NULL`) is sufficient for every real closure path that exists in this codebase right now. Do not build a second trigger on `tabs`.
**Warning signs:** If the planner scopes tasks for "trigger on tabs.status" as well as "trigger on pool_sessions.stopped_at," that's scope the current architecture doesn't need — flag it in plan review.

### Pitfall 2: `'pool_tables'` is also a `settings`-table row key — do not rename it
**What goes wrong:** A naive "rename every occurrence of the string `pool_tables`" sweep would touch `SettingsKeySchema` (`src/shared/lib/domain.ts:828-837`), `SETTINGS_KEYS` (`src/entities/settings/model/queries.ts:112-121`, `src/shared/lib/supabase-contracts.ts`), corrupting an unrelated `settings` table row key.
**Why it happens:** This is a genuine, coincidental string collision — the `settings` table stores per-venue config blobs keyed by string (`'general'`, `'billing'`, `'pool_tables'`, `'receipt'`, ...), and `'pool_tables'` was chosen as one of those keys before this phase existed. No code currently reads/writes a `PoolTablesSettings`-shaped value under that key (grepped — no `parsePoolTables`/`PoolTablesSettings` schema exists), so it may be a reserved/dead key, but renaming it would still require a `settings` table data migration for any existing row with `key='pool_tables'` and is out of this phase's scope entirely — D-01 is about the DB **table** `pool_tables`, not this settings key.
**How to avoid:** When sweeping the ~18 call sites, treat any `'pool_tables'` literal inside a `SettingsKeySchema`/`SETTINGS_KEYS`/settings-row context as **not in scope** — leave it as-is.
**Warning signs:** A diff touching `src/entities/settings/model/queries.ts` line ~117 or `src/shared/lib/domain.ts` line ~833 in this phase should be double-checked against this pitfall before merging.

### Pitfall 3: PL/pgSQL function bodies are not rewritten by `ALTER TABLE ... RENAME` — 3 functions will silently break
**What goes wrong:** After `ALTER TABLE pool_tables RENAME TO resources`, any function whose body text says `FROM pool_tables` (not just its DDL declaration) keeps referencing a table name that no longer exists, and errors at next invocation (`relation "pool_tables" does not exist`).
**Why it happens:** Postgres stores PL/pgSQL function source as opaque text in `pg_proc.prosrc`; a table rename updates catalog dependencies for views/FKs/indexes (OID-based), but does **not** parse and rewrite function bodies (confirmed via official Postgres mailing-list/catalog documentation — this is a long-standing, well-known PL/pgSQL limitation, not project-specific).
**How to avoid:** In the same migration that renames the table, `CREATE OR REPLACE FUNCTION` for every function whose body references `pool_table`/`pool_tables`: confirmed by grep, these are `stop_pool_session` (`supabase/migrations/20260710000006_stop_pool_session_rpc.sql`, reads `rate_per_hour FROM pool_tables`), `transfer_tab` and `transfer_pool_session` (`supabase/migrations/20260420000003_transfers.sql`, `20260713000002_fix_transfer_pool_session_version_bump.sql` — writes to `pool_table_transfers` and updates `pool_tables.current_session_id`).
**Warning signs:** A `stop_pool_session` or `transfer_tab` call failing with `relation "pool_tables" does not exist` immediately after the rename migration lands is this exact bug.

### Pitfall 4: `pool_table_transfers` — an un-mentioned table with two FKs into `pool_tables`
**What goes wrong:** 26-CONTEXT.md's canonical-refs list of ~18 call sites and 5 migrations does not mention `pool_table_transfers` (`supabase/migrations/20260420000003_transfers.sql`), a table with `from_pool_table_id UUID NOT NULL REFERENCES pool_tables(id)` and `to_pool_table_id UUID NOT NULL REFERENCES pool_tables(id)`, RLS policies named `"Staff can read pool table transfers"`/`"Staff can insert pool table transfers"`, and a reference from `20260510000001_rls_rewrite_phase13.sql`.
**Why it happens:** It's a transfer-audit-log table used by `transfer_tab`/`transfer_pool_session`, not surfaced by a grep for the literal string `'pool_tables'` (only `pool_table_transfers` and `from_pool_table_id`/`to_pool_table_id` match, a different substring).
**How to avoid:** FK targets survive the table rename automatically (Postgres OID-based), so no DDL change is strictly required on `pool_table_transfers` itself — but for naming consistency under D-01's "full rename," consider `ALTER TABLE pool_table_transfers RENAME TO resource_transfers` and its columns to `from_resource_id`/`to_resource_id` in the same migration, updating `transfer_tab`/`transfer_pool_session`'s function bodies accordingly (already required to be recreated per Pitfall 3).
**Warning signs:** If the plan's file-touch list for D-01 doesn't include `20260420000003_transfers.sql` or `20260713000002_fix_transfer_pool_session_version_bump.sql`, this table was missed.

### Pitfall 5: `PoolTableSchema.number.max(30)` cap will silently reject floating-table creation once venue + floating count exceeds 30 — and floating-table numbers never get reused
**What goes wrong:** `src/shared/lib/domain.ts:569` — `number: z.number().int().min(1).max(30)` — is a client-side-only cap (the DB constraint is just `CHECK (number > 0)`, no upper bound). The RLS `SELECT` policy already filters `is_deleted = FALSE` (`pool_tables_select_authenticated ... USING (is_deleted = FALSE)`), so the client's `usePoolTables()` query never sees soft-deleted rows — meaning `Math.max(0, ...sortedTables.map(t => t.number)) + 1` only looks at *visible* (non-deleted) tables, but the underlying `number` column still has a table-wide `UNIQUE` constraint that **also counts soft-deleted rows**. Every floating table that gets created and later auto-deactivated permanently consumes a number that will never be reused — the sequence only grows.
**Why it happens:** Soft-delete + a plain (non-partial) `UNIQUE` constraint means "deleted" numbers stay reserved forever.
**How to avoid:** Remove the `.max(30)` cap entirely (matching the DB's real constraint of `number > 0`, no ceiling) rather than raising it to some other arbitrary number — any fixed cap will eventually be hit again given the number-burn behavior above, for the same reason D-03 rejected a reserved range: "don't overthink it." If future work wants numbers to be reusable, that would require replacing the plain `UNIQUE` column constraint with a partial unique index (`CREATE UNIQUE INDEX ... ON resources(number) WHERE is_deleted = FALSE`) — out of scope for this phase but worth a one-line Open Question note for the planner in case they want to preempt it.
**Warning signs:** In a busy venue running floating tables for weeks, `number` will climb into the hundreds — a Zod `.max()` regression here silently blocks all future floating-table creation with a validation error, not a DB error, making it easy to miss in testing with a fresh dev DB.

## Code Examples

### Renaming with RLS/index/trigger name updates in one migration
```sql
-- Source: this repo's own migration conventions (20260414000005_pool_tables.sql,
-- 20260414000008_triggers.sql, 20260510000001_rls_rewrite_phase13.sql) combined
ALTER TABLE pool_tables RENAME TO resources;

ALTER INDEX idx_pool_tables_number RENAME TO idx_resources_number;
ALTER INDEX idx_pool_tables_status RENAME TO idx_resources_status;
ALTER INDEX idx_pool_tables_current_session_id RENAME TO idx_resources_current_session_id;
ALTER TABLE resources RENAME CONSTRAINT number_positive TO resources_number_positive;
ALTER TABLE resources RENAME CONSTRAINT rate_positive TO resources_rate_positive;
ALTER TABLE resources RENAME CONSTRAINT fk_pool_tables_current_session TO fk_resources_current_session;

ALTER TRIGGER update_pool_tables_updated_at ON resources RENAME TO update_resources_updated_at;

-- RLS policies keep working under old names (they're attached by OID), but rename for clarity:
ALTER POLICY "pool_tables_select_authenticated" ON resources RENAME TO "resources_select_authenticated";
ALTER POLICY "pool_tables_update_bartender" ON resources RENAME TO "resources_update_bartender";
ALTER POLICY "pool_tables_insert_manager_admin" ON resources RENAME TO "resources_insert_manager_admin";
ALTER POLICY "pool_tables_update_manager_admin" ON resources RENAME TO "resources_update_manager_admin";
ALTER POLICY "pool_tables_delete_manager_admin" ON resources RENAME TO "resources_delete_manager_admin";
```

### `PoolTableCard.tsx` badge extension (Claude's Discretion item)
```typescript
// Source: src/entities/pool-table/ui/PoolTableCard.tsx (existing pattern, extend the lookup tables)
const TABLE_TYPE_LABEL_KEY: Record<ResourceType, string> = {
  pool: 'resourceCard.tableType.pool',
  carom: 'resourceCard.tableType.carom',
  consumption: 'resourceCard.tableType.consumption',
  floating: 'resourceCard.tableType.floating', // new
};

const TABLE_TYPE_VARIANT: Record<ResourceType, 'default' | 'secondary' | 'outline'> = {
  pool: 'default',
  carom: 'secondary',
  consumption: 'outline',
  floating: 'outline', // reuse or pick a distinct accent — planner/UI discretion
};
```
i18n keys land in `src/shared/lib/i18n/locales/{es-MX,en-US}/entities.json` under the existing `poolTableCard` block (line ~73) — or its renamed equivalent if the planner also renames the i18n key namespace (D-02 says user-facing copy stays, but the *key names* are implementation detail, not user-facing).

## State of the Art

Not applicable in the conventional sense (this isn't a fast-moving external ecosystem) — the one relevant "old → new" shift is internal to this project:

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `pool_tables` = fixed, admin-managed billiard tables only | `resources` = billiard tables (`pool`/`carom`/`consumption`) + ad-hoc `floating` tables, same table | This phase | Every consumer that assumed "all rows in this table are permanent, admin-created" now must tolerate rows that appear and soft-delete themselves without admin action |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Postgres does not rewrite PL/pgSQL function body text (`prosrc`) on `ALTER TABLE RENAME` | Pitfall 3 | Low — this is well-established, long-standing PostgreSQL behavior, cross-checked via web search of PostgreSQL catalog/mailing-list documentation, not solely training-data recall. If somehow wrong, the 3 flagged RPCs would still work post-rename and the `CREATE OR REPLACE FUNCTION` step would just be redundant (safe either way) |
| A2 | `supabase_realtime` publication already covers `pool_tables` via a default/`FOR ALL TABLES`-style setup (no explicit `ALTER PUBLICATION` migration exists for it) | Runtime State Inventory | Low-medium — if this project's publication is actually scoped per-table and `pool_tables` was added outside the migrations directory (e.g. via Studio UI, not committed), the rename could silently drop realtime for the renamed table. Verify with `SELECT * FROM pg_publication_tables WHERE tablename = 'pool_tables';` against the real DB before/after the rename migration, as a cheap sanity check |

## Open Questions

1. **Should the `pool_table_status` enum type and `pool_table_transfers` table/columns be renamed too, for full naming consistency?**
   - What we know: D-01 explicitly scopes "the DB table... the FK relationship from pool_sessions, RLS policies, realtime wiring, the entity folder... and all ~18 internal call sites" — it does not explicitly mention the `pool_table_status` Postgres enum type name or the `pool_table_transfers` table.
   - What's unclear: Whether leaving `pool_table_status` and `pool_table_transfers`/`from_pool_table_id`/`to_pool_table_id` un-renamed is acceptable residual naming debt, or whether "full rename" was meant to be exhaustive.
   - Recommendation: Rename both for consistency (low cost — `ALTER TYPE pool_table_status RENAME TO resource_status;` and `ALTER TABLE pool_table_transfers RENAME TO resource_transfers` + column renames, all OID-based and safe), since the alternative leaves the word "pool_table" scattered through the renamed system indefinitely. Flag this explicitly to the user/planner rather than silently deciding either way.

2. **Should the `number` UNIQUE constraint become a partial index (`WHERE is_deleted = FALSE`) so floating-table numbers can be reused?**
   - What we know: Pitfall 5 establishes that numbers currently never get reused after a floating table soft-deletes.
   - What's unclear: Whether unbounded number growth is actually a problem worth solving now, or acceptable given D-03's explicit "don't overthink it" numbering stance.
   - Recommendation: Out of scope for this phase — just remove the `.max(30)` Zod cap (Pitfall 5) and leave the UNIQUE constraint as-is. Only revisit if a future phase reports the sequence becoming operationally confusing (e.g., "Table 847").

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI | `npx supabase gen types typescript --local` type regen after migrations | ✓ | 2.109.1 | — |
| Postgres (via Supabase Cloud/local) | Migration apply target | Assumed reachable (not probed — this repo pushes to remote Supabase Cloud, not a local Postgres instance, per CLAUDE.md's `npx supabase gen types typescript` — no `--local` flag shown in that doc's own workaround note, cloud is the default target) | — | — |

No missing dependencies block this phase — it needs no new tooling beyond what every other schema-touching phase in this repo already uses.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4 (unit), Playwright 1.59 (E2E) |
| Config file | `bar-pos/vitest.config.ts` (unit), `bar-pos/playwright.config.ts` (E2E) |
| Quick run command | `npx vitest run src/entities/resource/model/queries.test.ts` (post-rename path; today's file is `src/entities/pool-table/model/queries.test.ts`) |
| Full suite command | `npm run test` (unit), `npm run test:e2e` (E2E, requires display + Chrome per CLAUDE.md) |

### Phase Requirement → Test Map

No `REQUIREMENTS.md` exists for this milestone (confirmed absent, consistent with all prior 21-xx..25-xx phases per STATE.md session log) — mapping is against the 4 ROADMAP.md Success Criteria instead:

| Success Criterion | Behavior | Test Type | Automated Command | File Exists? |
|--------------------|----------|-----------|--------------------|--------------|
| SC-1: `resources` generalization, no breakage to existing `pool_tables` consumers | All 18 renamed call sites still compile + existing pool-table E2E flows pass | unit + E2E | `npx vitest run src/entities/resource/`, `npx playwright test e2e/04-pool-timer.spec.ts` | ✅ (renamed from `queries.test.ts`) / existing E2E file already covers pool timer start/stop |
| SC-2: auto-deactivate trigger retires floating tables | A floating table's `is_deleted` flips to `TRUE` immediately after its session's `stopped_at` is set | integration (SQL) | New: `supabase/migrations/*_deactivate_floating_resource_trigger.sql` needs a companion pgTAP-style or manual-verification query — this repo has no existing SQL test harness (checked: no `supabase/tests/` directory) | ❌ Wave 0 gap — see below |
| SC-3: waitlist auto-create flow | Empty-state "Seat at a new temporary table" action creates a resource + seats the party | E2E | New: extend `e2e/*waitlist*.spec.ts` (no existing waitlist E2E spec found in the 26-spec list in CLAUDE.md — confirm before assuming coverage) | ❌ Wave 0 gap — verify no waitlist E2E spec currently exists |
| SC-4: existing pool-table timer/billing unaffected | `computePoolSessionBilling` output unchanged for `table_type` != `'floating'` | unit | `npx vitest run src/entities/pool-table/model/usePoolTimer.test.ts` (pre-existing, should pass unmodified) | ✅ already exists |

### Sampling Rate
- **Per task commit:** targeted `npx vitest run <touched file>.test.ts`
- **Per wave merge:** `npm run typecheck && npm run lint && npm run test`
- **Phase gate:** Full suite green + a manual `npx supabase db push` + regenerated `supabase.types.ts` diff review before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] No existing SQL-level test harness for verifying the new trigger's behavior against a real/local Postgres — recommend a manual verification script (start a floating-table session, stop it, assert `is_deleted=TRUE`) documented in the plan's own verification section, since this repo has no `supabase/tests/` directory to extend.
- [ ] Confirm whether any of the 26 listed E2E spec files (CLAUDE.md's "E2E Test Suite" list) currently exercises `/waitlist` seating — none of the 26 names obviously match (`e2e/` doesn't have a `waitlist` spec in the enumerated list); if truly absent, a new `e2e/49-floating-tables.spec.ts` (or similar next-available number) is needed to cover SC-3.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|-------------------|
| V4 Access Control | yes | Existing RLS policies (`manager`/`admin` INSERT, `bartender`+ UPDATE gated by `start_pool_timer` permission) carry over unchanged post-rename; the new auto-create INSERT path is already covered by the existing `manager+`-only `manage_waitlist` RBAC gate on the whole `/waitlist` page, matching the existing `pool_tables_insert_manager_admin` RLS requirement — no privilege mismatch |
| V5 Input Validation | yes | Zod `PoolTableSchema`/renamed `ResourceSchema` continues to validate `number`/`ratePerHour`/`tableType` at the client boundary; DB-level `CHECK` constraints (`number > 0`, `rate_per_hour > 0`, `table_type IN (...)`) are the authoritative boundary |
| V1 Architecture | yes | The soft-delete-not-hard-delete choice (D-04) is itself an architectural integrity control preventing `pool_sessions.table_id ... ON DELETE RESTRICT` violations and preserving historical/report data referencing a since-retired floating table |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Trigger function granted overly broad privileges via `SECURITY DEFINER` without `SET search_path` | Elevation of Privilege | Always pair `SECURITY DEFINER` with `SET search_path = public` (this repo's own established convention, e.g. `stop_pool_session`) to prevent search-path-hijacking attacks against the definer's elevated privileges |
| Bypassing RLS via a hand-maintained type shim (`supabase-contracts.ts`) drifting from the real generated types | Tampering (data integrity, not auth) | Regenerate `supabase.types.ts` immediately after the migration and diff the hand-maintained `supabase-contracts.ts` block against it in the same commit, not a follow-up |

## Sources

### Primary (HIGH confidence — direct repo reads)
- `supabase/migrations/20260414000005_pool_tables.sql` — original table/FK definitions
- `supabase/migrations/20260421000002_pool_tables_type_column.sql` — TEXT+CHECK convention, migration-comment rationale
- `supabase/migrations/20260420000001_soft_delete.sql` — existing `is_deleted`/`deleted_at` columns already on `pool_tables`
- `supabase/migrations/20260414000008_triggers.sql`, `20260414000009_rls_policies.sql`, `20260420000006_rls_updates.sql`, `20260510000001_rls_rewrite_phase13.sql`, `20260420000008_pool_tables_bartender_update.sql` — trigger + full RLS policy history
- `supabase/migrations/20260420000003_transfers.sql`, `20260713000002_fix_transfer_pool_session_version_bump.sql`, `20260710000006_stop_pool_session_rpc.sql` — the 3 RPC function bodies that literally reference `pool_tables`/`pool_table_transfers`
- `supabase/migrations/20260414000001_enums.sql` — `pool_table_status` enum definition
- `supabase/migrations/20260501000001_waitlist_entries.sql` — `waitlist_entries.table_id` FK to `pool_tables`
- `src/shared/lib/domain.ts` — `PoolTableSchema`, `PoolSessionSchema`, `SettingsKeySchema` (naming-collision source)
- `src/entities/pool-table/model/{queries.ts,store.ts,types.ts,usePoolTimer.ts}`, `src/entities/pool-table/ui/PoolTableCard.tsx`
- `src/widgets/SettingsTabsPanel/tabs/PoolTablesSettingsTab.tsx` — `handleAddTable` numbering/rate logic
- `src/features/seat-waitlist-party/ui/SeatPartySheet.tsx`, `src/features/seat-waitlist-party/model/useSeatWaitlistParty.ts` — current "seat" flow (only sets `waitlist_entries.table_id`/`status`, does not start a session)
- `src/features/close-tab/index.ts` — `useCloseTab`'s `sessionStillRunningError` guard (source of Pitfall 1's finding)
- `src/entities/settings/model/queries.ts`, `src/shared/lib/supabase-contracts.ts` — settings-key naming collision confirmation
- `src/shared/lib/rbac.ts` — `manage_waitlist` role gate
- `.planning/phases/26-floating-tables-is-temp/26-CONTEXT.md` — locked decisions D-01..D-06

### Secondary (MEDIUM confidence)
- Web search cross-check on PostgreSQL `ALTER TABLE RENAME` not rewriting `pg_proc.prosrc` function bodies (PostgreSQL mailing-list/catalog documentation) — general Postgres behavior, not project-specific, standard and stable across versions

### Tertiary (LOW confidence)
- None — every claim above traces to either a direct file read in this repo or a cross-checked Postgres behavior

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, entirely internal rename/extension of existing patterns
- Architecture: HIGH — every pattern cited is copy-pasted or lightly adapted from code already in this repo
- Pitfalls: HIGH for Pitfalls 1-4 (all directly verified against source); MEDIUM-HIGH for Pitfall 5's `.max(30)` recommendation (the removal recommendation is a judgment call, not a hard requirement)

**Research date:** 2026-07-28
**Valid until:** No external-library staleness risk; this research is invalidated only by a subsequent phase touching the same `pool_tables`/`resources`/`waitlist_entries` surface before Phase 26 lands
