# Phase 31: Component, Token & Spacing Consistency Sweep - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-11
**Phase:** 31-component-token-spacing-consistency-sweep
**Areas discussed:** Payment scope, Global chrome, Input types, Color defaults

---

## Payment scope

| Option | Description | Selected |
|--------|-------------|----------|
| Defer all 5 to Phase 33 | Exclude CartPanel, pos/index.tsx, PaymentForm, TabPaymentCard, SplitTabSheet entirely from Phase 31 | |
| Defer 4, sweep SplitTabSheet now | SplitTabSheet is tab-splitting UI, not a money-movement surface — sweep its 3 raw buttons now, defer only the 4 truly payment-page files | ✓ |

**User's choice:** Defer 4, sweep SplitTabSheet now
**Notes:** COMPONENT-04 only names POS/payments/split-payment/refund/tip-distribution as payment-critical; split-tab isn't on that list.

---

## Global chrome

| Option | Description | Selected |
|--------|-------------|----------|
| Sweep now | AgentButton/CommandChips/FileDropZone are floating chat chrome with no payment logic — markup-only swap is zero-risk regardless of route | ✓ |
| Defer to Phase 33 | Hold back with the payment-critical batch since it renders on payment pages too | |

**User's choice:** Sweep now
**Notes:** No payment logic in agent-chat feature; swap is risk-free.

---

## Input types

| Option | Description | Selected |
|--------|-------------|----------|
| Swap checkboxes, wrap rest in FormField, keep native color/time/date/number | Checkboxes get shared/ui/checkbox.tsx; color/time/date/number wrapped in FormField but stay native — same opt-out precedent as Phase 17 | ✓ |
| Checkboxes only, leave everything else untouched | Only touch checkbox inputs, treat rest as fully out of scope | |

**User's choice:** Swap checkboxes, wrap rest in FormField, keep native color/time/date/number
**Notes:** No shared primitive exists for color/time/date/number types; FormField gives label consistency without inventing new primitives.

---

## Color defaults

| Option | Description | Selected |
|--------|-------------|----------|
| Exempt — document as data, not theme | category.color is per-row user data, not app theme — forcing onto a token would collapse category-color variety | ✓ |
| Force onto nearest Tailwind token | Replace all 3 defaults with an existing CSS-variable token | |

**User's choice:** Exempt — document as data, not theme
**Notes:** Applies to CategoryTreeEditor.tsx:465, CategoryForm.tsx:33/151, ModifierSheet.tsx:22.

---

## Claude's Discretion

None — all four areas resolved with explicit user selection.

## Deferred Ideas

- `src/pages/pos/index.tsx`, `src/widgets/OrderPanel/CartPanel.tsx`, `src/widgets/PaymentModal/ui/PaymentForm.tsx`, `src/widgets/PaymentPane/ui/TabPaymentCard.tsx` raw-button fixes — Phase 33.
