---
title: Mandatory automated (Playwright, headless) testing — no manual verification
status: LOCKED
date: 2026-08-07
scope: all phases, all plans, all GSD skills (past, present, future)
---

# Decision

Every test, verification, and UAT scenario in this project must be automated
via Playwright E2E, run headless by default. Manual/human verification of
already-built work is no longer an acceptable outcome for any phase, plan, or
UAT document in this project.

## What this bans

- `<task type="checkpoint:human-verify">` tasks in plans.
- `<verify><human-check>...</human-check></verify>` sub-blocks in plan tasks
  (the `end-of-phase` default in `workflow.human_verify_mode` still folds
  these into a batched `*-UAT.md` — that batching is not acceptable here;
  the content itself must not exist).
- Any `*-UAT.md` scenario whose pass condition is "a human clicked through
  this and confirmed it looked right."
- `VERIFICATION.md` status of `human_needed` as a terminal/accepted state.
  It is a FAIL that must be closed with an automated equivalent, not left
  outstanding.
- Overrides (`verification-overrides.md`) citing "requires visual/human
  judgment" as the reason. That reason is invalid in this project — write
  the Playwright visual-regression or DOM/computed-style assertion instead.

## What replaces it

Whatever human step a plan would have asked for gets rewritten as a
Playwright assertion in `e2e/`:

| Old human-check | Playwright equivalent |
|---|---|
| "Confirm sidebar collapses at 768px" | `page.setViewportSize()` + bounding-box/visibility assertions at the breakpoint |
| "Confirm layout looks right" | `expect(page).toHaveScreenshot()` visual-regression baseline (masked regions for dynamic content, per Phase 34's existing pattern) |
| "Confirm focus ring is visible" | computed-style assertion on `outline`/`box-shadow` after `page.keyboard.press('Tab')` |
| "Confirm PDF export works" | assert the download event fires and the resulting file is non-empty/parseable, or assert the network response, headless |
| "Confirm error toast appears" | `getByRole('alert')`/`getByText` assertion |

If a scenario genuinely cannot be expressed this way, that is a signal the
requirement itself is underspecified — clarify what "correct" means until it
is assertable, don't fall back to a human click.

## What is NOT affected

- `checkpoint:human-action` (credentials, physical hardware setup, an auth
  step only a human can perform) — not verification of finished work.
- `checkpoint:decision` (a choice the executor needs from the user before
  proceeding) — not verification of finished work.
- Genuinely manual, out-of-band activities that were already tracked as such
  (e.g. Phase 9's release-signing secret, Phase 37's physical Windows
  machine) — those are setup/infra blockers, not test verification, and stay
  out of scope for this decision.

## Retroactive scope — existing gaps

This does not retroactively mark old phases as failed, but it does mean their
`human_needed`/`gaps_found`/pending-manual-UAT items are backlog to close via
Playwright, not accepted precedent. See
`.planning/audits/2026-08-07-cross-phase-todos-and-gaps.md` for the full
list — phases 1, 3, 6, 7, 9, 12, 13, 26, 28, 33 carry outstanding manual
verification debt as of this date. Closing each is a normal
`/gsd-validate-phase` or `/gsd-audit-uat`-driven remediation effort, tracked
per phase, not done in bulk by this decision.

## Enforcement

GSD itself has no config flag that suppresses `<human-check>` emission — only
`workflow.human_verify_mode` (`end-of-phase` vs `mid-flight`), which controls
*when* a human is asked, not *whether*. Enforcement here is therefore at the
agent-instruction layer: `bar-pos/CLAUDE.md` carries this as a NON-NEGOTIABLE
policy section that every Claude/GSD agent driving planning, execution, or
verification in this repo reads and must follow, overriding GSD's default
planner behavior on a per-plan basis.
