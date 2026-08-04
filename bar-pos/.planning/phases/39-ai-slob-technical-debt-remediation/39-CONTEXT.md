# Phase 39: AI Slob Technical Debt Remediation - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Remediate the **Blocking tier** (181 findings) and **all knip dead-code findings** (High-tier 1917 + Medium-tier 37 = 1954 findings; **2135 findings total**) from `.planning/phases/10-ai-slob-technical-debt-checklist/10-CHECKLIST.md`, Phase 10's audit output.

This phase does NOT cover jscpd duplication (2657 findings), unjustified `as-any` casts (119), the 1 madge cycle, unused deps/devDeps (15), or Low-tier findings (TODO/FIXME + oversized files, 60) — those are split into separate future phases per category (see Deferred).

**Note on phase numbering:** This phase was originally routed to as "Phase 11" by STATE.md's next-phase pointer, but Phase 11 already exists in ROADMAP.md as a completed, unrelated phase (same name, "AI Slob Technical Debt Remediation", shipped 2026-04-27 — typed agent queries / CI pipeline / CVE docs, no relation to Phase 10's audit). STATE.md's `current_phase` was a stale pointer left over from an earlier planning pass. This is Phase 39 (next available integer), added fresh via `/gsd-phase add`.

</domain>

<decisions>
## Implementation Decisions

### Scope / Tiering
- **D-01:** Phase 39 covers Blocking tier (181: E2E 147 + knip unlisted deps 34) + knip dead-code (High 1917 + Medium 37). Total 2135 findings.
- **D-02:** Remaining categories become separate future phases, one per category: knip unused deps/devDeps (15, Blocking-adjacent but deliberately deferred), jscpd duplication (2657), as-any unjustified casts (119), Low tier (TODO/FIXME + oversized files, 60). — **Reversibility:** reversible — just future `/gsd-phase add` calls, no code committed yet that would need undoing.
- **D-03:** Any real product bug discovered while triaging (e.g. an E2E failure that turns out to be a genuine app defect, not test infra or audit noise) gets filed as a todo, not fixed inline in this phase. Keeps the diff scoped to technical-debt categories and reviewable. Exception: don't apply this to trivial one-line fixes that are clearly the same root cause as the debt item being fixed.

### E2E Triage (Blocking tier, 147 findings: 94 failed + 53 skipped)
- **D-04:** Triage-first approach. For each failing/skipped spec, open its actual error output (`.audit-tmp/e2e-per-spec/*.json` or re-run individually) — not just the digest title — before deciding the fix. Classify each into: infra/flaky (defer to Phase 38, do not fix here) / real regression (fix here) / obsolete test (update or remove).
- **D-05:** 11 of 147 are already confirmed tied to Phase 38's known root causes (test-DB pollution in `02-caja.spec.ts`, pool-table seed state in `04-pool-timer.spec.ts`, missing date-ranged report seed data in `07-reports.spec.ts`) — see 10-CHECKLIST.md "Cross-check against existing trackers" for the exact list. These don't need re-triage; route straight to "infra, defer to Phase 38."
- **D-06:** The remaining 83 unannotated failures/skips require real per-test investigation — 10-CHECKLIST.md explicitly did not open per-test output (D-03 rule during the audit: findings from tool output only, no src/test reads).

### Knip Dead-Code Removal
- **D-07:** Delete confirmed dead code (High-tier: 848 default-mode + 1069 production-mode unused files/exports/duplicates/types) after a quick sanity check per finding for dynamic/string-based usage knip can miss (e.g. route registration via router config, string-keyed lookups). — **Reversibility:** costly — deleted exports/files require re-adding + re-wiring call sites if a false-negative sanity-check missed a real usage; git history makes recovery possible but not free.
- **D-08:** Skip the Medium-tier 37 findings (4 default + 33 production) entirely — these are specifically flagged in 10-CHECKLIST.md as suspected false positives in `shared/ui`/Storybook stories, where knip's static-import analysis misses Storybook's own component discovery. Do not delete without individual manual review; if reviewed and confirmed genuinely dead, note that explicitly per finding rather than batch-deleting.
- **D-09:** Unused deps/devDeps (10 + 5 = 15, in the knip default-mode 886 bucket, distinct from the 34 unlisted deps already in Blocking) are explicitly OUT of scope for this phase — deferred to a separate dependency-cleanup phase, since `package.json` changes carry different risk/review characteristics than code-level dead-code removal.

### Claude's Discretion
- Exact wave/plan breakdown within Phase 39 (e.g. Wave 1: E2E triage, Wave 2: knip unlisted-deps fix, Wave 3: knip High-tier dead-code removal) — planner's call based on dependency ordering and what's safe to parallelize.
- Whether jscpd/as-any/unused-deps/Low-tier phases get created now (empty, for later `/gsd-discuss-phase`) or only when work on Phase 39 nears completion — recommend creating them now via `/gsd-phase add` so ROADMAP.md reflects the full remediation plan, but this wasn't explicitly decided by the user.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Audit source of truth
- `.planning/phases/10-ai-slob-technical-debt-checklist/10-CHECKLIST.md` — the full tiered findings list (Blocking/High/Medium/Low) this phase remediates. Contains inline file/line annotations for E2E failures and the Phase 38 cross-check.
- `.planning/phases/10-ai-slob-technical-debt-checklist/10-REVIEW.md` — code review of the audit pipeline itself (7 findings, non-blocking) — context on audit tooling reliability.
- `.planning/phases/10-ai-slob-technical-debt-checklist/10-VERIFICATION.md` — confirms all 11 audit categories reconcile against raw reports.

### Related phase
- ROADMAP.md "Phase 38: E2E Test Infrastructure & Seed Data Reliability" — owns the systemic test-DB pollution / seed-data root causes; Phase 39's E2E triage routes infra-classified failures here rather than fixing them itself.

### Audit tooling (for re-running/re-verifying findings during remediation)
- `scripts/run-tech-debt-audit.sh`, `knip.json`, `.jscpd.json` — the audit pipeline built in Phase 10, usable to re-check a finding is actually fixed.

No other external specs/ADRs apply — requirements captured fully in Decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/run-tech-debt-audit.sh` / `npm run audit:tech-debt` — re-run after fixes to confirm counts dropped, avoids hand-verifying each finding.
- `.audit-tmp/` digest format (gitignored, regenerable) — per-category raw JSON reports for looking up a specific finding's file/line before fixing it.

### Established Patterns
- `10-CHECKLIST.md`'s D-03 discipline (findings from tool output, not manual file reads, during audit) does NOT apply during remediation — remediation requires opening the actual files being fixed.

### Integration Points
- `.github/workflows/ci.yml` (from the old, already-completed Phase 11) runs typecheck/lint/test/audit — E2E is not currently gated in CI (per CLAUDE.md, E2E is manual pre-release only), so Phase 39's E2E fixes won't be CI-verified automatically; rely on local `npm run test:e2e` runs.

</code_context>

<specifics>
## Specific Ideas

No particular UI/UX references — this is a pure code-quality/reliability phase, not a visible feature.

</specifics>

<deferred>
## Deferred Ideas

- **jscpd duplication remediation** (2657 flagged clones) — separate future phase. Realistic scope likely "extract top offenders only," not all 2657 — to be decided when that phase is discussed.
- **as-any unjustified casts** (119) — separate future phase. Likely mix of "add justification comment" (fast, valid when the cast is genuinely necessary) vs. "retype properly" (correct, slower) — to be decided when that phase is discussed.
- **Unused deps/devDeps removal** (15) — separate future phase, `package.json`-focused.
- **Low tier** (TODO/FIXME 9 + oversized files >400 lines 51) — separate future phase or folded into general cleanup; low urgency.
- **Medium-tier knip shared-ui/stories findings** (37) — not deleted in this phase (D-08); may warrant a dedicated manual-review pass later if still flagged after Phase 39.

### Reviewed Todos (not folded)
- `2026-07-27-payment-total-omits-tax-shown-in-pre-payment-preview.md` — matched Phase 39 by keyword ("payment") at low confidence (0.6). 10-CHECKLIST.md explicitly confirms this bug was **NOT rediscovered** by any of the 11 audit categories (it's a business-logic bug, not a static-analysis-detectable issue) — genuinely out of scope for a technical-debt remediation phase. Left as an open todo for its own fix.

</deferred>

---

*Phase: 39-ai-slob-technical-debt-remediation*
*Context gathered: 2026-08-03*
