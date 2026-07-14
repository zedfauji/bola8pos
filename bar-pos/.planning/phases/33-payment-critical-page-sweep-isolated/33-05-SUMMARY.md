---
phase: 33-payment-critical-page-sweep-isolated
plan: 05
subsystem: RefundSheet (process-refund feature)
tags: [ui, touch-target, focus-ring, posbutton, refund, manager-pin-gate]
dependency-graph:
  requires: []
  provides:
    - "RefundSheet footer buttons are POSButton (Close refund=outline/large, Request approval=xl/high) per D-03/D-04/D-05"
  affects:
    - "e2e/09-rbac.spec.ts (T-RP-05 refund-blocked-for-bartender check)"
    - "e2e/35-refund.spec.ts"
tech-stack:
  added: []
  patterns:
    - "shadcn Button fully swapped to POSButton (import removed, not just prop-added) — the one file in this phase requiring a full primitive swap"
    - "dead hand-rolled min-h-[56px] removed in favor of touchSize=xl's min-h-[72px] (Pattern D)"
key-files:
  created: []
  modified:
    - src/features/process-refund/ui/RefundSheet.tsx
decisions: []
metrics:
  duration: "~20m (continuation of a prior run that died mid-edit; edit was already complete and uncommitted, this pass verified + committed)"
  completed: 2026-07-13
status: complete
---

# Phase 33 Plan 05: RefundSheet POSButton conversion Summary

Converted both footer buttons in `src/features/process-refund/ui/RefundSheet.tsx` from raw shadcn `Button` to `POSButton`: "Close refund" → `variant="outline" touchSize="large"` (D-04), "Request approval" → `touchSize="xl" focusEmphasis="high"` (D-03 item 2 + D-05), with the dead hand-rolled `min-h-[56px]` removed. Zero prop/handler/validation behavior change (COMPONENT-04).

## What Was Built

One file, one import change, two elements (`src/features/process-refund/ui/RefundSheet.tsx`):

- Import line changed from `import { Button, MoneyDisplay, QuantityControl } from "@shared/ui";` to `import { MoneyDisplay, POSButton, QuantityControl } from "@shared/ui";` — `Button` was used nowhere else in the file, confirmed via grep before removal.
- "Close refund": `<Button variant="outline" className="flex-1" onClick={...}>` → `<POSButton variant="outline" touchSize="large" className="flex-1" onClick={...}>`. `onOpenChange(false)` onClick and the label text kept byte-identical.
- "Request approval": `<Button className="flex-1 min-h-[56px]" disabled={...} onClick={...}>` → `<POSButton touchSize="xl" focusEmphasis="high" className="flex-1" disabled={...} onClick={...}>`. The dead `min-h-[56px]` was deleted (superseded by `touchSize="xl"`'s own `min-h-[72px]`). `disabled={!isValid || mutation.isPending}`, the `setPinOpen(true)` onClick (opens the ManagerPinDialog — does not itself submit the refund), and the label text kept byte-identical.

## Deviations from Plan

None — plan executed exactly as written. (This execution picked up a prior executor's already-completed, uncommitted edit; the diff was inspected against the plan's `acceptance_criteria` and `must_haves.truths` line by line and matched exactly, so no additional code changes were made.)

## Verification

- `grep '<Button' src/features/process-refund/ui/RefundSheet.tsx` — 0 matches. `grep 'min-h-\[56px\]'` — 0 matches. Import line confirmed: `import { MoneyDisplay, POSButton, QuantityControl } from "@shared/ui";`.
- `npm run typecheck` — 2 pre-existing errors in unrelated, untouched files (`src/entities/tab/model/queries.ts(780,11)`, `src/shared/lib/agent/rag.ts(60,7)`) — same errors documented in every prior plan's summary this phase (33-02, 33-03, 33-04). No new errors introduced by this diff.
- `npm run lint` — exits 0 (only pre-existing `eslint-plugin-boundaries` legacy-selector-syntax warnings, unrelated to this diff).
- E2E gate (live `.env.local` creds, real Supabase backend): `npx playwright test e2e/09-rbac.spec.ts e2e/35-refund.spec.ts --retries=0`:
  - `e2e/35-refund.spec.ts` — full pass, 0 failures. Confirms "Request approval" still opens the ManagerPinDialog (does not submit the refund directly) and "Close refund" still closes the sheet.
  - `e2e/09-rbac.spec.ts` — 5 of 23 tests failed (T7 tab deletion, T9 void order, T10 caja PIN visibility, T-RP-01 permission-matrix switch count, T-RP-02 ambiguous switch locator). None of these exercise `RefundSheet.tsx` or `POSButton`. Critically, `T-RP-05` ("process_refund is blocked for bartender at DB level"), the one rbac test that does interact with a refund button via `getByRole('button', { name: /refund/i })`, **passed** — confirming the swapped `POSButton` still exposes the same accessible name/role. The 5 failures are pre-existing environment/test-data drift (documented in `deferred-items.md`), confirmed unrelated to this plan's className/prop-only diff.

## Deferred Items

Logged to `.planning/phases/33-payment-critical-page-sweep-isolated/deferred-items.md` under "Plan 33-05": the 2 pre-existing typecheck errors and the 5 pre-existing `09-rbac.spec.ts` failures, with root-cause notes for a future phase.

## Self-Check: PASSED

- FOUND: src/features/process-refund/ui/RefundSheet.tsx (modified, verified via grep — no `<Button` remains, `POSButton` present on both footer buttons, `min-h-[56px]` absent, import line correct)
- FOUND: commit 88b928f (`git log --oneline -3` confirms it exists on `main`)
