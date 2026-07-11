# Phase 31: Component, Token & Spacing Consistency Sweep - Context

**Gathered:** 2026-07-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Sweep non-payment pages (login, home, settings, staff, rbac, audit, waitlist, rappi, reports, pool-tables, inventory, kitchen-prep, kds, kds-bar) plus non-payment-critical global chrome to: replace raw `<button>` with `POSButton`, replace raw form inputs with the correct `shared/ui` primitive (with documented type-based opt-outs), remove any remaining duplicate one-off primitives, and eliminate hardcoded theme hex/rgb colors and arbitrary-value spacing classes — all markup/class-level only, proving the fix pattern before Phase 33 touches payment-critical surfaces.

</domain>

<decisions>
## Implementation Decisions

### Payment-adjacent file boundary (COMPONENT-01/02)
- **D-01:** `src/pages/pos/index.tsx`, `src/widgets/OrderPanel/CartPanel.tsx`, `src/widgets/PaymentModal/ui/PaymentForm.tsx`, `src/widgets/PaymentPane/ui/TabPaymentCard.tsx` are OUT of scope for Phase 31 — deferred to Phase 33 (payment-critical sweep, COMPONENT-04). These are reachable only from the POS/payment checkout flow.
- **D-02:** `src/features/split-tab/ui/SplitTabSheet.tsx` (3 raw buttons) IS in scope for Phase 31, despite being reached from `OrderPanel`. It's tab-splitting UI, not a money-movement surface — COMPONENT-04 names only POS/payments/split-payment/refund/tip-distribution, not split-tab.
- **D-03:** `src/features/agent-chat/ui/AgentButton.tsx`, `CommandChips.tsx`, `FileDropZone.tsx` ARE in scope for Phase 31, even though `AgentButton` mounts globally in `router.tsx` and renders on every route including `/pos` and `/payments`. It's floating chat chrome with zero payment logic — markup-only swap is zero-risk regardless of which route it renders on.

### Non-text raw `<input>` handling (COMPONENT-02)
- **D-04:** The 2 raw `type="checkbox"` inputs (`ModifierGroupEditor.tsx:255,336`, `HardwareSettingsTab.tsx:147`) get swapped to the real `src/shared/ui/checkbox.tsx` primitive (currently unused — exists but not wired in).
- **D-05:** The 4 raw `type="color"/"time"` inputs (`CategoryTreeEditor.tsx:84`, `CategoryForm.tsx:135`, `ComboAvailabilityEditor.tsx:113,125`) and the 2 raw `type="date"` inputs (`AuditLogFilterBar.tsx:139,149`) get wrapped in `FormField` for label consistency, but the native `<input type=color/time/date>` stays — no shared primitive exists for these types.
- **D-06:** `InventoryPagePanel.tsx:353` (`type="number"`, `id="batch-delta"`) is a signed quantity-delta field (can go negative) — same shape as Phase 17's modifier-delta opt-out. Wrap in `FormField`, keep the native number input (not `MoneyInput` — it's a quantity, not currency, and MoneyInput likely clamps/formats as currency).
- **D-07:** `LogoUploader.tsx:77` (`type="file"`) stays untouched — no shared file-input primitive exists and file inputs aren't a component-drift concern.

### Hardcoded color exemption (TOKEN-01)
- **D-08:** `CategoryTreeEditor.tsx:465` (`'#6366f1'`), `CategoryForm.tsx:33,151` (`'#6B7280'`), and `ModifierSheet.tsx:22` (`'#808080'` fallback) are EXEMPT from TOKEN-01. These are `category.color` — arbitrary per-row **user data** (each category picks its own color, stored in the DB), not app theme colors. Forcing them onto a Tailwind CSS-variable token would collapse category-color variety to the fixed theme palette, breaking the feature. Document this exemption inline (comment) at each site so a future drift-lint (Phase 35) doesn't re-flag it.

### Component-03 (duplicate primitives)
- **D-09:** No live duplicate-primitive candidates remain as of this discussion — Phase 30 already removed `BackToHomeButton`/`AppShell`/`AppNav`. If the planner's own scan turns up a new one, treat it as in-scope under COMPONENT-03; none is pre-identified here.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Audit input (source of truth for file list)
- `.planning/phases/29-ui-drift-audit/DRIFT-AUDIT.md` — full file-mapped inventory (20 raw-button files, 8 raw-input files, 3 hardcoded-hex files, 0 arbitrary-spacing files) that this phase's scope is drawn from
- `.planning/phases/29-ui-drift-audit/29-CONTEXT.md` — audit script scope decisions (D-04/D-05: spacing scan = spacing-only, `shared/ui` excluded from scans)

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` §Token, §Component — TOKEN-01, TOKEN-02, COMPONENT-01, COMPONENT-02, COMPONENT-03 full text; COMPONENT-04 (Phase 33's payment-critical zero-behavior-change requirement, referenced by D-01/D-02 above)
- `.planning/ROADMAP.md` — Phase 31 goal/success criteria; Phase 33's named payment-critical surface list (POS, payments, split-payment, refund, tip-distribution) used to draw the D-01/D-02 boundary

### Prior phase precedent
- `.planning/phases/17-modifier-inventory-rules/17-UI-SPEC.md` — the signed-delta/no-`MoneyInput` opt-out precedent applied to D-06
- `.planning/phases/30-shared-shell-primitive-extension/30-05-SUMMARY.md` — confirms `AppShell`/`AppNav`/`BackToHomeButton` already deleted (informs D-09)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/shared/ui/checkbox.tsx` — exists, currently unused anywhere in the app; target for D-04
- `src/shared/ui/FormField.tsx` — existing label-wrapper primitive, used elsewhere (e.g. `ModifierGroupEditor.tsx`'s `maxSelect` field); target wrapper for D-05/D-06
- `src/shared/ui/POSButton.tsx` — target replacement for all in-scope raw `<button>` elements

### Established Patterns
- Phase 17 already established the precedent that a signed/negative-allowed numeric field can legitimately skip `MoneyInput` and stay a plain labeled input — D-06 follows this exactly.
- `scripts/audit-ui-drift.ts` (Phase 29) already excludes `shared/ui/` from all scans — no risk of the sweep touching primitive source files.

### Integration Points
- `src/app/router.tsx` mounts `<AgentButton />` globally — confirms D-03's "renders on every route" claim; the fix here is isolated to `AgentButton.tsx`/`CommandChips.tsx`/`FileDropZone.tsx` internals, no router change needed.

</code_context>

<specifics>
## Specific Ideas

No UI-flow or visual-design changes requested — this is a like-for-like markup/token swap. No specific look-and-feel preferences beyond "use what already exists in `shared/ui`."

</specifics>

<deferred>
## Deferred Ideas

- `src/pages/pos/index.tsx`, `src/widgets/OrderPanel/CartPanel.tsx`, `src/widgets/PaymentModal/ui/PaymentForm.tsx`, `src/widgets/PaymentPane/ui/TabPaymentCard.tsx` raw-button fixes — belongs to Phase 33 (payment-critical sweep), per D-01.

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 31-Component, Token & Spacing Consistency Sweep*
*Context gathered: 2026-07-11*
