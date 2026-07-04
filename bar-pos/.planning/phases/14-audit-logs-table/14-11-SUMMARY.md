---
phase: 14-audit-logs-table
plan: 11
subsystem: ui
tags: [react, tanstack-query, tanstack-table, radix-ui, zod, security]

requires:
  - phase: 14-02
    provides: "entities/audit-log useAuditLogs infinite query + AuditLog/AuditLogFilters Zod schemas"
provides:
  - "sanitizeSearch() closing the PostgREST .or() filter-injection gap in useAuditLogs' free-text search"
  - "widgets/AuditLogTable/ composite (FilterBar + DataTable + DetailSheet) for the /audit page"
affects: [14-10, 14-12, 14-14]

tech-stack:
  added: []
  patterns:
    - "sr-only <button> inside a plain-text table cell to satisfy both a role=cell substring-name query and a role=button accessible-name query without breaking table semantics (DataTable has no getRowAriaLabel hook)"
    - "staged-then-applied filter state: FilterBar owns no state itself, parent widget holds `staged` (draft) + `appliedFilters` (committed on Apply) so useAuditLogs only refetches on explicit Apply"

key-files:
  created:
    - src/entities/audit-log/model/queries.test.ts
    - src/widgets/AuditLogTable/AuditLogFilterBar.tsx
    - src/widgets/AuditLogTable/AuditLogDetailSheet.tsx
    - src/widgets/AuditLogTable/AuditLogTable.tsx
    - src/widgets/AuditLogTable/AuditLogTable.test.tsx
    - src/widgets/AuditLogTable/index.ts
  modified:
    - src/entities/audit-log/model/queries.ts
    - src/entities/audit-log/model/index.ts
    - src/entities/audit-log/index.ts

key-decisions:
  - "Entity-type filter list follows 14-UI-SPEC.md section B literally (payment, tab, caja_session, order, combo, inventory, prep_production, permission, staff, settings) — the PLAN.md Task 2 action text said 'ingredient' instead of 'inventory', which does not match any AuditActionSchema prefix (inventory.deplete/manual_adjust/physical_count); treated as a plan typo and followed the UI-SPEC (the explicitly cited source of truth) instead."
  - "AuditLogDetailSheet takes actorName as a prop (resolved by AuditLogTable, which already builds a staffId->name map for the Actor table column) rather than re-querying staff inside the Sheet."
  - "RTL test for the action-cell/diff-button DOM contract matches the cell's accessible name with a leading-anchor RegExp (/^payment\\.process/) rather than an exact string: dom-accessibility-api's 'name from content' computation for a <td> concatenates the sr-only button's aria-label text after the visible action text, so the jsdom-computed name is literally 'payment.process View diff...'. This mirrors production behavior — e2e/38-audit-logs.spec.ts's Playwright getByRole('cell', {name: 'payment.process'}) query is substring-matched by default, so the extra trailing text does not break the locked E2E contract in a real browser either."

patterns-established:
  - "omit(obj, key) via Object.fromEntries/filter (not delete, which trips @typescript-eslint/no-dynamic-delete; not destructuring-with-unused-rename, which trips no-unused-vars) for building AuditLogFilters updates under exactOptionalPropertyTypes."

requirements-completed: [SC6, SC7, SC9]

duration: ~20min
completed: 2026-07-04
---

# Phase 14 Plan 11: AuditLogTable widget + search-filter injection fix Summary

**Fixed a real PostgREST .or() filter-injection gap in the audit-log search, then built the widgets/AuditLogTable/ composite (5-filter bar, infinite-scroll DataTable with an accessible per-row diff button, and a read-only JsonDiffViewer Sheet) that will back the /audit page**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-04T14:12:00Z
- **Completed:** 2026-07-04T14:27:00Z
- **Tasks:** 3/3 complete
- **Files modified:** 9 (6 created, 3 modified)

## Accomplishments

- **Task 1 (tdd)** — Added `sanitizeSearch(raw: string): string` to `entities/audit-log/model/queries.ts`, stripping `,` `.` `(` `)` (PostgREST `.or()` filter-string metacharacters and grouping characters) before the search term is interpolated into the `entity_id::text.ilike.%...%,action.ilike.%...%` expression. Exported through the `entities/audit-log` barrel. Added `queries.test.ts` with 3 example-based tests plus a `fast-check` property test asserting no input can produce a cleaned string containing any of `, . ( )`.
- **Task 2** — `AuditLogFilterBar.tsx`: 5 staged filter controls (Action `<Select>` from `AuditActionSchema.options` with locked `id="audit-filter-action"`; Entity type `<Select>` from a hardcoded 10-value list; Actor `<Select>` from `useStaffList()`; two native date inputs with locked ids `audit-filter-date-from`/`audit-filter-date-to`; a search `<Input>` with the "Some characters aren't searchable..." note) + an "Apply filters" button that commits the staged draft to the parent. `AuditLogDetailSheet.tsx`: copies the `RefundSheet` Sheet shell exactly, renders `JsonDiffViewer` with `_truncated` extracted from `before`/`after`, no footer (read-only).
- **Task 3 (tdd)** — `AuditLogTable.tsx`: composes the filter bar (as `DataTable`'s `toolbar`), a 5-column `DataTable` (Action/Entity type/Actor/Timestamp/Source badge), a "Load more entries" button driving `fetchNextPage()` (disabled + spinner while `isFetchingNextPage`), and the detail Sheet. The Action column cell renders the raw action string as plain content plus an `sr-only <button aria-label="View diff for {action} on {date}">` in the same cell — satisfying both the `role=cell` and `role=button` DOM-contract queries in `e2e/38-audit-logs.spec.ts` without touching `DataTable`'s row semantics. Empty states branch on `hasAnyFilter(appliedFilters)`: "No matches" when filtered-and-empty, "No audit activity yet" when never-populated, and a connection-error copy on `status === 'error'`. `index.ts` barrel uses an explicit named export.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Escape PostgREST `.or()` metacharacters in useAuditLogs search filter | `97a2637` | `src/entities/audit-log/{index.ts, model/index.ts, model/queries.ts, model/queries.test.ts}` |
| 2 | AuditLogFilterBar + AuditLogDetailSheet | `a30d3bf` | `src/widgets/AuditLogTable/{AuditLogFilterBar.tsx, AuditLogDetailSheet.tsx}` |
| 3 | AuditLogTable widget + barrel + RTL test | `90e756e` | `src/widgets/AuditLogTable/{AuditLogTable.tsx, index.ts, AuditLogTable.test.tsx}` |

**Plan metadata:** (this SUMMARY commit)

## Verification

- `npx vitest run src/entities/audit-log/model/queries.test.ts src/widgets/AuditLogTable/AuditLogTable.test.tsx --reporter=verbose` — 6/6 tests pass.
- `npm run typecheck` — exit 0, clean.
- `npx eslint src/entities/audit-log/ src/widgets/AuditLogTable/` — clean (0 errors).
- `npm run lint` (full project) — 5 pre-existing errors in files untouched by this plan (`src/app/App.tsx`, `src/entities/tab/model/queries.concurrent.test.ts`, `src/shared/ui/ErrorBoundary.tsx`); logged to `.planning/phases/14-audit-logs-table/deferred-items.md` per the scope-boundary rule, not fixed here.

## Files Created/Modified

- `src/entities/audit-log/model/queries.ts` — added + applied `sanitizeSearch()`
- `src/entities/audit-log/model/queries.test.ts` — new: unit + property tests for `sanitizeSearch`
- `src/entities/audit-log/model/index.ts`, `src/entities/audit-log/index.ts` — export `sanitizeSearch`
- `src/widgets/AuditLogTable/AuditLogFilterBar.tsx` — new: 5-filter staged bar
- `src/widgets/AuditLogTable/AuditLogDetailSheet.tsx` — new: read-only diff Sheet
- `src/widgets/AuditLogTable/AuditLogTable.tsx` — new: composite widget
- `src/widgets/AuditLogTable/AuditLogTable.test.tsx` — new: RTL DOM-contract test
- `src/widgets/AuditLogTable/index.ts` — new: barrel (explicit named export)

## Decisions Made

- Followed 14-UI-SPEC.md's entity-type list (`inventory`, not the PLAN.md Task 2 text's `ingredient`) since the UI-SPEC is the cited source of truth and `inventory` matches the actual `AuditActionSchema` prefixes (`inventory.deplete`/`inventory.manual_adjust`/`inventory.physical_count`); no action uses an `ingredient.*` prefix.
- `AuditLogDetailSheet` receives a resolved `actorName: string | null` prop instead of querying staff itself, reusing the staff-name map `AuditLogTable` already builds for its Actor column.
- Used a leading-anchor RegExp matcher (`/^payment\.process/`) in the RTL test for the action cell's accessible name rather than an exact string, since dom-accessibility-api concatenates the sr-only button's aria-label into the `<td>`'s computed "name from content" — this mirrors how Playwright's own substring-based `getByRole('cell', {name: ...})` matching behaves against a real browser's accessibility tree, so it does not weaken the E2E DOM contract.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `omit()` helper avoids `no-dynamic-delete`/`no-unused-vars` lint traps**
- **Found during:** Task 2 (`AuditLogFilterBar.tsx`)
- **Issue:** The natural implementation for "clear one optional filter key" is either `delete obj[key]` (fails `@typescript-eslint/no-dynamic-delete`) or `const { key: _key, ...rest } = obj` (fails `@typescript-eslint/no-unused-vars` since this repo's config has no `ignoreRestSiblings`).
- **Fix:** Implemented `omit<T, K>(obj, key)` via `Object.entries(obj).filter(...)` + `Object.fromEntries(...)`, which avoids both lint rules while preserving `exactOptionalPropertyTypes`-safe semantics (the key is genuinely absent, not set to `undefined`).
- **Files modified:** `src/widgets/AuditLogTable/AuditLogFilterBar.tsx`
- **Verification:** `npm run typecheck` + `npx eslint` clean.
- **Committed in:** `a30d3bf` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1, lint-driven implementation detail)
**Impact on plan:** No scope creep — implementation detail required to satisfy the repo's existing lint config while matching the plan's described behavior exactly.

## Issues Encountered

- The worktree had no `node_modules` (fresh checkout) and no `.env.local` (gitignored). Ran `npm install` (~44s) and copied `.env.local` from the main repo checkout so `vitest`'s global setup (which connects to the live Supabase project) could run. Neither is a plan deliverable.
- `.planning/` is gitignored except a few previously force-added files (`14-01-SUMMARY.md`, `14-02-SUMMARY.md`). This SUMMARY.md is force-added per the parallel-execution instructions.
- Full-project `npm run lint` surfaced 5 pre-existing errors in files this plan never touches (`src/app/App.tsx`, `src/entities/tab/model/queries.concurrent.test.ts`, `src/shared/ui/ErrorBoundary.tsx`) — logged to `deferred-items.md`, not fixed (scope boundary).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 14-10 (AuditRoute guard + HomeDashboard tile gating fix + `view_audit_log` RBAC action) can now render `<AuditLogTable />` inside the `/audit` page once its own plan wires the route/page shell.
- 14-12/14-13 (Force PIN Change trigger + forced-PIN-change screen) are independent of this plan's artifacts.
- 14-14's final gate should confirm `e2e/38-audit-logs.spec.ts` passes end-to-end once `/audit` is wired to `<AuditLogTable />` by 14-10's page container — this plan only builds the widget, not the page/route composition.
- The `sanitizeSearch` fix closes the last open Security Domain V5 finding from RESEARCH.md; no further action needed there.

## Self-Check: PASSED

- FOUND: `src/entities/audit-log/model/queries.test.ts`
- FOUND: `src/widgets/AuditLogTable/AuditLogFilterBar.tsx`
- FOUND: `src/widgets/AuditLogTable/AuditLogDetailSheet.tsx`
- FOUND: `src/widgets/AuditLogTable/AuditLogTable.tsx`
- FOUND: `src/widgets/AuditLogTable/AuditLogTable.test.tsx`
- FOUND: `src/widgets/AuditLogTable/index.ts`
- FOUND commit `97a2637` (Task 1)
- FOUND commit `a30d3bf` (Task 2)
- FOUND commit `90e756e` (Task 3)

---
*Phase: 14-audit-logs-table*
*Completed: 2026-07-04*
