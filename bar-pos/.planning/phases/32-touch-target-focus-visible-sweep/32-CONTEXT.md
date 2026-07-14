# Phase 32: Touch Target & Focus-Visible Sweep - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Every interactive element on the 6 operational/realtime pages — pool-tables, pool-table-status, inventory, kitchen-prep, kds, kds-bar — meets a 44px minimum touch target (56px/72px for frequent/critical actions), adjacent tappable elements maintain adequate spacing, and all interactive elements show a visible focus-visible state (with primary/critical actions getting a higher-contrast ring). Sizing/contrast-only changes — no control reordering. Payment-critical pages are explicitly out of scope (Phase 33).

</domain>

<decisions>
## Implementation Decisions

### Touch-target sizing rollout (TOUCH-01/TOUCH-02)
- **D-01:** Every raw shadcn `Button`/icon-button instance on the 6 in-scope pages gets bumped to a minimum 44px touch target (`POSButton touchSize="default"` or equivalent `min-h-[44px]`) — no exceptions, including icon-only buttons and controls inside dense tables/lists (e.g. `InventoryPagePanel`'s DataTable row actions).
- **D-02:** `PoolTableGrid` (`src/widgets/PoolTableGrid/index.tsx`) mixes `POSButton` and plain `Button` today (line 120 uses raw `Button`) — that raw `Button` gets converted to `POSButton` per D-01.
- **D-03:** Only truly destructive/irreversible actions get the 72px (`xl`) size: void/cancel pool session, stop-and-move table. ("Delete inventory batch" was dropped — not a shipped feature; no delete-batch UI exists anywhere in `src/`. It was a discuss-phase example option, not a verified target. Belongs to a future milestone if/when built.) Everything else that's a frequent/primary action (add stock, notify waitlist, seat party, start timer, save prep batch, bump KDS order) gets 56px (`large`). Controls that are neither critical nor a primary/frequent action stay at the 44px floor.
- **D-04:** No control-specific exceptions — the planner does not need to hunt for a fixed-layout constraint that blocks growing a control; none was flagged.

### Grid/stepper spacing (TOUCH-03)
- **D-05:** No literal +/- stepper controls exist on the 6 in-scope pages (inventory's batch-delta field, `InventoryPagePanel.tsx:353`, is a plain signed number input per Phase 31's D-06, not stepper buttons). TOUCH-03 for this phase is a **grid-gap audit**, not a stepper-spacing fix.
- **D-06:** Enforce an 8px minimum gap between adjacent tappable cards/buttons in `PoolTableGrid` (currently `gap-4` / 16px at `src/widgets/PoolTableGrid/index.tsx:159,173` — already passes, verify not regress), the KDS/`kds-bar` order-card grids, and the kitchen-prep batch grid.
- **D-07:** Include KDS/`kds-bar` per-card action buttons (Start/Ready/Bump-style) in the spacing check even though they're expected to already be stacked/full-width — verify with the actual markup, don't assume compliance.

### Focus ring escalation (FOCUS-01/FOCUS-02)
- **D-08:** FOCUS-01 (baseline visible focus-visible state) is already satisfied app-wide by `src/shared/ui/button.tsx`'s CVA base classes (`focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50`) — no work needed for the baseline case, only verify it survives the touch-sizing className changes.
- **D-09:** For FOCUS-02, add a `focusEmphasis="high"` prop to the **base** `src/shared/ui/button.tsx` CVA variants (not just `POSButton`) that swaps the focus ring from `focus-visible:ring-3 focus-visible:ring-ring/50` to `focus-visible:ring-4 focus-visible:ring-ring` (full opacity, +1px width). It's a shared Button prop so future phases can reuse it, even though Phase 32 only wires it up on the 3 controls below.
- **D-10:** Apply `focusEmphasis="high"` to the **same set** identified as 72px-critical in D-03: void/cancel pool session, stop-and-move table (2 targets — "delete inventory batch" dropped, see D-03). No broader set (no "also every primary confirm button") — keep the emphasized ring reserved for genuinely destructive/high-stakes actions.

### Tab order verification (FOCUS-03)
- **D-11:** PINKeypad/SearchInput barely intersect these 6 pages directly: `PINKeypad` only appears indirectly via `ManagerPinDialog` (`src/features/manager-pin-gate/ui/ManagerPinDialog.tsx`), which is used from `TableStatusPanel` (`src/widgets/TableStatusPanel/index.tsx`) for PIN-gated actions; `SearchInput` only appears via `DataTable` (`src/shared/ui/DataTable.tsx`), which inventory's page/panel likely uses for its search/filter row.
- **D-12:** FOCUS-03 scope for this phase = verify keyboard tab order through: (a) `ManagerPinDialog`'s PIN entry flow as reached from `TableStatusPanel`, (b) inventory's `DataTable` search/filter row, and (c) any other form inputs on inventory/kitchen-prep (e.g. batch qty, adjustment-reason fields). Not a blanket sweep of every input on every page beyond these named surfaces.
- **D-13:** Verification method is an **automated Playwright test**, not manual click-through-and-document. Add a new spec file `e2e/44-focus-tab-order.spec.ts` (renumbered from originally-proposed `43` — that number is already taken by `e2e/43-promotions.spec.ts`) asserting Tab-key focus order matches visual order through the surfaces named in D-12. This becomes part of the permanent e2e suite (add to the 22-spec list in `CLAUDE.md` §E2E Test Suite once created).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` §Touch, §Focus — TOUCH-01, TOUCH-02, TOUCH-03, FOCUS-01, FOCUS-02, FOCUS-03 full text
- `.planning/ROADMAP.md` — Phase 32 goal/success criteria; Phase 33's payment-critical scope boundary (this phase explicitly excludes payment pages)

### Prior phase precedent
- `.planning/phases/31-component-token-spacing-consistency-sweep/31-CONTEXT.md` D-06 — confirms `InventoryPagePanel`'s batch-delta field is a plain signed number input, not a stepper (informs D-05)
- `.planning/phases/30-shared-shell-primitive-extension/30-CONTEXT.md` — `PageContainer`/shell conventions these pages already use; touch-target changes must not disturb the shell layout established there

### Code — components being extended
- `src/shared/ui/POSButton.tsx` — already has `touchSize` prop (`default`=44px, `large`=56px, `xl`=72px); target for D-01/D-02/D-03 conversions
- `src/shared/ui/button.tsx` — base `Button` CVA; target for the new `focusEmphasis` prop (D-09) and current default focus-ring classes (D-08)
- `src/features/manager-pin-gate/ui/ManagerPinDialog.tsx`, `src/shared/ui/PINKeypad.tsx` — tab-order target (D-11/D-12)
- `src/shared/ui/DataTable.tsx`, `src/shared/ui/SearchInput.tsx` — tab-order target (D-11/D-12)

### Code — in-scope pages/widgets
- `src/widgets/PoolTableGrid/index.tsx` — mixed `POSButton`/`Button` usage (D-02), grid gap at lines 159/173 (D-06)
- `src/widgets/TableStatusPanel/index.tsx` — hosts `ManagerPinDialog` (D-11)
- `src/pages/inventory/index.tsx`, `src/widgets/InventoryPagePanel.tsx` — batch-delta field (D-05), DataTable search (D-11)
- `src/pages/kitchen-prep/`, `src/features/produce-prep-batch/ui/PrepBatchPreview.tsx`, `PrepProductionForm.tsx` — kitchen-prep grid (D-06)
- `src/pages/kds/`, `src/pages/kds-bar/` — order-card action buttons (D-07)

### E2E
- `bar-pos/e2e/` — existing 22-spec suite; new spec `e2e/43-focus-tab-order.spec.ts` (D-13) follows the numbered-spec convention (`CLAUDE.md` §E2E Test Suite)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `POSButton` (`touchSize`: default/large/xl) — already implements the exact 44/56/72px scale TOUCH-01/02 require; this phase is a rollout/conversion task, not new component work
- `src/shared/ui/button.tsx`'s CVA `focus-visible:ring-3 focus-visible:ring-ring/50` baseline — already satisfies FOCUS-01 app-wide

### Established Patterns
- `--ring` design token defined in `src/app/globals.css` (`oklch(...)`, light/dark variants) — the emphasized ring (D-09) should reuse this token at full opacity, not introduce a new color
- Grid layouts in scope already use Tailwind `gap-*` utilities (`PoolTableGrid` at `gap-4`) — spacing check is a verify-or-bump pass on existing gap classes, not a new spacing system

### Integration Points
- `ManagerPinDialog` is the shared PIN-gate surface reused across the app (also used by `clock-in-staff`, `PINLoginForm`) — the tab-order fix here, if it touches `ManagerPinDialog`/`PINKeypad` itself rather than just `TableStatusPanel`'s usage, affects other pages too; flag this to the planner as a possible ripple effect worth a full-repo check before landing.

</code_context>

<specifics>
## Specific Ideas

No visual redesign — this is a sizing/spacing/focus-ring pass on existing components. No new component work beyond the `focusEmphasis` prop addition to `Button`.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 32-Touch Target & Focus-Visible Sweep*
*Context gathered: 2026-07-13*
