# Phase 39 Plan 08 — FSD Barrel Decision Ledger

**Generated:** 2026-08-06 (worktree re-run; `node_modules`/`.env.local` restored per the documented environment gap, see PLAN's `<parallel_execution>` note)

## Task 1 — Barrel Inventory and Import-Ratio Measurement

### Method

Regenerated both knip reports fresh (`npx knip --reporter json`, `npx knip --production --reporter json`), then computed the distinct `(file, line, name)` set-union over `exports`/`types` across both reports, excluding `src/shared/ui/**` (D-08), per 39-RESEARCH.md's "Diffing distinct dead-code count after a deletion wave" method (same method 39-01-LEDGER.md and 39-03-LEDGER.md used).

### Barrel vs. non-barrel split

Partitioned the 918 distinct line-level export/type findings by whether the file path ends in `/index.ts` or `/index.tsx`:

| Side | Findings | Distinct files |
|---|---|---|
| Barrel (`**/index.ts(x)`) | **433** | **64** |
| Non-barrel | **485** | **78** |
| **Total** | **918** | **142** |

Re-derived and matches 39-RESEARCH.md's planning-time figures (433/64 vs 485/78) exactly — no drift since the research snapshot.

Full per-barrel finding count (all 64 files, used directly as the Task 2 per-barrel outcome scaffold):

| File | Findings |
|---|---|
| `src/entities/audit-log/index.ts` | 4 |
| `src/entities/audit-log/model/index.ts` | 4 |
| `src/entities/caja/index.ts` | 5 |
| `src/entities/caja/model/index.ts` | 4 |
| `src/entities/category/index.ts` | 9 |
| `src/entities/category/model/index.ts` | 9 |
| `src/entities/combo/index.ts` | 6 |
| `src/entities/ingredient/index.ts` | 9 |
| `src/entities/inventory/index.ts` | 11 |
| `src/entities/inventory/model/index.ts` | 9 |
| `src/entities/kds/index.ts` | 1 |
| `src/entities/modifier-inventory-rule/index.ts` | 5 |
| `src/entities/open-unit/index.ts` | 6 |
| `src/entities/payment/index.ts` | 15 |
| `src/entities/payment/model/index.ts` | 15 |
| `src/entities/prep/index.ts` | 3 |
| `src/entities/product/index.ts` | 18 |
| `src/entities/product/model/index.ts` | 18 |
| `src/entities/promotion/index.ts` | 6 |
| `src/entities/rappi-order/index.ts` | 5 |
| `src/entities/rappi-order/model/index.ts` | 7 |
| `src/entities/rbac/index.ts` | 4 |
| `src/entities/rbac/model/index.ts` | 4 |
| `src/entities/recipe/index.ts` | 13 |
| `src/entities/refund/index.ts` | 7 |
| `src/entities/resource/index.ts` | 23 |
| `src/entities/resource/model/index.ts` | 22 |
| `src/entities/settings/index.ts` | 9 |
| `src/entities/settings/model/index.ts` | 17 |
| `src/entities/staff/index.ts` | 18 |
| `src/entities/staff/model/index.ts` | 21 |
| `src/entities/tab/index.ts` | 22 |
| `src/entities/tab/model/index.ts` | 24 |
| `src/entities/waitlist/index.ts` | 11 |
| `src/features/add-combo-to-tab/index.ts` | 1 |
| `src/features/assign-pool-session-to-tab/index.ts` | 1 |
| `src/features/clock-in-staff/index.ts` | 1 |
| `src/features/clock-out-staff/index.ts` | 1 |
| `src/features/correct-open-unit/index.ts` | 2 |
| `src/features/edit-paid-tab/index.ts` | 5 |
| `src/features/edit-session-start-time/index.ts` | 1 |
| `src/features/edit-staff-locale/index.ts` | 1 |
| `src/features/edit-staff-role/index.ts` | 1 |
| `src/features/export-report/index.ts` | 2 |
| `src/features/force-pin-change/index.ts` | 3 |
| `src/features/manage-products/index.ts` | 3 |
| `src/features/manage-recipe/index.ts` | 1 |
| `src/features/manager-pin-gate/index.ts` | 1 |
| `src/features/open-open-unit/index.ts` | 2 |
| `src/features/physical-count/index.ts` | 5 |
| `src/features/process-refund/index.ts` | 4 |
| `src/features/produce-prep-batch/index.ts` | 2 |
| `src/features/register-caja-entry/index.ts` | 1 |
| `src/features/reopen-tab/index.ts` | 4 |
| `src/features/split-tab/index.ts` | 8 |
| `src/features/start-pool-timer/index.ts` | 1 |
| `src/features/stop-pool-timer/index.ts` | 1 |
| `src/features/toggle-permission/index.ts` | 1 |
| `src/features/transfer-tab/index.ts` | 7 |
| `src/features/upload-logo/index.ts` | 4 |
| `src/features/void-open-unit/index.ts` | 2 |
| `src/features/void-order/index.ts` | 1 |
| `src/widgets/KdsBoard/index.tsx` | 1 |
| `src/widgets/PaymentModal/index.tsx` | 1 |
| **Total** | **433** |

### Whole-file-dead barrels

Union of both reports' `files` (unused-file) arrays, filtered to `**/index.ts(x)`, gives 26 raw hits. 13 of those are `supabase/functions/**/index.ts` (Deno HTTP entry points — a completely different pattern, already adjudicated FALSE POSITIVE in 39-03-LEDGER.md Task 1, out of this plan's scope) and 1 is `src/features/close-tab/index.ts` (already adjudicated FALSE POSITIVE in 39-03-LEDGER.md Task 2 — it's the feature's actual implementation file exercised by its own test, not a re-export barrel, and not FSD-barrel-shaped). Excluding those 14 leaves exactly the 12 FSD-slice barrels this plan's frontmatter names:

| # | File |
|---|---|
| 1 | `src/entities/combo/model/index.ts` |
| 2 | `src/entities/promotion/model/index.ts` |
| 3 | `src/features/add-item-to-tab/model/index.ts` |
| 4 | `src/features/add-item-to-tab/ui/index.ts` |
| 5 | `src/features/open-tab/index.ts` |
| 6 | `src/features/open-tab/ui/index.ts` |
| 7 | `src/features/print-precheque/index.ts` |
| 8 | `src/features/remove-item-from-tab/index.ts` |
| 9 | `src/features/remove-tab-item/index.ts` |
| 10 | `src/features/stop-and-move-table/index.ts` |
| 11 | `src/shared/lib/index.ts` |
| 12 | `src/widgets/RappiOrderBadge/index.ts` |

These 12 are a materially different case from the 64 barrels above: nothing imports them at all (whole-file dead), versus a live barrel with some unused re-export lines.

### Barrel-style vs. deep-path import ratio across `src/`

Measured every `import ... from '@entities/...'` / `@features/...` / `@widgets/...` statement across all `.ts`/`.tsx` files under `src/`, classifying each specifier as **barrel-style** (`@layer/slice`, exactly 2 path segments — imports through the slice's declared public API) or **deep-path** (`@layer/slice/...`, 3+ segments — reaches past the barrel into `model/`/`ui/` directly).

**Commands used:**
```bash
# Raw grep (includes JSDoc example-code comments as false positives — see note)
grep -rhoE "from ['\"]@(entities|features|widgets)/[^'\"]+['\"]" src \
  --include="*.ts" --include="*.tsx" \
  | sed -E "s/from ['\"]//;s/['\"]//" \
  | awk -F/ '{ if (NF==2) b++; else d++ } END { print "barrel:", b; print "deep:", d }'
# => barrel: 272, deep: 245

# Corrected: strip block/line comments first, then match only real
# `import ... from '...'` / `export ... from '...'` statements (Node script,
# regex: /(?:^|\n)\s*(?:import|export)\s[^;\n]*?from\s+['"](@(?:entities|features|widgets)\/[^'"]+)['"]/g
# applied after /\*[\s\S]*?\*\// and //-comment stripping)
```

**Correction note:** The raw grep over-counts barrel-style imports by 20 (272 vs. 252) because several barrel `index.ts` files carry a JSDoc header documenting their own public API with a literal example, e.g. `src/entities/category/index.ts`:
```ts
/**
 * Category entity public API.
 * Import from here: `import { useCategories } from '@entities/category'`
 * ...
 */
```
That comment text matches the same `from '@entities/category'` pattern as a real import. Stripping comments before matching removes this artifact (and 4 similar deep-path comment hits), giving the corrected count below.

| | Count |
|---|---|
| Barrel-style imports (`@layer/slice`) | **252** |
| Deep-path imports (`@layer/slice/...`) | **241** |
| Ratio (deep : barrel) | **0.96 : 1** |

**Reading:** This is the single most decision-relevant number, and it does **not** confirm the plan's planning-time hypothesis. 39-RESEARCH.md and this plan's own `<context>` state "at planning time deep-path imports outnumbered barrel-style ones" — that assumption does not hold under direct measurement. The two styles are nearly even, with barrel-style very slightly ahead (252 vs 241, an 11-import margin, 51% vs 49%). The barrel convention has **not** eroded in practice — it is still followed almost exactly as often as it is bypassed. This is evidence for reading the 433 findings as substantially a visibility gap (knip not crediting deep-path-adjacent consumers who *could* reach the same symbol through the barrel, or barrels exporting more than any *single* current consumer needs) rather than as 433 genuinely abandoned API surfaces — which favors Option B (configure) or Option C (hybrid) over Option A (prune) on the evidence, though the near-50/50 split is close enough that it does not settle the question outright.

## Decision (Task 2 checkpoint)

**Selected: Option C — Hybrid.** Delete the 12 whole-dead barrels. For the 433 line-level re-export findings, prune a re-export only where the underlying declaration is *also* independently flagged dead by knip (i.e., nobody reaches the symbol at all, not even via deep-path or through the barrel) — keep re-exports for symbols that are live, even if currently reached only via deep-path import rather than through the barrel. No `knip.json` changes.

## Task 2 — Applying the Decision

### 12 whole-dead barrels — sanity check and deletion

Every barrel was checked with a repository-wide search for both the directory-style import path (`@layer/slice` or `@layer/slice/subpath`) and the literal file path before deletion, per the plan's mandated pattern. All 12 confirmed zero functional hits (only comment/doc-string mentions or unrelated string-literal matches, e.g. the `'open-tab'` offline-queue action-type literal, which is unrelated to the `@features/open-tab` barrel import):

| # | File | Search evidence | Outcome |
|---|---|---|---|
| 1 | `src/entities/combo/model/index.ts` | `grep -rn "entities/combo/model" src/` → 2 hits, both header/doc comments in sibling files, zero imports | DELETED |
| 2 | `src/entities/promotion/model/index.ts` | `grep -rn "entities/promotion/model" src/` → 5 hits, all doc-comment references in test files, zero imports | DELETED |
| 3 | `src/features/add-item-to-tab/model/index.ts` | `grep -rn "add-item-to-tab/model" src/` → 0 hits | DELETED |
| 4 | `src/features/add-item-to-tab/ui/index.ts` | `grep -rn "add-item-to-tab/ui" src/` → 1 hit, deep-path `@features/add-item-to-tab/ui/ModifierSheet` (bypasses this barrel, doesn't import it) | DELETED |
| 5 | `src/features/open-tab/index.ts` | `grep -rn "open-tab" src/` → all hits are the unrelated `'open-tab'` offline-queue action-type string literal, or deep-path imports into `ui/OpenTabDialog`/`ui/OpenTabButton`; zero barrel-style hits | DELETED |
| 6 | `src/features/open-tab/ui/index.ts` | `grep -rn "features/open-tab/ui" src/` → 2 hits, both deep-path into `OpenTabDialog`/`OpenTabButton`, zero barrel-style | DELETED |
| 7 | `src/features/print-precheque/index.ts` | `grep -rn "print-precheque" src/` → 1 hit, deep-path `@features/print-precheque/usePrintPreCheque` | DELETED |
| 8 | `src/features/remove-item-from-tab/index.ts` | `grep -rn "remove-item-from-tab" src/` → 0 hits | DELETED |
| 9 | `src/features/remove-tab-item/index.ts` | `grep -rn "remove-tab-item" src/` → 3 hits, 2 unrelated i18n label strings (`htmlFor`/`id="remove-tab-item-reason"`), 1 deep-path `@features/remove-tab-item/ui/RemoveTabItemDialog` | DELETED |
| 10 | `src/features/stop-and-move-table/index.ts` | `grep -rn "stop-and-move-table" src/` → 1 hit, deep-path `@features/stop-and-move-table/ui/StopAndMoveDialog` | DELETED |
| 11 | `src/shared/lib/index.ts` | `grep -rn "@shared/lib['\"]" src/` and `grep -rln "shared/lib'" src/` → 0 hits | DELETED |
| 12 | `src/widgets/RappiOrderBadge/index.ts` + `src/widgets/RappiOrderBadge/RappiOrderBadge.tsx` | `grep -rn "RappiOrderBadge" src/` → only the two files' own declarations, zero external references | **DELETED TOGETHER, single commit** (T-39-12 — barrel + component pair, per 39-03's deferral) |

### 433 barrel re-export findings — per-barrel outcome (hybrid rule applied)

**Method:** for each flagged re-export `export { X, ... } from '<spec>'` (or `export type { ... }`), resolved `<spec>` to its actual file (handling relative paths, `@entities/@features/@widgets/@shared` tsconfig aliases, and one indirect import-then-plain-export pattern in `PaymentModal/index.tsx`), then checked whether the same symbol name is *also* independently flagged unused in the resolved underlying file's own knip findings (default+production union). Pruned only when both the barrel re-export AND the underlying declaration are dead. A worked example: `src/entities/audit-log/index.ts` re-exports `AuditLogSchema` from `./model` (itself `model/index.ts`, also one of the 64 barrels); `model/index.ts` re-exports it from `./types`; knip's production-mode report independently flags `AuditLogSchema` as unused at all three levels (`audit-log/index.ts`, `model/index.ts`, and `model/types.ts`) — confirming nobody reaches it via any path, barrel or deep. All three re-export levels get pruned in this plan; the leaf declaration in `model/types.ts` is untouched (that's a non-barrel finding, in 39-10's working set).

**Total: 293 re-exports pruned, 140 kept** (139 where the underlying declaration is independently live — reached via deep-path or elsewhere — plus 1 special case, `KdsCard`, below).

| File | Findings | Pruned | Kept | Pruned names | Notes |
|---|---|---|---|---|---|
| `src/entities/audit-log/index.ts` | 4 | 4 | 0 | AuditLogSchema, AuditLogFiltersSchema, PAGE_SIZE, sanitizeSearch | |
| `src/entities/audit-log/model/index.ts` | 4 | 4 | 0 | AuditLogSchema, AuditLogFiltersSchema, PAGE_SIZE, sanitizeSearch | |
| `src/entities/caja/index.ts` | 5 | 4 | 1 | cajaKeys, cajaEntryKeys, tipDistributionKeys, CajaPaymentSummary | |
| `src/entities/caja/model/index.ts` | 4 | 3 | 1 | cajaKeys, cajaEntryKeys, tipDistributionKeys | |
| `src/entities/category/index.ts` | 9 | 9 | 0 | CategorySchema, CategoryCreateSchema, CategoryUpdateSchema, buildCategoryTree, CATEGORY_QUERY_KEY, useCategoryTree, CategoryCreate, CategoryUpdate, CategoryNode | |
| `src/entities/category/model/index.ts` | 9 | 7 | 2 | CategorySchema, CategoryCreateSchema, CategoryUpdateSchema, CATEGORY_QUERY_KEY, useCategoryTree, CategoryCreate, CategoryUpdate | |
| `src/entities/combo/index.ts` | 6 | 6 | 0 | ComboSlotCreate, ComboSlotUpdate, ComboSlotOptionCreate, ComboAvailabilityCreate, SlotSelection, AddComboToTabInput | |
| `src/entities/ingredient/index.ts` | 9 | 9 | 0 | useIngredient, IngredientSchema, IngredientUpdateSchema, ManualAdjustReasonSchema, UomSchema, BaseUomSchema, IngredientUpdate, Uom, BaseUom | |
| `src/entities/inventory/index.ts` | 11 | 11 | 0 | InventorySchema, InventoryLogSchema, useInventoryStore, selectInventoryByProductId, selectIsLowStock, useInventoryByProduct, useLowStockInventory, InventoryRow, InventoryLog, LowStockAlertItem, InventoryRowProps | |
| `src/entities/inventory/model/index.ts` | 9 | 6 | 3 | selectInventoryByProductId, selectIsLowStock, useInventoryByProduct, useLowStockInventory, InventoryLog, LowStockAlertItem | |
| `src/entities/kds/index.ts` | 1 | 0 | 1 | — | |
| `src/entities/modifier-inventory-rule/index.ts` | 5 | 5 | 0 | ModifierInventoryRuleSchema, ModifierInventoryRuleCreateSchema, modifierInventoryRuleKeys, ModifierInventoryRule, ModifierInventoryRuleCreate | |
| `src/entities/open-unit/index.ts` | 6 | 6 | 0 | OpenUnitSchema, OpenUnitStatusSchema, OpenUnitCorrectionSchema, openUnitKeys, OpenUnitStatus, OpenUnitCorrection | |
| `src/entities/payment/index.ts` | 15 | 15 | 0 | PaymentSchema, CreatePaymentSchema, UpdatePaymentSchema, mockPayments, usePaymentStore, selectPaymentByTabId, selectPaymentsByMethod, selectPaymentsByStaffId, selectPaymentsByDateRange, selectTotalRevenue, selectTotalTips, paymentItemKeys, CreatePayment, UpdatePayment, OrderItemForRefund | |
| `src/entities/payment/model/index.ts` | 15 | 12 | 3 | CreatePaymentSchema, UpdatePaymentSchema, mockPayments, usePaymentStore, selectPaymentByTabId, selectPaymentsByMethod, selectPaymentsByStaffId, selectPaymentsByDateRange, selectTotalRevenue, selectTotalTips, paymentItemKeys, UpdatePayment | |
| `src/entities/prep/index.ts` | 3 | 3 | 0 | prepKeys, PrepProductionSchema, PrepProductionCreateSchema | |
| `src/entities/product/index.ts` | 18 | 18 | 0 | ProductSchema, CategorySchema, ModifierSchema, ProductCreateSchema, useProductStore, selectActiveProducts, selectProductsByCategoryId, selectProductById, selectCategoryById, selectModifierById, selectModifiersByIds, useCategories, useMutationCreateCategory, useMutationUpdateCategory, Product, Category, Modifier, ProductCreate | |
| `src/entities/product/model/index.ts` | 18 | 10 | 8 | ProductCreateSchema, selectActiveProducts, selectProductById, selectCategoryById, selectProductsByCategoryId, selectModifierById, selectModifiersByIds, useMutationCreateCategory, useMutationUpdateCategory, ProductCreate | |
| `src/entities/promotion/index.ts` | 6 | 6 | 0 | usePromotionActive, Promotion, PromotionCreate, PromotionUpdate, PromotionAvailabilityCreate, AppliedPromotion | |
| `src/entities/rappi-order/index.ts` | 5 | 5 | 0 | acceptRappiOrder, rejectRappiOrder, markRappiOrderReady, markRappiOrderCompleted, setRappiOrderPreparing | |
| `src/entities/rappi-order/model/index.ts` | 7 | 1 | 6 | rappiOrdersListQueryKey | |
| `src/entities/rbac/index.ts` | 4 | 4 | 0 | RolePermissionSchema, RolePermissionCreateSchema, RolePermission, RolePermissionCreate | |
| `src/entities/rbac/model/index.ts` | 4 | 4 | 0 | RolePermissionSchema, RolePermissionCreateSchema, RolePermission, RolePermissionCreate | |
| `src/entities/recipe/index.ts` | 13 | 13 | 0 | RecipeSchema, RecipeItemSchema, RecipeWithItemsSchema, RecipeCreateSchema, RecipeItemCreateSchema, RecipeUpdateSchema, recipeKeys, Recipe, RecipeCreate, RecipeItem, RecipeItemCreate, RecipeUpdate, RecipeWithItems | |
| `src/entities/refund/index.ts` | 7 | 5 | 2 | RefundSchema, RefundItemSchema, RefundReasonSchema, RefundCreateSchema, RefundCreate | |
| `src/entities/resource/index.ts` | 23 | 22 | 1 | ResourceSchema, PoolSessionSchema, PoolSessionSummarySchema, ResourceTypeSchema, useResourceStore, selectTableById, selectActiveSessionForTable, selectAvailableTableCount, selectSessionsByTabId, resourceKeys, useResource, useMutationStartSession, useMutationStopSession, usePoolSessionsByTab, useMutationLinkPoolSessionToTab, usePoolTimer, Resource, PoolSession, PoolTableStatus, ResourceType, PoolSessionSummary, UsePoolTimerOptions | |
| `src/entities/resource/model/index.ts` | 22 | 12 | 10 | PoolSessionSummarySchema, ResourceTypeSchema, selectTableById, selectActiveSessionForTable, selectAvailableTableCount, selectSessionsByTabId, usePoolSessionsByTab, Resource, PoolSession, PoolTableStatus, ResourceType, PoolSessionSummary | |
| `src/entities/settings/index.ts` | 9 | 9 | 0 | settingsKeys, TipDistributionSettingsSchema, SettingsSnapshot, BillingSettings, EmailReceiptSettings, GeneralSettings, RappiSettings, SettingsBackupSummary, SettingsKey | |
| `src/entities/settings/model/index.ts` | 17 | 2 | 15 | settingsKeys, SettingsKeySchema | |
| `src/entities/staff/index.ts` | 18 | 18 | 0 | StaffSchema, StaffCreateSchema, StaffUpdateSchema, ShiftSchema, ShiftCreateSchema, ShiftUpdateSchema, staffKeys, useLoginUiStore, useMutationClockIn, useMutationClockOut, useShiftClosePreview, Staff, StaffCreate, StaffUpdate, Shift, ShiftCreate, ShiftUpdate, ShiftClosePreview | |
| `src/entities/staff/model/index.ts` | 21 | 11 | 10 | CreateStaffSchema, mockStaff, StaffCreateSchema, StaffUpdateSchema, ShiftCreateSchema, ShiftUpdateSchema, StaffCreate, StaffUpdate, Shift, ShiftCreate, ShiftUpdate | |
| `src/entities/tab/index.ts` | 22 | 22 | 0 | TabSchema, OrderSchema, OrderItemSchema, OrderItemCreateSchema, CartItemInputSchema, mockTab, mockTabItem, useTabStore, useMutationOpenTab, useMutationAddOrder, useMutationUpdateTabStatus, useMutationRecordTabPayment, useVoidOrder, useCartStore, Order, OrderItem, CreateTab, CreateOrder, CreateOrderItem, CartItemInput, TabStatus, OrderStatus | |
| `src/entities/tab/model/index.ts` | 24 | 12 | 12 | selectOpenTabs, OrderItemCreateSchema, CartItemInputSchema, mockTab, mockTabItem, useMutationUpdateTabStatus, useMutationRecordTabPayment, useVoidOrder, OrderItem, CartItemInput, TabStatus, OrderStatus | |
| `src/entities/waitlist/index.ts` | 11 | 9 | 2 | useWaitlistEntry, useMutationUpdateWaitlistStatus, WaitlistEntrySchema, WaitlistEntryCreateSchema, WaitlistNotificationSchema, WaitlistEntryStatusSchema, PhoneE164Schema, useWaitlistStore, WaitlistEntryStatus | |
| `src/features/add-combo-to-tab/index.ts` | 1 | 0 | 1 | — | |
| `src/features/assign-pool-session-to-tab/index.ts` | 1 | 0 | 1 | — | |
| `src/features/clock-in-staff/index.ts` | 1 | 0 | 1 | — | |
| `src/features/clock-out-staff/index.ts` | 1 | 0 | 1 | — | |
| `src/features/correct-open-unit/index.ts` | 2 | 0 | 2 | — | |
| `src/features/edit-paid-tab/index.ts` | 5 | 1 | 4 | EditPaidTabPatchOp | |
| `src/features/edit-session-start-time/index.ts` | 1 | 0 | 1 | — | |
| `src/features/edit-staff-locale/index.ts` | 1 | 0 | 1 | — | |
| `src/features/edit-staff-role/index.ts` | 1 | 0 | 1 | — | |
| `src/features/export-report/index.ts` | 2 | 0 | 2 | — | |
| `src/features/force-pin-change/index.ts` | 3 | 0 | 3 | — | |
| `src/features/manage-products/index.ts` | 3 | 1 | 2 | CatalogCategoriesTab | |
| `src/features/manage-recipe/index.ts` | 1 | 0 | 1 | — | |
| `src/features/manager-pin-gate/index.ts` | 1 | 0 | 1 | — | |
| `src/features/open-open-unit/index.ts` | 2 | 0 | 2 | — | |
| `src/features/physical-count/index.ts` | 5 | 1 | 4 | PhysicalCountEntry | |
| `src/features/process-refund/index.ts` | 4 | 1 | 3 | RefundItemInput | |
| `src/features/produce-prep-batch/index.ts` | 2 | 0 | 2 | — | |
| `src/features/register-caja-entry/index.ts` | 1 | 0 | 1 | — | |
| `src/features/reopen-tab/index.ts` | 4 | 0 | 4 | — | |
| `src/features/split-tab/index.ts` | 8 | 0 | 8 | — | |
| `src/features/start-pool-timer/index.ts` | 1 | 0 | 1 | — | |
| `src/features/stop-pool-timer/index.ts` | 1 | 0 | 1 | — | |
| `src/features/toggle-permission/index.ts` | 1 | 0 | 1 | — | |
| `src/features/transfer-tab/index.ts` | 7 | 0 | 7 | — | |
| `src/features/upload-logo/index.ts` | 4 | 2 | 2 | LOGO_MAX_BYTES, LOGO_MAX_WIDTH | |
| `src/features/void-open-unit/index.ts` | 2 | 0 | 2 | — | |
| `src/features/void-order/index.ts` | 1 | 0 | 1 | — | |
| `src/widgets/KdsBoard/index.tsx` | 1 | 0 | 1 | — | `KdsCard` is a *locally declared* component in this file, not a re-export (this widget's `index.tsx` is its own implementation file, same shape as `close-tab/index.ts`/`TabDetail.tsx` in 39-03). Production-mode-only finding, reachable via `KdsCard.test.tsx` — same false-positive pattern already adjudicated in 39-03. Not pruned; out of the hybrid rule's re-export scope entirely. |
| `src/widgets/PaymentModal/index.tsx` | 1 | 0 | 1 | — | `PaymentProcessors` re-exported indirectly (`import type {...} from './ui/PaymentForm'` then `export type { PaymentProcessors };`, no `from` clause on the export itself). Production-mode-only finding; underlying declaration in `PaymentForm.tsx` is NOT flagged dead (used internally + imported by `PaymentForm.test.tsx`) — kept per hybrid rule. |

### Verification

```
npm run typecheck   # clean, zero errors
npm run lint         # clean — only the pre-existing [boundaries] legacy-selector-syntax warning
                       (documented out-of-scope in 39-01-LEDGER.md), zero new violations,
                       eslint-plugin-boundaries reports no import-direction breakage
npm run test          # 1391 passed, 15 todo (153 test files, 151 passed + 2 skipped)
                       — exact match to the pre-existing baseline, zero regression
```

No barrel file was deleted while any consumer import of its slice path remained (every one of the 12 whole-dead barrels was individually sanity-checked above). `src/widgets/RappiOrderBadge/index.ts` and `RappiOrderBadge.tsx` were resolved together in one commit. `knip.json` was not modified.

## Task 3 — Post-decision Knip Baseline

### Method

Regenerated both knip reports fresh (`npx knip --reporter json` / `--production --reporter json`), re-ran twice to confirm stability (identical counts both runs), then recomputed the distinct finding count with the same `(file, line, name)` set-union method used for the original 39-01-LEDGER.md baseline (files ∪ exports ∪ types ∪ duplicates, excluding `src/shared/ui/**`, dependency categories read separately and not folded in).

### Baseline comparison (39-01's full method — comparable across the whole phase)

| Category | Before this plan (Task 1 snapshot) | After this plan (Task 3) | Δ |
|---|---|---|---|
| Unused files | 50 | 43 | −7 (net: −13 deleted, +6 newly-surfaced, see below) |
| Unused exports | 613 | 399 | −214 |
| Unused types | 305 | 204 | −101 |
| Duplicate-export pairs | 3 | 3 | 0 |
| **Sum (distinct)** | **971** | **649** | **−322** |
| Distinct files touched | 187 | 156 | −31 |

Cross-check against 39-01-LEDGER.md: original baseline (post-39-01) was 982 → 39-03's 10-file sweep dropped it to 971 (matches this plan's "before" snapshot exactly, confirming no drift between 39-03 and this plan's Task 1). This plan's decision drops it further to **649** — a 33% reduction phase-to-date from the original 982.

### Plan's own Task 3 verify metric (exports+types union only, matches the `<verify>` command)

| | Before | After | Δ |
|---|---|---|---|
| Distinct export/type findings | 918 | **603** | **−315** |

This is lower than the 293 re-exports directly pruned in Task 2 because pruning a re-export can promote a file from "N unused exports, still reachable" to "1 unused whole file" once nothing reaches it at all anymore — those promoted files move from the `exports`/`types` categories into the `files` category (not double-counted in this metric). See below.

### Byproduct: 6 files newly reclassified whole-file-dead

Pruning barrel re-exports whose underlying declaration was also dead made 6 further files completely unreachable (previously "partially used" — some exports genuinely dead, file still counted reachable via the barrel's own dead re-export edge; now the file itself has zero remaining reachability):

| File | Was (pre-decision) | Now (post-decision) |
|---|---|---|
| `src/entities/recipe/model/types.ts` | 13 unused export/type findings | 1 unused-file finding |
| `src/entities/rbac/model/types.ts` | 4 unused export/type findings | 1 unused-file finding |
| `src/entities/modifier-inventory-rule/model/types.ts` | 4 unused export/type findings | 1 unused-file finding |
| `src/entities/payment/model/store.ts` | 7 unused export/type findings | 1 unused-file finding |
| `src/entities/waitlist/model/store.ts` | 1 unused export/type finding | 1 unused-file finding |
| `src/features/manage-products/ui/CatalogCategoriesTab.tsx` | 1 unused export/type finding | 1 unused-file finding |

These are genuine simplifications for the downstream plans that own them (39-10 for the 5 entities files, 39-11 for the 1 features file) — a single whole-file deletion candidate (after the same repo-wide sanity check pattern from 39-01/39-03) replaces what would otherwise have been several individual export deletions. Not deleted in this plan — out of Task 2's scope (only the 12 barrels named in this plan's frontmatter were whole-file candidates here).

**Also net +4, relocated not created:** `src/entities/rbac/index.ts`/`model/index.ts` pruning exposed `RolePermissionSchema`, `RolePermissionCreateSchema`, `RolePermission`, `RolePermissionCreate` as newly-unused at their true origin, `src/shared/lib/domain.ts` (previously "used" only because `rbac/model/types.ts` re-exported them, which itself only counted as reachable because the barrel chain re-exported *it*). Same 4 dead symbols, just now attributed to the correct origin file — not new dead code, a bookkeeping relocation. Folded into 39-09's domain.ts working set below.

### Working sets for plans 39-09, 39-10, 39-11

Computed from these post-decision reports (fresh regeneration, not from 39-RESEARCH.md's pre-decision figures, per this plan's explicit instruction — under option C some symbols reachable only via now-pruned barrel paths are gone from the report entirely, and some are newly exposed at their true origin as shown above).

| Plan | Scope | Export/type findings | Whole-file candidates |
|---|---|---|---|
| **39-09** | `src/shared/lib/domain.ts` + `src/shared/lib/edge-function-contracts.ts` | **196** | 0 |
| **39-10** | Remaining non-barrel findings under `src/entities/` | **148** | **7**: `modifier-inventory-rule/model/types.ts`, `rbac/model/types.ts`, `recipe/model/types.ts`, `waitlist/model/store.ts`, `payment/model/store.ts` (all newly-surfaced by this plan's Task 2, see above), plus `tab/ui/PoolChargeItem.tsx` and `tab/ui/TabDetail.tsx` (both already adjudicated FALSE POSITIVE — reachable via test/story — in 39-03-LEDGER.md; still present here as a knip finding, but not new dead code) |
| **39-11** | Remaining non-barrel findings under `src/shared/` (excl. `domain.ts`/`edge-function-contracts.ts`/`shared/ui/**`) + `src/features/` | **117** | **8**: `features/manage-products/ui/CatalogCategoriesTab.tsx` (newly-surfaced, see above); `shared/lib/mocks.ts`, `promotion-pricing.ts`, `rappi-webhook-payload.ts`, `supabase-test-client.ts`, `test-setup.ts`, `test-utils.tsx`, `uom.ts` (all 7 already adjudicated FALSE POSITIVE — test-only/config-wired — in 39-03-LEDGER.md Task 2) |

**No `src/widgets/**` non-barrel working set exists** — post-decision, zero non-barrel findings remain under `src/widgets/` (confirmed by exhaustive check across every non-barrel, non-entities/features/shared file: only 2 residual findings exist anywhere outside the three named scopes, both in `e2e/helpers/supabase.ts`, which is Track A's territory, not Track B's — out of this plan's and 39-09/10/11's scope entirely).

**Coverage check:** 196 + 148 + 117 + 2 (e2e, unassigned) = 463 = the full post-decision non-barrel export/type total. All 463 non-barrel findings are accounted for across the three working sets plus the 2 pre-existing e2e items — nothing is silently dropped.
