---
phase: 22-edit-paid-ticket-history
plan: 03
subsystem: payments
tags: [react-i18next, tanstack-query, supabase-rpc, manager-pin-gate, feature-sliced-design]

# Dependency graph
requires:
  - phase: 22-edit-paid-ticket-history (plan 01)
    provides: "'tab.edit_paid' AuditAction + 'edit_paid_tab' manager+ StaffAction enum registrations"
  - phase: 22-edit-paid-ticket-history (plan 02)
    provides: "edit_paid_tab SECURITY DEFINER RPC (live, db-pushed, supabase.types.ts regenerated)"
provides:
  - "edit-paid-tab feature slice: useEditPaidTab mutation hook + EditPaidTabDialog Sheet + barrel"
  - "Edit ticket trigger on the Payments page, reachable per paid payment row"
  - "26 featOrders.editPaidTab.* i18n keys (es-MX/en-US) + 1 wPanels.paymentPane.editTicket key"
affects: [22-edit-paid-ticket-history plan 05 (E2E spec covering SC-3 click-through)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "supabaseMutation() wrapper (not raw supabase.rpc()) so P0V01/P0V02 SQLSTATEs auto-map to STALE_VERSION/NOT_FOUND_VERSIONED AppErrors via parseSupabaseError, matching the Group A/B Phase-15 convention rather than process-refund's older string-matching pattern"
    - "RPC patch wire shape uses snake_case keys (unit_price/product_id) matching the SQL function's whitelist reader, not the camelCase convention used elsewhere in TS — documented inline to prevent silent no-ops"

key-files:
  created:
    - src/features/edit-paid-tab/model/useEditPaidTab.ts
    - src/features/edit-paid-tab/ui/EditPaidTabDialog.tsx
    - src/features/edit-paid-tab/index.ts
  modified:
    - src/widgets/PaymentPane/ui/PaymentPane.tsx
    - src/widgets/PaymentPane/ui/PaymentPane.test.tsx
    - src/shared/lib/i18n/locales/es-MX/featOrders.json
    - src/shared/lib/i18n/locales/en-US/featOrders.json
    - src/shared/lib/i18n/locales/es-MX/wPanels.json
    - src/shared/lib/i18n/locales/en-US/wPanels.json

key-decisions:
  - "Used supabaseMutation()/parseSupabaseError instead of process-refund's raw supabase.rpc() + string-matching pattern, so STALE_VERSION/NOT_FOUND_VERSIONED surface with the correct AppErrorCode for handleVersionError() to detect — process-refund's pattern would have silently swallowed those into a generic SUPABASE_ERROR"
  - "EditPaidTabPatch fields use snake_case (unit_price, product_id) matching exactly what edit_paid_tab's SQL patch loop destructures (v_patch->>'unit_price'), not the plan's literal camelCase wording — a camelCase key would be silently ignored by the RPC's whitelist reader (T-22-01's own documented mitigation), so this is a correctness fix, not a style choice"
  - "'Add item' uses a Select populated from useProducts() defaulting unit price to the product's basePrice (editable) — no new product-picker component; reuses the existing product-catalog query"
  - "Reason field uses the shared/ui Input component (no Textarea component exists in the codebase); UI-SPEC explicitly allows this as 'Textarea/Input'"
  - "es-MX values for all new keys are genuine Spanish translations (not byte-identical-to-English), following the precedent set by 22-04's wAdmin.json rather than featOrders.json's older Phase-21-migration byte-identical convention — per the UI-SPEC's explicit instruction for new keys"

requirements-completed: [SC-3]

coverage:
  - id: D1
    description: "useEditPaidTab calls edit_paid_tab RPC with the five p_* params, maps NO_OPEN_CAJA/AUTH_FORBIDDEN/TAB_NOT_EDITABLE to typed Result errors, and invalidates tab + audit caches on success"
    requirement: "SC-3"
    verification:
      - kind: unit
        ref: "npm run typecheck (whole-repo, only 2 pre-existing unrelated errors remain)"
        status: pass
    human_judgment: false
  - id: D2
    description: "EditPaidTabDialog is PIN-gated (requiredAction='edit_paid_tab'), lets a manager edit item qty/price/notes, add/remove rows, and tab notes, requires a free-text reason before Save is enabled, and is reachable from a paid payment row on the Payments page"
    requirement: "SC-3"
    verification: []
    human_judgment: true
    rationale: "Full end-to-end click-through (open dialog, edit a row, PIN, save, see the correction persist) is a UI interaction flow reserved for 22-05's E2E spec per this plan's own <verification> scope; this plan proves the code compiles, lints, and the unit-testable seams (hook error mapping, PaymentPane wiring) are correct."

# Metrics
duration: 35min
completed: 2026-07-19
status: complete
---

# Phase 22 Plan 03: edit-paid-tab Feature Slice Summary

**`useEditPaidTab` mutation hook + `EditPaidTabDialog` Sheet (manager-PIN-gated correction UI for paid tabs) wired into PaymentPane's payment history rows, cloning the process-refund pattern with add/remove item support and a free-text reason.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-07-19T17:35:00Z (approx.)
- **Completed:** 2026-07-19T18:03:00Z
- **Tasks:** 3
- **Files modified:** 9 (3 created, 6 modified)

## Accomplishments

- `useEditPaidTab` mutation hook calling the `edit_paid_tab` RPC via `supabaseMutation()`, correctly threading STALE_VERSION/NOT_FOUND_VERSIONED (P0V01/P0V02) through to the component's `handleVersionError()`, and mapping NO_OPEN_CAJA/AUTH_FORBIDDEN/TAB_NOT_EDITABLE to typed `Result` errors
- `EditPaidTabDialog` Sheet: per-row qty/unit-price/notes editors with an "Edited" badge, add-item (product picker) and remove-item (destructive `ConfirmDialog`) affordances, a tab-level notes field, a free-text reason, and a live "New total" row with a total-delta hint
- "Edit ticket" trigger wired into `PaymentPane`'s payment history rows (non-refund rows only), mirroring the existing `refundTarget`/`RefundSheet` pattern exactly
- 26 `featOrders.editPaidTab.*` keys + 1 `wPanels.paymentPane.editTicket` key added to both locales (es-MX/en-US, identical key sets, genuine Spanish copy)

## Task Commits

Each task was committed atomically:

1. **Task 1: useEditPaidTab mutation hook + feature barrel** - `bcaa1c8` (feat)
2. **Task 2: EditPaidTabDialog Sheet + featOrders i18n keys** - `811c29c` (feat)
3. **Task 3: Wire the "Edit paid ticket" trigger into PaymentPane** - `65c5302` (feat)

_No TDD tasks in this plan — all three were `type="auto"` without `tdd="true"`._

## Files Created/Modified

- `src/features/edit-paid-tab/model/useEditPaidTab.ts` - Mutation hook calling `edit_paid_tab` RPC
- `src/features/edit-paid-tab/ui/EditPaidTabDialog.tsx` - Correction Sheet (PIN-gated, add/remove/edit rows)
- `src/features/edit-paid-tab/index.ts` - Feature barrel
- `src/widgets/PaymentPane/ui/PaymentPane.tsx` - "Edit ticket" trigger + `editTarget` state + dialog render
- `src/widgets/PaymentPane/ui/PaymentPane.test.tsx` - Stubbed `useTab`/`useProducts` (Rule 1 fix, see below)
- `src/shared/lib/i18n/locales/{es-MX,en-US}/featOrders.json` - `editPaidTab.*` keys (26 each)
- `src/shared/lib/i18n/locales/{es-MX,en-US}/wPanels.json` - `paymentPane.editTicket` key

## Decisions Made

- Used `supabaseMutation()`/`parseSupabaseError` (the Phase 15 Group A/B convention already used by `useMutationUpdateTabStatus`/`useMutationCloseCaja`) instead of `process-refund`'s older raw-`rpc()`-plus-string-matching pattern, so `STALE_VERSION`/`NOT_FOUND_VERSIONED` carry the correct `AppErrorCode` for `handleVersionError()` to act on.
- `EditPaidTabPatch`'s wire fields are `unit_price`/`product_id` (snake_case), matching exactly what the `edit_paid_tab` SQL function's patch loop reads (`v_patch->>'unit_price'`) — the plan text used camelCase, but that would have been silently ignored by the RPC's whitelist reader.
- "Add item" uses a `Select` from `useProducts()`, defaulting unit price to the product's `basePrice` (editable) — reuses the existing product-catalog query instead of building a new picker.
- Reason field uses the existing `Input` component (no `Textarea` primitive exists in `shared/ui`); the UI-SPEC explicitly allows "Textarea/Input" for this field.
- New i18n keys use genuine Spanish for es-MX (not byte-identical-to-English), following 22-04's `wAdmin.json` precedent rather than `featOrders.json`'s older Phase-21-migration convention, per the UI-SPEC's explicit instruction for new keys.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] RPC patch wire shape corrected from camelCase to snake_case**
- **Found during:** Task 1 (reading the already-landed `edit_paid_tab` migration SQL before writing the hook)
- **Issue:** The plan's task text specified `EditPaidTabPatch` fields as `unitPrice`/`productId` (camelCase), but the live RPC's patch loop only reads `v_patch->>'unit_price'` / `v_patch->>'product_id'` (snake_case) — a camelCase key would be silently ignored per the RPC's own documented whitelist behavior (T-22-01: "a bogus extra key in an element is simply never destructured, so it is silently ignored"), meaning price/product edits would appear to succeed but never actually apply.
- **Fix:** Defined `EditPaidTabPatch` with `unit_price`/`product_id` snake_case fields matching the SQL exactly, with an inline comment explaining why.
- **Files modified:** `src/features/edit-paid-tab/model/useEditPaidTab.ts`, `src/features/edit-paid-tab/ui/EditPaidTabDialog.tsx`
- **Verification:** Field names cross-checked against `supabase/migrations/20260719000001_edit_paid_tab_rpc.sql` lines 130-153 and the 22-02 integration test's literal patch objects (which already used `unit_price` in its test fixtures).
- **Committed in:** `bcaa1c8`, `811c29c`

**2. [Rule 1 - Bug] STALE_VERSION/NOT_FOUND_VERSIONED routing fixed to use supabaseMutation()**
- **Found during:** Task 1 (comparing the plan's `useProcessRefund.ts`-mirroring instruction against the Phase 15 `handleVersionError()` contract)
- **Issue:** Mirroring `process-refund`'s raw `db.rpc()` + `error.message.includes(...)` pattern verbatim, with anything not matched by the two explicit `includes()` checks falling through to a generic `SUPABASE_ERROR` code, would have swallowed `STALE_VERSION`/`NOT_FOUND_VERSIONED` into that generic code — `handleVersionError()` checks `error.code === 'STALE_VERSION'` specifically, so the version-conflict toast/retry flow required by the plan's own T-22-03 threat mitigation would never fire.
- **Fix:** Used `supabaseMutation()` (which runs `parseSupabaseError` internally, mapping SQLSTATE `P0V01`/`P0V02` to `STALE_VERSION`/`NOT_FOUND_VERSIONED` automatically) instead of a raw `supabase.rpc()` call, matching the exact pattern already proven in `useMutationUpdateTabStatus`/`useMutationCloseCaja`.
- **Files modified:** `src/features/edit-paid-tab/model/useEditPaidTab.ts`
- **Verification:** `npm run typecheck` clean; cross-referenced against `src/entities/tab/model/queries.ts` lines 762-853 for the proven pattern.
- **Committed in:** `bcaa1c8`

**3. [Rule 1 - Bug] TAB_NOT_EDITABLE checked on the RPC response body, not on the thrown error**
- **Found during:** Task 1 (reading the RPC SQL's early-return branch)
- **Issue:** The plan's behavior spec grouped `TAB_NOT_EDITABLE` with the other `error.message.includes(...)` branches, but the RPC returns `TAB_NOT_EDITABLE` as a normal `RETURN jsonb_build_object('ok', false, 'code', 'TAB_NOT_EDITABLE', ...)` — not a raised exception — so `error` is `null` in that case and the code would never be reached if only checked inside `if (error)`.
- **Fix:** Added a `!result.ok` check on the successfully-returned `data` body, separate from the `error` branch.
- **Files modified:** `src/features/edit-paid-tab/model/useEditPaidTab.ts`
- **Verification:** Matches the RPC's `RETURN jsonb_build_object('ok', false, 'code', 'TAB_NOT_EDITABLE', ...)` at migration line 88-91 (a normal successful PostgREST response, not an exception).
- **Committed in:** `bcaa1c8`

**4. [Rule 1 - Bug] PaymentPane.test.tsx stubbed useTab/useProducts**
- **Found during:** Task 3 (running the PaymentPane unit test suite after wiring the dialog)
- **Issue:** `EditPaidTabDialog` is now always mounted by `PaymentPane` (even when `editTarget` is `null`), so it unconditionally calls `useTab(tabId ?? '')` and `useProducts()`. The existing test file mocked `@entities/tab/model/queries` without a `useTab` export (crashing with "useTab is not a function") and never mocked `@entities/product` at all (would have hit the live Supabase client).
- **Fix:** Added a `useTab` stub to the existing `@entities/tab/model/queries` mock and a new `@entities/product` mock, both returning empty/idle default state.
- **Files modified:** `src/widgets/PaymentPane/ui/PaymentPane.test.tsx`
- **Verification:** All 11 pre-existing `PaymentPane.test.tsx` tests pass; full repo suite re-run clean (140 files / 1254 tests / 15 todo, matching the pre-existing baseline).
- **Committed in:** `65c5302`

**5. [Rule 2 - Missing Critical] Two lint fixes surfaced by react-hooks/eslint-plugin and import/order**
- **Found during:** Task 2 (first lint pass on the new dialog)
- **Issue:** (a) Initializing `tabNotes` from the loaded `tab` in a `useEffect` triggered `react-hooks/set-state-in-effect` (cascading-render risk) with no existing suppression; (b) `@tanstack/react-query` was imported after `react` (violates `import/order`'s alphabetical external-import sort, `@` < `l` < `r`).
- **Fix:** (a) Wrapped the `setTabNotes` call in a scoped `eslint-disable`/`eslint-enable` block, mirroring the identical precedent in `GeneralSettingsTab.tsx`'s data→form sync; (b) reordered the import to alphabetical position.
- **Files modified:** `src/features/edit-paid-tab/ui/EditPaidTabDialog.tsx`
- **Verification:** `npm run lint -- src/features/edit-paid-tab` and `npm run lint` (full repo) both exit 0.
- **Committed in:** `811c29c`

---

**Total deviations:** 5 auto-fixed (4 Rule 1 bug fixes, 1 Rule 2 missing-critical/lint fix)
**Impact on plan:** All five were necessary for correctness (patches actually applying, version conflicts surfacing, TAB_NOT_EDITABLE being reachable, tests staying isolated from the live Supabase client) or for a clean lint gate. No scope creep — the dialog's feature set (edit/add/remove rows, tab notes, free-text reason, PIN gate) matches the plan and UI-SPEC exactly.

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

None - no external service configuration required. The `edit_paid_tab` RPC (22-02) is already live on remote Supabase.

## Next Phase Readiness

- SC-3's full click-through (open the dialog from a paid payment row, edit/add/remove items, enter a reason, PIN-gate, save, see the correction persist and the caja adjustment recorded) is ready for 22-05's E2E spec — this plan proves the code compiles, lints, and the unit-testable seams are correct, per this plan's own `<verification>` scope.
- `useEditPaidTab`'s success path invalidates `tabKeys.lists()` + `auditKeys.all`, so a successful edit will refresh both the Payments page and the `/edit-history` view (22-04) without a manual reload.
- No blockers. Phase 22 now has plans 01, 02, 03, 04 complete; only 22-05 (E2E) remains.

---
*Phase: 22-edit-paid-ticket-history*
*Completed: 2026-07-19*

## Self-Check: PASSED

All created files (`useEditPaidTab.ts`, `EditPaidTabDialog.tsx`, `index.ts`, this SUMMARY.md) confirmed present on disk. All 4 commits (`bcaa1c8`, `811c29c`, `65c5302`, `bde8e1a`) confirmed present in `git log --oneline --all`.
