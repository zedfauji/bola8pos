---
phase: 21-i18n-multi-language
plan: 09
subsystem: ui
tags: [i18next, react-i18next, eslint-plugin-i18next, fsd, order-panel, payments, pool-tables, kds, caja, rappi, waitlist, inventory]

# Dependency graph
requires:
  - phase: 21-i18n-multi-language
    provides: "21-01 i18next singleton, wPanels.json seed (empty {}), lint:i18n gate; 21-02..21-05 single-writer files already migrated so this fan-out sweep has no file/JSON conflicts; 21-06's shared/ui common namespace, 21-07's rpc/navigate/confirmClassName excludes, and 21-08's multi-line-Supabase-chain eslint-disable precedent all reused directly"
provides:
  - "Every hardcoded user-facing string in the 22 operational-panel widget folders in this plan's scope migrated to t('wPanels:...') / i18n.t('wPanels:...') (D-04, SC-4)"
  - "wPanels.json populated with 400 keys across 35 widget-scoped groups (both locales, key-parity-verified, 0 unused keys against src/**), covering order/payment/pool/table panels, login form, kds/caja/rappi/waitlist/inventory dashboards, and the home dashboard tile grid"
  - "eslint.i18n.config.js: aria-labelledby/height/highlight jsx-attribute excludes, maxHeight object-property exclude, logHardwareFail/toLocaleDateString/toLocaleTimeString/usePersistedBool callee excludes — closing gaps 21-06/21-07/21-08 didn't need to cover"
affects: [21-10, 21-11, 21-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-level TanStack Table ColumnDef[] arrays (CajaReportPanel, IngredientsTable's useMemo, KitchenPrepDashboard, StockMovementsList) cannot call useTranslation() directly since they sit outside the component body — converted to builder functions (buildXColumns(t: TFunction) or a plain t-closure inside useMemo) that accept the component's own t and are invoked inside the render, memoized where the array is otherwise static across renders."
    - "TFunction must be imported from 'i18next', not 're-exported' from 'react-i18next' — react-i18next@17's public d.ts imports TFunction internally for its own signatures but never re-exports it as a named type, so `import { type TFunction } from 'react-i18next'` silently resolves to an error type under this project's TS config (no hard parse error, but every downstream use reports 'Unsafe call of a type that could not be resolved') until typecheck's TS2305 surfaces the real cause."
    - "Non-component module-level pure functions defined inside a widget file (e.g. KdsBoard's formatAge, StockMovementsList's refTypeLabel) take an explicit `t: TFunction<'wPanels'>` parameter passed in by their caller component, rather than importing the i18n singleton — keeps them reactive to the calling component's already-resolved `t` without a second i18n.t() indirection."
    - "eslint-plugin-i18next's object-properties / array-literal detection is inconsistent for module-level (outside any component/JSX/call-arg) plain object arrays: CajaReportPanel's inline `[{ header: 'Product' }, ...]` column defs WERE flagged, but PoolTableGrid's TYPE_FILTER_LABELS and HomeDashboard's ITEMS array (module-level, `label:`/`managerLabel:` properties) were NOT — the rule's mode:'all' JSX/attribute/call-arg reach does not uniformly cover every module-scope literal shape. Per plan's explicit lint:i18n-driven scope, unflagged literals are left as-is UNLESS the plan text itself calls them out (HomeDashboard's tile labels were explicitly named in the plan, so migrated regardless of lint flagging)."

key-files:
  created: []
  modified:
    - "src/widgets/{OrderPanel/**,PaymentModal/**,PaymentPane/**,PoolTableGrid/**,PoolTableOccupancyPanel/**,TableStatusPanel/**,TabDrawer/**,PINLoginForm/**} (Task 1 — order/payment/pool/table cluster)"
    - "src/widgets/{CajaDashboard/**,CajaReportPanel/**,KdsBoard/**,KitchenPrepDashboard/**,IngredientsTable/**,StockMovementsList/**,LowStockAlert/**,RappiOrdersPanel/**,WaitlistQueue/**,HomeDashboard/**,EmployeeSelector/**,HelpSheet/**} (Task 2 — kds/caja/rappi/waitlist/inventory cluster; RappiOrderBadge/LogoImage had 0 violations, untouched)"
    - src/shared/lib/i18n/locales/es-MX/wPanels.json
    - src/shared/lib/i18n/locales/en-US/wPanels.json
    - eslint.i18n.config.js

key-decisions:
  - "PaymentForm.tsx's paymentLabels default fallback ({ cash: 'Efectivo', card: 'Terminal BBVA', rappi: 'Rappi' }) was already Spanish source text (mirrors 21-08's agent-chat precedent) — es-MX keeps the exact byte-identical Spanish literal, en-US received a genuine English translation ('Cash'/'BBVA Terminal'/'Rappi'), not a byte-copy."
  - "i18next's automatic count-based pluralization (`key_one`/`key_other` suffixes, triggered by passing a `count` interpolation option) was used ONLY where the original code already varied singular/plural text (CartPanel's `{count} {count===1?'item':'items'}`, TabPaymentCard's `{itemCount} item{s}`). Everywhere the original template literal never varied by count (HomeDashboard's 'parties waiting', KdsBoard's 'items'), the interpolation param was deliberately renamed away from the reserved `count` key (e.g. `waitingCount`, `itemCount`) to prevent i18next's pluralization resolver from engaging and to keep the rendered text byte-identical to the original for every input value (catalog rule / SC-4)."
  - "Multi-line Supabase query-builder chains inside two non-component inline hooks (PoolTableOccupancyPanel's usePoolTables, WaitlistQueue's usePoolTablesCount — both duplicate ad-hoc pool_tables queries pending a future @entities/pool-table consolidation) got scoped eslint-disable/eslint-enable blocks around the whole hook body, following 21-08's documented plugin-quirk precedent, rather than relying on the config-level from/select/order excludes alone."
  - "eslint.i18n.config.js gained 4 new callee excludes this plan: logHardwareFail (PaymentForm's local post-payment hardware-error logger wrapping logger.warn+toast.error, same category as the existing logger\\.\\w+ regex but not dotted since it's a local fn), toLocaleDateString/toLocaleTimeString (Date.prototype Intl-formatting methods whose first arg is a fixed BCP-47 locale string, e.g. 'en-GB'), and usePersistedBool (@shared/lib/usePersistedBool's localStorage-key first arg). Plus 3 new jsx-attribute/object-property excludes: aria-labelledby (DOM ID reference, same category as the existing aria-describedby), height (CardSkeleton's CSS pixel-dimension prop), highlight (CajaDashboard's SummaryCard Tailwind class passthrough prop), and maxHeight (CSS style-object value)."

requirements-completed: [SC-4]

coverage:
  - id: D1
    description: "npm run lint:i18n exits 0 across all 22 operational-panel widget folders in this plan's scope (the exact Task-3 acceptance command)"
    requirement: "SC-4"
    verification:
      - kind: other
        ref: "npm run lint:i18n -- src/widgets/CajaDashboard src/widgets/CajaReportPanel src/widgets/EmployeeSelector src/widgets/HelpSheet src/widgets/HomeDashboard src/widgets/IngredientsTable src/widgets/KdsBoard src/widgets/KitchenPrepDashboard src/widgets/LogoImage src/widgets/LowStockAlert src/widgets/OrderPanel src/widgets/PINLoginForm src/widgets/PaymentModal src/widgets/PaymentPane src/widgets/PoolTableGrid src/widgets/PoolTableOccupancyPanel src/widgets/RappiOrderBadge src/widgets/RappiOrdersPanel src/widgets/StockMovementsList src/widgets/TabDrawer src/widgets/TableStatusPanel src/widgets/WaitlistQueue (exit 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "es-MX and en-US wPanels.json have identical key sets (400/400) and 0 real unused keys against src/**; every migrated es-MX value equals the pre-migration literal byte-for-byte except PaymentForm's paymentLabels default (Spanish-source, deliberate en-US translation, documented)"
    requirement: "SC-4"
    verification:
      - kind: other
        ref: "node key-parity check (400/400 keys both locales, 0 orphans each side); leaf-name unused-key scan against src/**/*.{ts,tsx} found only 4 false positives (cartPanel.itemCount_one/_other, tabPaymentCard.itemCount_one/_other — i18next-suffix keys the naive scanner doesn't understand, code calls the un-suffixed base key)"
        status: pass
    human_judgment: false
  - id: D3
    description: "npm run typecheck and npm run lint both exit 0 across the whole repo after the sweep; full unit suite has zero regressions"
    requirement: "SC-4"
    verification:
      - kind: unit
        ref: "npm run typecheck (only the 2 pre-existing unrelated errors, same baseline as 21-06/21-07/21-08) + npm run lint (exit 0) + npm run test (140 files/1248 tests pass, 2 skipped, 15 todo — identical to prior plans' baseline)"
        status: pass
    human_judgment: false

duration: ~140min
completed: 2026-07-18
status: complete
---

# Phase 21 Plan 09: Order/Payment/Pool/Table + Kds/Caja/Rappi/Waitlist/Inventory Widget Sweep to wPanels Summary

**Big-bang string sweep of the 22 operational-panel widget cluster (order/payment/pool/table panels, login form, kds/caja/rappi/waitlist/inventory dashboards, home tile grid) into the `wPanels` i18next namespace — `npm run lint:i18n` goes from 213+ violations across two task batches to 0 across all 22 folders**

## Performance

- **Duration:** ~140 min
- **Tasks:** 3/3 complete
- **Files modified:** 20 widget files + 1 eslint config + 2 catalog files, across 2 commits

## Accomplishments

- **Task 1 (order/payment/pool/table cluster):** `OrderPanel` (7 files: ActiveTabSelector, CartPanel, CartSummary, HappyHourBanner, OrderItemCard, ProductGrid, SubChecksSection), `PaymentModal` (index + PaymentForm — the largest single file in this plan, ~65 keys covering the full split-payment/discount/tip UI), `PaymentPane` (PaymentPane, TabPaymentCard, TabPaymentList), `PoolTableGrid`, `PoolTableOccupancyPanel`, `TableStatusPanel`, `TabDrawer`, `PINLoginForm` — all migrated to `useTranslation('wPanels')`. Fixed a real multi-line-Supabase-chain plugin quirk in `PINLoginForm.tsx`'s existing-shift lookup (scoped eslint-disable, matching 21-08 precedent).
- **Task 2 (kds/caja/rappi/waitlist/inventory cluster):** `CajaDashboard` (open/close caja dialogs + printed cash-summary receipt lines), `CajaReportPanel` (3 TanStack Table column-def builders converted from module-level literals to `TFunction`-parameterized builder functions), `KdsBoard` (2 card components + a shared `statusColorFor`/`formatAge` helper pair), `KitchenPrepDashboard`, `IngredientsTable`, `StockMovementsList`, `LowStockAlert`, `RappiOrdersPanel`, `WaitlistQueue`, `HomeDashboard` (tile grid's `ITEMS` array converted to `labelKey`/`managerLabelKey` per the plan's explicit instruction to migrate every tile label), `EmployeeSelector`, `HelpSheet`. `RappiOrderBadge` and `LogoImage` had zero lint violations and were left untouched.
- Task 3: ran the exact Task-3 verification command across all 22 folders (0 violations), verified 400/400 key parity with 0 real unused keys, re-confirmed `typecheck`/`lint`/full unit suite (140 files/1248 tests, zero regressions) — no code changes needed, everything already clean after Tasks 1+2.
- `wPanels.json` grew from an empty seed (`{}`) to 400 keys across 35 widget-scoped groups (both locales): `activeTabSelector`, `cartPanel`, `cartSummary`, `happyHourBanner`, `orderItemCard`, `productGrid`, `subChecksSection`, `pinLoginForm`, `paymentModal`, `paymentForm`, `paymentPane`, `tabPaymentCard`, `tabPaymentList`, `poolTableGrid`, `poolTableOccupancyPanel`, `tableStatusPanel`, `tabDrawer`, `cajaDashboard`, `cajaReportPanel`, `helpSheet`, `employeeSelector`, `homeDashboard`, `ingredientsTable`, `kdsBoard`, `kitchenPrepDashboard`, `lowStockAlert`, `rappiOrdersPanel`, `stockMovementsList`, `waitlistQueue`.

## Task Commits

1. **Task 1: Sweep order/payment/pool/table widgets → wPanels** - `b11c9ed` (feat)
2. **Task 2: Sweep kds/caja/rappi/waitlist/inventory widgets → wPanels** - `df2a897` (feat)
3. **Task 3: Prove zero violations across operational widgets + reconcile catalog** - verification-only, no code changes (all 22 widgets already clean after Tasks 1+2; nothing to commit)

## Files Created/Modified

- `src/widgets/{OrderPanel/{ActiveTabSelector,CartPanel,CartSummary,HappyHourBanner,OrderItemCard,ProductGrid,SubChecksSection}.tsx}` — order entry, cart, promotions banner
- `src/widgets/{PaymentModal/{index,ui/PaymentForm}.tsx,PaymentPane/ui/{PaymentPane,TabPaymentCard,TabPaymentList}.tsx}` — payment dialog, split-payment, payment history
- `src/widgets/{PoolTableGrid/index.tsx,PoolTableOccupancyPanel/ui/PoolTableOccupancyPanel.tsx,TableStatusPanel/index.tsx,TabDrawer/index.tsx}` — pool table grid/status/occupancy, tab drawer
- `src/widgets/PINLoginForm/PINLoginForm.tsx` — PIN login, forced-PIN-change, opening-cash flow
- `src/widgets/{CajaDashboard/CajaDashboard.tsx,CajaReportPanel/CajaReportPanel.tsx}` — caja open/close, daily caja report
- `src/widgets/{KdsBoard/index.tsx,KitchenPrepDashboard/ui/KitchenPrepDashboard.tsx}` — kitchen/bar KDS board, prep batch dashboard
- `src/widgets/{IngredientsTable/index.tsx,StockMovementsList/index.tsx,LowStockAlert/index.tsx}` — inventory management tables/alerts
- `src/widgets/{RappiOrdersPanel/index.tsx,WaitlistQueue/ui/WaitlistQueue.tsx}` — delivery order queue, walk-in waitlist
- `src/widgets/{HomeDashboard/ui/HomeDashboard.tsx,EmployeeSelector/EmployeeSelector.tsx,HelpSheet/index.tsx}` — nav dashboard, PIN-login staff picker, F1 help panel
- `src/shared/lib/i18n/locales/{es-MX,en-US}/wPanels.json` — 35 widget-scoped key groups, 400 keys, key-parity-verified
- `eslint.i18n.config.js` — `aria-labelledby`/`height`/`highlight` jsx-attribute excludes, `maxHeight` object-property exclude, `logHardwareFail`/`toLocaleDateString`/`toLocaleTimeString`/`usePersistedBool` callee excludes

## Decisions Made

See `key-decisions` in frontmatter for the full list. Highlights: the `TFunction` import-source gotcha (`i18next`, not `react-i18next`) that silently degrades to an unresolved-type error rather than a hard parse failure; the deliberate avoidance of i18next's `count`-triggered auto-pluralization wherever the original text never varied by count; and PaymentForm's Spanish-source payment-label defaults getting a genuine English translation (not a byte-copy) for en-US, mirroring 21-08's agent-chat precedent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `TFunction` is not a public export of `react-i18next`**
- **Found during:** Task 2, after adding column-def builder functions to `CajaReportPanel.tsx`, `KdsBoard.tsx`, `StockMovementsList.tsx`
- **Issue:** `import { useTranslation, type TFunction } from 'react-i18next'` compiled without an immediate parse error but every downstream use of the `TFunction<'wPanels'>` type resolved to an unresolvable/`error` type, surfacing as 38 `@typescript-eslint/no-unsafe-*` lint errors (not a typecheck error) at first — `npm run typecheck` then confirmed the real root cause: `TS2305: Module '"react-i18next"' has no exported member 'TFunction'`. `react-i18next@17`'s `.d.ts` imports `TFunction` from `i18next` for its own internal signatures but never re-exports it publicly.
- **Fix:** Changed the import to `import type { TFunction } from 'i18next';` in all 3 files.
- **Files modified:** `src/widgets/CajaReportPanel/CajaReportPanel.tsx`, `src/widgets/KdsBoard/index.tsx`, `src/widgets/StockMovementsList/index.tsx`
- **Verification:** `npm run typecheck` back to the 2 pre-existing baseline errors; `npm run lint` exit 0 (the 38 unsafe-* errors gone).
- **Committed in:** `df2a897`

**2. [Rule 3 - Blocking] eslint-plugin-i18next flags CSS/technical values not covered by any existing exclude**
- **Found during:** Task 1 (`aria-labelledby`, `height`, `maxHeight`) and Task 2 (`highlight`, `logHardwareFail`, `toLocaleDateString`, `usePersistedBool`)
- **Issue:** Several attribute names / callee names carrying purely technical values (DOM ID references, CSS pixel dimensions, Tailwind class passthrough props, a local hardware-error-logging wrapper, Intl locale identifiers, a localStorage key) were flagged as literal UI copy despite being the same category as already-excluded entries (`aria-describedby`, `className`, `rpc`, `logger\.\w+`).
- **Fix:** Added `aria-labelledby`/`height`/`highlight` to `jsx-attributes.exclude`, `maxHeight` to `object-properties.exclude`, and `logHardwareFail`/`toLocaleDateString`/`toLocaleTimeString`/`usePersistedBool` to `callees.exclude` in `eslint.i18n.config.js`.
- **Files modified:** `eslint.i18n.config.js`
- **Verification:** `npm run lint:i18n` on each affected folder exits 0 after each addition.
- **Committed in:** `b11c9ed`, `df2a897`

**3. [Rule 1 - Bug] eslint-plugin-i18next's callee exclude doesn't suppress violations on multi-line-formatted Supabase query-builder chains (recurrence of 21-08's documented quirk)**
- **Found during:** Task 1 (`PINLoginForm.tsx`'s existing-shift lookup) and Task 2 (`PoolTableOccupancyPanel.tsx`'s `usePoolTables`, `WaitlistQueue.tsx`'s `usePoolTablesCount` — both ad-hoc inline `pool_tables` queries)
- **Issue:** Same plugin quirk documented in 21-08: a `db.from(...).select(...).order(...)` chain formatted across multiple lines is still flagged despite `from`/`select`/`order` all being in `callees.exclude`.
- **Fix:** Scoped `/* eslint-disable i18next/no-literal-string */ ... /* eslint-enable */` blocks around each affected hook body, per the established precedent.
- **Files modified:** `src/widgets/PINLoginForm/PINLoginForm.tsx`, `src/widgets/PoolTableOccupancyPanel/ui/PoolTableOccupancyPanel.tsx`, `src/widgets/WaitlistQueue/ui/WaitlistQueue.tsx`
- **Verification:** `npm run lint:i18n` on each affected folder exits 0.
- **Committed in:** `b11c9ed`, `df2a897`

---

**Total deviations:** 3 auto-fixed (all Rule 1/3 — blocking fixes and one real bug — needed to satisfy the plan's own stated `lint:i18n` acceptance criteria). No scope creep.

## Issues Encountered

None beyond the three auto-fixed items documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All 22 operational-panel widget folders in this plan's scope are fully migrated to `wPanels` (D-04) — the exact Task-3 `lint:i18n` command exits 0.
- `wPanels.json`'s 400 keys across 35 widget-scoped groups are the canonical location for any subsequent 21-xx sweep touching similar order/payment/pool/kds/caja/rappi/waitlist/inventory copy.
- `eslint.i18n.config.js`'s exclude list is now broader (aria-labelledby, height, highlight, maxHeight, logHardwareFail, toLocaleDateString, toLocaleTimeString, usePersistedBool) — future sweeps hitting the same technical-value categories should check this list before re-discovering the same excludes.
- `TFunction<'wPanels'>` (imported from `i18next`, not `react-i18next`) is now documented precedent for any future widget needing a translated module-level helper function or TanStack Table column-def builder outside the component body.

---
*Phase: 21-i18n-multi-language*
*Completed: 2026-07-18*

## Self-Check: PASSED

Both commits confirmed present in `git log --oneline --all` (`b11c9ed`, `df2a897`). Key files confirmed present on disk: `src/widgets/PaymentModal/ui/PaymentForm.tsx`, `src/widgets/CajaReportPanel/CajaReportPanel.tsx`, `src/widgets/HomeDashboard/ui/HomeDashboard.tsx`, `src/shared/lib/i18n/locales/{es-MX,en-US}/wPanels.json`, `eslint.i18n.config.js`. The exact Task-3 `lint:i18n` command across all 22 widgets, `npm run typecheck` (2 pre-existing unrelated errors only), `npm run lint`, and `npm run test` (1248 passed, zero regressions) all re-confirmed clean immediately before writing this summary.
