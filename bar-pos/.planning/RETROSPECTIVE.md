# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v2.2 — UI Standardization

**Shipped:** 2026-07-17
**Phases:** 8 (29, 30, 31, 32, 33, 33.1, 34, 35) | **Plans:** 31

### What Was Built
- File-mapped drift audit (`scripts/audit-ui-drift.ts` + `DRIFT-AUDIT.md`) scoping every subsequent phase against a concrete backlog
- Single `PageContainer` shell across all 15 non-exempt routes, dead `AppShell`/`AppNav`/`BackToHomeButton` deleted
- `shared/ui` primitives (`POSButton`, `Checkbox`, `FormField`) replacing raw markup on non-payment pages, plus Tailwind token/spacing conformance
- 44/56/72px touch targets and visible `focus-visible` rings across operational pages and (isolated, zero-behavior-change) payment-critical pages
- Isolated Playwright visual-regression suite with 43 masked-region baselines across admin/bartender/manager roles
- `DESIGN-TOKENS.md` reference doc + error-severity ESLint drift rule (`eslint-rules/no-ui-drift.js`) preventing regression

### What Worked
- Risk-tiered rollout order (audit → shell → low-risk sweep → operational sweep → payment-critical sweep → visual baseline → guardrails) meant the highest-blast-radius surfaces (payment/split/refund) were touched last, with the fix pattern already proven on lower-risk pages first
- Isolating payment-critical changes to one-file-per-commit (Phase 33) made the "zero behavior change" claim independently auditable via `git log` per file
- Re-running the phase-29 audit script itself as a verification tool in later phases (31, 33) gave an apples-to-apples before/after count instead of relying on prose claims

### What Was Inefficient
- Phase 31 never produced a `31-VERIFICATION.md` when it executed (2026-07-11) — the gap sat undetected for 6 days until the milestone-close audit caught it, requiring a retroactive verification pass against a codebase that had moved 4 phases ahead
- Phase 33's one open human-verification item (visual/focus-ring parity spot-check) was still pending at milestone close and got deferred rather than closed — the UAT mechanism worked as designed, but the check itself never got run
- This was the project's first-ever formal milestone close, despite 20 phases (1-20) having shipped beforehand — six of those phases (01, 03, 06, 07, 09, 12) surfaced with unresolved verification/UAT gaps that had never been gated on anything, only caught by the close-time artifact audit

### Patterns Established
- Every phase must end with a `VERIFICATION.md`, no exceptions — a phase-gate plan (like 31-07) that runs the checks is not a substitute for the artifact
- `/gsd-complete-milestone`'s pre-close artifact audit is the actual backstop against verification drift — run it early and often, not just at the end of a milestone, so gaps surface while the context is still warm
- Deferred human-verification items should be recorded with an explicit reason and owner intent (not silently skipped) so the audit trail stays honest about what's actually confirmed vs. assumed

### Key Lessons
1. A phase isn't done when its plans execute — it's done when `VERIFICATION.md` exists. Don't let "the SUMMARY says it's fine" substitute for the artifact.
2. Milestone-close artifact audits surface debt from phases far outside the milestone's own scope — budget time for triage, not just for the milestone being closed.
3. When a human accepts deferring a UAT item, capture *why* in the skip reason (not just "skipped") so a future session can judge whether it's still safe to leave open.

### Cost Observations
- Model mix: sonnet-heavy (verifier, integration-checker, orchestration all ran on sonnet)
- Sessions: 1 (this milestone-close session handled both gap-closure and archival)
- Notable: the retroactive Phase 31 verification agent took ~380s and 178k tokens — reading 7 plans + 7 summaries + re-running greps/audit-script/typecheck/lint/unit suite against a 6-day-later HEAD is real work; catching the gap at Phase 31's own close would have been cheaper

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v2.2 | 1 | 8 | First formal milestone close for this project — established the archive/audit/retrospective pattern going forward |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v2.2 | 1225 passed / 15 todo (unit) | not tracked | `eslint-plugin-tailwindcss@3.18.3` (exact-pinned, approved) |

### Top Lessons (Verified Across Milestones)

1. Every phase must produce `VERIFICATION.md` before being considered complete — a missing artifact is a silent gap that compounds until the next milestone-close audit catches it.
