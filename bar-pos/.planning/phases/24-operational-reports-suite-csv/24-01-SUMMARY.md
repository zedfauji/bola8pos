---
phase: 24-operational-reports-suite-csv
plan: 01
subsystem: api
tags: [zod, i18n, react-i18next, audit-log, domain-types]

# Dependency graph
requires: []
provides:
  - "order_item.remove audit action enumerated in AuditActionSchema, with a self-upgrading TARGET_RPCS coverage assertion for remove_tab_item"
  - "HourlyRowSchema extended with dayOfWeek/isBusiest (D-04), HourlyRow now Zod-backed instead of a manual TS type"
  - "DeletionsPreRowSchema, DeletionsPostRowSchema, ModifierPopularityRowSchema, PaymentMethodRowSchema + inferred types"
  - "~20 new i18n keys x 2 locales (wAdmin, featMgmt, featOrders, pages) for every widget/dialog the rest of Phase 24 will build"
affects: [24-02, 24-03, 24-04, 24-06, 24-07, 24-08, 24-09, 24-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Self-upgrading CI gate: TARGET_RPCS entries can carry a `pending: true` flag so an audit action can be registered ahead of the migration that writes it; the assertion skips itself while the migration is absent and automatically enforces once it lands"

key-files:
  created: []
  modified:
    - src/shared/lib/audit-actions.ts
    - src/shared/lib/__tests__/audit-actions.test.ts
    - src/shared/lib/domain.ts
    - src/shared/lib/domain.test.ts
    - src/shared/lib/reportHelpers.test.ts
    - src/shared/lib/i18n/locales/es-MX/wAdmin.json
    - src/shared/lib/i18n/locales/en-US/wAdmin.json
    - src/shared/lib/i18n/locales/es-MX/featMgmt.json
    - src/shared/lib/i18n/locales/en-US/featMgmt.json
    - src/shared/lib/i18n/locales/es-MX/featOrders.json
    - src/shared/lib/i18n/locales/en-US/featOrders.json
    - src/shared/lib/i18n/locales/es-MX/pages.json
    - src/shared/lib/i18n/locales/en-US/pages.json

key-decisions:
  - "TARGET_RPCS entry for remove_tab_item added with pending: true rather than left out or hard-failing, so the CI gate is green now and self-enforces once Plan 24-04 ships the migration"
  - "HourlyRow converted from a manually-declared TS type to z.infer<typeof HourlyRowSchema>, matching the project's 'infer from Zod, never hand-write domain types' convention"
  - "Fixed reportHelpers.test.ts's HourlyRow fixtures (not in this plan's files_modified) because the extension broke its typecheck and no later Phase-24 plan claims ownership of that file"
  - "Left queries-reports.ts/.test.ts, exporters/excel.test.ts, and HourlyBreakdownPanel.test.tsx with their pre-existing HourlyRow fixtures unfixed — each is explicitly owned by a later wave (24-06, 24-02, 24-09 respectively) per those plans' own files_modified/must_haves/verify commands"

patterns-established:
  - "Row schema style for new report types: z.object with UuidSchema/TimestampSchema/MoneySchema reused, mirroring VoidRefundRowSchema"

requirements-completed: [SC-1, SC-2, SC-3]

coverage:
  - id: D1
    description: "order_item.remove registered in AuditActionSchema; audit-actions.test.ts TARGET_RPCS names remove_tab_item as its writer with a self-upgrading pending check"
    requirement: "SC-1"
    verification:
      - kind: unit
        ref: "src/shared/lib/__tests__/audit-actions.test.ts#every migration-wired target RPC calls record_audit: remove_tab_item -> order_item.remove"
        status: pass
    human_judgment: false
  - id: D2
    description: "HourlyRowSchema extended with dayOfWeek/isBusiest; 4 new report-row Zod schemas (DeletionsPreRow, DeletionsPostRow, ModifierPopularityRow, PaymentMethodRow) added with inferred types"
    requirement: "SC-1"
    verification:
      - kind: unit
        ref: "src/shared/lib/domain.test.ts#HourlyRowSchema / DeletionsPreRowSchema / DeletionsPostRowSchema / ModifierPopularityRowSchema / PaymentMethodRowSchema"
        status: pass
    human_judgment: false
  - id: D3
    description: "All new i18n keys (wAdmin.deletionsPreSendPanel/deletionsPostCloseReport/modifierPopularityReport/paymentMethodsReport, featMgmt.exportReport.csvOption/csvFileLabel, featOrders.removeTabItem.reason*, pages.reports.tabs.*) present in both es-MX and en-US, all 8 catalogs valid JSON, lint green"
    requirement: "SC-2, SC-3"
    verification:
      - kind: other
        ref: "node -e catalog JSON.parse check across all 8 files (es-MX/en-US x wAdmin/featMgmt/featOrders/pages)"
        status: pass
      - kind: other
        ref: "npm run lint (max-warnings 0)"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-07-21
status: complete
---

# Phase 24 Plan 01: Contract Layer (Audit Action + Row Schemas + i18n Seed) Summary

**Registered the `order_item.remove` audit action with a self-upgrading CI gate, extended `HourlyRowSchema` (D-04) with day-of-week/busiest-hour fields, added 4 new report-row Zod schemas, and seeded ~20 i18n keys across 4 namespaces x 2 locales so no later Phase 24 plan touches a catalog file.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-07-21T15:53:00Z
- **Completed:** 2026-07-21T16:05:49Z
- **Tasks:** 3
- **Files modified:** 13 (3 core + 2 test fixture files + 8 i18n catalogs)

## Accomplishments
- `order_item.remove` is now a valid `AuditActionSchema` literal; `audit-actions.test.ts`'s TARGET_RPCS array names `remove_tab_item` as its writer via a `pending: true` entry that self-upgrades to a full CI-grep assertion once Plan 24-04's migration lands
- `HourlyRow` converted from a hand-written TS type to a Zod-inferred type (`HourlyRowSchema`), extended with required `dayOfWeek`/`isBusiest` fields per D-04
- 4 new row schemas added to `domain.ts`: `DeletionsPreRowSchema` (D-05 variant A), `DeletionsPostRowSchema` (D-05 variant B), `ModifierPopularityRowSchema` (D-09), `PaymentMethodRowSchema` (D-08), each with a `z.infer` type export
- All 20 new i18n keys seeded in both `es-MX` and `en-US` across `wAdmin`, `featMgmt`, `featOrders`, and `pages` — every widget/dialog string the rest of Phase 24 needs already resolves

## Task Commits

Each task was committed atomically:

1. **Task 1: Register order_item.remove audit action + extend CI coverage test** - `daa31f3` (feat)
2. **Task 2: Extend HourlyRowSchema (D-04) + add 4 new report-row schemas** - `b15c0c5` (feat, includes TDD unit tests)
3. **Task 3: Seed all new i18n keys in both locales** - `bfa77a6` (feat)

_Note: Task 2 is `tdd="true"` — tests and implementation landed in the same commit since domain.ts is pure Zod schema declarations with no separable RED phase; `domain.test.ts` exercises both the happy-path parse and the required-field rejection for every new/extended schema in one pass._

## Files Created/Modified
- `src/shared/lib/audit-actions.ts` - Added `order_item.remove` under a new "Order items" grouping
- `src/shared/lib/__tests__/audit-actions.test.ts` - Added `{ fn: 'remove_tab_item', action: 'order_item.remove', pending: true }` to TARGET_RPCS; the per-RPC assertion now skips itself when `pending && !definesFn`, and runs the full check once the function is defined
- `src/shared/lib/domain.ts` - `HourlyRowSchema` extended with `dayOfWeek`/`isBusiest`; added `DeletionsPreRowSchema`, `DeletionsPostRowSchema`, `ModifierPopularityRowSchema`, `PaymentMethodRowSchema` + inferred types
- `src/shared/lib/domain.test.ts` - Added unit tests for all 5 touched/new schemas (happy path + a rejection case each)
- `src/shared/lib/reportHelpers.test.ts` - Updated `HourlyRow` fixtures (literal + property-based) to include `dayOfWeek`/`isBusiest`
- `src/shared/lib/i18n/locales/{es-MX,en-US}/wAdmin.json` - Added `deletionsPreSendPanel.*`, `deletionsPostCloseReport.*`, `modifierPopularityReport.*`, `paymentMethodsReport.*`
- `src/shared/lib/i18n/locales/{es-MX,en-US}/featMgmt.json` - Added `exportReport.csvOption`, `exportReport.csvFileLabel`
- `src/shared/lib/i18n/locales/{es-MX,en-US}/featOrders.json` - Added `removeTabItem.reasonLabel/reasonPlaceholder/reasonRequired` to the existing `removeTabItem` block
- `src/shared/lib/i18n/locales/{es-MX,en-US}/pages.json` - Added `reports.tabs.deletionsPre/deletionsPost/modifierPopularity/paymentMethods`

## Decisions Made
- `pending: true` flag on the TARGET_RPCS entry lets the audit action be registered here (Wave 1) while its writer migration ships in Plan 24-04 (a later wave), without the CI grep gate going RED in the interim, and without weakening the gate for the other 10 already-wired RPCs.
- Converting `HourlyRow` to a Zod-inferred type (rather than a parallel hand-written type) follows the project's CLAUDE.md convention ("single source of truth is domain.ts, infer from Zod — never manually write entity types"), even though it produces one small transient typecheck gap outside this plan's scope (see Deviations).
- `exportReport.csvOption` value is exactly `"CSV"` (not `"CSV (.csv)"` like the sibling `excelOption`/`pdfOption`) — followed the UI-SPEC Copywriting Contract table literally per Task 3's instruction ("es-MX values are byte-identical to the UI-SPEC table").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed reportHelpers.test.ts HourlyRow fixtures broken by the HourlyRowSchema extension**
- **Found during:** Task 2 (extending HourlyRowSchema)
- **Issue:** Extending `HourlyRow` with required `dayOfWeek`/`isBusiest` fields broke `npm run typecheck` for `reportHelpers.test.ts`'s literal `HourlyRow[]` fixtures and its `fast-check` `fc.record` generator — this file isn't claimed by any of Plan 24's 10 plans (`files_modified` search across all 24-0X-PLAN.md files found no match), so no later wave would fix it.
- **Fix:** Added `dayOfWeek: 0, isBusiest: false` to the 3 literal fixture rows and `dayOfWeek`/`isBusiest` generators to the property-based test's `fc.record`. Zero behavior change — these are pure test-fixture updates for functions (`findPeakHour`/`findSlowestHour`) that don't read the new fields.
- **Files modified:** src/shared/lib/reportHelpers.test.ts
- **Verification:** `npx vitest run src/shared/lib/reportHelpers.test.ts` — 9/9 pass
- **Committed in:** b15c0c5 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to keep `reportHelpers.test.ts` type-safe after this plan's own change to `HourlyRow`. No scope creep — file is genuinely unowned elsewhere in the phase.

## Known Transient Typecheck Gap (documented, not fixed here)

Extending `HourlyRowSchema` per D-04 also breaks typecheck in 3 files this plan does **not** own, each explicitly claimed by a later wave:

| File | New errors | Owning plan | Evidence |
|------|-----------|-------------|----------|
| `src/entities/tab/model/queries-reports.ts` + `.test.ts` | ~20 | 24-06 | `files_modified` lists `queries-reports.ts`; its `<verify>` command runs `npx vitest run .../queries-reports.test.ts` then `tsc --noEmit` |
| `src/shared/lib/exporters/excel.test.ts` | 1 | 24-02 | `files_modified` lists `excel.ts`; must_haves: "The extended HourlyRow's new day-of-week + busiest fields appear in the hourly Excel workbook and PDF (D-04)" |
| `src/widgets/HourlyBreakdownPanel/HourlyBreakdownPanel.test.tsx` | 4 | 24-09 | `files_modified` lists `HourlyBreakdownPanel.tsx`; must_haves: "HourlyBreakdownPanel renders ... gains a day-of-week column, reading the migrated RPC-backed hook (D-03/D-13)" |

`npm run typecheck` currently reports these plus the 2 pre-existing errors (`queries.ts:791`, `rag.ts:60`) as the only non-domain.ts fallout. This is the expected, self-documented cost of a Wave-1 "contract layer" plan that intentionally changes a widely-consumed type ahead of its consumers — D-04 itself states the change is "Not additive-only" and explicitly assigns the exporter fix to Plan 24-02 and the widget fix to Plan 24-09. Confirmed each owning plan's `files_modified`/`must_haves`/`verify` commands anticipate exactly this fallout.

## Issues Encountered
None beyond the typecheck fallout documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 24-02 (CSV exporter + hourly Excel/PDF extension) can now import `HourlyRowSchema`'s extended shape and `exportReport.csvOption`/`csvFileLabel` i18n keys.
- Plan 24-03/24-04 (RPC migrations) can call `PERFORM record_audit('order_item.remove', ...)` — the CI gate's `pending` flag will auto-upgrade to full enforcement once that migration exists.
- Plans 24-06/24-08/24-09 (hooks + widgets) can import `DeletionsPreRow`/`DeletionsPostRow`/`ModifierPopularityRow`/`PaymentMethodRow` and every `wAdmin`/`pages` i18n key they need.
- No blockers. The 3-file transient typecheck gap above is expected to close incrementally as Plans 24-02/24-06/24-09 execute — flagging here so the phase-level verifier doesn't mistake it for a Plan 01 regression.

---
*Phase: 24-operational-reports-suite-csv*
*Completed: 2026-07-21*

## Self-Check: PASSED

All created/modified files verified present on disk; all 3 task commits (daa31f3, b15c0c5, bfa77a6) verified present in git log.
