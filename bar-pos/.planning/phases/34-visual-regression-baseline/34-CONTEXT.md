# Phase 34: Visual Regression Baseline - Context

**Gathered:** 2026-07-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Stand up an isolated Playwright visual-regression suite (separate config from the functional `e2e/` suite) and capture screenshot baselines for all 17 registered routes, now that Phases 29-33/33.1's shell/token/component/touch/focus fixes are complete. Baselines must be stable (dynamic/live regions masked) and manual-only (no CI gate this phase).

</domain>

<decisions>
## Implementation Decisions

### Config isolation & CI gate
- **D-01:** New file `playwright.visual.config.ts`, fully isolated from `playwright.config.ts` (own `testDir`, headless, bundled Chromium — no `channel: 'chrome'`, no `slowMo`). Run via `--config` flag.
- **D-02:** Manual-only — no CI gate this phase. CI (`.github/workflows/ci.yml`) currently has zero E2E steps (typecheck/lint/unit/audit only); adding a visual CI gate is out of scope, matches `research/SUMMARY.md`'s default.
- **D-03:** New npm script `test:e2e:visual` → `playwright test --config=playwright.visual.config.ts`, following the existing `test:e2e`/`test:e2e:report` naming pattern.

### Route coverage & seeding
- **D-04:** Admin role (PIN `0000`, via `e2e/helpers/auth.ts` `loginAs`) snapshots all 17 registered routes — satisfies the ROADMAP success criterion in one pass.
- **D-05:** Bartender and manager roles additionally snapshot only their own normally-accessible route subset (e.g. bartender: `/pos`, `/pool-tables`, `/pool-tables/:tableId`, `/kds-bar`, `/kitchen-prep`, `/waitlist`) — to catch role-specific UI differences such as hidden admin nav items. Not all 3 roles × all 17 routes.
- **D-06:** `/pool-tables/:tableId` uses the first seeded table id from `npm run setup:dev` — same lookup approach `e2e/16-table-status.spec.ts` already uses. No hardcoded UUID.
- **D-07:** Access-denied/redirect states for role-gated routes (e.g. bartender hitting `/rbac` or `/audit`) ARE included as additional baselines in this phase (user overrode the "defer" recommendation — explicitly wants 403/redirect UI captured now, not deferred).

### Dynamic region masking
- **D-08:** Default masking strategy is Playwright's `toHaveScreenshot({ mask: [locator(...)] })` — paint a solid box over dynamic elements per-route, keep the rest of the page diffable. Do not exclude whole routes/panels.
- **D-09:** `pool-table-status` (`/pool-tables/:tableId`) — start an active pool session (not idle) so the "occupied" visual state (different layout/colors) is captured, and mask the running timer digits region specifically.
- **D-10:** Toasts — defensively add a `mask` over the toast container region on every route even though the spec doesn't intentionally trigger any (navigate-only, no mutating actions before snapshot), as a safety net against incidental toasts.
- Realtime KDS boards (`/kds`, `/kds-bar`) — mask the live board content region using the same `mask: []` approach as timers (not excluded).

### Baseline storage & naming
- **D-11:** Visual spec(s) live in `e2e/visual/45-visual-baseline.spec.ts` (new subfolder, separate from flat `e2e/*.spec.ts` functional specs). `45` is the next free number after `44-focus-tab-order` (`43` is taken by `43-promotions`).
- **D-12:** Baseline PNG snapshots are **local-only, gitignored** — NOT committed to git. Each machine that runs the suite seeds its own baseline once via `--update-snapshots`, then subsequent local runs on that same machine diff against it. Consistent with the manual-only/no-CI decision (D-02) — no baseline is ever shared or diffed cross-machine/CI.

### Claude's Discretion
- Exact `mask` locator selectors per route (timer text, KDS board container, toast root) — implementer's judgment from existing component structure.
- Whether admin-role snapshots and bartender/manager-role snapshots live in one spec file or are split by role — planner's call, D-11 only fixes the directory/number.

### Post-research corrections & additions (2026-07-14, RESEARCH.md)
- **D-13 (corrects D-05):** `/waitlist` requires `manage_waitlist` (manager+) per `rbac.ts` — a bartender is redirected, not the other way around. Bartender's actual accessible subset is `/pos`, `/pool-tables`, `/pool-tables/:tableId`, `/kitchen-prep`. `/kds`/`/kds-bar` require `view_kds` (kitchen role + admin only — manager is ALSO blocked from these, not just bartender). Planner must use RESEARCH.md's corrected route×role matrix (Pattern 3), not the illustrative example in D-05.
- **D-14 (corrects D-06):** `npm run setup:dev` is broken — `scripts/setup-dev-users.ts` / `scripts/seed-dev-data.ts` referenced in `package.json` do not exist in the repo. Seed the pool table id (and any other fixture data) directly via `e2e/helpers/supabase.ts`'s `getServiceClient()`, the same pattern `e2e/16-table-status.spec.ts` already uses. Do not depend on `setup:dev` running successfully.
- **D-15:** Denied-route captures (D-07) — for routes where denial is an instant `<Navigate>` redirect (pixel-identical to `/home`), assert the resulting URL is `/home` only; do NOT screenshot. `/audit`'s denial is the exception — it renders a distinguishing `sonner` toast before/during redirect, so it DOES get an actual screenshot.
- **D-16:** `/kds` and `/kds-bar` boards are snapshotted with 1-2 pending orders seeded (not empty) — an empty board hides card layout/spacing drift, which is the point of a visual baseline. Card relative-age labels ("2 min") are masked per the same locator-mask pattern as D-08/D-09.
- **D-17 (masking inventory expansion):** Beyond the timer/KDS-board/toast regions named in the original discussion, RESEARCH.md found additional dynamic regions requiring masks: `/pool-tables` grid view (not just the `:tableId` detail page) has live minutes-counters + SVG timer overlays on occupied cards; `/pos` has `data-testid="active-promotions-banner"` (happy-hour countdown — selector already exists in code); `/staff` has a live shift-duration tick; both KDS pages render a `LiveTimeDisplay` clock in the header separate from the board content. All must be masked using the same `mask: []` locator approach as D-08.
- Toast mask selector confirmed: `data-sonner-toaster` (from direct `node_modules/sonner` inspection).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & requirements
- `.planning/ROADMAP.md` §"Phase 34: Visual Regression Baseline" — goal, requirements (VISUAL-01..03), success criteria
- `.planning/REQUIREMENTS.md` §"Visual" — VISUAL-01, VISUAL-02, VISUAL-03 requirement text and coverage table

### Research
- `.planning/research/SUMMARY.md` — blast-radius-tiered rollout rationale, visual-regression isolation/masking pitfalls (#2, #3 under "Critical Pitfalls"), CI-gate-vs-manual default

### Existing test infra (patterns to follow, not duplicate)
- `playwright.config.ts` — functional E2E config being isolated FROM (headless=false, slowMo, channel:'chrome' — visual config must diverge on all three)
- `e2e/helpers/auth.ts` — `loginAs(page, role)` helper, admin PIN `0000`
- `e2e/16-table-status.spec.ts` — existing pattern for looking up a seeded pool table id
- `e2e/global-teardown.ts`, `e2e/fixtures.ts` — shared E2E fixtures (console/pageerror tailing)

### Routes
- `src/app/router.tsx` — canonical list of all 17 registered routes + role gates (`<ProtectedRoute>`, `ReportsRoute`, `KdsRoute`)

No other external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `e2e/helpers/auth.ts` `loginAs(page, 'admin'|'manager'|'bartender')` — role login, reuse directly for all role/route combinations.
- `e2e/16-table-status.spec.ts` — existing seeded-table-id lookup pattern, reuse for D-06.

### Established Patterns
- Functional E2E specs are numbered flat files in `e2e/`; this phase introduces the first subfolder (`e2e/visual/`) — a new but additive pattern, not a refactor of existing specs.
- `.gitignore` already excludes `e2e-results/` and `e2e-blob-reports/` — the visual snapshot output dir (Playwright's default `__screenshots__/` or `-snapshots/` folder under `e2e/visual/`) needs a new `.gitignore` entry per D-12.

### Integration Points
- `npm run setup:dev` seeds dev users + pool table data — visual suite depends on this having been run first (same as functional E2E's existing `.env.local` E2E credentials requirement per CLAUDE.md).
- `package.json` scripts block — add `test:e2e:visual` alongside existing `test:e2e`/`test:e2e:report`.

</code_context>

<specifics>
## Specific Ideas

No particular visual/design references beyond what's already implemented in Phases 29-33.1 — this phase is capture-only, not a design pass.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (403/redirect-state capture, initially flagged as possible scope creep, was explicitly pulled into this phase's scope per D-07 rather than deferred.)

</deferred>

---

*Phase: 34-Visual Regression Baseline*
*Context gathered: 2026-07-14*
