# Phase 26: Floating Tables (`is_temp`) - Context

**Gathered:** 2026-07-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Generalize the existing `pool_tables` schema/entity into a broader `resources` concept that supports a `FLOATING` table type (`is_temp` flag) for temporary/ad-hoc tables — auto-created mainly from the waitlist when no fixed table is free, billed like a normal table while in use, and auto-retired once its session/tab closes. Existing pool-table timer/billing behavior for real (non-floating) tables must be unaffected.

</domain>

<decisions>
## Implementation Decisions

### Schema generalization scope
- **D-01:** Full rename: the DB table (`pool_tables` → `resources`), the FK relationship from `pool_sessions`, RLS policies, realtime wiring, the entity folder (`entities/pool-table` → `entities/resource`), and all ~18 internal call sites that reference `'pool_tables'` literally are renamed to the `resources`/`resource` concept. User explicitly chose the full rename over the smaller additive-column option (which would have kept the `pool_tables` name and just added `is_temp` + a `'floating'` value to the existing `table_type` CHECK constraint). — **Reversibility:** one-way — once the table/FK/RLS/realtime/entity-folder rename lands and ~18 call sites depend on the new name, reverting means a second full rename pass across the same surface area.
- **D-02:** User-facing surface does NOT rename. Routes stay `/pool-tables`, nav label stays "Pool Tables", page titles/i18n copy unchanged. This is a schema/entity-level rename only — billiard tables remain the dominant, most-visible use case; `FLOATING`/`is_temp` are just new values surfaced within the existing screen, not a rebranded product surface.

### Numbering for floating tables
- **D-03:** No reserved number range. A floating table gets the next available number, exactly the same way the existing admin "Add Table" flow already computes it (`max(existing numbers) + 1`, see `PoolTablesSettingsTab.tsx`'s `handleAddTable`). User explicitly rejected a reserved high-range block (e.g. 900+) as unnecessary complexity — "don't overthink it." — **Reversibility:** reversible — pure numbering logic, no schema impact.
- Consequence: the current Zod `PoolTableSchema.number` cap (`z.number().int().min(1).max(30)`, assumed fixed ~30-table venue capacity) needs to be raised or removed since floating tables push past a small fixed venue count over time — planner/research to confirm the right new bound (or removal) against the renamed schema.
- Telling a floating table apart from a real one visually is a separate concern from numbering — see Claude's Discretion below.

### Auto-deactivate trigger
- **D-04:** Deactivation happens the moment the floating table's pool session stops (or its tab closes, for non-timed/consumption-style use) — a DB trigger fires immediately on that event and soft-deletes the `resources` row, following the same soft-delete pattern this codebase already uses elsewhere (`20260420000001_soft_delete.sql`). Chosen over an idle-timeout/cron-based approach — user picked the simpler event-driven trigger. — **Reversibility:** costly — undoing requires dropping the trigger and reconciling any floating-table rows already soft-deleted by it; soft-delete (not hard-delete) was specifically chosen so `pool_sessions.table_id ... ON DELETE RESTRICT` is never violated and historical session/report data referencing a since-retired floating table stays intact.

### Waitlist auto-create flow
- **D-05:** `SeatPartySheet` (currently shows "no tables available" and disables seating when `availableTables.length === 0`) gets a new, distinct "Seat at a new temporary table" action in that same empty state. Staff must explicitly click it — no silent/implicit auto-create the moment they attempt to seat with nothing free. — **Reversibility:** reversible — additive UI action, no contract change.
- **D-06:** The auto-created floating table inherits the same default `ratePerHour` the admin "Add Table" flow already carries forward (last table's rate, or a fixed fallback) — no separate/reduced rate tier for floating tables.

### Claude's Discretion
- Visual marker to distinguish a floating table from a real one at a glance (e.g. a "Temp"/"Floating" badge on `PoolTableCard`/the table grid) — user didn't want to decide the numbering-range approach to this, so treat it as a UI detail: the existing `is_temp` flag is sufficient signal to key a badge/style off of; exact styling is planner's call.
- Exact new upper bound (or removal) for `PoolTableSchema.number`'s current `.max(30)` cap, now that floating tables push past a small fixed venue count over time (see D-03 consequence).
- Whether the entity-folder/type rename (D-01) is done in one wave or split into schema-first / call-sites-after waves — sequencing is a planning concern, not a product decision.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap
- `.planning/ROADMAP.md` §"Phase 26: Floating Tables (`is_temp`)" — goal and success criteria (no dependencies)
- No REQUIREMENTS.md file exists in `.planning/` for this milestone; ROADMAP notes the original source doc (`POS-COMPARISON.md §26`) is no longer present — scope is fully captured in this CONTEXT.md instead.

### Existing pool-table schema/code (must extend/rename, not duplicate)
- `supabase/migrations/20260414000005_pool_tables.sql` — the original `pool_tables`/`pool_sessions` table definitions (`number INT NOT NULL UNIQUE`, FK `pool_sessions.table_id ... ON DELETE RESTRICT`, `current_session_id` FK) that D-01's rename and D-04's soft-delete-not-hard-delete decision both depend on.
- `supabase/migrations/20260421000002_pool_tables_type_column.sql` — the prior `table_type` TEXT+CHECK column addition; its own migration comment documents the project's established convention (additive TEXT+CHECK over new enum/table) — read this before deciding how `FLOATING`/`is_temp` are added post-rename.
- `supabase/migrations/20260420000001_soft_delete.sql` — the existing soft-delete pattern D-04's auto-deactivate trigger should follow.
- `src/shared/lib/domain.ts` — `PoolTableSchema` (`number` cap, `tableType` enum, `status` enum), `PoolSessionSchema`/`PoolSessionBaseSchema` — all need `resources`/`FLOATING`/`is_temp` additions.
- `src/entities/pool-table/` (types.ts, queries.ts, store.ts, ui/PoolTableCard.tsx) — the entity folder D-01 renames to `entities/resource/`.
- `src/widgets/SettingsTabsPanel/tabs/PoolTablesSettingsTab.tsx` — `handleAddTable`'s next-number/rate-carry-forward logic that D-03/D-06 explicitly reuse for floating-table creation.
- `src/features/seat-waitlist-party/ui/SeatPartySheet.tsx` + `src/features/seat-waitlist-party/model/useSeatWaitlistParty.ts` — today's "no tables available" empty state and seat mutation; D-05's new action lands here.
- The ~18 files referencing `'pool_tables'` literally (grep-confirmed): `src/app/PoolRealtimeListener.tsx`, `src/entities/pool-table/model/store.ts`, `src/entities/pool-table/model/queries.ts`, `src/app/WaitlistRealtimeListener.tsx`, `src/entities/pool-table/model/queries.test.ts`, `src/entities/promotion/model/pool-promotions-rpc.integration.test.ts`, `src/entities/settings/model/queries.ts`, `src/features/stop-and-move-table/useStopAndMoveSession.ts`, `src/features/close-tab/tests/useCloseTab.test.ts`, `src/shared/lib/agent/tools/guardTools.ts`, `src/features/seat-waitlist-party/ui/SeatPartySheet.tsx`, `src/shared/lib/supabase-realtime.ts`, `src/shared/lib/domain.ts`, `src/shared/lib/supabase-contracts.ts`, `src/shared/lib/agent/tools/posTools.ts`, `src/shared/lib/supabase.ts`, `src/widgets/WaitlistQueue/ui/WaitlistQueue.tsx`, `src/widgets/PoolTableOccupancyPanel/ui/PoolTableOccupancyPanel.tsx` — D-01's rename must sweep all of these.

### RLS / triggers referencing pool_tables
- `supabase/migrations/20260414000008_triggers.sql` — `update_pool_tables_updated_at` trigger (needs renaming alongside the table).
- `supabase/migrations/20260414000009_rls_policies.sql`, `20260420000006_rls_updates.sql`, `20260510000001_rls_rewrite_phase13.sql`, `20260420000008_pool_tables_bartender_update.sql` — all define RLS policies against `pool_tables` that need to move to `resources`.

No other external specs/ADRs — scope is fully captured in this CONTEXT.md.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PoolTablesSettingsTab.tsx`'s `handleAddTable` next-number/rate-carry-forward logic — directly reusable for the floating-table auto-create path (D-03, D-06), just triggered from a different entry point (waitlist seating instead of Settings).
- Existing soft-delete pattern (`20260420000001_soft_delete.sql`) — D-04's trigger should follow this rather than inventing a new deletion mechanism.

### Established Patterns
- Post-launch schema additions in this codebase favor TEXT + CHECK constraints over new Postgres enums (documented explicitly in the `table_type` migration's own comment) — apply this same convention for however `FLOATING`/`is_temp` land on the renamed `resources` table.
- `pool_tables.number` is `NOT NULL UNIQUE` at the DB level with no numeric ceiling; the ~30 cap is purely a client-side Zod assumption (`PoolTableSchema.number.max(30)`) that predates floating tables and needs revisiting (see Claude's Discretion).
- FK `pool_sessions.table_id ... ON DELETE RESTRICT` is why D-04 chose soft-delete over hard-delete for retiring floating tables — hard-deleting a row any session ever referenced would violate this constraint.

### Integration Points
- `src/entities/pool-table/` → `src/entities/resource/` (D-01)
- `src/features/seat-waitlist-party/` (D-05, D-06 — new action + rate inheritance)
- `src/widgets/SettingsTabsPanel/tabs/PoolTablesSettingsTab.tsx` (numbering/rate convention reused, D-03/D-06)
- Supabase migrations: rename + `FLOATING`/`is_temp` schema additions + new auto-deactivate trigger (D-01, D-04)

</code_context>

<specifics>
## Specific Ideas

None beyond the decisions above — user corrected an over-engineered numbering proposal (rejected a reserved 900+ range) in favor of reusing the exact existing "next number" convention; no other specific styling/reference examples given.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

### Reviewed Todos (not folded)
- 4 loose keyword-match todos surfaced by `cross_reference_todos` (tsc CI errors, misplaced GitHub workflows dir, print-popup Playwright hang, Caja Report PDF export outside Tauri) — all scored ≤0.4 and are unrelated repo-hygiene/testing concerns, not floating-tables scope. Not presented to the user as fold candidates given the clear irrelevance; noted here for completeness.

</deferred>

---

*Phase: 26-floating-tables-is-temp*
*Context gathered: 2026-07-28*
