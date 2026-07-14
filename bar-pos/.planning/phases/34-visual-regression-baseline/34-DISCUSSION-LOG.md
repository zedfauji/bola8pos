# Phase 34: Visual Regression Baseline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-14
**Phase:** 34-visual-regression-baseline
**Areas discussed:** Config isolation & CI gate, Route coverage & seeding, Dynamic region masking, Baseline storage & naming

---

## Config isolation & CI gate

| Option | Description | Selected |
|--------|-------------|----------|
| New file `playwright.visual.config.ts` | Fully isolated, own testDir, run via --config | ✓ |
| Second project in existing `playwright.config.ts` | Single config file, projects array | |

**User's choice:** New file `playwright.visual.config.ts`
**Notes:** Recommended option, matches ROADMAP wording "second Playwright config."

| Option | Description | Selected |
|--------|-------------|----------|
| Manual-only, local/pinned-container | Matches research SUMMARY.md default; CI has zero E2E today | ✓ |
| Add as CI gate now | New GitHub Actions job on PRs | |

**User's choice:** Manual-only, local/pinned-container

| Option | Description | Selected |
|--------|-------------|----------|
| `test:e2e:visual` | Matches existing `test:e2e` naming pattern | ✓ |
| `test:visual` | Shorter, breaks naming pattern | |

**User's choice:** `test:e2e:visual`

---

## Route coverage & seeding

| Option | Description | Selected |
|--------|-------------|----------|
| admin only | One login covers all 17 routes | |
| Multiple roles | admin + bartender/manager for their views | ✓ |

**User's choice:** Multiple roles

| Option | Description | Selected |
|--------|-------------|----------|
| First seeded table from setup:dev | Same approach as 16-table-status.spec.ts | ✓ |
| Hardcode a known UUID | Brittle if seed data changes | |

**User's choice:** First seeded table from setup:dev

| Option | Description | Selected |
|--------|-------------|----------|
| Admin-reachable only, 17 total | Matches ROADMAP's 17-route criterion | |
| Also capture 403/redirect states for other roles | Adds access-denied UI baselines | ✓ |

**User's choice:** Also capture 403/redirect states for other roles

**Follow-up 1 — role split:**

| Option | Description | Selected |
|--------|-------------|----------|
| Admin=all 17, bartender/manager=only their own accessible subset | Admin covers ROADMAP criterion; role-specific baselines catch nav differences | ✓ |
| All 3 roles snapshot all 17 routes each | 51 baselines, triples runtime | |

**User's choice:** Admin=all 17, bartender/manager=own subset

**Follow-up 2 — 403 scope:**

| Option | Description | Selected |
|--------|-------------|----------|
| Defer — note as backlog idea | Keep Phase 34 focused on the 17-route criterion | |
| Include now | Add access-denied/redirect screenshots this phase | ✓ |

**User's choice:** Include now
**Notes:** User explicitly overrode the "defer" recommendation — wants 403/redirect states captured within Phase 34, not pushed to backlog.

---

## Dynamic region masking

| Option | Description | Selected |
|--------|-------------|----------|
| Playwright `mask: []` locators | Solid box over dynamic elements, rest of page diffable | ✓ |
| Exclude routes/panels entirely | Skip kds/kds-bar and timer regions | |

**User's choice:** Playwright `mask: []` locators

| Option | Description | Selected |
|--------|-------------|----------|
| Seed idle/no-session table | Simplest, no timer text at all | |
| Start a session and mask the timer region | Captures "occupied" visual state too, timer masked | ✓ |

**User's choice:** Start a session and mask the timer region

| Option | Description | Selected |
|--------|-------------|----------|
| Don't trigger any toasts — navigate cold | No action triggers a toast | |
| Trigger + mask toast region defensively | Mask toast container as safety net even though none should appear | ✓ |

**User's choice:** Trigger + mask toast region defensively

---

## Baseline storage & naming

| Option | Description | Selected |
|--------|-------------|----------|
| `e2e/visual/45-visual-baseline.spec.ts` | New subfolder, 45 is next free number after 44-focus-tab-order | ✓ |
| `e2e/45-visual-baseline.spec.ts` | Flat, same dir as functional specs | |

**User's choice:** `e2e/visual/45-visual-baseline.spec.ts`

| Option | Description | Selected |
|--------|-------------|----------|
| Commit to git | Baselines are the deliverable, must be shared | |
| Local-only, gitignored | Regenerated per-machine | ✓ |

**User's choice:** Local-only, gitignored

**Follow-up — confirmation:**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, per-machine baselines | Whoever runs the suite seeds their own baseline once locally, no cross-machine sharing since it's never automated | ✓ |
| Actually, commit them — reconsider | Switch back to committing PNGs | |

**User's choice:** Yes, per-machine baselines
**Notes:** Confirmed consistent with the earlier manual-only/no-CI decision — no baseline is ever diffed cross-machine.

---

## Claude's Discretion

- Exact `mask` locator selectors per route (timer text, KDS board container, toast root) — implementer's judgment from existing component structure.
- Whether admin-role and bartender/manager-role snapshots live in one spec file or are split by role — planner's call.

## Deferred Ideas

None — discussion stayed within phase scope.
