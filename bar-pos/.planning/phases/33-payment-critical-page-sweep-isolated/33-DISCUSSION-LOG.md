# Phase 33: Payment-Critical Page Sweep (Isolated) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-13
**Phase:** 33-Payment-Critical Page Sweep (Isolated)
**Areas discussed:** Touch-target tier assignment, Focus-ring emphasis scope, File scope beyond the drift audit, PR/commit sequencing

---

## Touch-target tier assignment — Process Payment tier

| Option | Description | Selected |
|--------|-------------|----------|
| 56px (large) — match Phase 32 rule exactly | Process Payment isn't destructive/irreversible in the void/refund sense; stays consistent with D-03's "only void/refund/delete-leg get 72px" rule | |
| 72px (xl) — elevate it | Committing a real payment is higher-stakes than a pool-table void; treat it as critical regardless of the destructive/irreversible framing | ✓ |

**User's choice:** 72px (xl) — elevate it
**Notes:** Establishes that this phase widens Phase 32's "destructive-only" 72px rule to also include money-commit actions.

---

## Touch-target tier assignment — remaining 72px set

| Option | Description | Selected |
|--------|-------------|----------|
| Refund confirm (RefundSheet.tsx) | Irreversible money-out action, same class as void/stop-session in Phase 32 | ✓ |
| Void order confirm | Irreversible order cancellation — matches Phase 32's void/cancel precedent directly | ✓ |
| Split-payment final confirm (submit all legs) | Commits the split transaction — same money-commit class as Process Payment | ✓ |
| Remove split-tab line item / leg | Reversible before final submit (can re-add), lower stakes than the above | ✓ |

**User's choice:** All four selected (multiSelect)
**Notes:** Final 72px set = Process Payment + Refund confirm + Void confirm + Split-final-confirm + Remove split-leg (5 actions total).

---

## Focus-ring emphasis scope

| Option | Description | Selected |
|--------|-------------|----------|
| Match the 72px set exactly | Same 5 actions get both 72px size AND emphasized ring — keeps critical-tier sizing and focus treatment in lockstep | ✓ |
| Destructive-only subset | Only Refund confirm, Void confirm, Remove split-leg get focusEmphasis="high"; Process Payment and Split-final-confirm keep default ring | |

**User's choice:** Match the 72px set exactly
**Notes:** No separate narrower ring rule — sizing and focus emphasis stay in lockstep for this phase.

---

## File scope beyond the drift audit

| Option | Description | Selected |
|--------|-------------|----------|
| 5 files | 4 audit-flagged raw-button files + RefundSheet.tsx (raw Button → POSButton). TabDrawer/TipDistributionPanel excluded. | |
| Broader — also sweep split-tab confirm/submit buttons | Add SplitTabSheet.tsx explicitly to wire touchSize/focusEmphasis tiers for split-final-confirm and remove-leg actions decided above | ✓ |

**User's choice:** Broader — also sweep split-tab confirm/submit buttons
**Notes:** Final file scope = 6 files (pos/index.tsx, CartPanel.tsx, PaymentForm.tsx, TabPaymentCard.tsx, RefundSheet.tsx, SplitTabSheet.tsx).

---

## PR/commit sequencing

| Option | Description | Selected |
|--------|-------------|----------|
| Planner's discretion | No preference — let the planner sequence by dependency/risk | ✓ |
| Lowest-risk first: POS → CartPanel → PaymentForm/TabPaymentCard → SplitTabSheet → RefundSheet last | Refund is highest-stakes/least-tested surface — land it last after the pattern is proven | |

**User's choice:** Planner's discretion
**Notes:** Roadmap already locks "one page/widget per PR, isolated commits" — order is not user-constrained.

---

## Claude's Discretion

- Exact ordering of the isolated PRs within Wave planning.
- Whether shared Button/POSButton prop work (if any additional prop is needed) lands as its own preliminary commit or inline with the first widget PR.

## Deferred Ideas

None — discussion stayed within phase scope.
