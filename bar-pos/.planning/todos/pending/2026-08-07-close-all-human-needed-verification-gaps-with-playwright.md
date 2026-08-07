---
title: Close all human_needed / manual-UAT verification gaps with Playwright automation
severity: major
area: testing
filed: 2026-08-07
---

## What

Per `.planning/decisions/2026-08-07-mandatory-automated-testing-no-manual-verification.md`,
`human_needed` is no longer an acceptable terminal verification status in this
project. The following phases currently carry outstanding manual/human
verification debt (see `.planning/audits/2026-08-07-cross-phase-todos-and-gaps.md`
for full detail) and need their remaining manual checks rewritten as
Playwright E2E assertions:

- Phase 1 — Tauri smoke never run (manual)
- Phase 3 — no remaining manual items (verification gap already closed 2026-08-07; confirm)
- Phase 6 — 8 E2E tests never run against real app (needs execution + automation, not manual)
- Phase 7 — none remaining beyond re-verified items (confirm closed)
- Phase 9 — Tauri smoke, Storybook states, signing secret confirmation (signing secret itself is `checkpoint:human-action`, out of scope; the rest is automatable)
- Phase 12 — dialog-preseed value, tile click-through, bartender tile-gating (3 items, all DOM-assertable)
- Phase 13 — 5 manual UI checks (RBAC page — role-gated visibility, all `getByRole`-assertable)
- Phase 26 — E2E reset helper silently no-ops (fix the helper, then re-run automated)
- Phase 28 — `28-09` human sign-off on money rendering (both locales) — visual-regression screenshot assertion
- Phase 33 — visual/keyboard-focus-ring parity spot-check on 7 payment-critical surfaces — computed-style assertion on `outline`/`box-shadow` after `Tab` key press (same pattern already used by `e2e/44-focus-tab-order.spec.ts`)

## Why

User directive 2026-08-07: zero tolerance for manual verification going
forward; existing gaps are backlog to close via Playwright, not permanent
exceptions.

## Suggested approach

Not a single phase — each item above is a small, independent Playwright spec
addition/fix. Route through `/gsd-validate-phase <n>` per phase (it's built
for exactly this: retroactively filling Nyquist/verification gaps for a
completed phase) rather than one giant remediation phase.
