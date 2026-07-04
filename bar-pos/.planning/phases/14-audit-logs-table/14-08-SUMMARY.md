---
phase: 14-audit-logs-table
plan: 08
subsystem: edge-functions
tags: [supabase, edge-functions, audit, vitest, deno]

requires: ["14-02"]
provides:
  - "'staff.create' enumerated in AuditActionSchema / AuditAction"
  - "create-staff Edge Function emits recordAudit('staff.create') on success"
  - "settings-restore Edge Function emits recordAudit('settings.update') with restored-counts summary"
  - "SENSITIVE_EDGE_FUNCTIONS allowlist coverage test (src/shared/lib/__tests__/audit-edge-coverage.test.ts)"
affects: [14-14]

tech-stack:
  added: []
  patterns:
    - "Edge-function audit wiring: import recordAudit from '../_shared/audit.ts', call it after the mutation's success branch (never on the rollback/failure branch), await it (matches the doc-comment's own usage example — 'fire-and-forget' means it never throws / never gates response status, not that it's literally unawaited)"
    - "Allowlist coverage test mirrors audit-actions.test.ts's TARGET_RPCS scaffold pattern but for Edge Functions: SENSITIVE_EDGE_FUNCTIONS array + it.each per-function assertion, plus a directory-existence guard so a renamed/deleted function fails loudly instead of silently skipping"

key-files:
  created:
    - src/shared/lib/__tests__/audit-edge-coverage.test.ts
  modified:
    - src/shared/lib/audit-actions.ts
    - supabase/functions/create-staff/index.ts
    - supabase/functions/settings-restore/index.ts

key-decisions:
  - "create-staff has no authenticated caller established anywhere in the function (it accepts an unauthenticated POST and mints a new user) — actorId is passed as null per the plan's explicit fallback instruction, since there is no caller identity to attribute the audit row to."
  - "settings-restore audit payload records only restored-counts (categories.length/products.length/settings.length), never the full snapshot — keeps the payload well under the 64KB record_audit truncation guard and avoids leaking bulk business data into audit_logs (T-14-11)."
  - "audit-edge-coverage.test.ts's void-order sub-tests are expected RED in this worktree: void-order is authored by the parallel 14-07 plan in a separate worktree and does not yet exist on this branch. create-staff and settings-restore sub-tests pass now; the full allowlist goes green once 14-07 merges, mirroring the 14-02 TARGET_RPCS scaffold precedent."

patterns-established:
  - "Sensitive Edge Function audit allowlist (SENSITIVE_EDGE_FUNCTIONS) is the SC4 CI enforcement mechanism for edge-level (non-RPC) mutations, parallel to the existing RPC-level TARGET_RPCS scaffold in audit-actions.test.ts."

requirements-completed: [SC4, SC5]

duration: ~35min
completed: 2026-07-04
---

# Phase 14 Plan 08: Edge Function Audit Coverage (create-staff, settings-restore) Summary

**Wired recordAudit into create-staff (new 'staff.create' action) and settings-restore ('settings.update' with restored-counts summary); added SENSITIVE_EDGE_FUNCTIONS allowlist CI test covering void-order/create-staff/settings-restore**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-04T19:40:00Z
- **Completed:** 2026-07-04T20:15:00Z
- **Tasks:** 3/3 complete
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- **Task 1** — Added `'staff.create'` to `AuditActionSchema`'s z.enum (under the `// Staff` comment, adjacent to `'staff.role_change'`) and the matching `STAFF_CREATE: 'staff.create'` const entry to `AuditAction`, preserving `satisfies Record<string, AuditAction>`. Enum count is now 21.
- **Task 2** — `supabase/functions/create-staff/index.ts`: imported `recordAudit` from `../_shared/audit.ts` and called it after the `profiles` INSERT succeeds (i.e. after the `profileError` rollback branch, which calls `deleteUser` and returns early, is skipped). Payload is `{ name, role, email }` — the PIN is excluded. `actorId: null` since the function never establishes an authenticated caller identity (unauthenticated POST that mints a brand-new user). `supabase/functions/settings-restore/index.ts`: imported `recordAudit` and called it after the full restore completes (all upserts + the `settings_backups` `restored_at`/`restored_by` update done), before the `{ ok: true }` response. Payload is a restored-counts summary (`{ categories: categories.length, products: products.length, settings: settingsRows.length }`), not the full snapshot. `actorId: user.id` (the authenticated admin caller already resolved earlier in the function via `userClient.auth.getUser()`).
- **Task 3** — Created `src/shared/lib/__tests__/audit-edge-coverage.test.ts` defining `SENSITIVE_EDGE_FUNCTIONS = ['void-order', 'create-staff', 'settings-restore']`. First `it` asserts the allowlist is non-empty and every listed function's `index.ts` exists via `existsSync`. Second, `it.each`-driven, reads each function's source (readFileSync + comment-line stripping matching the `audit-actions.test.ts` convention) and asserts it contains both `from '../_shared/audit.ts'` and `recordAudit(`.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add 'staff.create' to AuditActionSchema | `c81bfd7` | `src/shared/lib/audit-actions.ts` |
| 2 | Wire recordAudit into create-staff and settings-restore | `9f9096f` | `supabase/functions/create-staff/index.ts`, `supabase/functions/settings-restore/index.ts` |
| 3 | SC4 allowlist coverage test over sensitive Edge Functions | `6bccb3f` | `src/shared/lib/__tests__/audit-edge-coverage.test.ts` |

**Plan metadata:** (this SUMMARY commit)

## Verification

- `npx vitest run src/shared/lib/__tests__/audit-actions.test.ts` — the pre-existing 2 base tests + 4/10 TARGET_RPCS pass (unchanged from 14-02's documented scaffold state; this plan does not touch RPC wiring so the 6 RED cases — transfer_tab/record_stock_movement/caja_open/close_tab/produce_prep_batch/force_pin_change — remain exactly as expected, owned by other Wave-2/3 plans).
- `npm run typecheck` — exit 0.
- `grep -q "recordAudit" supabase/functions/create-staff/index.ts && grep -q "'staff.create'" ... && grep -q "recordAudit" supabase/functions/settings-restore/index.ts && grep -q "'settings.update'" ... && echo OK` — `OK`.
- `npx vitest run src/shared/lib/__tests__/audit-edge-coverage.test.ts --reporter=verbose` — **4 tests: 2 passed / 2 failed**. Both failures are the `void-order` sub-tests (directory-existence + import/call assertions) — expected, since `void-order` is authored by the parallel 14-07 plan in a sibling worktree and is absent from this branch. `create-staff` and `settings-restore` sub-tests both PASS, confirming this plan's own scope is fully wired. The full allowlist will go green once 14-07 merges into the same branch (mirrors the precedent set by 14-02's `TARGET_RPCS` scaffold, which is fully enforced only at the 14-14 gate).
- `npx eslint src/shared/lib/__tests__/audit-edge-coverage.test.ts` — clean, no warnings.

## Deviations from Plan

None — plan executed exactly as written. One implementation detail chosen where the plan left room: create-staff's `actorId` was set to `null` (per the plan's own explicit fallback wording, "actorId if the function establishes one else null") because the function accepts an unauthenticated POST and never resolves a caller identity — there genuinely is no actor id to attribute. This is a literal application of the plan's stated fallback, not a scope change.

## Issues Encountered

- `.planning/` is gitignored in this repo (confirmed via `git check-ignore`); plan/context files were copied from the main checkout's working tree into this worktree before execution since a fresh worktree branch has no working-tree copy of untracked files.
- Worktree had no `node_modules` and no `.env.local` (both gitignored/untracked) — ran `npm install` (1240 packages) and copied `.env.local` from the main repo checkout so `npx vitest run` could resolve `src/test/global-setup.ts`'s Supabase connection probe. Neither is a plan deliverable — noted for visibility only, consistent with 14-02's prior note on the same setup gap.
- The `void-order` sub-test failures in `audit-edge-coverage.test.ts` are an expected cross-worktree scaffold gap (14-07 lands `void-order` in a parallel worktree this same wave), not a defect in this plan's own Task 2/3 work — flagged explicitly in Verification above and in the test file's own top-of-file comment so a future reader does not mistake it for a regression.

## User Setup Required

None — no external service configuration required. No new migrations; no Supabase push needed for this plan (edge function deployment is deferred to whatever plan handles Phase 14's Edge Function deploy step, consistent with 14-01/14-02's noted deferral pattern for remote pushes).

## Next Phase Readiness

- 14-14 (final gate) must re-run `audit-edge-coverage.test.ts` after all Wave-2 worktrees (including 14-07's `void-order`) are merged onto the integration branch — only then will all 3 allowlist entries pass together in one working tree.
- `audit-actions.test.ts`'s existing `TARGET_RPCS` scaffold is untouched by this plan; still 6 RED entries owned by other in-flight plans, unaffected by this plan's edge-function-only scope.
- No other plan needs to touch `create-staff`, `settings-restore`, or `audit-actions.ts`'s Staff/Settings enum entries — this closes out SC4 edge coverage for the two functions explicitly assigned to 14-08.

## Self-Check: PASSED

- FOUND: `src/shared/lib/audit-actions.ts` ('staff.create' present)
- FOUND: `supabase/functions/create-staff/index.ts` (recordAudit wired)
- FOUND: `supabase/functions/settings-restore/index.ts` (recordAudit wired)
- FOUND: `src/shared/lib/__tests__/audit-edge-coverage.test.ts`
- FOUND commit `c81bfd7` (Task 1)
- FOUND commit `9f9096f` (Task 2)
- FOUND commit `6bccb3f` (Task 3)

---
*Phase: 14-audit-logs-table*
*Completed: 2026-07-04*
