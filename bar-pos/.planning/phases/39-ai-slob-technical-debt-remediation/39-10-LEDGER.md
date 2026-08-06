# Phase 39 Plan 10 — Entities Layer Non-Barrel Dead-Declaration Ledger

## Method

Working set: the 148 non-barrel `src/entities/` export/type findings published by 39-08-LEDGER.md's post-decision knip baseline (`src/entities/**`, excluding `**/index.ts(x)` barrel files). Reconstructed fresh in this worktree by re-running `npx knip --reporter json` and `npx knip --production --reporter json`, taking the distinct `(file, line, name)` set-union over `exports`/`types` filtered to `src/entities/` non-barrel files — **148 findings, exact match** to 39-08-LEDGER.md's stated working set for this plan.

Per finding, three checks were performed (not just a single bare-identifier grep, per the caution that many of these declarations are re-export shims of `@shared/lib/domain` schemas whose bare names are used dozens of times elsewhere in the codebase via a *different* import path — see "why bare-identifier count alone is insufficient" below):

1. **`grep -rn "\b<name>\b" src supabase e2e`** — repository-wide bare-identifier search, hit count recorded per row (the `grep -rn` hit count column, excluding the declaration's own line).
2. **Full-repo import-graph resolution** — a purpose-built script parsed every `import`/`export ... from` statement under `src/`, `e2e/`, `supabase/`, `scripts/` (multi-line-safe, comment-stripped, resolving both relative and `@entities`/`@features`/`@widgets`/`@shared`/`@app`/`@pages` tsconfig aliases, including namespace-import `alias.property` member-access tracing), building a map of `resolvedFile -> Set(importedNames)`. A finding is **path-aware reached** only if something imports/re-exports its exact name *from its own declaring file's module path* — not merely if the same name is used anywhere in the codebase (the domain.ts-native symbol names are frequently reached via a **different** origin path, most commonly a direct `@shared/lib/domain` import that bypasses this entity's re-export shim entirely).
3. **Knip per-mode cross-check** — for every finding NOT resolved as reached by (2), its live/dead status in knip's default-mode vs. production-mode report was compared. A finding dead in both modes is confirmed dead. A finding dead in production-mode only (i.e. live in default mode) means it is reached exclusively from a `.test.ts(x)`/`.stories.tsx` file — the same false-positive pattern 39-01-LEDGER.md/39-03-LEDGER.md already established for entities-layer files (`KdsCard`, `PoolChargeItem.tsx`, `TabDetail.tsx`) — and is **kept, not deleted**, with the specific reaching test/story file(s) recorded per row.

**Why bare-identifier count alone is insufficient (worked example):** `src/entities/category/model/types.ts:2` re-exports `CategorySchema` from `@shared/lib/domain` under this entity's own module path. A bare-identifier grep for `CategorySchema` finds 33 hits elsewhere in the repo — but every one of those 33 is a direct `import { CategorySchema } from '@shared/lib/domain'` (or a hit inside `domain.ts` itself), none of which resolves through `@entities/category/model/types` or the (already-pruned, per 39-08) `@entities/category/model`/`@entities/category` barrels. The re-export line in this file is therefore genuinely dead despite the symbol name being heavily used — deleting it does not touch `domain.ts`'s own internal `CategorySchema` declaration or any of its 33 real consumers, since none of them route through this specific file.

**Paired Zod schema/type discipline (39-PATTERNS.md item 3, applied in both directions):** most flagged files here are pure re-export shims (`export { XSchema } from '@shared/lib/domain'; export type { X } from '@shared/lib/domain';`) where deleting one half's re-export line has zero effect on the other half or on `domain.ts`'s own internal derivation. One file — `src/entities/kds/model/types.ts` — is a genuine local declaration (`export const KdsOrderItemSchema = z.object({...}); export type KdsOrderItem = z.infer<typeof KdsOrderItemSchema>;`), where the *type* half is used everywhere (`kds/model/store.ts`, `kds/model/queries.ts`, `widgets/KdsBoard/index.tsx`) but the *schema* half is flagged dead as a standalone export. Deleting `KdsOrderItemSchema` would have broken `KdsOrderItem`'s `z.infer` derivation — kept, not deleted. This is the paired-declaration caution applying in reverse (type depends on schema, not schema depends on type).

**No file was deleted** — per this plan's explicit prohibition, the 7 whole-file candidates newly surfaced by 39-08 (`modifier-inventory-rule/model/types.ts`, `rbac/model/types.ts`, `recipe/model/types.ts`, `waitlist/model/store.ts`, `payment/model/store.ts`, plus the 2 already-adjudicated-false-positive `tab/ui/PoolChargeItem.tsx`/`tab/ui/TabDetail.tsx`) were **not touched** in this plan despite 39-08-LEDGER.md listing them as "candidates" for 39-10 — this plan's own frontmatter (must_haves, prohibitions) explicitly scopes it to individual declaration removal only, deferring whole-file deletion to a future plan. See Task 3 for the reconciliation of this discrepancy.

---

## Task 1 — `model/types.ts` findings (93 of 148)


### `src/entities/audit-log/model/types.ts`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check) |
|---|---|---|---|---|---|
| 2 | `AuditSource` | type | 1 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 4 | `AuditLogSchema` | export | 4 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 5 | `AuditLogFiltersSchema` | export | 2 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 6 | `AuditSourceSchema` | export | 3 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |

### `src/entities/category/model/types.ts`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check) |
|---|---|---|---|---|---|
| 2 | `CategorySchema` | export | 33 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 2 | `CategoryCreateSchema` | export | 6 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 2 | `CategoryUpdateSchema` | export | 6 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 4 | `CategoryCreate` | type | 9 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 4 | `CategoryUpdate` | type | 9 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |

### `src/entities/combo/model/types.ts`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check) |
|---|---|---|---|---|---|
| 6 | `ComboSlotCreate` | type | 1 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 7 | `ComboSlotUpdate` | type | 1 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 9 | `ComboSlotOptionCreate` | type | 1 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 11 | `ComboAvailabilityCreate` | type | 1 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 12 | `SlotSelection` | type | 14 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 13 | `AddComboToTabInput` | type | 4 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 16 | `ComboSlotSchema` | export | 6 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 17 | `ComboSlotOptionSchema` | export | 5 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 18 | `ComboAvailabilitySchema` | export | 5 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 19 | `SlotSelectionSchema` | export | 3 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |

### `src/entities/ingredient/model/types.ts`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check) |
|---|---|---|---|---|---|
| 8 | `IngredientUpdate` | type | 1 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 10 | `Uom` | type | 2 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 11 | `BaseUom` | type | 2 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 15 | `IngredientSchema` | export | 10 | **KEEP** | Reached only via entities/ingredient/model/queries.test.ts. No immediate slice barrel forwards it (not re-exported by @entities/ingredient). Production-mode-only finding (live in default mode, flagged only in production mode) — test-reachable false positive, same pattern as 39-03-LEDGER.md. |
| 17 | `IngredientUpdateSchema` | export | 2 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 18 | `ManualAdjustReasonSchema` | export | 2 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 19 | `UomSchema` | export | 3 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 20 | `BaseUomSchema` | export | 3 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |

### `src/entities/inventory/model/types.ts`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check) |
|---|---|---|---|---|---|
| 2 | `InventoryAlertSchema` | export | 4 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 4 | `InventoryAlert` | type | 9 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 4 | `InventoryLog` | type | 8 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |

### `src/entities/kds/model/types.ts`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check) |
|---|---|---|---|---|---|
| 4 | `KdsOrderItemSchema` | export | 0 | **KEEP** | kds/index.ts (Findings=1/Pruned=0/Kept=1 per 39-08) keeps KdsOrderItem (the derived type) live. KdsOrderItemSchema itself is NOT imported as a runtime value anywhere, but type KdsOrderItem = z.infer<typeof KdsOrderItemSchema> (same file, line 23) IS live and heavily used in production (kds/model/store.ts, kds/model/queries.ts, widgets/KdsBoard/index.tsx). Deleting the schema would break the type inference. 39-PATTERNS.md paired Zod schema/type caution applies (type depends on schema here, not the reverse). |

### `src/entities/open-unit/model/types.ts`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check) |
|---|---|---|---|---|---|
| 2 | `OpenUnitSchema` | export | 13 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 2 | `OpenUnitStatusSchema` | export | 4 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 2 | `OpenUnitCorrectionSchema` | export | 12 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 4 | `OpenUnitStatus` | type | 3 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 4 | `OpenUnitCorrection` | type | 7 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |

### `src/entities/payment/model/types.ts`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check) |
|---|---|---|---|---|---|
| 31 | `CreatePaymentSchema` | export | 3 | **KEEP** | Reached only via entities/payment/model/types.test.ts. No immediate slice barrel forwards it. Production-mode-only finding — test-reachable false positive. |
| 36 | `CreatePayment` | type | 5 | **KEEP** | Barrel entities/payment/model/index.ts:8 still re-exports it (`export type { Payment, CreatePayment } from './types';`) -- one of the 3 names 39-08 kept at this barrel (Findings=15/Pruned=12/Kept=3). Also still imported by entities/payment/model/store.ts (itself a whole-file-dead candidate per 39-08-LEDGER.md byproduct list -- out of this plan scope, no-whole-file-deletion rule). Deleting would break both the barrel and the untouched store.ts file typecheck. |
| 38 | `UpdatePaymentSchema` | export | 0 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 40 | `UpdatePayment` | type | 0 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 53 | `mockPayments` | export | 0 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |

### `src/entities/prep/model/types.ts`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check) |
|---|---|---|---|---|---|
| 2 | `PrepProductionSchema` | export | 9 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 2 | `PrepProductionCreateSchema` | export | 8 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |

### `src/entities/product/model/types.ts`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check) |
|---|---|---|---|---|---|
| 6 | `ProductCreateSchema` | export | 8 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 9 | `ProductCreate` | type | 5 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |

### `src/entities/promotion/model/types.ts`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check) |
|---|---|---|---|---|---|
| 5 | `Promotion` | type | 38 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 6 | `PromotionCreate` | type | 1 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 7 | `PromotionUpdate` | type | 4 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 9 | `PromotionAvailabilityCreate` | type | 1 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 10 | `AppliedPromotion` | type | 1 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 13 | `PromotionSchema` | export | 7 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 14 | `PromotionCreateSchema` | export | 10 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 15 | `PromotionUpdateSchema` | export | 2 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 16 | `PromotionAvailabilitySchema` | export | 5 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 17 | `PromotionAvailabilityCreateSchema` | export | 2 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 18 | `AppliedPromotionSchema` | export | 5 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |

### `src/entities/refund/model/types.ts`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check) |
|---|---|---|---|---|---|
| 6 | `RefundCreate` | type | 1 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 11 | `RefundSchema` | export | 3 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 12 | `RefundItemSchema` | export | 4 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 13 | `RefundReasonSchema` | export | 4 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 14 | `RefundCreateSchema` | export | 2 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |

### `src/entities/resource/model/types.ts`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check) |
|---|---|---|---|---|---|
| 5 | `PoolSessionSummarySchema` | export | 4 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 6 | `ResourceTypeSchema` | export | 10 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 10 | `Resource` | type | 60 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 11 | `PoolSession` | type | 55 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 12 | `PoolTableStatus` | type | 4 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 13 | `ResourceType` | type | 14 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 14 | `PoolSessionSummary` | type | 13 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |

### `src/entities/settings/model/types.ts`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check) |
|---|---|---|---|---|---|
| 9 | `SettingsKeySchema` | export | 3 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |

### `src/entities/staff/model/types.ts`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check) |
|---|---|---|---|---|---|
| 20 | `StaffCreateSchema` | export | 3 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 21 | `StaffUpdateSchema` | export | 4 | **KEEP** | Barrel entities/staff/model/index.ts:7 still re-exports this declaration (aliased StaffUpdateSchema as UpdateStaffSchema). Per plan rule the barrel is authority, not this plan -- kept. Note: 39-08-LEDGER.md per-barrel table lists StaffUpdateSchema among pruned names for this barrel, but current file content still forwards it (aliased); not touched by this plan. |
| 23 | `ShiftCreateSchema` | export | 3 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 24 | `ShiftUpdateSchema` | export | 3 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 27 | `StaffCreate` | type | 3 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 27 | `StaffUpdate` | type | 3 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 27 | `Shift` | type | 43 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 27 | `ShiftCreate` | type | 3 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 27 | `ShiftUpdate` | type | 3 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 31 | `mockStaff` | export | 22 | **KEEP** | No immediate slice barrel forwards it. Reached from src/app/ProtectedRoute.test.tsx, src/features/open-tab/ui/OpenTabButton.stories.tsx, src/widgets/PINLoginForm/PINLoginForm.test.tsx (test/story files only). Production-mode-only finding -- test/story-reachable false positive. |

### `src/entities/tab/model/types.ts`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check) |
|---|---|---|---|---|---|
| 6 | `OrderItemCreateSchema` | export | 3 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 7 | `CartItemInputSchema` | export | 3 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 13 | `OrderItem` | type | 50 | **KEEP** | No immediate slice barrel forwards it directly (deep-path only). Still imported by entities/tab/ui/TabDetail.tsx (already adjudicated FALSE POSITIVE -- reachable via test/story -- in 39-03-LEDGER.md; file exists and is untouched by this plan). Deleting the type would break TabDetail.tsx typecheck. |
| 17 | `CartItemInput` | type | 3 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 18 | `TabStatus` | type | 3 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 19 | `OrderStatus` | type | 3 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 29 | `mockTabItem` | export | 8 | **KEEP** | No immediate slice barrel forwards it. Reached only via entities/tab/ui/TabCard.stories.tsx. Production-mode-only finding -- story-reachable false positive. |
| 42 | `mockTab` | export | 64 | **KEEP** | No immediate slice barrel forwards it. Reached via TabCard.stories.tsx, TabCard.test.tsx, OrderPanel/ActiveTabSelector.stories.tsx, OrderPanel/CartPanel.stories.tsx, TabDrawer/TabDrawer.stories.tsx (test/story files only). Production-mode-only finding -- test/story-reachable false positive. |

### `src/entities/waitlist/model/types.ts`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check) |
|---|---|---|---|---|---|
| 11 | `WaitlistEntryStatus` | type | 3 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 15 | `WaitlistEntrySchema` | export | 14 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 16 | `WaitlistEntryCreateSchema` | export | 2 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 17 | `WaitlistNotificationSchema` | export | 4 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 18 | `WaitlistEntryStatusSchema` | export | 3 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |
| 19 | `PhoneE164Schema` | export | 2 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution (relative + @alias, multi-line-safe) in either knip mode; no immediate slice barrel forwards it (pruned in 39-08 or never present). Confirmed dead. |

---

## Task 2 — `model/store.ts`, `model/queries.ts`, `model/queries-reports.ts`, `ui/*.tsx` findings (55 of 148), and the `inventoryStore`/`useInventoryStore` duplicate export

### Method addendum for Task 2

Same three-check method as Task 1. One additional wrinkle for this batch: several findings here are query-key factory objects or row-mapper helper functions that ARE used internally within their own file (by sibling exported hooks in the same module) but have zero external importers. For those, the disposition is still **DELETE** (the finding — "this export is unused externally" — is real), but the *action* taken is narrower than Task 1's whole-declaration removal: only the `export` keyword is dropped, the declaration itself stays (it is not dead code, just no longer part of the file's public surface). Each such row's Reason column states this explicitly ("Kept the declaration ... removed only the `export` keyword"). Rows where nothing in the file or elsewhere referenced the name at all get the full declaration removed, same as Task 1.

### `src/entities/inventory/model/store.ts` — duplicate-export pair resolution

`inventoryStore` and `useInventoryStore` both point at the same Zustand store instance (`export const inventoryStore = useInventoryStore;`). Checked which consumers import which name:

- `useInventoryStore` — imported by `entities/inventory/model/index.ts` (barrel re-export), `entities/inventory/model/queries.ts` (internal), `entities/inventory/model/store.test.ts` (test).
- `inventoryStore` — imported by `src/widgets/LowStockAlert/index.tsx` (`inventoryStore(s => s.lowStockAlerts)`) and `src/widgets/OrderPanel/CartPanel.tsx` (`inventoryStore.getState().decrementQuantities(...)`), both real production widgets, both reached via `@entities/inventory`'s barrel (`export { inventoryStore, ... } from './model'`).

**Resolution: DEFERRED, both kept.** Both aliases have real, distinct, non-overlapping consumer sets — neither is dead. Consolidating them (e.g. renaming the two widget call sites to `useInventoryStore` and deleting the `inventoryStore` alias) would require editing `src/widgets/**` files, which are outside this plan's file scope (`src/entities/*/model/*.ts`, `src/entities/*/ui/*.tsx` per the parallel-execution scope note) and would also cross into "restructuring the module," which this plan's own text prohibits for this specific file ("Do not restructure the module, and do not touch the `queries.ts` <-> `store.ts` circular import while you are in there"). A comment recording this reasoning was added directly above the `inventoryStore` declaration so a future dependency-cleanup phase (with widgets in scope) can act on it.

### Per-finding table


### `src/entities/audit-log/model/queries.ts`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check + action taken) |
|---|---|---|---|---|---|
| 18 | `PAGE_SIZE` | export | 0 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution in either knip mode; no immediate slice barrel forwards it. Confirmed dead. Kept the declaration (used internally in the same file); removed only the `export` keyword. |
| 31 | `sanitizeSearch` | export | 8 | **KEEP** | Barrel not involved (no re-export). Reached only via entities/audit-log/model/queries.test.ts. Production-mode-only finding -- test-reachable false positive. |

### `src/entities/caja/model/queries.ts`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check + action taken) |
|---|---|---|---|---|---|
| 41 | `cajaKeys` | export | 0 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution in either knip mode; no immediate slice barrel forwards it. Confirmed dead. Kept the declaration (used internally in the same file); removed only the `export` keyword. |
| 386 | `cajaEntryKeys` | export | 0 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution in either knip mode; no immediate slice barrel forwards it. Confirmed dead. Kept the declaration (used internally in the same file); removed only the `export` keyword. |
| 515 | `tipDistributionKeys` | export | 0 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution in either knip mode; no immediate slice barrel forwards it. Confirmed dead. Kept the declaration (used internally in the same file); removed only the `export` keyword. |

### `src/entities/category/model/queries.ts`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check + action taken) |
|---|---|---|---|---|---|
| 24 | `CATEGORY_QUERY_KEY` | export | 0 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution in either knip mode; no immediate slice barrel forwards it. Confirmed dead. Kept the declaration (used internally in the same file); removed only the `export` keyword. |
| 116 | `useCategoryTree` | export | 1 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution in either knip mode; no immediate slice barrel forwards it. Confirmed dead. Nothing else in the file (or elsewhere) referenced it; removed the whole declaration. |

### `src/entities/ingredient/model/queries.ts`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check + action taken) |
|---|---|---|---|---|---|
| 105 | `useIngredient` | export | 7 | **KEEP** | Barrel not involved. Reached only via entities/ingredient/model/queries.test.ts. Production-mode-only finding -- test-reachable false positive. |

### `src/entities/inventory/model/queries.ts`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check + action taken) |
|---|---|---|---|---|---|
| 156 | `useInventoryByProduct` | export | 0 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution in either knip mode; no immediate slice barrel forwards it. Confirmed dead. Nothing else in the file (or elsewhere) referenced it; removed the whole declaration. |
| 196 | `useLowStockInventory` | export | 0 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution in either knip mode; no immediate slice barrel forwards it. Confirmed dead. Nothing else in the file (or elsewhere) referenced it; removed the whole declaration. |

### `src/entities/inventory/model/store.ts`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check + action taken) |
|---|---|---|---|---|---|
| 12 | `LowStockAlertItem` | type | 0 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution in either knip mode; no immediate slice barrel forwards it. Confirmed dead. Kept the declaration (used internally in the same file); removed only the `export` keyword. |
| 115 | `selectInventoryByProductId` | export | 0 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution in either knip mode; no immediate slice barrel forwards it. Confirmed dead. Nothing else in the file (or elsewhere) referenced it; removed the whole declaration. |
| 119 | `selectIsLowStock` | export | 0 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution in either knip mode; no immediate slice barrel forwards it. Confirmed dead. Nothing else in the file (or elsewhere) referenced it; removed the whole declaration. |

### `src/entities/inventory/ui/InventoryRow.tsx`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check + action taken) |
|---|---|---|---|---|---|
| 120 | `InventoryRowProps` | type | 0 | **KEEP** | Self-referenced as the exported InventoryRow component prop-type annotation within the same file (line 129). Production-mode-only finding (default mode resolves the internal usage) -- not deleted. |
| 129 | `InventoryRow` | export | 11 | **KEEP** | Reached only via entities/inventory/ui/InventoryRow.stories.tsx. Production-mode-only finding -- story-reachable false positive. |

### `src/entities/modifier-inventory-rule/model/queries.ts`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check + action taken) |
|---|---|---|---|---|---|
| 28 | `modifierInventoryRuleKeys` | export | 0 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution in either knip mode; no immediate slice barrel forwards it. Confirmed dead. Kept the declaration (used internally in the same file); removed only the `export` keyword. |

### `src/entities/open-unit/model/queries.ts`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check + action taken) |
|---|---|---|---|---|---|
| 17 | `openUnitKeys` | export | 4 | **KEEP** | Reached only via entities/open-unit/model/queries.test.ts. Production-mode-only finding -- test-reachable false positive. |

### `src/entities/payment/model/queries.ts`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check + action taken) |
|---|---|---|---|---|---|
| 26 | `paymentItemKeys` | export | 0 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution in either knip mode; no immediate slice barrel forwards it. Confirmed dead. Kept the declaration (used internally in the same file); removed only the `export` keyword. |

### `src/entities/prep/model/queries.ts`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check + action taken) |
|---|---|---|---|---|---|
| 22 | `prepKeys` | export | 0 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution in either knip mode; no immediate slice barrel forwards it. Confirmed dead. Kept the declaration (used internally in the same file); removed only the `export` keyword. |

### `src/entities/product/model/queries.ts`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check + action taken) |
|---|---|---|---|---|---|
| 521 | `useMutationCreateCategory` | export | 8 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution in either knip mode; no immediate slice barrel forwards it. Confirmed dead. Nothing else in the file (or elsewhere) referenced it; removed the whole declaration. |
| 550 | `useMutationUpdateCategory` | export | 8 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution in either knip mode; no immediate slice barrel forwards it. Confirmed dead. Nothing else in the file (or elsewhere) referenced it; removed the whole declaration. |

### `src/entities/product/model/store.ts`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check + action taken) |
|---|---|---|---|---|---|
| 49 | `selectProductById` | export | 0 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution in either knip mode; no immediate slice barrel forwards it. Confirmed dead. Nothing else in the file (or elsewhere) referenced it; removed the whole declaration. |
| 53 | `selectActiveProducts` | export | 0 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution in either knip mode; no immediate slice barrel forwards it. Confirmed dead. Nothing else in the file (or elsewhere) referenced it; removed the whole declaration. |
| 57 | `selectCategoryById` | export | 0 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution in either knip mode; no immediate slice barrel forwards it. Confirmed dead. Nothing else in the file (or elsewhere) referenced it; removed the whole declaration. |
| 61 | `selectProductsByCategoryId` | export | 0 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution in either knip mode; no immediate slice barrel forwards it. Confirmed dead. Nothing else in the file (or elsewhere) referenced it; removed the whole declaration. |
| 65 | `selectModifierById` | export | 0 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution in either knip mode; no immediate slice barrel forwards it. Confirmed dead. Nothing else in the file (or elsewhere) referenced it; removed the whole declaration. |
| 69 | `selectModifiersByIds` | export | 0 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution in either knip mode; no immediate slice barrel forwards it. Confirmed dead. Nothing else in the file (or elsewhere) referenced it; removed the whole declaration. |

### `src/entities/promotion/model/queries.ts`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check + action taken) |
|---|---|---|---|---|---|
| 31 | `mapPromotionRow` | export | 0 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution in either knip mode; no immediate slice barrel forwards it. Confirmed dead. Kept the declaration (used internally in the same file); removed only the `export` keyword. |
| 275 | `usePromotionActive` | export | 0 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution in either knip mode; no immediate slice barrel forwards it. Confirmed dead. Nothing else in the file (or elsewhere) referenced it; removed the whole declaration. |

### `src/entities/rappi-order/model/queries.ts`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check + action taken) |
|---|---|---|---|---|---|
| 49 | `rappiOrdersListQueryKey` | export | 0 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution in either knip mode; no immediate slice barrel forwards it. Confirmed dead. Nothing else in the file (or elsewhere) referenced it; removed the whole declaration. |

### `src/entities/recipe/model/queries.ts`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check + action taken) |
|---|---|---|---|---|---|
| 28 | `recipeKeys` | export | 0 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution in either knip mode; no immediate slice barrel forwards it. Confirmed dead. Kept the declaration (used internally in the same file); removed only the `export` keyword. |

### `src/entities/resource/model/queries.ts`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check + action taken) |
|---|---|---|---|---|---|
| 500 | `usePoolSessionsByTab` | export | 0 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution in either knip mode; no immediate slice barrel forwards it. Confirmed dead. Nothing else in the file (or elsewhere) referenced it; removed the whole declaration. |

### `src/entities/resource/model/store.ts`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check + action taken) |
|---|---|---|---|---|---|
| 115 | `selectTableById` | export | 0 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution in either knip mode; no immediate slice barrel forwards it. Confirmed dead. Nothing else in the file (or elsewhere) referenced it; removed the whole declaration. |
| 119 | `selectActiveSessionForTable` | export | 0 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution in either knip mode; no immediate slice barrel forwards it. Confirmed dead. Nothing else in the file (or elsewhere) referenced it; removed the whole declaration. |
| 123 | `selectAvailableTableCount` | export | 0 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution in either knip mode; no immediate slice barrel forwards it. Confirmed dead. Nothing else in the file (or elsewhere) referenced it; removed the whole declaration. |
| 127 | `selectSessionsByTabId` | export | 0 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution in either knip mode; no immediate slice barrel forwards it. Confirmed dead. Nothing else in the file (or elsewhere) referenced it; removed the whole declaration. |

### `src/entities/settings/model/queries.ts`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check + action taken) |
|---|---|---|---|---|---|
| 103 | `settingsKeys` | export | 0 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution in either knip mode; no immediate slice barrel forwards it. Confirmed dead. Kept the declaration (used internally in the same file); removed only the `export` keyword. |

### `src/entities/staff/model/queries.ts`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check + action taken) |
|---|---|---|---|---|---|
| 38 | `mapStaffRow` | export | 3 | **KEEP** | Reached only via entities/staff/model/queries.test.ts. Production-mode-only finding -- test-reachable false positive. |

### `src/entities/tab/model/queries-reports.ts`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check + action taken) |
|---|---|---|---|---|---|
| 52 | `DeletionsPreRow` | type | 10 | **KEEP** | Re-exported from @shared/lib/domain (import-then-plain-export pattern, no from clause on the export itself) but reached only via 6 widget .test.tsx files that do `import type * as QueriesReports from '@entities/tab/model/queries-reports'` for mock typing. All production consumers (DeletionsPreSendPanel.tsx, ExportButtons.tsx, useExportReport.ts) import the type directly from @shared/lib/domain, bypassing this re-export. Production-mode-only finding -- test-reachable false positive. |
| 53 | `DeletionsPostRow` | type | 10 | **KEEP** | Same re-export/test-reachable pattern as DeletionsPreRow (line 52) -- reached only via the same 6 widget .test.tsx namespace type imports; production consumers use @shared/lib/domain directly. |
| 54 | `ModifierPopularityRow` | type | 11 | **KEEP** | Same re-export/test-reachable pattern as DeletionsPreRow (line 52). |
| 55 | `PaymentMethodRow` | type | 10 | **KEEP** | Same re-export/test-reachable pattern as DeletionsPreRow (line 52). |
| 71 | `computePctTotals` | export | 21 | **KEEP** | Used internally (lines 298, 461) and reached externally via entities/tab/model/queries-reports.test.ts + shared/lib/reportHelpers.test.ts + 3 widget vi.mock() factories (VoidRefundPanel, ProductSalesPanel, ProductSalesExportFilter .test.tsx). Production-mode-only finding -- test-reachable false positive. |
| 88 | `aggregateHourlyRevenue` | export | 8 | **KEEP** | Reached via entities/tab/model/queries-reports.test.ts. Production-mode-only finding -- test-reachable false positive. |
| 129 | `fillMissingHours` | export | 19 | **KEEP** | Reached via entities/tab/model/queries-reports.test.ts and widgets/HourlyBreakdownPanel/HourlyBreakdownPanel.test.tsx. Production-mode-only finding -- test-reachable false positive. |
| 162 | `fillMissingCategories` | export | 8 | **KEEP** | Reached via entities/tab/model/queries-reports.test.ts. Production-mode-only finding -- test-reachable false positive. |
| 365 | `filterVoidRefundRows` | export | 8 | **KEEP** | Reached via entities/tab/model/queries-reports.test.ts. Production-mode-only finding -- test-reachable false positive. |
| 473 | `assertDateRangeValid` | export | 7 | **KEEP** | Reached via entities/tab/model/queries-reports.test.ts. Production-mode-only finding -- test-reachable false positive. |

### `src/entities/tab/model/queries.ts`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check + action taken) |
|---|---|---|---|---|---|
| 774 | `useMutationUpdateTabStatus` | export | 2 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution in either knip mode; no immediate slice barrel forwards it. Confirmed dead. Nothing else in the file (or elsewhere) referenced it; removed the whole declaration (also removed the now-dangling `handleVersionError`/`TERMINAL_ID`/`UpdateTabStatusContext` helpers this and the next deletion left unreferenced). |
| 880 | `useMutationRecordTabPayment` | export | 1 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution in either knip mode; no immediate slice barrel forwards it. Confirmed dead. Nothing else in the file (or elsewhere) referenced it; removed the whole declaration. |
| 1039 | `useVoidOrder` | export | 17 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution in either knip mode; no immediate slice barrel forwards it. Confirmed dead. Nothing else in the file (or elsewhere) referenced it; removed the whole declaration. |

### `src/entities/tab/model/store.ts`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check + action taken) |
|---|---|---|---|---|---|
| 24 | `OfflineActionType` | type | 3 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution in either knip mode; no immediate slice barrel forwards it. Confirmed dead (the re-export line, not the import — `OfflineAction`, the sibling type on the same re-export line, is kept, still live). Removed the name from both the import and the re-export. |
| 260 | `selectOpenTabs` | export | 0 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution in either knip mode; no immediate slice barrel forwards it. Confirmed dead. Nothing else in the file (or elsewhere) referenced it; removed the whole declaration. |

### `src/entities/waitlist/model/queries.ts`

| Line | Name | Kind | `grep -rn` hit count (outside decl) | Disposition | Reason (search evidence + barrel check + action taken) |
|---|---|---|---|---|---|
| 103 | `useWaitlistEntry` | export | 0 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution in either knip mode; no immediate slice barrel forwards it. Confirmed dead. Nothing else in the file (or elsewhere) referenced it; removed the whole declaration. |
| 225 | `useMutationUpdateWaitlistStatus` | export | 0 | **DELETE** | Zero reaching imports found via full-repo import-graph resolution in either knip mode; no immediate slice barrel forwards it. Confirmed dead. Nothing else in the file (or elsewhere) referenced it; removed the whole declaration. |

---

## Task 3 — Entities-layer delta re-measurement

### Method

Regenerated both knip reports fresh a third time (`npx knip --reporter json`, `npx knip --production --reporter json`, after both Task 1 and Task 2's commits), recomputed the distinct `(file, line, name)` export/type union scoped to `src/entities/`, excluding `**/index.ts(x)` barrels — same method as Task 1/2's working-set derivation and the same method 39-01/39-03/39-08 used for comparability.

### Before / after

| | Before this plan (Task 1 baseline, = 39-08-LEDGER.md's published 39-10 working set) | After this plan (Task 3, fresh) | Δ |
|---|---|---|---|
| `src/entities/` non-barrel export/type findings | **148** | **27** | **-121** |
| Whole-file-dead candidates under `src/entities/` | 7 | 7 | 0 (untouched — out of this plan's scope) |

### The 27 residual findings are fully attributable

25 are the KEEP dispositions already recorded per-row above (9 from Task 1, 16 from Task 2) — barrel-forwarded, still-live-via-a-different-origin, or test/story-reachable production-mode-only false positives, each with its specific evidence in the per-finding tables.

The remaining 2 — `buildCategoryTree` and `CategoryNode` in `src/entities/category/model/types.ts` (lines 7-8) — are a byproduct newly surfaced by Task 2's own deletion of `useCategoryTree` in `category/model/queries.ts` (the only file in this slice that imported them). Checked before finalizing this count: `src/entities/category/model/index.ts` still re-exports both (`export { buildCategoryTree } from './types'; export type { Category, CategoryNode } from './types';`) — per this plan's own rule ("the barrel is the authority, not this plan"), a still-forwarding barrel means the declaration is not this plan's to delete, exactly the same precedent already applied to `CreatePayment`/`StaffUpdateSchema` in Task 1. Not touched; flagged here for a future barrel-decision pass (39-08's territory) to resolve, consistent with how 39-08-LEDGER.md itself documented an analogous byproduct (6 files newly reclassified whole-file-dead) for downstream plans to inherit rather than silently absorbing.

25 (recorded KEEP) + 2 (barrel-protected byproduct) = **27**, matching the residual exactly. Zero unattributed/unexplained residual findings.

### Whole-file candidates — explicitly not touched, carried forward

The same 7 whole-file candidates 39-08-LEDGER.md surfaced remain unchanged (this plan does not delete files, per its own frontmatter prohibition):

| File | Status |
|---|---|
| `src/entities/modifier-inventory-rule/model/types.ts` | Whole-file-dead candidate (newly surfaced by 39-08's barrel pruning) — not adjudicated by this plan |
| `src/entities/rbac/model/types.ts` | Whole-file-dead candidate (newly surfaced by 39-08's barrel pruning) — not adjudicated by this plan |
| `src/entities/recipe/model/types.ts` | Whole-file-dead candidate (newly surfaced by 39-08's barrel pruning) — not adjudicated by this plan |
| `src/entities/waitlist/model/store.ts` | Whole-file-dead candidate (newly surfaced by 39-08's barrel pruning) — not adjudicated by this plan |
| `src/entities/payment/model/store.ts` | Whole-file-dead candidate (newly surfaced by 39-08's barrel pruning); this plan explicitly kept `CreatePayment`/`CreatePaymentSchema` alive in `types.ts` specifically because this file still imports them — deleting this file is future work, not this plan's |
| `src/entities/tab/ui/PoolChargeItem.tsx` | Already adjudicated FALSE POSITIVE (reachable via test/story) in 39-03-LEDGER.md — carried forward unchanged, not re-litigated |
| `src/entities/tab/ui/TabDetail.tsx` | Already adjudicated FALSE POSITIVE (reachable via test/story) in 39-03-LEDGER.md — carried forward unchanged; this plan explicitly kept `OrderItem` alive in `tab/model/types.ts` specifically because this file still imports it |

### Verification

```
npm run typecheck   # clean, zero errors (both after Task 2 and after this re-measurement)
npm run test          # 1391 passed, 15 todo — one transient failure observed on an
                       # intermediate run (fast-check property test in
                       # src/shared/lib/groupOrderItemsForReceipt.test.ts, a file
                       # entirely outside this plan's scope), passed in isolation and
                       # on a full-suite re-run — pre-existing flakiness, not caused
                       # by this plan's changes, not fixed (out of scope per the
                       # deviation-rules scope boundary)
```

No file was deleted by this plan (verified: `git diff --stat` against the pre-plan base shows only modifications, zero deletions, across both task commits). No deletion in either task's table has a nonzero *path-aware* reaching-import count recorded against it (the raw bare-identifier `grep -rn` hit counts are non-zero for many rows precisely because the domain.ts-native symbol names are reused elsewhere via a different origin — see the Method section's worked example — every one of those was individually confirmed non-reaching via the import-graph resolution step before deletion).

