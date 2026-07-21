---
phase: 24-operational-reports-suite-csv
plan: 09
subsystem: ui
tags: [recharts, react-i18next, reports, widgets]

# Dependency graph
requires:
  - phase: 24-operational-reports-suite-csv
    provides: "Plan 06 — useModifierPopularityReport/usePaymentMethodsReport hooks + bounded RPCs; Plan 02 — HourlyRow dayOfWeek/isBusiest schema extension"
provides:
  - "ModifierPopularityReport widget (horizontal bar chart + top-20 table, uncapped CSV export)"
  - "PaymentMethodsReport widget (donut chart + two-grain table with pinned rollup row)"
  - "HourlyBreakdownPanel extended with a per-hour bar chart + day-of-week table column"
affects: [24-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Recharts Cell is deprecated in recharts 3.8.1 (installed version) — per-datum highlight color is now done via Bar's `shape` prop rendering a `Rectangle` (reads `props.payload` cast to the row type), and via Pie's native per-datum `fill` field on the data array (no Cell needed for Pie at all)."
key-files:
  created:
    - src/widgets/ModifierPopularityReport/ModifierPopularityReport.tsx
    - src/widgets/ModifierPopularityReport/index.ts
    - src/widgets/PaymentMethodsReport/PaymentMethodsReport.tsx
    - src/widgets/PaymentMethodsReport/index.ts
  modified:
    - src/widgets/HourlyBreakdownPanel/HourlyBreakdownPanel.tsx
    - src/widgets/HourlyBreakdownPanel/HourlyBreakdownPanel.test.tsx
    - src/shared/lib/i18n/locales/es-MX/wAdmin.json
    - src/shared/lib/i18n/locales/en-US/wAdmin.json

key-decisions:
  - "recharts 3.8.1 (the version actually installed) has deprecated `Cell` — the plan's read_first examples (ComboMixReport) predate this and use Cell-free patterns already (stacked bar via dataKey per series), but per-bar/per-slice single-series highlighting needed a Cell-free approach: Bar chart highlighting uses the `shape` render-prop + public `Rectangle` component; Pie/donut highlighting uses recharts' built-in support for a `fill` field on each data object (confirmed by reading recharts' pieSelectors.js source — it reads `entry.fill` when no Cell children are present)."
  - "PaymentMethodsReport's donut + 'leading method' accent is derived from the day-level rollup rows only (sorted by grossAmount desc); the two-grain table shows per-session rows first then all rollup rows, with border-t-2 + emerald applied only to the single leading rollup row (not every row sharing that method) to keep 'exactly one accent element' true."
  - "HourlyBreakdownPanel's day-of-week column formats `row.dayOfWeek` (0=Sun..6=Sat, matches JS Date.getDay()) via a small reference-Sunday + toLocaleDateString(i18n.language) helper, so it's locale-aware without adding a new dependency."

requirements-completed: [SC-3]

coverage:
  - id: D1
    description: "ModifierPopularityReport renders a horizontal Recharts BarChart (top bar emerald-500) + a top-20-capped table with top20Note caption; ExportButtons receives the full uncapped rows"
    requirement: "SC-3"
    verification:
      - kind: unit
        ref: "node -e structural grep (useModifierPopularityReport, slice(0, 20), CHART_COLORS, reportType=, rounded-lg border p-4) — pass"
        status: pass
    human_judgment: true
    rationale: "Visual chart rendering (colors, layout) and CSV export correctness are best confirmed by a human looking at the /reports tab once 24-10 wires it in; no existing widget test harness renders Recharts SVG output in this repo."
  - id: D2
    description: "PaymentMethodsReport renders a Recharts donut (innerRadius) with the leading method slice emerald-500, plus a two-grain table (per-session rows + day rollup row pinned bottom via border-t-2)"
    requirement: "SC-3"
    verification:
      - kind: unit
        ref: "node -e structural grep (usePaymentMethodsReport, innerRadius, border-t-2, reportType=, CHART_COLORS) — pass"
        status: pass
    human_judgment: true
    rationale: "Same as D1 — visual donut rendering and table grouping fidelity need a human look once wired into the reports page in 24-10."
  - id: D3
    description: "HourlyBreakdownPanel extended in place with a per-hour BarChart (busiest bar emerald-500) and a day-of-week table column, reading the migrated RPC-backed hook"
    requirement: "SC-3"
    verification:
      - kind: unit
        ref: "src/widgets/HourlyBreakdownPanel/HourlyBreakdownPanel.test.tsx — 8/8 tests pass"
      - kind: unit
        ref: "node -e structural grep (BarChart, dayOfWeek, rounded-lg border p-4) — pass"
        status: pass
    human_judgment: false

# Metrics
duration: 45min
completed: 2026-07-21
status: complete
---

# Phase 24 Plan 09: Chart-Bearing Report Widgets Summary

**Three Recharts-backed report widgets (ModifierPopularityReport, PaymentMethodsReport, and an extended HourlyBreakdownPanel) built on recharts 3.8.1, which deprecates `Cell` — replaced with the `shape`+`Rectangle` pattern for bars and native per-datum `fill` for the donut.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-07-21T20:57:21Z
- **Completed:** 2026-07-21T21:12:04Z
- **Tasks:** 3
- **Files modified:** 8 (4 created, 4 modified — including 2 i18n locale catalogs and the pre-existing test-fixture gap)

## Accomplishments
- `ModifierPopularityReport`: horizontal Recharts BarChart ranked by attach-count desc (top bar emerald-500), on-screen table capped to top 20 with a `top20Note` caption, full uncapped rows still flow to `ExportButtons` (D-10)
- `PaymentMethodsReport`: Recharts donut (`innerRadius`) colored per-method with the leading (highest day-gross) method slice emerald-500, plus one two-grain table (per-session rows + day-level rollup row(s) pinned bottom via `border-t-2`)
- `HourlyBreakdownPanel` extended in place: per-hour BarChart with the busiest bar emerald-500, and the existing 24-row table gains a day-of-week column reading the migrated RPC-backed hook (D-03) — no rename/split (D-04)
- Fixed the last remaining item of the documented 24-01 transient TS2739 gap: `HourlyBreakdownPanel.test.tsx`'s literal `HourlyRow` fixtures now include `dayOfWeek`/`isBusiest`

## Task Commits

Each task was committed atomically:

1. **Task 1: ModifierPopularityReport** - `5e53d02` (feat)
2. **Task 2: PaymentMethodsReport** - `96018d5` (feat)
3. **Task 3: Extend HourlyBreakdownPanel** - `06749f9` (feat)

_No TDD tasks in this plan — all 3 are `type="auto"`._

## Files Created/Modified
- `src/widgets/ModifierPopularityReport/ModifierPopularityReport.tsx` - Horizontal BarChart + capped table, uncapped export
- `src/widgets/ModifierPopularityReport/index.ts` - Barrel export
- `src/widgets/PaymentMethodsReport/PaymentMethodsReport.tsx` - Donut chart + two-grain table
- `src/widgets/PaymentMethodsReport/index.ts` - Barrel export
- `src/widgets/HourlyBreakdownPanel/HourlyBreakdownPanel.tsx` - Added bar chart + day-of-week column, extended in place
- `src/widgets/HourlyBreakdownPanel/HourlyBreakdownPanel.test.tsx` - Fixed literal `HourlyRow` fixtures missing `dayOfWeek`/`isBusiest` (deferred 24-01 gap)
- `src/shared/lib/i18n/locales/es-MX/wAdmin.json` - Added column/rollup-label keys for the 3 widgets
- `src/shared/lib/i18n/locales/en-US/wAdmin.json` - Same keys, English translations

## Decisions Made
- **Cell is deprecated in the installed recharts (3.8.1).** The plan's `CHART_COLORS`/`chartColor()` copy-verbatim instruction was followed, but per-bar/per-slice coloring could not use `<Cell>` (would fail `@typescript-eslint/no-deprecated`, a lint error in this repo). Resolved via:
  - **Bar charts** (modifier-popularity, hourly): `<Bar shape={(props) => <Rectangle {...props} fill={...} />}>` — the sanctioned recharts 3.x replacement for Cell-based per-bar fills.
  - **Donut** (payment-methods): recharts' `Pie` reads a `fill` field directly off each data object when no `Cell` children are present (confirmed in `recharts/es6/state/selectors/pieSelectors.js`) — so `chartData` rows simply carry their own `fill`, no Cell/shape needed.
- **PaymentMethodsReport's "leading method" accent** is scoped to the day-level rollup rows only (not every session row of that method) so exactly one table row and one donut slice carry the emerald accent, matching the must_have.
- **HourlyBreakdownPanel's day-of-week formatting** uses a reference-Sunday-plus-offset + `toLocaleDateString(i18n.language, { weekday: 'short' })` rather than a lookup table, so it stays locale-aware (es-MX/en-US) with zero new code paths.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `Cell` unavailable — recharts 3.8.1 deprecates it**
- **Found during:** Task 1 (ModifierPopularityReport chart)
- **Issue:** The plan's read_first analog (ComboMixReport) and PATTERNS.md snippets show `<Cell fill={chartColor(i)} />` as the per-bar/per-slice coloring pattern, but the installed recharts version (3.8.1) marks `Cell` `@deprecated` — `npm run lint`'s `@typescript-eslint/no-deprecated` rule fails on any `Cell` usage (max-warnings 0 project gate).
- **Fix:** Bar charts use the `shape` render-prop + public `Rectangle` component (verified via `recharts/es6/cartesian/Bar.js` that this is the documented Cell replacement); the donut uses recharts' native per-datum `fill` field support on `Pie`'s `data` array (verified via `recharts/es6/state/selectors/pieSelectors.js`).
- **Files modified:** `ModifierPopularityReport.tsx`, `PaymentMethodsReport.tsx`, `HourlyBreakdownPanel.tsx`
- **Verification:** `npx tsc --noEmit` and `npm run lint` both clean across all 3 files; visual chart-container/Tooltip/Legend/single-accent structure unchanged from the plan's intent.
- **Committed in:** `5e53d02`, `96018d5`, `06749f9` (part of each task's own commit)

**2. [Rule 1 - Bug] Fixed deferred `HourlyRow` test-fixture TS2739 gap**
- **Found during:** Task 3 (per `<prior_wave_context>` — explicitly deferred to this plan by 24-01)
- **Issue:** `HourlyBreakdownPanel.test.tsx` had 5 literal `HourlyRow` object fixtures missing the `dayOfWeek`/`isBusiest` fields added to the schema in an earlier plan, causing a `tsc --noEmit` TS2739 error.
- **Fix:** Added `dayOfWeek: 1, isBusiest: false` to each literal fixture (values don't affect any assertion in the existing tests).
- **Files modified:** `HourlyBreakdownPanel.test.tsx`
- **Verification:** `npx tsc --noEmit` clean; `npx vitest run HourlyBreakdownPanel.test.tsx` — 8/8 pass.
- **Committed in:** `06749f9` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs/gaps blocking a clean typecheck+lint, not scope changes)
**Impact on plan:** Zero scope creep — both fixes were required to satisfy the plan's own `npm run typecheck` / `npm run lint` acceptance criteria. Chart visuals and colors match the plan's intent (single emerald accent per chart/table, grayscale rest, Tooltip+Legend, `rounded-lg border p-4` container) despite the underlying rendering mechanism changing from `Cell` to `shape`/`Rectangle`/native `fill`.

## Issues Encountered
None beyond the Cell-deprecation discovery above (documented as a deviation, not a blocker — resolved same-session).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 3 report hooks now have widgets; 24-10 (final plan) can wire `ModifierPopularityReport`, `PaymentMethodsReport`, `DeletionsPreSendPanel`, and `DeletionsPostCloseReport` into `src/pages/reports/index.tsx`'s `Tabs` list per the UI-SPEC's Report Tab Inventory — none of that page-level wiring was in this plan's scope.
- No blockers. `npm run typecheck` and `npm run lint` are both clean project-wide (2 pre-existing, unrelated errors in `queries.ts`/`rag.ts` predate this plan and are out of scope).

---
*Phase: 24-operational-reports-suite-csv*
*Completed: 2026-07-21*

## Self-Check: PASSED

All 6 created/modified files confirmed present on disk; all 3 task commit hashes (`5e53d02`, `96018d5`, `06749f9`) confirmed in `git log --oneline --all`.
