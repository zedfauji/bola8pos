---
phase: 33-payment-critical-page-sweep-isolated
plan: 04
subsystem: PaymentPane (payment-critical widget)
tags: [ui, touch-target, focus-ring, posbutton, payments, card-as-button]
dependency-graph:
  requires: []
  provides:
    - "TabPaymentCard.tsx root is a POSButton variant=\"ghost\" touchSize=\"large\" (D-01/D-04)"
  affects:
    - "e2e/17-payment-pane.spec.ts"
    - "e2e/05-payments.spec.ts"
tech-stack:
  added: []
  patterns:
    - "raw <button>-as-full-width-card converted to POSButton with explicit CVA-override className (justify-start/items-stretch/flex-col/border-border) to preserve pixel parity against the Button base CVA's inline-flex row/center/border-transparent defaults"
    - "dead hand-rolled focus-visible ring removed in favor of the CVA base's own ring (Pattern D)"
key-files:
  created: []
  modified:
    - src/widgets/PaymentPane/ui/TabPaymentCard.tsx
decisions: []
metrics:
  duration: "~25m"
  completed: 2026-07-13
status: complete
---

# Phase 33 Plan 04: TabPaymentCard POSButton conversion (highest visual-risk swap) Summary

Converted the root raw `<button>` in `src/widgets/PaymentPane/ui/TabPaymentCard.tsx` — a full-width, two-row layout card, not a simple label button — to `POSButton variant="ghost" touchSize="large"`, with explicit CVA-override classes to preserve pixel parity, per D-01/D-04/COMPONENT-04.

## What Was Built

One file, one element (`src/widgets/PaymentPane/ui/TabPaymentCard.tsx`):

- Added `POSButton` to the existing `@shared/ui` barrel import (alongside `MoneyDisplay`), matching the file's existing import style.
- Root `<button>` → `<POSButton type="button" variant="ghost" touchSize="large" ...>`. `aria-label={\`tab ${tab.customerName}\`}`, `aria-pressed={selected}`, and `onClick={onClick}` are byte-identical to before. The entire child content tree (name, item count, `MoneyDisplay`, badges row) is untouched.
- `className` reworked to fight the `Button` base CVA (`inline-flex items-center justify-center`, `border-transparent`) which the raw `<button>` never had to contend with:
  - Dropped the hand-rolled `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring` (Pattern D — CVA base already supplies `focus-visible:ring-3 focus-visible:ring-ring/50`).
  - Added `border-border` to override the CVA base's `border-transparent` so the unselected card keeps its visible border (the `selected && 'border-primary ...'` branch already overrode this in the selected case, kept byte-identical).
  - Added `justify-start` and kept `text-left` per the plan's explicit instruction.
  - Kept `w-full rounded-lg border bg-card p-3 transition-colors hover:bg-accent` and the `selected` branch verbatim.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added `flex-col items-stretch` — not called out in the plan's action text, but required for pixel parity**

- **Found during:** Task 1, while tracing the CVA base class chain before editing (this file has two top-level content rows — the name/item-count/`MoneyDisplay` row and the badges row — not the single-child case the plan's action text anticipated).
- **Issue:** `Button`'s base CVA sets `inline-flex` with the CSS default `flex-direction: row`. The plan's instructions covered overriding `justify-center`→`justify-start` (assumed a horizontal-centering fight) and adding `w-full` to a single inner wrapper "if it shrink-wraps." But `TabPaymentCard`'s root has **two** direct-child `<div>`s (the info row and the badges row). Without an explicit `flex-col`, converting the root to a flex container would have placed those two rows **side-by-side** instead of stacked, silently breaking the card's layout — a direct violation of Success Criterion 1 (zero visual change) and the exact risk this plan's `<threat_model>` T-33-04-02 flags.
- **Fix:** Added `flex-col` (restores vertical stacking of the two content rows) and `items-stretch` (overrides the CVA base's `items-center`, which — combined with `flex-col`'s now-horizontal cross-axis — would otherwise horizontally shrink-wrap and center each row's div instead of letting them span the card's full width, as they did under the original block-layout `<button>`).
- **Verification:** `npx vitest run src/widgets/PaymentPane/ui/PaymentPane.test.tsx` (11/11 pass, including the "Timer Running" badge and "Pool #5" badge assertions scoped `within(card)`) plus the live E2E run below, which exercises the rendered card in a real browser.
- **Files modified:** `src/widgets/PaymentPane/ui/TabPaymentCard.tsx` (same file/commit as the plan's primary edit — no separate commit).
- **Commit:** `1ea478c`

## Verification

- `npx vitest run src/widgets/PaymentPane/ui/PaymentPane.test.tsx` — 11/11 passed.
- `npm run typecheck` — 2 pre-existing errors in unrelated files (`src/entities/tab/model/queries.ts`, `src/shared/lib/agent/rag.ts`, both untouched by this plan and not in `git status`), no new errors introduced.
- `npm run lint` — exits 0 (only pre-existing `eslint-plugin-boundaries` config notices, unrelated to this diff).
- `grep '<button' src/widgets/PaymentPane/ui/TabPaymentCard.tsx` — 0 matches. `grep 'focus-visible:ring-2'` — 0 matches. `grep 'border-border\|justify-start'` — both present.
- E2E gate (live `.env.local` creds, real Supabase backend, headed Chromium): `npx playwright test e2e/17-payment-pane.spec.ts e2e/05-payments.spec.ts` — **20/20 passed** in 6.5 minutes, exit code 0. This exercises the converted card end-to-end (tab selection, PIN gate, payment flow, badge rendering) in a real running app, satisfying the plan's mandatory visual/functional verification for the highest-risk file in the phase.

## Self-Check: PASSED

- FOUND: src/widgets/PaymentPane/ui/TabPaymentCard.tsx (modified, verified via grep — no raw `<button` remains, `POSButton variant="ghost" touchSize="large"` present, `border-border`/`justify-start` present, `focus-visible:ring-2` absent)
- FOUND: commit 1ea478c (`git log --oneline -3` confirms it exists on `main`)
