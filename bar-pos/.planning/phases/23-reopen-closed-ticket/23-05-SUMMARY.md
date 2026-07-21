---
phase: 23-reopen-closed-ticket
plan: 05
subsystem: features
tags: [react, tanstack-query, i18n, rbac, manager-pin-gate]

# Dependency graph
requires:
  - phase: 23-reopen-closed-ticket
    provides: "Plan 04's live reopen_tab RPC + regenerated supabase.types.ts (Functions.reopen_tab)"
  - phase: 23-reopen-closed-ticket
    provides: "Plan 01's 'reopen_tab' manager+ RBAC action and PaymentSchema.status field"
provides:
  - "useReopenTab() mutation hook + ReopenTabInput/ReopenTabRpcResult interfaces"
  - "ReopenTabDialog — PIN-gated (requiredAction='reopen_tab'), reason-only Sheet"
  - "src/features/reopen-tab/index.ts barrel exporting both"
  - "PaymentPane ReopenTabButton on non-voided, non-refund payment rows"
affects: ["23-06"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reason-only PIN-gated Sheet (no item-override machinery) — simplest of the three PaymentPane dialogs, mirroring RefundSheet's shell more than EditPaidTabDialog's"
    - "Payment-row-only reopen gate: no per-row tab fetch — the RPC's TAB_NOT_REOPENABLE/REOPEN_CAP_EXCEEDED/REOPEN_WINDOW_EXPIRED checks are the authoritative server-side gate; the client button only hides on payment.isRefund/payment.status"

key-files:
  created:
    - src/features/reopen-tab/model/useReopenTab.ts
    - src/features/reopen-tab/ui/ReopenTabDialog.tsx
    - src/features/reopen-tab/index.ts
  modified:
    - src/widgets/PaymentPane/ui/PaymentPane.tsx
    - src/shared/lib/i18n/locales/es-MX/featOrders.json
    - src/shared/lib/i18n/locales/en-US/featOrders.json
    - src/shared/lib/i18n/locales/es-MX/wPanels.json
    - src/shared/lib/i18n/locales/en-US/wPanels.json

key-decisions:
  - "index.ts (Task 1's file per plan frontmatter) was written in two passes: Task 1 exports only the hook (the dialog doesn't exist yet at that point), Task 2 amends it to add the dialog export once ReopenTabDialog.tsx exists. Both edits land in their respective task's commit — no separate deviation, just a natural sequencing consequence of the plan listing index.ts only under Task 1's files while its full content depends on Task 2's output."
  - "ReopenTabButton takes only `payment` (not `tab`) and reads `payment.tabId` for the onReopen callback, per the plan's explicit instruction to skip a per-row tab fetch — the 23-PATTERNS.md draft's ReopenTabButtonProps sketch (which took a `tab` prop) predates this plan's finalized task text and was superseded by it."
  - "Used the existing `Input` component for the reason field (not a `Textarea`) — no Textarea component exists in `shared/ui`, and EditPaidTabDialog's own reason field uses `Input` for the identical single-line reason pattern; matches this codebase's established convention rather than introducing a new primitive."

requirements-completed: [SC-1, SC-3]

coverage:
  - id: D1
    description: "useReopenTab calls the reopen_tab RPC via supabaseMutation and maps REOPEN_CAP_EXCEEDED/REOPEN_WINDOW_EXPIRED/TAB_NOT_REOPENABLE (response-body codes) and NO_OPEN_CAJA/AUTH_FORBIDDEN (message-based) to user-facing i18n messages; STALE_VERSION/NOT_FOUND_VERSIONED pass through unchanged"
    requirement: "SC-1, SC-3"
    verification:
      - kind: automated
        ref: "grep -c \"supabase.rpc('reopen_tab'\" src/features/reopen-tab/model/useReopenTab.ts == 1; npm run typecheck shows only the 2 pre-existing documented errors"
        status: pass
    human_judgment: false
  - id: D2
    description: "Success path invalidates tabKeys.lists(), paymentKeys.lists(), and auditKeys.all — so a voided payment row's Reopen button hides once the mutation resolves"
    requirement: "SC-1"
    verification:
      - kind: other
        ref: "code inspection of useReopenTab.ts's mutationFn success branch"
        status: pass
    human_judgment: false
  - id: D3
    description: "ReopenTabDialog is a PIN-gated (requiredAction='reopen_tab') reason-only Sheet with no QuantityControl/item-list/add-item code, submitting on manager approval with the tab's current version"
    requirement: "SC-1"
    verification:
      - kind: automated
        ref: "grep -c 'requiredAction=\"reopen_tab\"' src/features/reopen-tab/ui/ReopenTabDialog.tsx == 1; npm run lint clean"
        status: pass
    human_judgment: false
  - id: D4
    description: "PaymentPane shows a Reopen button on non-voided, non-refund payment rows and opens ReopenTabDialog via reopenTarget state; a voided payment (status='reopened_void') hides its Reopen button"
    requirement: "SC-1, SC-3"
    verification:
      - kind: automated
        ref: "grep -c ReopenTabDialog PaymentPane.tsx == 2 (import + mount); grep -c reopened_void == 1 (button gate); npx vitest run src/widgets/PaymentPane — 11/11 pass"
        status: pass
    human_judgment: false
  - id: D5
    description: "reopenTab i18n key group present with identical keys in both es-MX/en-US featOrders.json; paymentPane.reopenTab present in both wPanels.json locales"
    requirement: "SC-1"
    verification:
      - kind: other
        ref: "manual diff of both locale pairs — identical key sets, es-MX genuine Spanish, en-US genuine English per Phase 22/21 precedent"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-07-21
status: complete
---

# Phase 23 Plan 05: Reopen-Tab Feature Slice (useReopenTab + ReopenTabDialog + PaymentPane wiring) Summary

**Built the `useReopenTab` mutation hook, a PIN-gated reason-only `ReopenTabDialog`, and wired a `ReopenTabButton` into PaymentPane's payment-history rows — the SC-1 user entry point for reopening a closed/paid ticket, dropping all item-editor machinery per D-06 since the RPC returns a fully normal open tab.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 3 (as planned)
- **Files created:** 3
- **Files modified:** 5

## Accomplishments

- **`useReopenTab.ts`** wraps `supabase.rpc('reopen_tab', ...)` in `supabaseMutation()` (not a raw `rpc()` call), so `P0V01`/`P0V02` SQLSTATEs auto-map to `STALE_VERSION`/`NOT_FOUND_VERSIONED` via `parseSupabaseError` — the same convention `useEditPaidTab` relies on for the dialog's `handleVersionError()` to work unmodified. Response-body codes (`REOPEN_CAP_EXCEEDED`, `REOPEN_WINDOW_EXPIRED`, `TAB_NOT_REOPENABLE`) are checked on `result.code`, same pattern as `edit_paid_tab`'s `TAB_NOT_EDITABLE`; message-based codes (`NO_OPEN_CAJA`, `AUTH_FORBIDDEN`) are checked on `rpcRes.error.message`. On success, invalidates `tabKeys.lists()`, `paymentKeys.lists()` (so a voided payment row's Reopen button hides), and `auditKeys.all`.
- **`ReopenTabDialog.tsx`** mirrors `EditPaidTabDialog`'s Sheet shell (header/description/footer/`ManagerPinDialog` wiring) but drops every item-override/`QuantityControl`/add-item element — only a reason `Input` and a confirm button gated behind `ManagerPinDialog requiredAction="reopen_tab"`. On PIN success it calls `mutation.mutateAsync` with the loaded tab's current `version`; a `STALE_VERSION`/`NOT_FOUND_VERSIONED` result routes through the shared `handleVersionError()` helper (same `queryKey: tabKeys.detail(tab.id)` wiring as `EditPaidTabDialog`); any other error toasts the mapped message; success toasts and closes.
- **PaymentPane wiring**: a new `ReopenTabButton` (mirroring `EditTicketButton`'s shape) renders in the payment-history row's action cluster, gated to return `null` when `payment.isRefund === true` OR `payment.status === 'reopened_void'` — no per-row tab fetch, since the RPC's own `TAB_NOT_REOPENABLE`/cap/window checks are the authoritative server-side gate. A `reopenTarget` state + mounted `ReopenTabDialog` sit alongside the existing `RefundSheet`/`EditPaidTabDialog` pair.
- **i18n**: `reopenTab` key group (title, description, summary, reasonLabel, reasonPlaceholder, cancel, requestApproval, reopenSuccess, capExceeded, windowExpired, noOpenCaja, authForbidden, notReopenable, genericError) added to both `featOrders.json` locales with identical keys (es-MX genuine Spanish, en-US genuine English, per the Phase 21/22 precedent for phase-native new keys). `paymentPane.reopenTab` added to both `wPanels.json` locales, matching the existing `editTicket` sibling's genuinely-translated convention.

## Task Commits

Each task was committed atomically:

1. **Task 1: useReopenTab mutation hook + barrel** — `1513d64` (feat)
2. **Task 2: ReopenTabDialog (PIN-gated, reason-only) + i18n keys** — `fa7df0c` (feat)
3. **Task 3: Wire ReopenTabButton + ReopenTabDialog into PaymentPane** — `1862288` (feat)

_Note: no separate plan-metadata commit is included in this list; SUMMARY.md/STATE.md/ROADMAP.md commit follows this document._

## Files Created/Modified

- `src/features/reopen-tab/model/useReopenTab.ts` (new) — mutation hook, `ReopenTabInput`/`ReopenTabRpcResult` interfaces
- `src/features/reopen-tab/ui/ReopenTabDialog.tsx` (new) — PIN-gated reason-only Sheet
- `src/features/reopen-tab/index.ts` (new) — barrel exporting the hook + dialog
- `src/widgets/PaymentPane/ui/PaymentPane.tsx` (modified) — `ReopenTabButton`, `reopenTarget` state, mounted `ReopenTabDialog`
- `src/shared/lib/i18n/locales/es-MX/featOrders.json` / `en-US/featOrders.json` (modified) — `reopenTab` key group
- `src/shared/lib/i18n/locales/es-MX/wPanels.json` / `en-US/wPanels.json` (modified) — `paymentPane.reopenTab` label

## Decisions Made

- **`index.ts` was built incrementally across Task 1 and Task 2**, since the plan's frontmatter lists it only under Task 1's `files_modified` but its final content (re-exporting the dialog) depends on Task 2's `ReopenTabDialog.tsx`. Task 1's commit exports only the hook; Task 2's commit amends the barrel to also export the dialog, satisfying Task 3's `import { ReopenTabDialog } from '@features/reopen-tab'`.
- **`ReopenTabButton` takes only a `payment` prop, not a `tab` prop**, per the plan's Task 3 action text ("the tab-status guard is enforced server-side by the RPC's TAB_NOT_REOPENABLE, so the button needs only the payment gate — no per-row tab fetch"). This differs slightly from 23-PATTERNS.md's earlier sketch (which showed a `tab: Tab` prop reading `tab.status`) — the plan's finalized task instructions supersede the pattern-map draft, and were followed as written.
- **Reason field uses `Input`, not a `Textarea`** — no `Textarea` primitive exists in `shared/ui`, and `EditPaidTabDialog`'s own single-line reason field already uses `Input` for the same purpose; reused rather than introducing a new component.

## Deviations from Plan

None requiring Rule 1/2/3/4 action — all three tasks matched their acceptance criteria on the first attempt. The only adjustments (documented above under Decisions Made) were natural consequences of the plan's own task/file sequencing, not corrections to broken or missing behavior.

## Issues Encountered

None. All three tasks' automated verification (grep gates, `npm run typecheck`, `npm run lint`, `npx vitest run src/widgets/PaymentPane`) passed on the first attempt; the full unit suite (140 files / 1258 tests / 15 todo) also passed with zero regressions.

## Auth Gates

None encountered — this plan is entirely client-side feature code, no CLI/service auth required.

## User Setup Required

None.

## Next Phase Readiness

- The reopen-tab feature slice (`useReopenTab`, `ReopenTabDialog`, `ReopenTabButton`) is fully wired and reachable from PaymentPane's payment-history rows for any manager+ staff member.
- Plan 06 (E2E) can now fill in the 3 pending `test.fixme` placeholders in `e2e/48-reopen-closed-ticket.spec.ts` against this real UI: the PIN-gated reopen flow, the bartender-negative case (button/dialog present but RPC's `AUTH_FORBIDDEN` surfaces), and the reopen-cap UI surfacing (`REOPEN_CAP_EXCEEDED` toast).
- No blockers for Plan 06.

---
*Phase: 23-reopen-closed-ticket*
*Completed: 2026-07-21*

## Self-Check: PASSED
All 3 created files (`useReopenTab.ts`, `ReopenTabDialog.tsx`, `index.ts`) verified present; all 3 task commit hashes (`1513d64`, `fa7df0c`, `1862288`) verified present in git log.
