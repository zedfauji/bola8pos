---
phase: 23-reopen-closed-ticket
plan: 01
subsystem: auth
tags: [zod, rbac, audit-log, supabase, vitest, playwright]

# Dependency graph
requires:
  - phase: 22-edit-paid-ticket-history
    provides: "tab.edit_paid audit action / edit_paid_tab RBAC action pattern this plan mirrors"
provides:
  - "'tab.reopen' registered in AuditActionSchema + AuditAction const"
  - "'reopen_tab' registered as a manager+ RBAC action (STAFF_ACTIONS + MANAGER_EXTRA)"
  - "PaymentSchema.status ('completed'|'reopened_void', default 'completed') in both domain.ts and the entities/payment/model/types.ts duplicate"
  - "TabSchema.reopenCount / TabSchema.lastReopenedAt in domain.ts"
  - "mapPaymentRow surfaces status on the mapped Payment object"
  - "Pending Wave-0 test scaffolds: reopen-tab-rpc.integration.test.ts (it.todo), e2e/48-reopen-closed-ticket.spec.ts (test.fixme)"
affects: ["23-02", "23-03", "23-04", "23-05", "23-06"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave-0 foundation-first sequencing: audit action + RBAC action registered before any migration references them (CI grep gate)"
    - "it.todo/test.fixme pending scaffolds filled in by later waves"

key-files:
  created:
    - src/features/reopen-tab/model/reopen-tab-rpc.integration.test.ts
    - e2e/48-reopen-closed-ticket.spec.ts
  modified:
    - src/shared/lib/audit-actions.ts
    - src/shared/lib/rbac.ts
    - src/shared/lib/rbac.test.ts
    - src/shared/lib/domain.ts
    - src/entities/payment/model/types.ts
    - src/entities/payment/model/queries.ts
    - src/entities/payment/model/store.test.ts
    - src/widgets/RBACDashboard/PermissionMatrix.test.tsx

key-decisions:
  - "entities/payment/model/types.ts holds its own un-consolidated duplicate of PaymentSchema (not re-exported from domain.ts, unlike TabSchema/OrderSchema which are). mapPaymentRow parses against this local schema, not domain.ts's. Added `status` to both schemas rather than only domain.ts as literally read in the plan, otherwise the field would be silently stripped by Zod on the object real callers actually see."

patterns-established:
  - "Reopen-tab foundation slice: audit action + RBAC action + schema fields all land before the migration exists, satisfying the CI grep gate that fails if a migration references an unregistered audit action."

requirements-completed: [SC-1, SC-4]

coverage:
  - id: D1
    description: "'tab.reopen' registered in AuditActionSchema enum + AuditAction const, ahead of any migration referencing it"
    requirement: "SC-4"
    verification:
      - kind: unit
        ref: "src/shared/lib/__tests__/audit-actions.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "'reopen_tab' registered as a manager+ RBAC action (STAFF_ACTIONS + MANAGER_EXTRA); canAccess('bartender','reopen_tab') is false"
    requirement: "SC-1"
    verification:
      - kind: unit
        ref: "src/shared/lib/rbac.test.ts#canAccess (matrix) + %s may %s iff matrix allows"
        status: pass
    human_judgment: false
  - id: D3
    description: "PaymentSchema.status and TabSchema.reopenCount/lastReopenedAt parse without breaking existing rows/fixtures"
    verification:
      - kind: unit
        ref: "src/entities/payment/model/store.test.ts, src/entities/payment/model/types.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "mapPaymentRow surfaces payments.status on the mapped Payment object, defaulting to 'completed' pre-migration"
    verification:
      - kind: other
        ref: "npm run typecheck (no new errors beyond the 2 documented pre-existing) — no dedicated queries.ts unit test exists for mapPaymentRow's field set; visual code inspection + full unit suite green"
        status: pass
    human_judgment: false
  - id: D5
    description: "Pending Wave-0 test scaffolds (integration it.todo x8, E2E test.fixme x3) compile/collect without running real logic"
    verification:
      - kind: unit
        ref: "npx vitest run src/features/reopen-tab/model/reopen-tab-rpc.integration.test.ts (8 todo, 0 failed)"
        status: pass
      - kind: e2e
        ref: "npx playwright test e2e/48-reopen-closed-ticket.spec.ts --list (3 tests listed, 0 errors)"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-07-20
status: complete
---

# Phase 23 Plan 01: Wave-0 Foundations Summary

**Registered `tab.reopen` audit action + `reopen_tab` manager+ RBAC action, extended `PaymentSchema`/`TabSchema` with reopen-tracking fields, and stood up two pending test scaffolds for later waves to fill in.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-20T21:12Z (approx, first commit 21:13:04-06:00)
- **Completed:** 2026-07-20T21:19:38-06:00
- **Tasks:** 3 (as planned) + 1 auto-fix commit
- **Files modified:** 9 (7 modified + 2 created, plus 1 follow-up test-fixture fix)

## Accomplishments
- `'tab.reopen'` registered in `AuditActionSchema` + `AuditAction.TAB_REOPEN`, satisfying the CI grep gate (`src/shared/lib/__tests__/audit-actions.test.ts`) before any migration references it
- `'reopen_tab'` registered as a manager+ RBAC action (`STAFF_ACTIONS` + `MANAGER_EXTRA`), mirrored in `rbac.test.ts`'s hand-written `ALLOWED.manager` fixture
- `PaymentSchema.status` (`'completed' | 'reopened_void'`, default `'completed'`) added to `domain.ts` AND to the pre-existing un-consolidated duplicate in `entities/payment/model/types.ts` (the schema `mapPaymentRow` actually parses against)
- `TabSchema.reopenCount` / `TabSchema.lastReopenedAt` added to `domain.ts`, mirroring the existing `version`/`closedAt` conventions
- `mapPaymentRow` now maps `status: row['status'] ?? 'completed'`
- Two pending Wave-0 test scaffolds created: `reopen-tab-rpc.integration.test.ts` (8 `it.todo` placeholders covering SC-1/SC-2/SC-3/SC-4 plus the critical re-pay-double-count regression) and `e2e/48-reopen-closed-ticket.spec.ts` (3 `test.fixme` placeholders for the PIN-gated reopen flow, bartender-negative case, and reopen-cap UI surfacing)

## Task Commits

Each task was committed atomically:

1. **Task 1: Register 'tab.reopen' audit action and 'reopen_tab' RBAC action** - `b159388` (feat)
2. **Task 2: Extend PaymentSchema + TabSchema and map payments.status** - `7a8f65d` (feat)
3. **Task 3: Create pending integration + E2E test scaffolds (Wave 0)** - `6f2021b` (test)

**Auto-fix commit (Rule 1):** `0365182` (fix) — `PermissionMatrix.test.tsx` fixture update

_Note: no separate plan-metadata commit is included in this list; SUMMARY.md/STATE.md/ROADMAP.md commit follows this document._

## Files Created/Modified
- `src/shared/lib/audit-actions.ts` - added `'tab.reopen'` enum entry + `TAB_REOPEN` const
- `src/shared/lib/rbac.ts` - added `'reopen_tab'` to `STAFF_ACTIONS` + `MANAGER_EXTRA`
- `src/shared/lib/rbac.test.ts` - mirrored `'reopen_tab'` in `ALLOWED.manager`
- `src/shared/lib/domain.ts` - `PaymentSchema.status`, `TabSchema.reopenCount`/`lastReopenedAt`
- `src/entities/payment/model/types.ts` - mirrored `PaymentSchema.status` on the local duplicate schema + updated `mockPayments` fixtures
- `src/entities/payment/model/queries.ts` - `mapPaymentRow` now maps `status`
- `src/entities/payment/model/store.test.ts` - updated `createPayment`/`CreatePayment` test fixtures for the new required `status` field
- `src/widgets/RBACDashboard/PermissionMatrix.test.tsx` - updated hardcoded `STAFF_ACTIONS`/switch-grid counts (25→26, 100→104)
- `src/features/reopen-tab/model/reopen-tab-rpc.integration.test.ts` (new) - pending `it.todo` integration scaffold
- `e2e/48-reopen-closed-ticket.spec.ts` (new) - pending `test.fixme` E2E scaffold

## Decisions Made
- **`entities/payment/model/types.ts` has its own un-consolidated `PaymentSchema`** (not re-exported from `domain.ts`, unlike `TabSchema`/`OrderSchema` which are properly re-exported per CLAUDE.md's single-source-of-truth convention). `mapPaymentRow` parses against this local schema. Adding `status` only to `domain.ts` (as literally read in the plan's `read_first`) would have Zod silently strip the extra key on the object real callers (`PaymentPane`, `ReopenTabButton` in Plan 05) actually see. Added `status` to both schemas to satisfy the plan's own must-have truth ("A payment row's status surfaces on the mapped Payment object"). This is pre-existing tech debt (not created by this plan) — flagged here for future consolidation, not fixed wholesale (out of scope).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] entities/payment/model/types.ts's duplicate PaymentSchema also needed `status`**
- **Found during:** Task 2 (extend PaymentSchema + map payments.status)
- **Issue:** `mapPaymentRow` (`src/entities/payment/model/queries.ts`) parses against `PaymentSchema` imported from `./types`, a separate un-consolidated schema — not `domain.ts`'s. Adding `status` only to `domain.ts` per the plan's literal instruction would mean the field is silently dropped by Zod's default parse behavior, breaking the plan's own must-have truth.
- **Fix:** Added the identical `status` enum field to `entities/payment/model/types.ts`'s `PaymentSchema`, plus `status: 'completed'` to its `mockPayments` fixtures (the new field is required in the Zod-inferred output type because of `.default()`).
- **Files modified:** `src/entities/payment/model/types.ts`, `src/entities/payment/model/queries.ts`
- **Verification:** `npm run typecheck` clean (only the 2 pre-existing documented errors); `npx vitest run src/entities/payment/` 23/23 pass
- **Committed in:** `7a8f65d` (Task 2 commit)

**2. [Rule 3 - Blocking] `store.test.ts` fixtures needed the new required `status` field**
- **Found during:** Task 2, immediately after the schema change above
- **Issue:** `createPayment()` test helper and one `CreatePayment` literal in `store.test.ts` didn't set `status`, which is now a required key in the Zod-inferred output type (`.default()` makes the input optional but the output required) — typecheck failed.
- **Fix:** Added `status: 'completed'` to the helper's base object and to the one inline literal.
- **Files modified:** `src/entities/payment/model/store.test.ts`
- **Verification:** `npm run typecheck` clean
- **Committed in:** `7a8f65d` (Task 2 commit)

**3. [Rule 1 - Bug] PermissionMatrix.test.tsx hardcoded STAFF_ACTIONS count went stale**
- **Found during:** post-Task-3 full regression run (`npm run test`)
- **Issue:** Recurring regression from Phase 21/22 — `PermissionMatrix.test.tsx` hardcodes `STAFF_ACTIONS.toHaveLength(N)` and the switch-grid size (`N * 4`). Task 1 added `'reopen_tab'` (25→26 actions), which broke both assertions (2 failing tests).
- **Fix:** Updated both hardcoded counts (25→26, 100→104) and both test names.
- **Files modified:** `src/widgets/RBACDashboard/PermissionMatrix.test.tsx`
- **Verification:** `npx vitest run src/widgets/RBACDashboard/PermissionMatrix.test.tsx` 4/4 pass; full suite re-run 140 files/1258 tests, 0 failed
- **Committed in:** `0365182` (separate follow-up commit, since the regression only surfaced during the full-suite gate after Task 3)

---

**Total deviations:** 3 auto-fixed (2 Rule 1 bug, 1 Rule 3 blocking)
**Impact on plan:** All three were necessary corrections to keep the codebase's actual mapped-object/test contracts consistent with the plan's must-have truths. No scope creep — no new files or features beyond what the plan specified.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `tab.reopen` audit action and `reopen_tab` RBAC action are registered and ready for the `reopen_tab` migration (Plan 02) to reference without tripping the CI grep gate.
- `PaymentSchema.status` and `TabSchema.reopenCount`/`lastReopenedAt` are in place (both the canonical `domain.ts` schema and the actually-consumed `entities/payment/model/types.ts` duplicate) for Plan 03's payment-sum-exclusion work and Plan 05's `ReopenTabButton` visibility gate.
- Both Wave-0 test scaffolds exist, compile, and enumerate every planned scenario (including the highest-risk implicit double-count regression) for Plan 04 (integration) and Plan 06 (E2E) to fill in.
- Full unit suite green: 140 files / 1258 tests / 15 todo, 0 failed. `npm run typecheck`/`npm run lint` clean (only the 2 pre-existing documented unrelated errors remain).
- No blockers for Plan 02.

---
*Phase: 23-reopen-closed-ticket*
*Completed: 2026-07-20*

## Self-Check: PASSED
All created files and all 4 commit hashes verified present.
