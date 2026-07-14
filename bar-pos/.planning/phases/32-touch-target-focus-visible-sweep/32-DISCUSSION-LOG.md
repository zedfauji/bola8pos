# Phase 32: Touch Target & Focus-Visible Sweep - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-13
**Phase:** 32-Touch Target & Focus-Visible Sweep
**Areas discussed:** Touch-target sizing rollout, Grid/stepper spacing (TOUCH-03), Focus ring escalation (FOCUS-02), Tab order verification (FOCUS-03)

---

## Touch-target sizing rollout

| Option | Description | Selected |
|--------|-------------|----------|
| All interactive controls → min 44px (default) | Every raw Button/icon-button on the 6 pages gets a 44px floor; frequent/critical actions bumped further per TOUCH-02 | ✓ |
| Only tap-heavy controls, leave rare ones alone | Bump grid/card taps and frequent actions; leave rarely-used icon buttons at current size | |
| You decide per-control during planning | No blanket rule, planner applies judgment | |

**User's choice:** All interactive controls → min 44px (default)

| Option | Description | Selected |
|--------|-------------|----------|
| Only truly destructive/irreversible actions | 72px reserved for void/cancel session, stop-and-move table, delete inventory batch | ✓ |
| Also include primary confirm actions | 72px for destructive AND main confirm action per page | |
| You decide per-control during planning | No blanket rule | |

**User's choice:** Only truly destructive/irreversible actions

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, same 44px floor applies | Icon-only controls are interactive elements too, no exception | ✓ |
| Exempt icon buttons inside dense tables/lists | Table row actions stay compact | |

**User's choice:** Yes, same 44px floor applies

| Option | Description | Selected |
|--------|-------------|----------|
| No exceptions — apply the rule everywhere in scope | | ✓ |
| Let me describe one | | |

**User's choice:** No exceptions
**Notes:** PoolTableGrid's mixed POSButton/Button usage (raw Button at line 120) called out explicitly as needing conversion.

---

## Grid/stepper spacing (TOUCH-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Verify grid gaps only, set 8px floor | No stepper controls exist on these pages; audit PoolTableGrid/KDS/kitchen-prep grid gaps for an 8px minimum | ✓ |
| Let me point out a stepper control | | |

**User's choice:** Verify grid gaps only, set 8px floor

| Option | Description | Selected |
|--------|-------------|----------|
| Include KDS/kds-bar card action buttons in the spacing check | Treat like PoolTableGrid, verify adjacent buttons meet the gap floor | ✓ |
| Skip — they're already stacked/full-width | | |

**User's choice:** Include KDS/kds-bar card action buttons in the spacing check
**Notes:** Verify actual markup rather than assuming compliance.

---

## Focus ring escalation (FOCUS-02)

| Option | Description | Selected |
|--------|-------------|----------|
| New POSButton/Button variant prop | e.g. focusEmphasis='high' — explicit, opt-in per instance | ✓ |
| Tie it to variant='default' automatically | Affects all default-variant buttons app-wide | |

**User's choice:** New POSButton/Button variant prop

| Option | Description | Selected |
|--------|-------------|----------|
| Same set as the 72px critical actions | Reuse the touch-sizing critical list 1:1 | ✓ |
| Broader: critical actions + main per-page confirm action | | |

**User's choice:** Same set as the 72px critical actions

| Option | Description | Selected |
|--------|-------------|----------|
| ring-4 ring-ring (full opacity, +1px width) | Clearly distinguishable bump | ✓ |
| Keep ring-3 width, just full opacity | Smaller visual change | |

**User's choice:** ring-4 ring-ring (full opacity, +1px width)

| Option | Description | Selected |
|--------|-------------|----------|
| focusEmphasis='high' on POSButton only | Scoped to POSButton | |
| Add to base Button too (shared prop) | More reusable for future phases | ✓ |

**User's choice:** Add to base Button too (shared prop)

---

## Tab order verification (FOCUS-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Cover ManagerPinDialog + inventory DataTable search, plus any forms on these pages | Verify tab order through the named surfaces specifically | ✓ |
| Just do a general tab-order pass on all forms in the 6 pages | Broader, less targeted | |

**User's choice:** Cover ManagerPinDialog + inventory DataTable search, plus any forms on these pages

| Option | Description | Selected |
|--------|-------------|----------|
| Manual verification during planning/execution, documented in PLAN.md | No new test written | |
| Add a lightweight Playwright keyboard-nav test | New e2e assertion(s), catches regressions | ✓ |

**User's choice:** Add a lightweight Playwright keyboard-nav test

| Option | Description | Selected |
|--------|-------------|----------|
| New spec file, e.g. e2e/43-focus-tab-order.spec.ts | Dedicated, isolated spec | ✓ |
| Add cases into existing specs (10-inventory, 16-table-status) | Extend existing coverage | |

**User's choice:** New spec file, e2e/43-focus-tab-order.spec.ts

| Option | Description | Selected |
|--------|-------------|----------|
| No, that covers it | | ✓ |
| Let me describe one | | |

**User's choice:** No, that covers it

---

## Claude's Discretion

None — every area reached an explicit user decision.

## Deferred Ideas

None — discussion stayed within phase scope.
