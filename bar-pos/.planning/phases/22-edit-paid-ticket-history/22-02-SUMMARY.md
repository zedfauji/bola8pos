---
phase: 22-edit-paid-ticket-history
plan: 02
subsystem: billing
tags: [rpc, migration, security-definer, audit-log, caja, integration-test]

requires:
  - phase: 22-edit-paid-ticket-history
    plan: 01
    provides: "'tab.edit_paid' AuditAction enum + 'edit_paid_tab' manager+ StaffAction, and the Wave-0 it.todo integration test scaffold this plan activates"
  - phase: 15-optimistic-concurrency
    provides: "p_expected_version / FOR UPDATE / P0V01 (STALE_VERSION) / P0V02 (NOT_FOUND_VERSIONED) guard pattern, bump_version_on_update trigger"
  - phase: 14-audit-logs
    provides: record_audit(action, entity_type, entity_id, before, after, source) convention
provides:
  - "edit_paid_tab(uuid, int, jsonb, text, text) SECURITY DEFINER RPC — live on remote Supabase, whitelisted patch of order_items.quantity/unit_price/notes + add/soft-delete rows + tabs.notes, manager+ role re-check, version guard, conditional offsetting caja_entries row, record_audit('tab.edit_paid', ...) on success"
  - "supabase.types.ts Functions.edit_paid_tab type entry — no supabase-as-any cast needed downstream"
  - "Green live-Supabase integration test proving SC-1 (whitelist/role/version guards + caja offset) and SC-2 (audit diff)"
affects: [22-03-pin-gated-dialog, 22-04-edit-history-page, 22-05-e2e-activation]

tech-stack:
  added: []
  patterns:
    - "Named-key jsonb patch destructuring (id/op/quantity/unit_price/notes/product_id) — never dynamic column-name SQL — for whitelisted partial-update RPCs"
    - "Free-text caja_entries.concept encoding (tab short id + date + sanitized reason, truncated to 200 chars) as a deliberate placeholder ahead of a possible Phase 23 source_tab_id/source_type column"

key-files:
  created:
    - supabase/migrations/20260719000001_edit_paid_tab_rpc.sql
  modified:
    - src/shared/lib/supabase.types.ts
    - src/features/edit-paid-tab/model/edit-paid-tab-rpc.integration.test.ts

key-decisions:
  - "Recovery/continuation execution: a prior executor run for this plan was cut off by a transient API connection error while writing SUMMARY.md. All 3 tasks' implementation work was already fully committed (23f17eb, 0272e6d, 4f55795) before the interruption — this run only verified and closed out the plan, it did not redo or duplicate any implementation."

requirements-completed: [SC-1, SC-2]

coverage:
  - id: D1
    description: "edit_paid_tab restricts writes to order_items.quantity/unit_price/notes, add/soft-delete of order_items rows, and tabs.notes only — never payments or a dynamic column"
    requirement: SC-1
    verification:
      - kind: unit
        ref: "npx vitest run src/features/edit-paid-tab/model/edit-paid-tab-rpc.integration.test.ts — 'a non-whitelisted key in an order_item patch is ignored, not applied (payments untouched)'"
        status: pass
    human_judgment: false
  - id: D2
    description: "A non-manager/admin caller is rejected with AUTH_FORBIDDEN; a wrong p_expected_version raises STALE_VERSION"
    requirement: SC-1
    verification:
      - kind: unit
        ref: "npx vitest run .../edit-paid-tab-rpc.integration.test.ts — 'STALE_VERSION is returned when p_expected_version does not match' + 'AUTH_FORBIDDEN is returned when the caller is not manager/admin role'"
        status: pass
    human_judgment: false
  - id: D3
    description: "A total-changing edit inserts exactly one offsetting caja_entries row into the currently-open caja session"
    requirement: SC-1
    verification:
      - kind: unit
        ref: "npx vitest run .../edit-paid-tab-rpc.integration.test.ts — 'a total-changing edit with an open caja inserts exactly one offsetting caja_entries row'"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every successful edit writes one audit_logs row via record_audit('tab.edit_paid', ...) with before/after jsonb and the reason embedded in after"
    requirement: SC-2
    verification:
      - kind: unit
        ref: "npx vitest run .../edit-paid-tab-rpc.integration.test.ts — 'a successful edit writes an audit_logs row (action=tab.edit_paid) with before/after diff and the reason'"
        status: pass
    human_judgment: false

duration: unknown (recovery run — original execution timing lost to the interrupted session; original 3 task commits are timestamped 2026-07-19)
completed: 2026-07-19
status: complete
---

# Phase 22 Plan 02: edit_paid_tab RPC + Live Push + Integration Test Summary

**Whitelisted, version-guarded, manager-gated, audit-logged `edit_paid_tab` SECURITY DEFINER RPC, pushed live to remote Supabase with regenerated types and a green 6-test live integration suite covering SC-1 and SC-2.**

## Recovery Note

This SUMMARY.md was produced by a **recovery/continuation run**. A prior executor session for this plan was interrupted by a transient API connection error while writing this file — after all 3 tasks' implementation work had already been fully committed. This run did not redo, re-edit, or duplicate any implementation; it verified the existing commits against the plan's tasks and acceptance criteria, ran the full verification suite fresh, and then wrote this SUMMARY.md, updated STATE.md/ROADMAP.md, and made the closing docs commit.

## Performance

- **Tasks:** 3
- **Files modified:** 3 (1 migration created, 2 files modified)
- **Completed:** 2026-07-19

## Accomplishments

- **Task 1 — `23f17eb` (feat):** Wrote `supabase/migrations/20260719000001_edit_paid_tab_rpc.sql` defining `edit_paid_tab(p_tab_id uuid, p_expected_version int, p_order_item_patches jsonb, p_notes text, p_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public`. Verified present: `SELECT id INTO v_staff_id FROM profiles WHERE id = auth.uid() AND role IN ('manager','admin')` → `AUTH_FORBIDDEN`; version guard raising `P0V01`/`P0V02` (re-raised, not swallowed); named-key jsonb patch destructuring for `order_items.quantity/unit_price/notes` update, soft-delete, and add ops — no dynamic column-name SQL, no `payments` reference, no discount column; conditional offsetting `caja_entries` INSERT guarded by an open-caja `NO_OPEN_CAJA` check when `v_delta <> 0`, skipped entirely for notes-only edits; `version = version + 1` bump; success-path `record_audit('tab.edit_paid', 'tab', p_tab_id, v_before, v_after, 'rpc')` with the reason embedded in `v_after`; `GRANT EXECUTE ... TO authenticated`.
- **Task 2 — `0272e6d` (chore):** Ran `npx supabase db push` to apply the migration to the remote project and regenerated `src/shared/lib/supabase.types.ts` — confirmed `Functions.edit_paid_tab` is present in the generated types (no `supabase as any` cast needed downstream for this RPC). `npm run typecheck` passes (only the 2 pre-existing, unrelated `tab/model/queries.ts` / `agent/rag.ts` errors documented since Phase 21 remain).
- **Task 3 — `4f55795` (test):** Converted all `it.todo` placeholders in `edit-paid-tab-rpc.integration.test.ts` (22-01's Wave-0 scaffold) into 6 live assertions against the pushed RPC, following the `split-payment-rpc.integration.test.ts` seed/cleanup pattern: SC-1 happy path (patch applied, `newTotal`/`delta` returned, `tabs.version` +1), SC-1 `STALE_VERSION` on wrong `p_expected_version`, SC-1 `AUTH_FORBIDDEN` for a non-manager/admin caller, SC-1 whitelist-ignore (bogus extra key rejected, `payments` untouched), SC-1 caja offset (exactly one `caja_entries` row, correct sign/amount), SC-2 `audit_logs` row with `action='tab.edit_paid'` and `after.reason` set. No `it.todo`/`it.skip` remain.

## Verification (this recovery run)

- `npx vitest run src/features/edit-paid-tab/model/edit-paid-tab-rpc.integration.test.ts` — **6/6 passed** against live remote Supabase (`https://shsrhxleopmovzpzqmex.supabase.co`), 11.14s. `.env.local` credentials (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) were present in this environment, so the `describe.skipIf(skip)` gate did not skip — the suite ran for real, it was not silently no-op'd.
- `npm run typecheck` — 2 errors, both the pre-existing `src/entities/tab/model/queries.ts` and `src/shared/lib/agent/rag.ts` errors documented since Phase 21; no new errors introduced by this plan.
- `git status --short` in `bar-pos/` showed no uncommitted changes to any of the 3 plan files — confirming the prior session's work was fully committed before the interruption.

## Task Commits

All 3 tasks were committed atomically by the prior (interrupted) executor session:

1. **Task 1: Write the edit_paid_tab RPC migration** - `23f17eb` (feat)
2. **Task 2: Push the migration live and refresh types** - `0272e6d` (chore)
3. **Task 3: Activate the SC-1/SC-2 integration test** - `4f55795` (test)

## Files Created/Modified

- `supabase/migrations/20260719000001_edit_paid_tab_rpc.sql` (new) - The `edit_paid_tab` SECURITY DEFINER RPC: whitelist patch + manager role check + version guard + conditional caja offset + audit write
- `src/shared/lib/supabase.types.ts` - Regenerated to include the `edit_paid_tab` Functions entry
- `src/features/edit-paid-tab/model/edit-paid-tab-rpc.integration.test.ts` - `it.todo` scaffold from 22-01 converted to 6 live-Supabase assertions covering SC-1/SC-2

## Decisions Made

- No new decisions beyond those already recorded in 22-CONTEXT.md/22-RESEARCH.md (D-01 whitelist, D-02/D-03 caja offset, Open Questions 1-3) — this plan implemented those decisions as written, with no deviation.

## Deviations from Plan

None — plan executed exactly as written by the original (interrupted) executor session. This recovery run made no code changes; it only verified.

## Issues Encountered

The original executor session hit a transient API connection error while writing this SUMMARY.md, after all 3 tasks were already committed. No implementation work was lost — this recovery run confirmed all 3 commits exist, all 3 files match the plan's acceptance criteria, and the full verification suite (integration test + typecheck) is green, then completed the plan's closing steps (SUMMARY.md, STATE.md, ROADMAP.md, closing commit).

## User Setup Required

None - the RPC is already live on the remote Supabase project; no further external configuration needed for this plan.

## Next Phase Readiness

- 22-03 can now call the live `edit_paid_tab` RPC from its `useEditPaidTab` mutation hook without a `supabase as any` cast, and can build `EditPaidTabDialog` on top of the manager-role/version/whitelist guarantees this RPC enforces server-side
- 22-04's `/edit-history` page can rely on `audit_logs` rows with `action='tab.edit_paid'` existing for any edit made via this RPC
- No blockers

---
*Phase: 22-edit-paid-ticket-history*
*Completed: 2026-07-19*

## Self-Check: PASSED

- `supabase/migrations/20260719000001_edit_paid_tab_rpc.sql` — FOUND on disk, contains `CREATE OR REPLACE FUNCTION public.edit_paid_tab` and `SECURITY DEFINER`
- `Functions.edit_paid_tab` — FOUND in `src/shared/lib/supabase.types.ts`
- `edit-paid-tab-rpc.integration.test.ts` — FOUND, 0 `it.todo`/`it.skip` remain, 6/6 tests pass live
- Commits `23f17eb`, `0272e6d`, `4f55795` — all FOUND in `git log --oneline --all`
