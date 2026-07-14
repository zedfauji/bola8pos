# Phase 29: UI Drift Audit - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-10
**Phase:** 29-ui-drift-audit
**Areas discussed:** Script approach, Output format & location, Violation definition & exclusions, Route-count cross-check method

---

## Script approach

| Option | Description | Selected |
|--------|-------------|----------|
| Regex/grep | Plain Node.js fs walk + regex per pattern. Matches research's counts, zero new deps. | ✓ |
| AST via ts-morph | Parses JSX properly, catches conditional/spread cases regex misses. New dependency, slower. | |
| You decide | Claude picks during planning. | |

**User's choice:** Regex/grep
**Notes:** None

---

## Output format & location

| Option | Description | Selected |
|--------|-------------|----------|
| Markdown checklist | Human-scannable backlog grouped by file. Matches AUDIT-02 wording. | ✓ |
| Markdown + JSON | Both formats — more upfront work, no current consumer needs machine format. | |
| JSON only | Machine-parseable but AUDIT-02 wants a checklist. | |

**User's choice:** Markdown checklist

| Option | Description | Selected |
|--------|-------------|----------|
| Phase dir | `.planning/phases/29-ui-drift-audit/DRIFT-AUDIT.md` — committed, phase-doc co-located. | ✓ |
| scripts/ output | stdout only, no committed artifact, manual redirect. | |

**User's choice:** Phase dir
**Notes:** None

---

## Violation definition & exclusions

| Option | Description | Selected |
|--------|-------------|----------|
| Spacing only | p-[13px] etc. — matches roadmap wording exactly. | ✓ |
| Spacing + sizing + typography | Wider net (w-[Npx], text-[Npx]), more noise. | |

**User's choice:** Spacing only

| Option | Description | Selected |
|--------|-------------|----------|
| Exclude shared/ui | Roadmap scope is pages/widgets/features only. | ✓ |
| Include shared/ui | Catches drift in primitives themselves — out of stated scope. | |

**User's choice:** Exclude shared/ui
**Notes:** None

---

## Route-count cross-check method

| Option | Description | Selected |
|--------|-------------|----------|
| Script-asserted diff | Script parses router.tsx, counts routes, prints explicit diff vs CLAUDE.md table. | ✓ |
| Manual note | Claude counts by hand, states discrepancy in prose. | |

**User's choice:** Script-asserted diff
**Notes:** Scouting grep found 19 `<Route` matches vs. roadmap's stated 17 — script must resolve precisely (filter redirects/nested routes) rather than trust raw grep.

---

## Claude's Discretion

None — all areas had explicit user selections (all recommended options accepted).

## Deferred Ideas

None — discussion stayed within phase scope.
