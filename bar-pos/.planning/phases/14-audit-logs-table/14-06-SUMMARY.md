---
phase: 14-audit-logs-table
plan: 06
subsystem: frontend
tags: [rbac, audit, tanstack-query, vitest, client-side-audit]

requires: ["14-02"]
provides:
  - "Client-side record_audit('permission.toggle', source:'client') call in useMutationTogglePermission (both INSERT/enable and DELETE/disable branches)"
  - "Client-side record_audit('staff.role_change', source:'client') call in useMutationUpdateStaffRole"
affects: [14-14]

tech-stack:
  added: []
  patterns:
    - "Pattern 3 (client-side, non-atomic) record_audit call — fire-and-forget await immediately before the mutation's success return, failure only logger.warn's, never flips the returned Result"

key-files:
  created: []
  modified:
    - src/features/toggle-permission/useMutationTogglePermission.ts
    - src/features/toggle-permission/useMutationTogglePermission.test.ts
    - src/entities/staff/model/queries.ts

key-decisions:
  - "Per RESEARCH.md Open Question 3, chose Pattern 3 (client-side, non-atomic record_audit RPC call) over authoring a new wrapper RPC for both permission toggles and staff role changes — low-frequency, manager+-only actions where the shipped OfflineQueueProcessor already establishes this exact pattern as acceptable"
  - "useMutationUpdateStaffRole's audit call casts args 'as never' (matching OfflineQueueProcessor's existing record_audit call) rather than adding a new supabase-as-any local var, because supabase.types.ts record_audit Args have not yet been regenerated with p_terminal_id/p_user_id (known 14-02 gap, to be resolved when Docker/CLI type regen is available)"
  - "useMutationTogglePermission reuses the file's existing 'const db = supabase as any' cast for its record_audit call (per plan instruction) since that cast already exists in the file for the role_permissions table"

patterns-established:
  - "Both RBAC audit-wiring hooks place the fire-and-forget record_audit call immediately before their existing success return, after all prior error-return branches — establishes the exact insertion point for any future Pattern-3 client-side audit wiring"

requirements-completed: [SC3]

duration: ~35min
completed: 2026-07-04
---

# Phase 14 Plan 06: RBAC client-side audit wiring (permission.toggle + staff.role_change) Summary

**useMutationTogglePermission and useMutationUpdateStaffRole both issue fire-and-forget client-side record_audit calls (source:'client') after their mutation succeeds; audit failure never fails the primary mutation; 3 new unit tests assert the wiring**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-04T14:07:00Z
- **Completed:** 2026-07-04T14:18:00Z
- **Tasks:** 3/3 complete
- **Files modified:** 3 (0 created, 3 modified)

## Accomplishments

- **Task 1 (tdd)** — `useMutationTogglePermission.ts`: added module-level `TERMINAL_ID` constant; after both the enable (INSERT) success branch and the disable (DELETE) success branch, added a fire-and-forget `db.rpc('record_audit', { p_action: 'permission.toggle', p_entity_type: 'permission', p_entity_id: null, p_before/p_after: { role, action } (swapped per direction), p_source: 'client', p_terminal_id: TERMINAL_ID, p_user_id: null })` call; `auditRes?.error` logs `logger.warn('permission.toggle.audit_failed', ...)` without altering the returned `ok(null)`. Discovered the existing test file's `supabase` mock had no `.rpc` method, which broke the two pre-existing enable/disable tests once the audit call was wired in — fixed (Rule 3, blocking issue) by extending the shared mock: `supabase: { from: vi.fn(), rpc: vi.fn().mockResolvedValue({ data: 'uuid', error: null }) }`.
- **Task 2 (tdd)** — `src/entities/staff/model/queries.ts`: added module-level `TERMINAL_ID` constant near the top of the file; in `useMutationUpdateStaffRole`, after the successful `mapStaffRow` map and before `return m`, added a fire-and-forget `supabase.rpc('record_audit', { p_action: 'staff.role_change', p_entity_type: 'staff', p_entity_id: staffId, p_before: null, p_after: { role }, p_source: 'client', p_terminal_id: TERMINAL_ID, p_user_id: null } as never)` call (the `as never` cast matches `OfflineQueueProcessor.tsx`'s existing `record_audit` call, since `supabase.types.ts`'s generated `record_audit` Args do not yet include `p_terminal_id`/`p_user_id` — same gap documented in 14-02-SUMMARY.md). `auditRes.error` (non-optional-chained, per `@typescript-eslint/no-unnecessary-condition`) logs `logger.warn('staff.role_change.audit_failed', ...)` without altering the returned mapped `Result`.
- **Task 3** — `useMutationTogglePermission.test.ts`: added `mockedRpc = vi.mocked(supabase).rpc` (matching the codebase's established `@typescript-eslint/unbound-method`-safe mock-access pattern used in `queries.staff-report.test.ts` etc.) and 3 new tests: (a) a successful enable calls `record_audit` with `p_action: 'permission.toggle'` + `p_source: 'client'`; (b) a successful disable calls the same; (c) when the mocked audit rpc resolves with an `error`, the mutation still resolves `ok(null)` (non-fatal audit failure).

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Record 'permission.toggle' after a successful role_permission toggle | `4bb6586` | `src/features/toggle-permission/useMutationTogglePermission.ts`, `src/features/toggle-permission/useMutationTogglePermission.test.ts` |
| 2 | Record 'staff.role_change' after a successful profiles.role update | `4aaebc0` | `src/entities/staff/model/queries.ts` |
| 3 | Unit test — both hooks call record_audit with the correct action after success | `3fb565e` | `src/features/toggle-permission/useMutationTogglePermission.test.ts` |

**Plan metadata:** (this SUMMARY commit)

## Verification

- `npx vitest run src/features/toggle-permission --reporter=verbose` — 6/6 pass (3 pre-existing + 3 new audit assertions).
- `npx vitest run src/entities/staff --reporter=verbose` — 18/18 pass (2 test files: `queries.clock.test.ts`, `queries.staff-report.test.ts`); no dedicated `useMutationUpdateStaffRole` unit test exists in the codebase, so Task 2's own verify (existing staff suite + typecheck) is the acceptance gate, per the plan's explicit note in Task 3.
- `npm run typecheck` — exit 0 (ran after every task).
- `npx eslint <modified files>` — clean (one `@typescript-eslint/no-unnecessary-condition` fix and one `@typescript-eslint/unbound-method` fix applied during implementation, both resolved before commit).
- Full repo `npx vitest run` — 1140 passed / 7 failed / 15 todo. All 7 failures are pre-existing and out of scope: 6 are the documented 14-02 RPC-coverage scaffold RED cases (`transfer_tab`, `record_stock_movement`, `caja_open`, `close_tab`, `produce_prep_batch`, `force_pin_change` — not yet wired by Wave-2/Wave-3 plans) and 1 is the `useCloseTab.test.ts:95` failure documented as pre-existing/unrelated since Phase 15. No new failures introduced by this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Extended toggle-permission test's supabase mock to include `.rpc`**
- **Found during:** Task 1
- **Issue:** The existing `useMutationTogglePermission.test.ts` mocked `supabase` as `{ from: vi.fn() }` only. Once Task 1 wired a fire-and-forget `db.rpc('record_audit', ...)` call into both success branches, the two pre-existing enable/disable tests began failing with `TypeError: db.rpc is not a function` (the mutation's audit call threw before its own success test assertions could complete).
- **Fix:** Extended the shared `vi.mock('@shared/lib/supabase', ...)` factory to `supabase: { from: vi.fn(), rpc: vi.fn().mockResolvedValue({ data: 'uuid', error: null }) }` so the audit call resolves successfully by default in every test unless a test explicitly overrides it with `mockResolvedValueOnce`.
- **Files modified:** `src/features/toggle-permission/useMutationTogglePermission.test.ts`
- **Commit:** `4bb6586`

**2. [Rule 1 - Bug] Fixed `@typescript-eslint/no-unnecessary-condition` on `auditRes?.error` in queries.ts**
- **Found during:** Task 2
- **Issue:** `supabase.rpc(...)` (typed via the generated `Database` types, not `any`) resolves to a non-nullable object with a required `error` field, so `auditRes?.error` triggered `no-unnecessary-condition` (the optional chain can never be nullish).
- **Fix:** Changed to `auditRes.error` (no optional chain) — behavior identical since `auditRes` itself is never null/undefined at that point.
- **Files modified:** `src/entities/staff/model/queries.ts`
- **Commit:** `4aaebc0`

**3. [Rule 1 - Bug] Fixed `@typescript-eslint/unbound-method` on `expect(supabase.rpc)` in the new tests**
- **Found during:** Task 3
- **Issue:** Calling `expect(supabase.rpc).toHaveBeenCalledWith(...)` directly triggers `unbound-method` because `supabase.rpc` is accessed as a bare method reference off an object.
- **Fix:** Added `const mockedRpc = vi.mocked(supabase).rpc;` with the codebase's established `// eslint-disable-next-line @typescript-eslint/unbound-method` comment (same pattern already used in `queries.staff-report.test.ts`, `queries.test.ts` for `caja`/`ingredient`/`inventory`, `usePhysicalCount.test.ts`, `useRemoveTabItem.test.ts`) and asserted against `mockedRpc` instead of `supabase.rpc` directly.
- **Files modified:** `src/features/toggle-permission/useMutationTogglePermission.test.ts`
- **Commit:** `3fb565e`

## Issues Encountered

- Fresh worktree had no `node_modules` and no `.env.local` (both gitignored/untracked) — ran `npm install` (1240 packages, ~51s) and copied `.env.local` from the main repo checkout so `npx vitest run` could connect to the live Supabase test-setup probe.
- `.planning/` is entirely gitignored except a handful of previously force-added files (matching the pattern documented in `14-02-SUMMARY.md`). `PLAN.md`, `PROJECT.md`, `STATE.md`, `config.json`, `14-01-SUMMARY.md`/`14-02-SUMMARY.md`, and `14-PATTERNS.md` were read from the main repo's working tree since they are absent from this fresh worktree checkout. This SUMMARY.md is being force-added/committed per the parallel-execution instructions.

## User Setup Required

None — no external service configuration required. No new migrations, no new packages, no infra changes. Both audit calls use the already-live `record_audit` RPC (8-arg signature confirmed live via 14-02) with the older 6 positionally-named args plus the two new trailing params.

## Next Phase Readiness

- 14-14's final gate (regression + push) is unaffected by this plan — no new migrations were authored here, and the two RBAC actions wired here (`permission.toggle`, `staff.role_change`) are intentionally **not** part of the `audit-actions.test.ts` RPC-coverage `it.each` scaffold (that scaffold only covers RPC-sourced actions per 14-02's design; these two are client-sourced Pattern-3 actions, verified directly by this plan's own unit tests instead).
- SC3 (RBAC audit coverage) is now satisfied for both permission toggles and staff role changes.
- No downstream plan is blocked by this plan; `14-14`'s full-suite regression run will see the same 7 pre-existing failures already documented above (6 scaffold RED + 1 useCloseTab), none introduced by 14-06.

## Self-Check: PASSED

- FOUND: `src/features/toggle-permission/useMutationTogglePermission.ts` (modified)
- FOUND: `src/features/toggle-permission/useMutationTogglePermission.test.ts` (modified)
- FOUND: `src/entities/staff/model/queries.ts` (modified)
- FOUND commit `4bb6586` (Task 1)
- FOUND commit `4aaebc0` (Task 2)
- FOUND commit `3fb565e` (Task 3)

---
*Phase: 14-audit-logs-table*
*Completed: 2026-07-04*
