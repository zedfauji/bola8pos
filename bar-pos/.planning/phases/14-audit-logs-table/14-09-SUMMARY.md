---
phase: 14-audit-logs-table
plan: 09
subsystem: database
tags: [supabase, postgres, rbac, audit, security-definer]

requires:
  - phase: 14-audit-logs-table
    provides: "record_audit(text,text,uuid,jsonb,jsonb,text,text,uuid) 8-arg signature (14-02) + confirmed remote state that must_change_pin column is live but force_pin_change RPC is absent (14-01)"
provides:
  - "profiles.must_change_pin column reconciled via idempotent ADD COLUMN IF NOT EXISTS (safe no-op against the live drift confirmed in 14-01)"
  - "force_pin_change(uuid, text) SECURITY DEFINER RPC — manager+ gated, flags a target staff member, audits 'permission.force_pin_change'"
  - "clear_must_change_pin(text) SECURITY DEFINER RPC — self-service only (auth.uid()), clears the caller's own flag, audits 'permission.force_pin_change'"
affects: [14-12, 14-14]

tech-stack:
  added: []
  patterns:
    - "manager+ auth-check guard shape reused verbatim from process_refund (SELECT id INTO v_caller FROM profiles WHERE id = auth.uid() AND role IN ('manager','admin'); IF NOT FOUND THEN RAISE EXCEPTION 'AUTH_FORBIDDEN...')"
    - "self-service-only RPC pattern: no target-id parameter accepted, operates exclusively on auth.uid() to prevent cross-staff flag manipulation"

key-files:
  created:
    - supabase/migrations/20260703000005_force_pin_change.sql
  modified: []

key-decisions:
  - "Both RPCs use the SAME audit action label 'permission.force_pin_change' for both the set path (force_pin_change) and the clear path (clear_must_change_pin) — the before/after jsonb diff on each audit row distinguishes flag-set from flag-clear rather than using two separate action labels; this matches the plan's explicit instruction and the pre-existing AuditActionSchema enum, which only defines one permission-related action."
  - "must_change_pin column DOWN migration deliberately does NOT drop the column — it predates this migration (confirmed live drift per 14-01) and StaffSchema/mapStaffRow depend on it unconditionally; dropping it on rollback would break unrelated already-shipped functionality."

patterns-established:
  - "Idempotent column reconciliation for confirmed live-drift columns: ADD COLUMN IF NOT EXISTS with the exact default/nullability the code already assumes, rather than treating drift columns as fresh creations."

requirements-completed: [SC3]

duration: ~20min
completed: 2026-07-04
---

# Phase 14 Plan 09: force_pin_change + clear_must_change_pin RPCs Summary

**Idempotent must_change_pin column reconciliation + manager-gated force_pin_change RPC + self-service clear_must_change_pin RPC, both auditing 'permission.force_pin_change'**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-04T19:56:00Z
- **Completed:** 2026-07-04T20:16:00Z
- **Tasks:** 2/2 complete
- **Files modified:** 1 (created)

## Accomplishments

- **Task 1** — Authored `supabase/migrations/20260703000005_force_pin_change.sql` with `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS must_change_pin boolean NOT NULL DEFAULT false` (idempotent — safe whether or not the column already exists live, per 14-01's confirmed drift) followed by `force_pin_change(p_staff_id uuid, p_terminal_id text DEFAULT NULL)`: manager+ gate copied from `process_refund`'s auth-check shape, `NOT_FOUND` guard when the target staff row doesn't exist, `UPDATE profiles SET must_change_pin = true`, before/after `to_jsonb` capture, and `PERFORM record_audit('permission.force_pin_change', 'staff', p_staff_id, v_before, v_after, 'rpc', p_terminal_id)` on the success path only. `GRANT EXECUTE ... TO authenticated`.
- **Task 2** — Appended `clear_must_change_pin(p_terminal_id text DEFAULT NULL)` to the same migration file: derives `v_uid := auth.uid()`, `RAISE EXCEPTION 'AUTH_REQUIRED...'` when null, clears `must_change_pin = false WHERE id = v_uid` (no target-id parameter — self-service only, mitigating T-14-12), records the same `'permission.force_pin_change'` audit action with before/after diff showing the flag transition, `GRANT EXECUTE ... TO authenticated`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration — reconcile profiles.must_change_pin + create force_pin_change RPC** - `739c6e1` (feat)
2. **Task 2: Add clear_must_change_pin SECURITY DEFINER RPC** - `b2caf7a` (feat)

**Plan metadata:** (this SUMMARY commit)

## Files Created/Modified

- `supabase/migrations/20260703000005_force_pin_change.sql` - Idempotent `must_change_pin` column reconciliation + `force_pin_change` (manager+ gated) + `clear_must_change_pin` (self-service) SECURITY DEFINER RPCs, both auditing `permission.force_pin_change`

## Decisions Made

- Same audit action label used for both the flag-set and flag-clear paths (see `key-decisions` in frontmatter) — matches the plan's literal instruction and the existing single-entry `AuditActionSchema` enum for this action.
- DOWN script intentionally leaves the `must_change_pin` column in place on rollback (drift predates this migration; dropping it would regress unrelated shipped code).

## Deviations from Plan

None - plan executed exactly as written. Both tasks landed in the same migration file as instructed, committed as two separate atomic commits (Task 1's UP/DOWN block was temporarily scoped to just `force_pin_change` for its own commit, then Task 2's commit extended the file with `clear_must_change_pin` and the final combined DOWN block — this preserves per-task commit granularity within a single target file).

## Issues Encountered

- Worktree had no `node_modules` (fresh checkout) and no `.env.local` (gitignored, untracked) — ran `npm install` (1240 packages) and copied `.env.local` from the main repo checkout so `npx vitest run` could connect to the live Supabase test-setup probe, consistent with the same issue documented in 14-02-SUMMARY.md. Neither is a plan deliverable.
- `.planning/` is entirely gitignored in this repo except previously force-added files (14-01-SUMMARY.md, 14-02-SUMMARY.md). This worktree's checkout of `.planning/` is therefore sparse (missing PROJECT.md, STATE.md, config.json, and every other Phase 14 PLAN.md except what prior waves force-added) — those files were read from the main repo's working tree (`D:/Projects/Code/POS/bola8pos-kiro/bar-pos/.planning/...`) instead, matching the pattern noted in 14-02-SUMMARY.md's Issues Encountered section.
- Running the full `audit-actions.test.ts` coverage scaffold in this worktree shows 5 RED cases (`transfer_tab`, `record_stock_movement`, `caja_open`, `close_tab`, `produce_prep_batch`) in addition to the now-GREEN `force_pin_change` case — these 5 are the responsibility of sibling Wave-2/Wave-3 plans (14-03 through 14-08) whose migrations have not been merged into this worktree branch yet; this is expected and out of scope for 14-09 per the scaffold's documented design (14-02-SUMMARY.md), not a regression introduced here.

## User Setup Required

None - no external service configuration required. The migration created in this plan is **not pushed** to remote Supabase; push is explicitly deferred to plan 14-14 (BLOCKING push gate covering all Phase 14 migrations at once).

## Next Phase Readiness

- 14-12 (forced-PIN-change frontend screen) can proceed: `force_pin_change` (manager-triggered) and `clear_must_change_pin` (self-service, called after `supabase.auth.updateUser` sets a new PIN client-side) are both available to wire into the UI flow.
- 14-14's push gate must include `20260703000005_force_pin_change.sql` alongside all other Phase 14 migrations. Note: 14-14 should also reconcile the STATE.md-documented "migration-history drift" mention of a `force_pin_change` migration having been previously applied remotely-adjacent to a Phase 15 session note — per 14-01's direct SQL probe, no `force_pin_change` function exists live, so this migration is a genuinely new artifact, not a duplicate; 14-14 should re-verify at push time in case remote state has changed since 14-01 ran its probes.
- `audit-actions.test.ts`'s `force_pin_change -> permission.force_pin_change` coverage assertion is now GREEN in isolation; the full `it.each` scaffold will only be fully green once 14-03 through 14-08 have landed in the same branch/worktree (this plan does not block on or fix those).

## Self-Check: PASSED

- FOUND: `supabase/migrations/20260703000005_force_pin_change.sql`
- FOUND: `.planning/phases/14-audit-logs-table/14-09-SUMMARY.md`
- FOUND commit `739c6e1` (Task 1)
- FOUND commit `b2caf7a` (Task 2)

---
*Phase: 14-audit-logs-table*
*Completed: 2026-07-04*
