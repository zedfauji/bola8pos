# Phase 29: UI Drift Audit - Context

**Gathered:** 2026-07-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Produce a complete, file-mapped inventory of every design-system violation (raw `<button>`/`<input>` elements, hardcoded hex/rgb colors, arbitrary-value Tailwind spacing classes) across all 17 routes in `pages/`, `widgets/`, `features/`. Read-only — no application code under `src/` is modified. Output is the backlog Phases 30-33 scope their work from.

</domain>

<decisions>
## Implementation Decisions

### Script approach
- **D-01:** `scripts/audit-ui-drift.ts` uses plain Node.js `fs` walk + regex per pattern (no AST/ts-morph). Matches research's already-verified counts (28 raw-button files, 8 raw-input files) and keeps the tool dependency-free.

### Output format & location
- **D-02:** Output is a single Markdown checklist grouped by file (per AUDIT-02's "checklist/backlog" wording) — not JSON, not a dual-format artifact. No current downstream consumer needs machine-parseable output.
- **D-03:** Committed artifact lives at `.planning/phases/29-ui-drift-audit/DRIFT-AUDIT.md` — co-located with phase docs, git-tracked, directly readable by Phase 30-33 planners/researchers. Script does not just print to stdout.

### Violation definition & exclusions
- **D-04:** "Arbitrary-value Tailwind class" scope = spacing only (`p-[13px]`, `m-[7px]`, `gap-[5px]`, etc.) — matches roadmap wording exactly. Arbitrary sizing/typography values (`w-[Npx]`, `text-[Npx]`) are out of scope for this audit, not flagged.
- **D-05:** `shared/ui/` is excluded from all three scans (raw button/input, hex color, arbitrary spacing). Roadmap scope is `pages/`, `widgets/`, `features/` only — `shared/ui` is the primitive source, not drift.

### Route-count cross-check
- **D-06:** Script parses `<Route path=...>` entries in `src/app/router.tsx`, counts them, and prints an explicit diff against `CLAUDE.md`'s routes table (13 rows) as part of the audit output — not a manually-written prose note. This gives SHELL-03 (Phase 30) hard evidence rather than an assertion.
  - Note: raw `grep -c "<Route"` during scouting returned 19 matches (vs. roadmap/research's stated 17) — likely includes redirects or nested routes counted separately. The script must resolve this precisely (e.g. filter to routes with a real `element`/`Component`, not redirects) rather than trusting the raw grep count.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone research
- `.planning/research/SUMMARY.md` — full v2.2 research: recommended stack, phase rationale, pitfalls (touch-target shrink risk, visual-diff flakiness, payment scope-creep risk)
- `.planning/research/ARCHITECTURE.md`, `.planning/research/FEATURES.md`, `.planning/research/PITFALLS.md`, `.planning/research/STACK.md` — supporting research docs

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` §Audit — AUDIT-01, AUDIT-02 full text
- `.planning/ROADMAP.md` — Phase 29 goal/success criteria; Phase 30-35 downstream consumers of this audit

### Code
- `src/app/router.tsx` — source of truth for actual registered routes (script must parse this, not CLAUDE.md's table)
- `CLAUDE.md` §Routes — the stale table this audit's route-count check exposes (13 rows vs. actual registered routes)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None needed — this phase adds one new standalone script, no application code touched.

### Established Patterns
- `scripts/` already holds standalone Node/TS utility scripts (`indexCodebase.ts`, seed scripts) not imported by `src/` — `audit-ui-drift.ts` follows this pattern, can't violate `eslint-plugin-boundaries` since it's never imported.

### Integration Points
- None — read-only, no wiring into app code, build, or CI in this phase (guardrail/lint automation is Phase 35).

</code_context>

<specifics>
## Specific Ideas

Scouting counts (regex, pre-script, for calibration only — not final numbers):
- Raw `<button>`: 29 files match `grep -rl "<button"` across `pages/widgets/features`
- Raw `<input>`: 8 files
- Hex/rgb colors: 4 files
- Arbitrary spacing (`p-/m-/gap- with [Npx]`): 0 files matched via simple regex — script needs a more complete pattern set (research's summary implies some exist; simple grep pattern used during scouting likely too narrow)

These are directional, not authoritative — the actual script's counts are what ships in DRIFT-AUDIT.md.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 29-UI Drift Audit*
*Context gathered: 2026-07-10*
