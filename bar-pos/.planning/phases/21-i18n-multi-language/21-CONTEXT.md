# Phase 21: i18n Multi-Language - Context

**Gathered:** 2026-07-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Add multi-language support across the whole app: `react-i18next` wired with `es-MX`/`en-US` catalogs, a per-staff `profiles.locale` preference, and a custom ESLint rule banning new hard-coded UI strings. Migrate existing hard-coded strings to catalogs in this phase (no visual regression). Does not include adding any language beyond es-MX/en-US.

</domain>

<decisions>
## Implementation Decisions

### Default locale + switching
- **D-01:** `profiles.locale` is per-staff, not per-terminal. Persists across devices/logins.
- **D-02:** es-MX is the default locale for new/unset profiles.
- **D-03:** Self-service switcher lives in Settings; admin can also set a staff member's locale when managing staff (Staff management page).

### String migration strategy
- **D-04:** Big-bang migration in this phase — every FSD layer (`shared/ui`, `entities`, `features`, `widgets`, `pages`) gets moved to i18next catalogs now. No deferred routes.

### ESLint rule scope + enforcement
- **D-05:** `no-raw-hardcoded-strings`-style rule is strict everywhere from day one — no grandfather/ignore list. Big-bang migration means there should be nothing left to grandfather.

### Print / receipt language
- **D-06:** Printed receipts (Tauri Rust) and generated PDFs (reports) follow the *logged-in staff's* UI locale (`profiles.locale`), not a fixed business language. Consistent with D-01/D-02 — locale is a staff attribute that flows through to everything that staff member produces.

### Claude's Discretion
- Catalog file structure/namespacing (per-feature vs per-page vs single catalog) — planner's call based on FSD layer boundaries.
  - **Resolution (planner, 2026-07-17):** 10 domain/layer namespaces (`common`, `featOrders`, `featMgmt`, `wPanels`, `wAdmin`, `entities`, `pages`, `settings`, `staff`, `receipt`), one owner per namespace, enabling parallel disjoint sweeps.
- Exact ESLint rule implementation (custom rule vs existing plugin like `eslint-plugin-i18next`) — research/planner's call.
  - **Resolution (planner, 2026-07-17):** `eslint-plugin-i18next`'s `no-literal-string` rule (`mode: 'all'`), committed repo-wide in 21-12; a standalone `eslint.i18n.config.js` helper drives per-sweep verification before the repo-wide gate turns on.
- Whether `profiles.locale` also drives `Intl.NumberFormat`/date formatting or stays scoped to UI string translation only — planner should confirm against Phase 28 (Money Formatter Utility, which depends on Phase 21) to avoid overlap.
  - **Resolution (planner, 2026-07-17):** Scope narrowed to **UI string translation + receipt/PDF date formatting only (D-06)**. The ~52 non-receipt `toLocaleString()`/`toLocaleDateString()` call sites are deliberately left UNTOUCHED: they currently render with the browser/OS default locale, and forcing an explicit `es-MX` there would change rendered date formats vs. today and fail SC-4's zero-visual-regression baseline. Receipts/PDFs (21-05) DO pass the acting staff's locale into their date calls, because a translated receipt with a mismatched-locale date is visibly wrong (RESEARCH Pitfall 3). `Intl.NumberFormat`/money formatting is entirely out of scope — owned by Phase 28, which consumes the `getCurrentLocale()` accessor added in 21-02. This resolves RESEARCH Open Question #1.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap
- `.planning/ROADMAP.md` §Phase 21 (line ~614) — goal, success criteria, depends-on
- `.planning/ROADMAP.md` §Phase 28 (Money Formatter Utility) — depends on Phase 21's locale; planner should sequence to avoid rework on shared locale plumbing

No other external specs/ADRs exist for this phase — POS-COMPARISON.md source doc is no longer present per ROADMAP.md note.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None found — no `react-i18next`, no `profiles.locale` column, no existing i18n infra in the codebase (confirmed via grep of `src/shared/lib/domain.ts` and `supabase.types.ts`). This is greenfield.

### Established Patterns
- `src/shared/lib/domain.ts` is the single source of truth for Zod schemas (per CLAUDE.md) — `profiles.locale` column needs a corresponding Zod schema field here, inferred not hand-written.
- Migration to `supabase.types.ts` must be regenerated via `npx supabase gen types typescript` after the `profiles.locale` column migration lands.

### Integration Points
- `profiles` table (Staff accounts + roles) — needs new `locale` column.
- Settings page (`SettingsTabsPanel` / `SettingsPagePanel`) — needs new locale switcher tab/control.
- Staff management page — needs admin-side locale field per staff member.
- Receipt printing (Tauri Rust side) + PDF report builders (`ReportsPage` export builders) — need to read the acting staff member's locale at print/export time.

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond the decisions above — open to standard `react-i18next` setup approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 21-i18n-multi-language*
*Context gathered: 2026-07-17*
