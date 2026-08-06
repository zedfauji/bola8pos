# Phase 39 Plan 11 — Shared + Features Dead-Declaration Ledger

**Generated:** 2026-08-06 (worktree run; `node_modules`/`.env.local` restored per the plan's `<parallel_execution>` note)

## Method

Regenerated both knip reports fresh (`npx knip --reporter json`, `npx knip --production --reporter json`) rather than using 39-RESEARCH.md's pre-decision figures or trusting 39-08-LEDGER.md's estimate unverified, per this plan's explicit instruction to work from the `src/shared/` and `src/features/` **working set published by plan 39-08**. Computed the distinct `(file, line, name)` set-union over `exports`/`types` across both reports, scoped to:

- `src/shared/**` excluding `src/shared/ui/**` (D-08), `src/shared/lib/domain.ts`, and `src/shared/lib/edge-function-contracts.ts` (both owned exclusively by plan 39-09 in this wave)
- `src/features/**`
- `e2e/helpers/supabase.ts`
- **excluding** any `**/index.ts(x)` barrel file in `src/shared/` or `src/features/` (plan 39-08's territory — this plan's frontmatter file globs are `src/shared/lib/*.ts`, `*.tsx`, `agent/tools/*.ts`, `src/shared/config/constants.ts`, `src/features/*/model/*.ts`, `src/features/*/ui/*.tsx`, `e2e/helpers/supabase.ts` — none of which match a barrel path)

**Fresh count at plan start: 119 export/type findings, 9 whole-file candidates** (across the three scopes above). 39-08-LEDGER.md's own estimate for this plan's working set was 117 export/type findings + 8 whole-file candidates — the 2-row/1-file drift is expected: 39-08 computed its estimate before this plan's own edits, and knip finding counts can shift by a handful between runs as unrelated dependency graphs settle. Re-verified as stable across two consecutive regenerations before starting Task 1.

Every deletion below was preceded by a repository-wide search (`grep -rn` for the bare identifier across `src/`, `e2e/`, `supabase/`) confirming zero call sites outside the flagged declaration's own file, per 39-PATTERNS.md's "Clean Partial-Export Deletion" pattern. `rbac.ts`, `result.ts`, `audit-actions.ts`, `rappi-constants.ts`, and `config/constants.ts` additionally received a **quoted-string search** (`grep -rn "'<name>'"`) per this plan's string-keyed-blind-spot instructions.

## A recurring pattern found during this sweep: "flagged export, used internally, never imported externally"

Roughly half of this plan's findings were **not** genuinely dead code — the flagged declaration is still called from elsewhere *within its own file* (e.g. `generateMockTab` calling `generateMockStaff`), but knip's "unused export" check only tracks cross-file import edges, not same-file value use. Deleting the function in these cases would have broken the file's own internal callers. The correct minimal fix, applied throughout this ledger, is **removing the `export` keyword only** (making the declaration a private module-internal helper) rather than deleting the declaration — this resolves the knip finding without touching behavior. This is called out per-row below as "de-export (internally used)".

## Task 1 — String-Keyed Blind-Spot Files (`rbac.ts`, `result.ts`)

### `src/shared/lib/rbac.ts`

| Line | Name | Bare-identifier search | Quoted-string search | Outcome |
|---|---|---|---|---|
| 106 | `isStaffAction` | 2 hits, both in `rbac.test.ts` (import + direct call) | 1 hit, `rbac.test.ts` `describe('isStaffAction', ...)` — same test file | **RETAIN** — production-mode-only false positive; exported type-guard function directly unit-tested by its own test file, invisible to knip's production entry graph. No `STAFF_ACTIONS` entry or `StaffAction` union member is independently flagged by this knip run — the RBAC action set itself is untouched. |

### `src/shared/lib/result.ts`

All 14 flagged exports searched (bare identifier across `src/`, `e2e/`, `supabase/`; `AppErrorCode` union member quoted-string search extended to `supabase/functions/` per this file's client/edge-boundary risk — **zero individual `AppErrorCode` union members are flagged** by this run, so no per-code disposition was needed):

| Line | Name | External hits | Outcome |
|---|---|---|---|
| 103 | `mapResult` | `result.test.ts` only (7 call sites) | **RETAIN** — test-only-consumed |
| 129 | `unwrapResult` | `result.test.ts` only | **RETAIN** — test-only-consumed |
| 142 | `isOk` | `result.test.ts` only | **RETAIN** — test-only-consumed |
| 152 | `isErr` | `result.test.ts` only | **RETAIN** — test-only-consumed |
| 237 | `authRequiredError` | `result.test.ts` only | **RETAIN** — test-only-consumed |
| 247 | `authForbiddenError` | `result.test.ts` only | **RETAIN** — test-only-consumed |
| 278 | `duplicateEntryError` | `result.test.ts` only | **RETAIN** — test-only-consumed |
| 286 | `tabAlreadyClosedError` | `result.test.ts` only | **RETAIN** — test-only-consumed |
| 306 | `sessionStillRunningError` | `result.test.ts` **and** `src/features/close-tab/index.ts:40` (real production call site) | **RETAIN** — genuinely production-consumed. Flagged only because `close-tab/index.ts` is itself a whole-file knip false positive (already adjudicated in 39-03-LEDGER.md — reachable via its own test, not a barrel), so symbols reached only through it are transitively mis-flagged too. |
| 316 | `paymentDeclinedError` | `result.test.ts` only | **RETAIN** — test-only-consumed |
| 325 | `paymentAlreadyProcessedError` | `result.test.ts` only | **RETAIN** — test-only-consumed |
| 335 | `inventoryNegativeError` | `result.test.ts` only | **RETAIN** — test-only-consumed |
| 413 | `notFoundVersionedError` | `version-error.test.ts` only | **RETAIN** — test-only-consumed |
| 431 | `parseSupabaseError` | `result.test.ts` **and** `entities/tab/model/queries.concurrent.test.ts` (both test files import `parseSupabaseError` from `@shared/lib/result` specifically — a distinct, same-named function from `supabase-contracts.ts`'s own `parseSupabaseError`, see Task 2) | **RETAIN** — test-only-consumed |

**Task 1 verify:** `npm run typecheck && npm run lint && npm run test` — all pass, zero changes made (both files' flagged declarations are correctly classified as needed; no deletion, no de-export needed since none are called internally-only — they're called externally by tests/production, just not by anything knip's production-mode graph counts).

## Task 2 — Remaining Sweep

### `src/shared/lib/supabase-contracts.ts` (19 findings — highest count in batch)

All 19 searched; **18 of 19 confirmed zero real external hits** (all grep matches were same-named local variables/types in unrelated files — e.g. `ErrorBoundary.tsx`'s own `hasError` state field, `TabCard`/`ProductGrid`/`TabDrawer`'s own local `hasError` booleans — never an import of this file's declarations). The file's only genuinely-consumed export is `AppError` (imported by `payment-processor.ts`, `email-receipt.ts`, `edge-function-contracts.ts`) — **not** independently flagged by knip, so untouched.

| Names deleted (18) | Outcome |
|---|---|
| `Database` (placeholder type, comment says "to be generated from Supabase" — real generated type lives in `supabase.types.ts`), `SupabaseQueryResult`, `TabWithOrders`, `ResourceWithSession`, `ProductWithDetails`, `InventoryWithProduct`, `ShiftWithStaff`, `OrderWithItems`, `isTabWithOrders`, `isResourceWithSession`, `isProductWithDetails`, `isInventoryWithProduct`, `isShiftWithStaff`, `isOrderWithItems`, `SUPABASE_ERROR_CODES`, `parseSupabaseError` (this file's own copy — distinct from `result.ts`'s, zero real importers), `isSupabaseError`, `hasData` | **DELETED** — entire "typed query result shapes" scaffolding superseded by `result.ts`'s real `AppErrorCode`-based error handling; zero importers anywhere in `src/` or `supabase/functions/`. `hasError` included in this count (19th finding) — see below. |

File rewritten to retain only the header doc (updated to record what was removed and why) and the still-live `AppError` type. The now-unused `import type { PostgrestError }` was removed along with the block that used it.

### `src/shared/lib/test-utils.tsx` (14 findings)

Verified **zero** of the 45 files importing `@shared/lib/test-utils` reference any of the 14 flagged names (`act`, `cleanup`, `fireEvent`, `getDefaultNormalizer`, `getNodeText`, `isInaccessible`, `logDOM`, `logRoles`, `prettyDOM`, `screen`, `waitFor`, `waitForElementToBeRemoved`, `within`, `render`) — every real consumer imports only `renderWithProviders` (or `createTestQueryClient`). **DELETED** the RTL pass-through re-export block and the `renderWithProviders as render` alias. Whole-file candidate (see below) — file itself retained, already adjudicated FALSE POSITIVE at file level in 39-03-LEDGER.md.

### `src/shared/lib/supabase.ts` (12 findings)

All 12 `*Row` type aliases (`TabRow`, `OrderRow`, `OrderItemRow`, `ProductRow`, `CategoryRow`, `ModifierRow`, `ResourceRow`, `PoolSessionRow`, `ProfileRow`, `ShiftRow`, `PaymentRow`, `InventoryRow`) searched — zero real importers anywhere. Every "hit" found was a same-named **local** type independently declared inside each entity's own `queries.ts` (e.g. `entities/tab/model/queries.ts` declares its own local `interface TabRow`), never importing these aliases. **DELETED** all 12.

### `src/shared/lib/mocks.ts` (9 findings)

| Name | Internal use (same file) | External use | Outcome |
|---|---|---|---|
| `generateMockStaff` | called by `generateMockTab` | none | **de-export (internally used)** |
| `generateMockShift` | called by `generateMockTab` | none | **de-export (internally used)** |
| `generateMockTab` | called by `buildClosingTime`/`buildBusyBar` | none | **de-export (internally used)** |
| `generateMockOrder` | none | none | **DELETED** |
| `generateMockOrderItem` | none | none | **DELETED** |
| `generateMockPoolTable` | none | none | **DELETED** |
| `generateMockPoolSession` | none | none | **DELETED** |
| `generateMockOccupiedPoolTable` | called by `buildClosingTime`/`buildBusyBar` | none | **de-export (internally used)** |
| `generateMockPayment` | none | none | **DELETED** |

`generateMockCategory`, `generateMockProduct`, `generateMockInventory` are genuinely consumed externally (Storybook stories, `.test.tsx` files) and were **not** flagged by knip — confirmed untouched. Removed the now-dead `OrderSchema`/`OrderItemSchema`/`PoolSessionSchema`/`PaymentSchema` imports and `Order`/`OrderItem`/`PoolSession`/`Payment` type imports that only the 4 deleted functions used; updated the file's header comment (referenced a since-deleted `generateMockPoolTable`). Whole-file candidate — file retained (already adjudicated FALSE POSITIVE in 39-03-LEDGER.md).

### `src/shared/lib/domain-helpers.ts` (8 findings)

7 of 8 (`calculateTipAmount`, `calculateTipSuggestions`, `computeDepletion`, `computeModifierDepletion`, `calculatePoolCharge`, `calculateOrderItemLineTotal`, `calculateTabSubtotal`) are consumed by test files and/or real production code (e.g. `calculateTipSuggestions` by `TabDetail.tsx`, `computeDepletion`/`computeModifierDepletion` by `depletion.test.ts`) — **RETAIN**, all 7.

`getTabOpenMinutes` (line 197, this plan's cited worked-example target): zero external hits, **but** it is called internally by `getTabDurationTier` and `formatTimeOpen` in the same file — both of which are genuinely production-consumed (`TabCard.tsx`, `TabDetail.tsx`, `TimerDisplay.tsx`). 39-PATTERNS.md's worked example describes deleting the whole function; that description predates a since-added internal caller. **de-export (internally used)** instead of deletion — correct minimal fix, documented as a deviation below.

### `src/shared/config/constants.ts` (6 findings)

`MAX_POOL_TABLES`, `BILLING_ROUND_MINUTES`, `DEFAULT_POOL_RATE_PER_HOUR`, `MAX_TERMINALS`, `APP_NAME`, `ROUTES` — all 6 searched with **both** bare-identifier and quoted-string forms per this plan's config-file requirement; zero hits either form, zero internal use. **DELETED** all 6. `TERMINAL_ID` (not flagged — genuinely imported by `EditPaidTabDialog.tsx` and `ReopenTabDialog.tsx`) retained unchanged; noted but out of scope: most other call sites re-declare their own local `TERMINAL_ID` constant rather than importing this one (separate duplication debt, not a dead-code finding).

### `src/shared/lib/logger.ts` (5 findings)

`sanitizePayload`, `redactString`: both consumed by `logger.test.ts` — **RETAIN** (test-only-consumed).

`SafeLogPayload`, `LogLevel`, `LogEntry`: all three used pervasively *within* `logger.ts` itself (method signatures, internal typing) but never imported by another file. **de-export (internally used)**, all 3.

### `src/shared/lib/agent/tools/posTools.ts` (3 findings)

`_executeCloseTab`, `_executeStopPoolSession`, `_executeStopAndMoveTable` — each called internally as the executor callback passed to `createPendingAction(...)` (e.g. `_executeStopAndMoveTable` also calls `_executeStopPoolSession` directly), zero external hits. **de-export (internally used)**, all 3.

### `src/shared/lib/category-tree.ts` (3 findings)

`isAncestor`, `hasCycle`, `getNodeDepth` — all consumed exclusively by `category-tree.test.ts`. **RETAIN**, all 3 (test-only-consumed).

### `e2e/helpers/supabase.ts` (2 findings, searched scoped to `e2e/` per plan instruction)

`E2E_PREP_INGREDIENT_NAME`, `seedE2ePrepKitchenFixture` — zero hits anywhere in `e2e/`. Confirmed genuinely orphaned: `e2e/21-prep.spec.ts` (the only kitchen-prep E2E spec) seeds its fixture data via a completely different mechanism (`resetPrepIngredientStock`, backed by `seed-prep.ts` baselines) and never calls `seedE2ePrepKitchenFixture`. **DELETED** the function, its private helper const `E2E_PREP_RAW_INGREDIENT_NAME`, and a stray orphaned JSDoc comment ("Delete a staff member from profiles and Supabase Auth by name.") that had been left stranded directly above this dead block — it actually documents `deleteTestStaff`, defined ~120 lines further down with no doc comment of its own; left in place it would have become an even more confusing dangling comment after this deletion, so it was reattached implicitly by removing it (the function it describes needs no comment restored — out of this plan's scope to add one).

Production-mode's whole-file flag on `e2e/helpers/supabase.ts` itself (not one of the 2 named findings) is a knip config artifact — e2e helper files aren't part of the "production" entry graph knip's `--production` flag traces, so a helper file with real spec consumers still shows whole-file-dead in that mode alone. Not a genuine candidate; consistent with this plan's framing of exactly "the two findings," not three.

### `src/shared/lib/logger-instance.ts` (2 findings)

`createUserLogger`, `createFeatureLogger` — zero external hits, zero internal use (only referenced in their own JSDoc `@example` blocks, not real code), no test file exists for this module. **DELETED** both.

### `src/shared/lib/agent/tools/menuTools.ts` (2 findings)

`_executeDeactivateProduct`, `_executeBulkImportProducts` — same `createPendingAction` executor-callback pattern as `posTools.ts` above, internally used. **de-export (internally used)**, both.

### `src/shared/lib/uom.ts` (2 findings)

`BaseUom`, `Uom` type aliases — zero internal use (the file's `toBase`/`fromBase`/`roundTrip` functions take plain `number` params, never reference these types) and zero real external use. `entities/ingredient/model/types.ts` imports its own same-named `Uom`/`BaseUom` from `@shared/lib/domain` (a distinct, separately-declared pair) — not from this file. **DELETED** both. Whole-file candidate — file retained (already adjudicated FALSE POSITIVE in 39-03-LEDGER.md; `uom.test.ts` imports `ALL_UOMS`/`BASE_UOMS`/`toBase`/`fromBase`/`roundTrip`, none of which were flagged).

### `src/shared/lib/rappi-webhook-payload.ts` (1 finding — also a whole-file candidate)

`RappiWebhookBodySchema` — zero real external hits (`supabase/functions/rappi-webhook/index.ts` has its own independent local declaration of the same name — edge functions don't import from `src/`). Used internally by this file's own `parseRappiWebhookBody`. **de-export (internally used)**. Whole-file candidate — file retained (already adjudicated FALSE POSITIVE in 39-03-LEDGER.md; consumed by `rappi-webhook-payload.test.ts` and `RAPPI_DEFAULT_TENANT_ID` import, see below).

### `src/shared/lib/audit-actions.ts` (1 finding, quoted-string search required per plan)

`AuditAction` (type alias, line 68, `z.infer<typeof AuditActionSchema>`) — bare-identifier and quoted-string searches both zero real hits (only a comment mention in `EditHistoryTable.tsx`). The type was used internally only by the file's own `export const AuditAction = {...} as const satisfies Record<string, AuditAction>` — a declaration-merged constant object mapping `PAYMENT_PROCESS: 'payment.process'`-style named constants to the same string literals already in `AuditActionSchema`.

De-exporting the type alone (the mechanical minimal fix) caused the previously-invisible-to-knip `export const AuditAction` object to surface as its own newly-flagged unused export on the very next knip run — a direct, immediate side effect of this edit, verified before finalizing. Searched `AuditAction.` member-access across `src/` and `supabase/`: **zero real hits** — nothing in the codebase actually uses these named constants; every `record_audit()` call site hardcodes the string literal directly (`AuditActionSchema`'s own enum values remain the actual single source of truth per the file's header comment). **DELETED** both the type alias and the const object; `AuditActionSchema` (genuinely imported by `AuditLogFilterBar.tsx`, `domain.test.ts`, `audit-actions.test.ts`) is completely untouched.

### `src/shared/lib/version-error.ts` (1 finding)

`VersionedEntity` — zero external hits, used internally as a field type on the same file's own `VersionError`-adjacent type. **de-export (internally used)**.

### `src/shared/lib/format.ts` (1 finding)

`parseMoneyInput` — consumed by `format.test.ts` only. **RETAIN** (test-only-consumed).

### `src/shared/lib/json-diff.ts` (1 finding)

`DiffStatus` — zero external hits, used internally as a field/local-variable type within the same file. **de-export (internally used)**.

### `src/shared/lib/phone.ts` (1 finding)

`isE164` — consumed by `phone.test.ts` only. **RETAIN** (test-only-consumed).

### `src/shared/lib/pos-printer.ts` (1 finding)

`receiptDataToPrinterLines` — consumed by `pos-printer.test.ts` only. **RETAIN** (test-only-consumed).

### `src/shared/lib/rappi-constants.ts` (1 finding, quoted-string search required per plan)

`RAPPI_DEFAULT_TENANT_ID` — bare-identifier search found it genuinely imported and used by `rappi-webhook-payload.ts` (default parameter value) **and** directly by `rappi-webhook-payload.test.ts`; quoted-string search found zero additional hits. **RETAIN** — real usage exists, flagged only because it's reached exclusively through `rappi-webhook-payload.ts`, itself a whole-file knip false positive (test-consumed, see above) whose transitive dependents inherit the same mis-flag.

### `src/shared/lib/split-math.ts` (1 finding)

`fromCents` — consumed by `split-math.test.ts` only. **RETAIN** (test-only-consumed).

### `src/features/edit-paid-tab/model/useEditPaidTab.ts` (1 finding)

`EditPaidTabPatchOp` (type) — zero external hits, used internally as a field type in the same file. **de-export (internally used)**.

### `src/features/import-ingredients-csv/ui/CsvImportSheet.tsx` (1 finding)

`parseCsvText` (line 34, `export { parseCsvText } from './csv-parse';`) — this is a pass-through re-export; the real implementation lives in the co-located `csv-parse.ts` (split out to satisfy `react-refresh/only-export-components`, per its own header comment). `CsvImportSheet.test.tsx` imports `parseCsvText` from `./CsvImportSheet` specifically (not `./csv-parse` directly), so this re-export line is genuinely consumed — just only by a test file, invisible to knip's production-mode graph. **RETAIN** (test-only-consumed).

### `src/features/manage-products/ui/CategoryForm.tsx` (2 findings — newly cascaded from 39-08's barrel pruning, not explicitly named in this plan's Task 2 action text but within its `src/features/*/ui/*.tsx` file-glob scope)

`CategoryFormProps` (type), `CategoryForm` (export) — zero external hits from any *live* code path. The only consumer is `src/features/manage-products/ui/CatalogCategoriesTab.tsx`, itself confirmed genuinely dead (see below): `e2e/21-product-management.spec.ts:36` explicitly documents both as "the unused, unwired `CatalogCategoriesTab`/`CategoryForm` pair" (real category management goes through the separate, unrelated `manage-categories/ui/CategoryTreeEditor.tsx`, which declares its own private, differently-scoped `CategoryForm` function). **RETAIN, not deleted** — deleting `CategoryForm.tsx`'s exports would break `CatalogCategoriesTab.tsx`'s `import { CategoryForm } from './CategoryForm'` at typecheck time, and this plan's `must_haves` explicitly prohibit whole-file deletion (`CatalogCategoriesTab.tsx` would need to go too, in the same commit, to safely remove `CategoryForm.tsx`'s exports). Deferred as a same-commit pair for a future plan once whole-file deletion is back in scope.

## Whole-File Candidates (9 total — not deleted, per this plan's `must_haves`: "No file is deleted in this plan")

| File | Status |
|---|---|
| `src/shared/lib/mocks.ts` | Already adjudicated FALSE POSITIVE (file-level) in 39-03-LEDGER.md — test/Storybook-consumed. Individual dead exports addressed above. |
| `src/shared/lib/promotion-pricing.ts` | Already adjudicated FALSE POSITIVE in 39-03-LEDGER.md — consumed by `promotion-pricing.test.ts` only. No individual export/type findings in this run (whole-file flag only). |
| `src/shared/lib/rappi-webhook-payload.ts` | Already adjudicated FALSE POSITIVE in 39-03-LEDGER.md — test-consumed. Individual finding addressed above (de-export). |
| `src/shared/lib/supabase-test-client.ts` | Already adjudicated FALSE POSITIVE in 39-03-LEDGER.md — test-infra wiring. No individual findings in this run. |
| `src/shared/lib/test-setup.ts` | Already adjudicated FALSE POSITIVE in 39-03-LEDGER.md — wired via `vitest.config.ts`'s `setupFiles` (confirmed directly this run: `vitest.config.ts:68`). No individual findings. |
| `src/shared/lib/test-utils.tsx` | Already adjudicated FALSE POSITIVE in 39-03-LEDGER.md — genuinely consumed by 45 files via `renderWithProviders`. Individual dead re-exports addressed above. |
| `src/shared/lib/uom.ts` | Already adjudicated FALSE POSITIVE in 39-03-LEDGER.md — consumed by `uom.test.ts`. Individual dead types addressed above. |
| `e2e/helpers/supabase.ts` | Production-mode-only knip artifact (e2e helpers aren't traced by `--production`'s entry graph) — file has real spec consumers (`resetPrepIngredientStock`, `getKdsItemStatus`, `deleteTestStaff`, etc. across the E2E suite). Not a genuine whole-file candidate; its 2 individually-flagged dead exports were addressed above. |
| `src/features/manage-products/ui/CatalogCategoriesTab.tsx` | **Newly surfaced by 39-08's barrel pruning (not a prior false-positive adjudication).** Confirmed genuinely dead — zero real importers, and `e2e/21-product-management.spec.ts:36` explicitly documents it as unused/unwired. **Not deleted**, per this plan's explicit `must_haves` prohibition on whole-file deletion in this plan. Deferred to a future plan alongside its paired `CategoryForm.tsx` exports (see above) — both should be removed together once whole-file deletion is back in scope. |

## Verification

```
npm run typecheck   # clean, zero errors (re-run after every file's edit batch)
npm run lint         # clean — only the pre-existing [boundaries] legacy-selector-syntax
                       warning (documented out-of-scope in 39-01-LEDGER.md), zero new
                       violations
npm run test          # 1391 passed, 15 todo (151 passed + 2 skipped test files) —
                       exact match to the 39-08-SUMMARY.md baseline, zero regression.
                       One transient failure (queries.clock.test.ts, a timing-sensitive
                       test unrelated to any file this plan touched) on a single full-
                       suite run — confirmed pre-existing/flaky via isolated re-run
                       (passed 6/6 alone) and a clean full-suite re-run (1391/1391).
```

No RBAC action string or `AppErrorCode` union member was deleted (Task 1: zero deletions in either file). No file was deleted (18 files edited, 0 deleted). No `features/` component's rendered markup, styling, or copy was changed — only unused exported declarations were removed or de-exported.

## Task 3 — Delta Measurement

### This plan's scope (export/type findings, matches the `<verify>` command's method)

| | Before | After | Δ |
|---|---|---|---|
| `src/shared/` (excl. `domain.ts`/`edge-function-contracts.ts`/`shared/ui/**`, excl. barrels) + `src/features/` (excl. barrels) + `e2e/helpers/supabase.ts` — distinct export/type findings | 119 | **35** | **−84** |
| Whole-file candidates in scope | 9 | 9 | 0 (none deleted — see prohibition above) |

**Deliberately retained: 35 findings**, broken out by category:

- **String-keyed / declaration-merged blind spot (Task 1 pattern):** 0 in this final count — Task 1's 15 findings (`rbac.ts` 1 + `result.ts` 14) are **all** test-only-consumed or transitively-reached-via-a-known-false-positive-file, not string-keyed lookups in the STAFF_ACTIONS/AppErrorCode-union sense; none were deletable, all retained with cause documented above. Zero RBAC action strings or `AppErrorCode` union members were found individually flagged at all in this run.
- **Test-only-consumed (production-mode false positive):** 25 — `result.ts` (14, including `sessionStillRunningError`, which is *also* transitively reachable via a false-positive file — counted once here), `rbac.ts` `isStaffAction` (1), `category-tree.ts` (3), `format.ts` `parseMoneyInput` (1), `phone.ts` `isE164` (1), `pos-printer.ts` `receiptDataToPrinterLines` (1), `split-math.ts` `fromCents` (1), `logger.ts` `sanitizePayload`/`redactString` (2), `CsvImportSheet.tsx` `parseCsvText` (1)
- **Genuinely production-consumed, transitively mis-flagged via an already-adjudicated false-positive file (not already counted above):** `rappi-constants.ts` `RAPPI_DEFAULT_TENANT_ID` (1)
- **Confirmed-dead pair blocked by this plan's no-whole-file-deletion rule:** `CategoryForm.tsx` `CategoryFormProps` + `CategoryForm` (2)
- **domain-helpers.ts genuinely-consumed (production + test):** 7

25 + 1 + 2 + 7 = 35, reconciling exactly with the scoped after-count above. The authoritative record is the flat 35-row scoped list reproduced by re-running the Method section's knip query — every one of those 35 rows has its individual disposition documented in the Task 1/Task 2 sections above; the categories here are a descriptive grouping for this summary, not a re-derivation.

### Whole-project comparison (39-01's full method: files+exports+types+dups, `src/shared/ui/**` excluded), isolated to this worktree's own changes

| Category | Before this plan (worktree start) | After this plan | Δ |
|---|---|---|---|
| Sum (distinct: files+exports+types+dups) | not independently re-measured whole-project at plan start (this plan only touches its 3 named scopes; 39-09/39-10 make concurrent, isolated changes in sibling worktrees not visible here) | 565 | n/a — see scoped delta above for the authoritative, comparable number |

The scoped before/after (119 → 35, Δ −84) is the number directly comparable to 39-08-LEDGER.md's published estimate and to sibling plans 39-09/39-10's own scoped deltas; the whole-project figure is provided for context only and is not meaningful for cross-plan comparison since 39-09 and 39-10 ran concurrently in separate worktrees during this same wave.
