# Phase 10: AI Slob Technical Debt Checklist - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Audit and document all technical debt accumulated across the codebase, producing a categorized CHECKLIST.md. This is an **audit/documentation phase only** — no remediation/fixing happens here (that's a future phase, mirroring how Phase 11 followed the original Phase 10 audit).

**Roadmap note:** ROADMAP.md carries a stale duplicate — a "detailed section" (search "Phase 10: AI Slob Technical Debt Checklist") incorrectly shows this phase as already executed with a completed `10-01-PLAN.md`. No `10-*` phase directory ever existed on disk; that work was actually absorbed into Phase 11's combined `11-ai-slob-technical-debt-audit-remediation/` folder. The top-level ROADMAP.md checklist entry (`- [ ] Phase 10: AI Slob Technical Debt Audit`) and `PROJECT.md`'s backlog list are correct — this phase is genuinely unstarted. The stale detailed section should be corrected/removed as part of this phase's or a follow-up doc-hygiene pass.

</domain>

<decisions>
## Implementation Decisions

### Audit Scope
- **D-01:** Full re-audit of the entire codebase, not just the delta since Phase 11 (2026-04-27). Re-run lint/test/typecheck/E2E across everything regardless of when it was written, to also catch regressions in old code.

### What Counts as "AI Slob"
- **D-02:** Broadened beyond the original lint/test/typecheck/E2E scope to include structural code smells: dead code, unjustified `as any`, duplicate abstractions across FSD layers, oversized files, unused deps, stale TODO/FIXME comments.
- **D-03:** Structural-smell detection must come from **tool-generated reports**, not Claude manually reading every source file — the user explicitly wants to avoid burning tokens parsing the codebase file-by-file. The planner/researcher should design the audit around tools that scan and emit structured output (findings lists, JSON, etc.) which Claude then reads and synthesizes into the checklist.
- **D-04:** Add a full new tooling set as devDependencies to produce these reports: **knip** (unused files/exports/deps/dead code), **jscpd** (duplicate-code detection), **madge** (circular dependency / dependency-graph analysis). None of these (nor ts-prune, depcheck, unimported) are currently installed — confirmed via `package.json` scan. — **Reversibility:** reversible — new devDependencies only, no runtime/production code touched; can be removed cleanly if unused.
- Existing tooling to reuse as-is (already in `package.json` scripts): `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e`.

### Relationship to Existing Debt Trackers
- **D-05:** Run the audit fully independently — do NOT pre-seed the checklist from the 5 existing pending todos in `.planning/todos/pending/` or from Phase 38's E2E-infra findings. After the independent audit completes, cross-check its findings against those existing trackers to identify overlaps/gaps, rather than folding them in up front.

### Output Format
- **D-06:** CHECKLIST.md output is grouped by **severity** (e.g. Blocking / High / Medium / Low) with sub-groups per **source/category** (lint, typecheck, unit test, E2E, knip, jscpd, madge) — not a flat numbered list like the original Phase 10 checklist. Structure should make it easy for a future remediation phase to triage in priority order.

### Claude's Discretion
- Exact severity-tier definitions and thresholds (e.g. what counts as "Blocking" vs "High") are left to the researcher/planner to define based on what the audit tools actually surface.
- Whether to fix the stale ROADMAP.md duplicate section as part of this phase or file it as a separate doc-hygiene todo is left to planning — either is acceptable, just don't leave it unaddressed.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap / Project State
- `.planning/ROADMAP.md` (line ~25 top-level entry; line ~323 stale duplicate detailed section) — phase boundary and the stale-doc discrepancy noted above
- `.planning/PROJECT.md` — confirms Phase 10 is genuine unstarted backlog (Backlog section, "AI slob technical debt audit — Phase 10")
- `.planning/STATE.md` — current project state (v2.1 milestone, Phase 28 in progress as of context-gathering date)

### Prior Audit Precedent
- `.planning/phases/11-ai-slob-technical-debt-audit-remediation/` — the prior audit+remediation cycle (covered phases 1-9); `11-02-SUMMARY.md`, `11-03-SUMMARY.md`, `11-04-SUMMARY.md` document what categories of findings were fixed last time (typed agent queries, lint/test green baseline, CI pipeline, CVE risk docs) — useful precedent for what "AI slob" has meant concretely in this project before.

### Existing Debt Trackers (for post-audit cross-check only, per D-05)
- `.planning/todos/pending/2026-07-25-activate-inert-git-hooks-husky-gitignored-stale-hookspath.md`
- `.planning/todos/pending/2026-07-25-relocate-misplaced-github-workflows-directory-to-git-root.md`
- `.planning/todos/pending/2026-07-27-caja-report-pdf-export-fails-silently-outside-tauri-runtime.md`
- `.planning/todos/pending/2026-07-27-payment-total-omits-tax-shown-in-pre-payment-preview.md`
- `.planning/todos/pending/2026-07-27-print-popup-fallback-hangs-under-playwright-automation.md`
- `.planning/phases/38-e2e-test-infrastructure-seed-data-reliability/` (Phase 38, roadmap addition covering E2E test infra/seed-data gaps discovered during Phase 28) — cross-check for overlap, do not duplicate its scope

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `package.json` scripts already wired for lint/typecheck/test/e2e: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e` — no new script plumbing needed for the baseline 4 checks.
- `eslint-rules/no-ui-drift.js` and other project-custom ESLint rules already flag some categories of drift (raw `<button>`/`<input>`, hardcoded hex/rgb, arbitrary Tailwind spacing) — their existing violation counts (if any) are relevant lint-category findings, not new tooling to build.

### Established Patterns
- FSD layer boundaries (`app → pages → widgets → features → entities → shared`) enforced by `eslint-plugin-boundaries` — duplicate-abstraction findings (via jscpd/madge) should be interpreted against this layering, since some "duplication" across layers may be intentional isolation rather than debt.

### Integration Points
- Findings should reference `file_path:line_number` per project convention so a future remediation phase can act on them directly.

</code_context>

<specifics>
## Specific Ideas

No specific implementation-style requirements beyond the tool choices and output-grouping decisions above — open to standard approaches for how the audit is actually run/orchestrated (single script vs. multiple plan tasks).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Actual remediation of any findings surfaced by this audit is explicitly out of scope for Phase 10 and belongs in a future phase (as Phase 11 did for the original audit).

### Reviewed Todos (not folded)
- All 5 pending todos in `.planning/todos/pending/` were reviewed but explicitly NOT folded in per D-05 — the audit runs independently first, then cross-checks against them afterward.

</deferred>

---

*Phase: 10-ai-slob-technical-debt-checklist*
*Context gathered: 2026-08-03*
