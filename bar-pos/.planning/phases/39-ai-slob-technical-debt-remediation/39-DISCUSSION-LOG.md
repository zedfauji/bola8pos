# Phase 39: AI Slob Technical Debt Remediation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-03
**Phase:** 39-ai-slob-technical-debt-remediation
**Areas discussed:** Phase routing correction, Remediation scope/tiering, Bug-vs-debt handling, Phase structure, E2E triage strategy, Phase 39 exact scope, Dead-code (knip) removal aggressiveness, Unused deps handling

---

## Phase Routing Correction (pre-discussion)

STATE.md's `current_phase: 11` pointed to a phase that already exists in ROADMAP.md as completed (2026-04-27, unrelated prior remediation with the same name). User confirmed this should become a new phase rather than reusing/overwriting the old Phase 11.

| Option | Description | Selected |
|--------|-------------|----------|
| Create a new phase for this | Add a fresh phase at the next available number | ✓ |
| Fix STATE.md pointer only | Correct the pointer without scoping remediation yet | |
| I meant something else | User clarifies what Phase 11 should actually mean | |

**User's choice:** Create a new phase — Phase 39 (next available integer after Phase 38) created via `gsd-tools query phase.add`.

---

## Remediation Scope / Tiering

| Option | Description | Selected |
|--------|-------------|----------|
| Blocking only (181) | E2E + knip unlisted deps | |
| Blocking + High (4875) | Also knip dead-code, jscpd, as-any, madge | ✓ (initial) |
| Everything (4972) | Full backlog including Medium/Low | |

**User's choice:** Blocking + High initially selected, then refined (see "Phase Structure" and "Phase 39 Exact Scope" below) into a per-category phase split.

---

## Bug-vs-Debt Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Fix debt, file bugs separately | Stay scoped to audit categories; real product bugs found along the way get filed as todos | ✓ |
| Fix whatever's found | Fix any real bug encountered inline | |

**User's choice:** Fix debt, file bugs separately.

---

## Phase Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Multiple waves in one phase | Phase 39 stays one phase, planner breaks into waves | |
| Split into separate phases per category | Each major category (E2E, knip, jscpd, as-any) gets its own phase | ✓ |

**User's choice:** Split into separate phases per category — this narrowed Phase 39's actual scope (see next).

---

## E2E Triage Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Triage first, then fix | Open actual per-test error output before deciding fix vs. defer vs. remove | ✓ |
| Fix only the 11 confirmed Phase-38 overlaps | Leave the other 83 untouched | |

**User's choice:** Triage first, then fix.

---

## Phase 39 Exact Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Blocking tier only (181) | E2E triage + knip unlisted deps | |
| Blocking + knip dead-code (2098, refined to 2135 incl. Medium) | Absorbs all knip findings since same tool family; jscpd/as-any split off separately | ✓ |

**User's choice:** Blocking + knip dead-code. Final scope: 181 (Blocking) + 1917 (High knip) + 37 (Medium knip) = 2135 findings.

---

## Knip Dead-Code Removal Aggressiveness

| Option | Description | Selected |
|--------|-------------|----------|
| Delete confirmed dead code, skip flagged false positives | Sanity-check each High-tier finding; leave Medium-tier shared-ui/stories findings alone | ✓ |
| Delete everything knip flags | Treat knip output as ground truth across all tiers | |

**User's choice:** Delete confirmed dead code, skip flagged false positives (Medium tier).

---

## Unused Deps/DevDeps Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Remove them here | Same category, low risk | |
| Defer to a separate phase | package.json changes get their own review pass | ✓ |

**User's choice:** Defer to a separate phase.

---

## Claude's Discretion

- Exact wave/plan breakdown within Phase 39 (dependency ordering, parallelization).
- Whether to create the deferred future phases (jscpd, as-any, unused-deps, Low-tier) now via `/gsd-phase add` or only when Phase 39 nears completion.

## Deferred Ideas

- jscpd duplication remediation (2657 findings) — separate future phase.
- as-any unjustified casts (119) — separate future phase.
- Unused deps/devDeps removal (15) — separate future phase.
- Low tier (TODO/FIXME + oversized files, 60) — separate future phase or general cleanup.
- Medium-tier knip shared-ui/stories findings (37) — not deleted in Phase 39; may need dedicated manual-review pass later.
- `2026-07-27-payment-total-omits-tax-shown-in-pre-payment-preview.md` todo — reviewed, not folded (confirmed out of audit-detectable scope by 10-CHECKLIST.md's cross-check).
