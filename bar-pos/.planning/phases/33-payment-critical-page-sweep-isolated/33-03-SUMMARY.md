---
phase: 33-payment-critical-page-sweep-isolated
plan: 03
subsystem: PaymentModal (payment-critical widget)
tags: [ui, touch-target, focus-ring, posbutton, payments]
dependency-graph:
  requires: []
  provides:
    - "PaymentForm.tsx Process Payment button carries focusEmphasis=\"high\" (72px ring-4)"
    - "PaymentForm.tsx Remove payment N buttons carry touchSize=\"xl\" focusEmphasis=\"high\""
    - "PaymentForm.tsx Reset-to-computed is a POSButton (no raw <button> remains in file)"
  affects:
    - "e2e/05-payments.spec.ts"
    - "e2e/41-split-payment.spec.ts"
    - "e2e/42-tip-distribution.spec.ts"
tech-stack:
  added: []
  patterns:
    - "focusEmphasis=\"high\" prop-only addition on existing POSButton (D-03/D-05 tier)"
    - "raw <button> to POSButton conversion with explicit variant=\"ghost\" to avoid CVA default bg-primary regression (D-03b)"
key-files:
  created: []
  modified:
    - src/widgets/PaymentModal/ui/PaymentForm.tsx
decisions: []
metrics:
  duration: "~35m"
  completed: 2026-07-13
status: complete
---

# Phase 33 Plan 03: PaymentForm 72px/high-ring standardization Summary

Applied the D-03/D-04/D-05 tier rules to the three in-scope elements in `src/widgets/PaymentModal/ui/PaymentForm.tsx` — the primary money-commit surface — with zero prop/handler/validation behavior change.

## What Was Built

Three markup/class-only edits to `src/widgets/PaymentModal/ui/PaymentForm.tsx`:

1. **Process Payment / Process split payment** (~L1000-1021): added `focusEmphasis="high"` to the existing `POSButton touchSize="xl"`. `disabled` expression, `className="w-full bg-[var(--pos-accent)] ..."`, `onClick`, and the computed `primaryLabel` child are byte-identical to before.
2. **Remove payment N** (~L721-732): added `touchSize="xl" focusEmphasis="high"` to the existing `POSButton variant="ghost"`. `aria-label={\`Remove payment ${String(index + 1)}\`}`, `disabled={isProcessing}`, `className="px-2 text-destructive"`, the `REMOVE_ROW` onClick, and the `Trash2` child are preserved verbatim.
3. **Reset to computed** (~L954-963): converted the raw `<button>` to `<POSButton variant="ghost" touchSize="default">`, per D-01/D-03b (explicit `variant="ghost"` prevents the CVA default `bg-primary` from silently changing this transparent text-link's appearance). `type="button"`, `data-testid="card-override-reset"`, `className="text-xs text-muted-foreground underline"`, the `onClick` calling `setCardChargeOverride(null)`, and the computed label text are preserved verbatim.

No other line in the file changed — Cancel (`touchSize="large"`, no `focusEmphasis`), tip-preset buttons, discount selectors, and payment-method selectors were left untouched per the plan's explicit exclusion list.

## Verification

- `npx vitest run src/widgets/PaymentModal/ui/PaymentForm.test.tsx` — 20/20 passed (card-override-reset testid + Remove payment N accessible-name assertions green).
- `npm run typecheck` — 2 pre-existing errors in unrelated files (`src/entities/tab/model/queries.ts`, `src/shared/lib/agent/rag.ts`), neither touched by this plan; no new errors introduced. See Deferred Issues.
- `npm run lint` — exits 0 (no new warnings; only pre-existing eslint-plugin-boundaries config notices unrelated to this diff).
- `grep '<button' src/widgets/PaymentModal/ui/PaymentForm.tsx` — 0 matches (raw button fully eliminated from the file).
- E2E gate (live `.env.local` creds): `npx playwright test e2e/05-payments.spec.ts e2e/41-split-payment.spec.ts e2e/42-tip-distribution.spec.ts` — ran twice as a batch; individual tests were re-run in isolation with `--retries=0` to distinguish real regressions from shared-backend flakiness:
  - `41-split-payment.spec.ts` T2 and `05-payments.spec.ts` T8: failed once in the combined batch run, passed cleanly in isolation — consistent with live-Supabase test-data collisions across specs run back-to-back, not a regression from this plan's className/prop-only diff.
  - `42-tip-distribution.spec.ts` T1: fails even in isolation, but the failure is a stall on Settings → Tab Split's "Save Tip Split" disabled button — entirely inside `TipDistributionSettingsTab.tsx`, a file never touched by this plan. Confirmed pre-existing/unrelated; logged to `deferred-items.md`.
  - All other tests across the three specs passed in isolation.

## Deviations from Plan

None — plan executed exactly as written. The three edits match the plan's `<action>` block verbatim.

## Deferred Issues (out of scope, logged to `deferred-items.md`)

- Two pre-existing typecheck errors in files not modified by this plan (documented since Phase 32-01).
- `e2e/42-tip-distribution.spec.ts` T1's Settings → Tip Split "Save Tip Split" disabled-button stall — pre-existing bug unrelated to `PaymentForm.tsx`, flagged for a future bug-fix task.
- Shared-backend E2E flakiness (`41-split-payment.spec.ts` T2, `05-payments.spec.ts` T8) when specs run in the same batch against the live Supabase instance — both pass individually.

## Self-Check: PASSED

- FOUND: src/widgets/PaymentModal/ui/PaymentForm.tsx (modified, verified via grep — no raw `<button` remains, `focusEmphasis="high"` present at 2 sites, `card-override-reset` testid intact)
- FOUND: commit 46f1ae1 (`git log --oneline -3` confirms it exists on `main`)
