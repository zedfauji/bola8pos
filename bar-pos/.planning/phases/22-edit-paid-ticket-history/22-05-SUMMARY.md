---
phase: 22-edit-paid-ticket-history
plan: 05
subsystem: testing
tags: [playwright, e2e, rbac, i18n, audit-log]

# Dependency graph
requires:
  - phase: 22-edit-paid-ticket-history (22-02)
    provides: edit_paid_tab RPC (live, integration-tested)
  - phase: 22-edit-paid-ticket-history (22-03)
    provides: EditPaidTabDialog feature slice wired into PaymentPane
  - phase: 22-edit-paid-ticket-history (22-04)
    provides: /edit-history read-only view (EditHistoryTable, EditHistoryRoute)
provides:
  - Live e2e/47-edit-paid-tab.spec.ts proving SC-3 (PIN-gated edit flow) and SC-4 (/edit-history diff view) end-to-end
  - CLAUDE.md E2E spec list registration (25 spec files)
affects: [edit-paid-ticket-history, e2e-suite]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "es-MX is the default E2E test-profile locale (resetTestState forces it) — new Phase-22 i18n keys (editPaidTab, editHistoryTable, pages.editHistory, wPanels.editTicket) are genuinely Spanish, unlike Phase 21's byte-identical-English catalog, so E2E assertions on these specific strings must use the Spanish text"
    - "RBAC enforcement for edit_paid_tab lives entirely in ManagerPinDialog's eligibleStaff check, not route/visibility gating — EditTicketButton renders for every role (mirrors RefundButton); a bartender can open the dialog but their own PIN is rejected as ineligible"

key-files:
  created: []
  modified:
    - e2e/47-edit-paid-tab.spec.ts
    - CLAUDE.md

key-decisions:
  - "Converted all 4 test.fixme placeholders (not just the 2 the plan's action text detailed) since the acceptance criteria required zero test.fixme/test.skip remaining under both SC-3 and SC-4 describe blocks"
  - "Rewrote the bartender SC-3 negative test from the scaffold's stale premise ('bartender cannot see or trigger the edit-paid-tab action') to match actual 22-03 behavior: the Edit ticket button is visible to every role, and manager-only enforcement happens at the ManagerPinDialog PIN-eligibility check, not button visibility"

requirements-completed: [SC-3, SC-4]

coverage:
  - id: D1
    description: "Manager PIN-gated edit-paid-tab flow: open EditPaidTabDialog from a paid tab on /payments, edit an item's unit price, enter a reason, pass the ManagerPinDialog gate, save — server-side unit_price update and tab.edit_paid audit_logs row verified via service-role DB query"
    requirement: SC-3
    verification:
      - kind: e2e
        ref: "e2e/47-edit-paid-tab.spec.ts#manager opens EditPaidTabDialog from a paid tab, passes the PIN gate, edits an item and reason, and saves"
        status: pass
    human_judgment: false
  - id: D2
    description: "Manager-only enforcement: a bartender can open the dialog but their own PIN is rejected by ManagerPinDialog's eligibleStaff check (edit_paid_tab is manager+), and no server-side change occurs"
    requirement: SC-3
    verification:
      - kind: e2e
        ref: "e2e/47-edit-paid-tab.spec.ts#bartender cannot self-approve the edit-paid-tab PIN gate (manager+ only)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The saved edit appears on /edit-history with its action, reason, and entity — row click opens AuditLogDetailSheet's JsonDiffViewer showing before/after"
    requirement: SC-4
    verification:
      - kind: e2e
        ref: "e2e/47-edit-paid-tab.spec.ts#manager sees the edit in /edit-history and row click opens the JsonDiffViewer"
        status: pass
    human_judgment: false
  - id: D4
    description: "A bartender is redirected away from /edit-history (view_audit_log guard, manager+ only)"
    requirement: SC-4
    verification:
      - kind: e2e
        ref: "e2e/47-edit-paid-tab.spec.ts#bartender is redirected away from /edit-history"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-07-19
status: complete
---

# Phase 22 Plan 05: Activate the SC-3/SC-4 E2E Spec Summary

**Converted `e2e/47-edit-paid-tab.spec.ts`'s 4 `test.fixme` placeholders into live Playwright tests proving the manager PIN-gated edit flow (SC-3) and the `/edit-history` audit-diff view (SC-4) compose correctly end-to-end, then ran and confirmed the full phase gate green.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `e2e/47-edit-paid-tab.spec.ts` now has 4 live tests (was 4 `test.fixme`), all green twice in a row against live remote Supabase
- SC-3 proven: manager opens `EditPaidTabDialog` from a seeded paid tab's `/payments` row, edits the item's unit price via `#edit-price-{id}`, fills the reason field, saves, passes `ManagerPinDialog`, and the success toast + dialog close are asserted; DB-verified the `order_items.unit_price` change and the `tab.edit_paid` `audit_logs` row (with the entered reason embedded in `after`)
- SC-3 negative case proven: a bartender can open the dialog (no route/visibility gate) but their own PIN is rejected by `ManagerPinDialog`'s `eligibleStaff` check — dialog stays open with an error, no DB change
- SC-4 proven: after a fresh edit, `/edit-history` lists the `tab.edit_paid` row with the entered reason, and clicking the row opens `AuditLogDetailSheet`'s `JsonDiffViewer` (before/after labels visible)
- SC-4 negative case proven: a bartender navigating to `/edit-history` is redirected to `/home` with the restricted toast (`EditHistoryRoute`'s `view_audit_log` guard)
- `CLAUDE.md`'s E2E Test Suite list updated to 25 spec files, including `47-edit-paid-tab`
- Full phase gate confirmed green: `npm run typecheck` (only the 2 documented pre-existing unrelated errors), `npm run lint` (clean), `npm run test` (140 files/1254 tests, 15 todo, 2 skipped — no regressions)

## Task Commits

Each task was committed atomically:

1. **Task 1: Activate the SC-3 + SC-4 E2E spec** - `665d44a` (test)
2. **Task 2: Run the full phase gate + register the spec in CLAUDE.md** - `69c625b` (docs)

## Files Created/Modified
- `e2e/47-edit-paid-tab.spec.ts` - 4 live Playwright tests replacing the 22-01 Wave-0 `test.fixme` scaffold; local `seedPaidTab`/`enterManagerPin` helpers mirror `e2e/35-refund.spec.ts`'s proven pattern; a shared `editPaidTabViaUi` helper drives the full SC-3 UI flow, reused by the SC-4 setup
- `CLAUDE.md` - E2E Test Suite section: 24 → 25 spec files, `47-edit-paid-tab` appended

## Decisions Made
- Converted all 4 `test.fixme` placeholders (both SC-3 tests and both SC-4 tests), not just the two flows the plan's action text spelled out in detail, because the acceptance criteria explicitly required zero `test.fixme`/`test.skip` remaining
- Corrected the scaffold's stale bartender-SC-3 premise ("bartender cannot see or trigger the edit-paid-tab action") to match the actual 22-03 implementation: `EditTicketButton` has no role gate (mirrors `RefundButton`) — the manager+ restriction lives entirely in `ManagerPinDialog`'s PIN-eligibility check. Rewrote that test to assert the real enforcement point (bartender's own PIN rejected, dialog stays open, no DB write) rather than a UI element that was never actually gated
- Edited an existing item's unit price via its stable `#edit-price-{orderItemId}` input ID rather than the `QuantityControl` +/- buttons, avoiding a dependency on translated `aria-label` text for a simpler, more deterministic assertion
- Used the es-MX (Spanish) UI text throughout new-Phase-22-key assertions (`Editar ticket`, `Editar ticket pagado`, `Guardar corrección`, `Historial de ediciones`, toast text) since `resetTestState()` forces all E2E test-profile locales to `es-MX`, and this phase's new i18n keys are genuinely Spanish (not the byte-identical-English convention Phase 21 used for its migrated keys)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Strict-mode toast-locator collision in the bartender-redirect test**
- **Found during:** Task 1 (first `npx playwright test` run)
- **Issue:** `page.getByText(/restricted to managers and admins/i)` resolved to 2 elements (sonner appears to render both a visible toast and an aria-live-region duplicate for the same message), causing a strict-mode violation
- **Fix:** Scoped the locator with `.first()`
- **Files modified:** `e2e/47-edit-paid-tab.spec.ts`
- **Verification:** Spec passed twice in a row after the fix
- **Committed in:** `665d44a` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor test-locator fix only. No scope creep, no application code touched.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
Phase 22 (edit-paid-ticket-history) is complete — 5/5 plans. SC-1 through SC-4 are all proven: SC-1/SC-2 by 22-02's live RPC integration test, SC-3/SC-4 by this plan's live E2E spec. The full phase gate (typecheck/lint/unit/E2E) is green with no new failures against the documented pre-phase baseline.

---
*Phase: 22-edit-paid-ticket-history*
*Completed: 2026-07-19*

## Self-Check: PASSED

- FOUND: e2e/47-edit-paid-tab.spec.ts
- FOUND: 665d44a (Task 1 commit)
- FOUND: 69c625b (Task 2 commit)
