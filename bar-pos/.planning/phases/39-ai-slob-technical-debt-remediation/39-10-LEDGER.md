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

<!-- gsd:write-continue -->
