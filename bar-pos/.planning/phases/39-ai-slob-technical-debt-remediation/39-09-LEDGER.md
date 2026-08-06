# Phase 39 Plan 09 — Registry File Review Ledger (`domain.ts` / `edge-function-contracts.ts`)

**Generated:** 2026-08-06 (worktree parallel-executor run; `node_modules`/`.env.local` restored per the documented environment gap, see PLAN's `<parallel_execution>` note)

## Method

Regenerated both knip reports fresh (`npx knip --reporter json`, `npx knip --production --reporter json`) against the working set published in `39-08-LEDGER.md`, then recomputed the distinct `(file, line, name)` set-union over `exports`/`types` for exactly the two registry files (`src/shared/lib/domain.ts`, `src/shared/lib/edge-function-contracts.ts`). This reproduced 39-08's published working-set count exactly: **196 findings** (155 in `domain.ts`, 41 in `edge-function-contracts.ts`) — no drift between 39-08's Task 3 snapshot and this plan's Task 1 starting point.

For every one of the 196 flagged names, ran a repository-wide bare-identifier search (not an import-statement search, per 39-RESEARCH.md Pitfall 2 and `39-PATTERNS.md`'s "Registry File Review" pattern):

```bash
grep -rnE "\bIDENTIFIER\b" src/ supabase/functions/ e2e/ scripts/ --include=*.ts --include=*.tsx
```

Hits on the flagged declaration's own line were excluded; every other hit (including hits elsewhere in the *same* file — e.g. a `z.infer<typeof X>` target, a registry-object entry, a JSDoc example) counted as evidence of use, consistent with 39-PATTERNS.md's warning that a registry symbol can be reached through a re-export chain or an in-file reference knip's own reachability graph still credits.

**Tooling note:** the first `grep`/`node` pass wrote scratch state to `/tmp/`, which is shared across the three parallel sibling worktree agents (39-09/39-10/39-11) executing this wave concurrently on the same machine — a sibling agent's writes clobbered this plan's `/tmp/search-results.json` mid-run (148/196 rows, silently truncated, no error). Caught by a sanity check (the recovered file's rows referenced `PhoneE164Schema`/`waitlist`, not this plan's scope) before it reached any deletion decision. All scratch work was re-run from scratch inside a worktree-local `.scratch-39-09/` directory (not `/tmp/`) to eliminate cross-agent collision; the directory is deleted before this plan's final commit.

## Task 1 — `domain.ts` (155 findings)

### Zero-hit findings (9 candidates repo-wide, but only 2 are in `domain.ts`)

Of the 155 `domain.ts` findings, exactly **2** had zero repository-wide hits outside their own declaration:

| Line | Name | Pairing | Schema hit count |
|---|---|---|---|
| 677 | `SplitPaymentLeg` (type) | type half of `SplitPaymentLegSchema` (line 668) | 2 (schema is live) |
| 1620 | `ComboSlotType` (type) | type half of `ComboSlotTypeSchema` (line 1619) | 2 (schema is live) |

Both are the **type half** of a schema/type pair whose schema remains referenced elsewhere (confirmed independently — `SplitPaymentLegSchema` and `ComboSlotTypeSchema` are each used at their own local reference site plus one external site, neither is itself a deletion candidate). Deleting only the type alias, per `39-PATTERNS.md`'s pairing rule ("the type half of a pair whose schema is still used is usually a safe deletion"), leaves the schema and its runtime validation fully intact. **DELETED.**

The remaining 153 `domain.ts` findings all had one or more repository-wide hits outside their own declaration and were **KEPT** as knip false positives (registry symbols reached via a path knip's static graph under-credits — deep-path imports, the `domain` namespace object, or test-file-only consumers). Full per-name evidence in the table below.

### Duplicate-export pairs (2 pairs, both `domain.ts`)

knip flags two duplicate-export pairs in `domain.ts`, both under the "MODIFIER GROUP ITEM"/"PRODUCT MODIFIER GROUP" sections:

1. `ModifierGroupItemSchema` (line 818) / `ModifierGroupItemCreateSchema` (line 824) — `ModifierGroupItemCreateSchema = ModifierGroupItemSchema;` (a bare re-assignment, byte-identical value under two names).
2. `ProductModifierGroupSchema` (line 833) / `ProductModifierGroupCreateSchema` (line 839) — `ProductModifierGroupCreateSchema = ProductModifierGroupSchema;` (same pattern).

**Investigation:** unlike every other `XCreateSchema` in this file (which is built via `.omit({ id: true, createdAt: true })`), both `ModifierGroupItem` and `ProductModifierGroup` are pure join-table rows with no `id`/`createdAt` field to strip — there is nothing for `.omit()` to remove, so the "create" schema is legitimately identical to the base schema. This is the file's established naming convention applied consistently (every entity gets a `Create` variant for symmetry with the `domain` namespace object's `schemas`/`types` catalog, even when the variant happens to equal its base), not a copy-paste accident.

**Usage evidence:**
- `ModifierGroupItemSchema` — 11 repo-wide hits, including direct, heavy use in `domain.test.ts` (`describe('ModifierGroupItemSchema', ...)`, multiple `.safeParse()` calls).
- `ModifierGroupItemCreateSchema` — 2 hits, both internal to `domain.ts` itself (its own type alias, and the `domain.schemas.ModifierGroupItemCreate` registry entry).
- `ProductModifierGroupSchema` — 12 repo-wide hits, same heavy `domain.test.ts` coverage pattern.
- `ProductModifierGroupCreateSchema` — 2 hits, both internal (type alias + registry entry).

**Resolution: KEPT BOTH, deferred — not a defect.** Both names in each pair are actively referenced (the base schema by tests, the Create alias by the `domain` namespace registry object's own `Create` entry and its paired type). Consolidating to a single name would mean either (a) removing the `XCreateSchema` alias and updating the `domain` registry object's `schemas.XCreate`/`types.XCreate` entries to reference the base schema directly under a different key shape, or (b) removing the base schema name and updating 11-12 call sites in `domain.test.ts`. Both options touch the widely-consumed `domain` namespace export or the test suite for a purely cosmetic naming consolidation with no dead-code benefit — out of scope for a low-risk per-export sweep, per this plan's explicit prohibition on batch-editing registry structure. Recorded here as a stated deferral, not corrected.

### Full per-finding table (155 rows)

| Line | Kind | Name | Search command | Hits | Pairing | Outcome |
|---|---|---|---|---|---|---|
| 20 | export | `PinSchema` | `grep -rnE "\\bPinSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 4 | schema, no paired type alias | KEPT — false positive, 4 repo-wide hit(s) outside declaration |
| 24 | export | `HexColorSchema` | `grep -rnE "\\bHexColorSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema, no paired type alias | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 25 | export | `TimeStringSchema` | `grep -rnE "\\bTimeStringSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 7 | schema, no paired type alias | KEPT — false positive, 7 repo-wide hit(s) outside declaration |
| 26 | export | `UrlSchema` | `grep -rnE "\\bUrlSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema, no paired type alias | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 59 | export | `RolePermissionSchema` | `grep -rnE "\\bRolePermissionSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 4 | schema half (paired type: RolePermission) | KEPT — false positive, 4 repo-wide hit(s) outside declaration |
| 66 | export | `RolePermissionCreateSchema` | `grep -rnE "\\bRolePermissionCreateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | schema half (paired type: RolePermissionCreate) | KEPT — false positive, 3 repo-wide hit(s) outside declaration |
| 71 | type | `RolePermission` | `grep -rnE "\\bRolePermission\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | type half (paired schema: RolePermissionSchema) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 72 | type | `RolePermissionCreate` | `grep -rnE "\\bRolePermissionCreate\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | type half (paired schema: RolePermissionCreateSchema) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 75 | export | `TabStatus` | `grep -rnE "\\bTabStatus\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | standalone value export (not a Schema-suffixed const) | KEPT — false positive, 3 repo-wide hit(s) outside declaration |
| 84 | export | `OrderStatus` | `grep -rnE "\\bOrderStatus\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | standalone value export (not a Schema-suffixed const) | KEPT — false positive, 3 repo-wide hit(s) outside declaration |
| 91 | export | `KdsStatus` | `grep -rnE "\\bKdsStatus\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | standalone value export (not a Schema-suffixed const) | KEPT — false positive, 3 repo-wide hit(s) outside declaration |
| 100 | export | `ResourceTypeSchema` | `grep -rnE "\\bResourceTypeSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 10 | schema, no paired type alias | KEPT — false positive, 10 repo-wide hit(s) outside declaration |
| 102 | export | `PoolTableStatus` | `grep -rnE "\\bPoolTableStatus\\b" src/ supabase/functions/ e2e/ scripts/` | 4 | standalone value export (not a Schema-suffixed const) | KEPT — false positive, 4 repo-wide hit(s) outside declaration |
| 110 | export | `PaymentMethod` | `grep -rnE "\\bPaymentMethod\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | standalone value export (not a Schema-suffixed const) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 116 | export | `InventoryAdjustReasonSchema` | `grep -rnE "\\bInventoryAdjustReasonSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 10 | schema, no paired type alias | KEPT — false positive, 10 repo-wide hit(s) outside declaration |
| 134 | export | `StockMovementReasonSchema` | `grep -rnE "\\bStockMovementReasonSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 10 | schema, no paired type alias | KEPT — false positive, 10 repo-wide hit(s) outside declaration |
| 147 | export | `StockMovementReason` | `grep -rnE "\\bStockMovementReason\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | standalone value export (not a Schema-suffixed const) | KEPT — false positive, 3 repo-wide hit(s) outside declaration |
| 230 | export | `ModifierCreateSchema` | `grep -rnE "\\bModifierCreateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema, no paired type alias | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 232 | export | `ModifierUpdateSchema` | `grep -rnE "\\bModifierUpdateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema, no paired type alias | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 359 | export | `OrderItemCreateSchema` | `grep -rnE "\\bOrderItemCreateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | schema, no paired type alias | KEPT — false positive, 3 repo-wide hit(s) outside declaration |
| 367 | export | `OrderItemUpdateSchema` | `grep -rnE "\\bOrderItemUpdateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema half (paired type: OrderItemUpdate) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 377 | type | `OrderItemUpdate` | `grep -rnE "\\bOrderItemUpdate\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | type half (paired schema: OrderItemUpdateSchema) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 394 | export | `OrderCreateSchema` | `grep -rnE "\\bOrderCreateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema, no paired type alias | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 401 | export | `OrderUpdateSchema` | `grep -rnE "\\bOrderUpdateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema half (paired type: OrderUpdate) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 410 | type | `OrderUpdate` | `grep -rnE "\\bOrderUpdate\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | type half (paired schema: OrderUpdateSchema) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 416 | export | `PoolSessionSummarySchema` | `grep -rnE "\\bPoolSessionSummarySchema\\b" src/ supabase/functions/ e2e/ scripts/` | 4 | schema, no paired type alias | KEPT — false positive, 4 repo-wide hit(s) outside declaration |
| 468 | export | `TabCreateSchema` | `grep -rnE "\\bTabCreateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema, no paired type alias | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 480 | export | `TabUpdateSchema` | `grep -rnE "\\bTabUpdateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema half (paired type: TabUpdate) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 493 | type | `TabUpdate` | `grep -rnE "\\bTabUpdate\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | type half (paired schema: TabUpdateSchema) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 499 | export | `RappiOrderStatusSchema` | `grep -rnE "\\bRappiOrderStatusSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | schema, no paired type alias | KEPT — false positive, 3 repo-wide hit(s) outside declaration |
| 508 | export | `RappiOrderStatus` | `grep -rnE "\\bRappiOrderStatus\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | standalone value export (not a Schema-suffixed const) | KEPT — false positive, 3 repo-wide hit(s) outside declaration |
| 583 | export | `ResourceCreateSchema` | `grep -rnE "\\bResourceCreateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema half (paired type: ResourceCreate) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 585 | export | `ResourceUpdateSchema` | `grep -rnE "\\bResourceUpdateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema half (paired type: ResourceUpdate) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 588 | type | `ResourceCreate` | `grep -rnE "\\bResourceCreate\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | type half (paired schema: ResourceCreateSchema) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 589 | type | `ResourceUpdate` | `grep -rnE "\\bResourceUpdate\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | type half (paired schema: ResourceUpdateSchema) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 599 | export | `PoolSessionCreateSchema` | `grep -rnE "\\bPoolSessionCreateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema half (paired type: PoolSessionCreate) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 608 | export | `PoolSessionUpdateSchema` | `grep -rnE "\\bPoolSessionUpdateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema half (paired type: PoolSessionUpdate) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 613 | type | `PoolSessionCreate` | `grep -rnE "\\bPoolSessionCreate\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | type half (paired schema: PoolSessionCreateSchema) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 614 | type | `PoolSessionUpdate` | `grep -rnE "\\bPoolSessionUpdate\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | type half (paired schema: PoolSessionUpdateSchema) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 620 | export | `PaymentSchema` | `grep -rnE "\\bPaymentSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 19 | schema half (paired type: Payment) | KEPT — false positive, 19 repo-wide hit(s) outside declaration |
| 653 | export | `PaymentCreateSchema` | `grep -rnE "\\bPaymentCreateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema half (paired type: PaymentCreate) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 658 | export | `PaymentUpdateSchema` | `grep -rnE "\\bPaymentUpdateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema half (paired type: PaymentUpdate) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 660 | type | `Payment` | `grep -rnE "\\bPayment\\b" src/ supabase/functions/ e2e/ scripts/` | 80 | type half (paired schema: PaymentSchema) | KEPT — false positive, 80 repo-wide hit(s) outside declaration |
| 661 | type | `PaymentCreate` | `grep -rnE "\\bPaymentCreate\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | type half (paired schema: PaymentCreateSchema) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 662 | type | `PaymentUpdate` | `grep -rnE "\\bPaymentUpdate\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | type half (paired schema: PaymentUpdateSchema) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 668 | export | `SplitPaymentLegSchema` | `grep -rnE "\\bSplitPaymentLegSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema half (paired type: SplitPaymentLeg) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 677 | type | `SplitPaymentLeg` | `grep -rnE "\\bSplitPaymentLeg\\b" src/ supabase/functions/ e2e/ scripts/` | 0 | type half (paired schema: SplitPaymentLegSchema) | DELETED — type-alias half of a live schema/type pair, zero repo-wide hits outside its own declaration |
| 692 | export | `InventoryCreateSchema` | `grep -rnE "\\bInventoryCreateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema half (paired type: InventoryCreate) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 697 | export | `InventoryUpdateSchema` | `grep -rnE "\\bInventoryUpdateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema half (paired type: InventoryUpdate) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 702 | type | `InventoryCreate` | `grep -rnE "\\bInventoryCreate\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | type half (paired schema: InventoryCreateSchema) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 703 | type | `InventoryUpdate` | `grep -rnE "\\bInventoryUpdate\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | type half (paired schema: InventoryUpdateSchema) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 718 | export | `InventoryLogCreateSchema` | `grep -rnE "\\bInventoryLogCreateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema half (paired type: InventoryLogCreate) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 723 | export | `InventoryLogUpdateSchema` | `grep -rnE "\\bInventoryLogUpdateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema half (paired type: InventoryLogUpdate) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 726 | type | `InventoryLogCreate` | `grep -rnE "\\bInventoryLogCreate\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | type half (paired schema: InventoryLogCreateSchema) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 727 | type | `InventoryLogUpdate` | `grep -rnE "\\bInventoryLogUpdate\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | type half (paired schema: InventoryLogUpdateSchema) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 733 | export | `OpenUnitStatusSchema` | `grep -rnE "\\bOpenUnitStatusSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 4 | schema half (paired type: OpenUnitStatus) | KEPT — false positive, 4 repo-wide hit(s) outside declaration |
| 734 | type | `OpenUnitStatus` | `grep -rnE "\\bOpenUnitStatus\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | type half (paired schema: OpenUnitStatusSchema) | KEPT — false positive, 3 repo-wide hit(s) outside declaration |
| 765 | export | `StockMovementSchema` | `grep -rnE "\\bStockMovementSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 17 | schema, no paired type alias | KEPT — false positive, 17 repo-wide hit(s) outside declaration |
| 781 | export | `StockMovementCreateSchema` | `grep -rnE "\\bStockMovementCreateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema half (paired type: StockMovementCreate) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 787 | type | `StockMovementCreate` | `grep -rnE "\\bStockMovementCreate\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | type half (paired schema: StockMovementCreateSchema) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 803 | export | `ModifierGroupCreateSchema` | `grep -rnE "\\bModifierGroupCreateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema, no paired type alias | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 808 | export | `ModifierGroupUpdateSchema` | `grep -rnE "\\bModifierGroupUpdateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema half (paired type: ModifierGroupUpdate) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 812 | type | `ModifierGroupUpdate` | `grep -rnE "\\bModifierGroupUpdate\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | type half (paired schema: ModifierGroupUpdateSchema) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 818 | export | `ModifierGroupItemSchema` | `grep -rnE "\\bModifierGroupItemSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 11 | schema half (paired type: ModifierGroupItem); **duplicate-export pair #1** | KEPT — false positive, 11 repo-wide hit(s) outside declaration; duplicate-pair deferral, see narrative above |
| 824 | export | `ModifierGroupItemCreateSchema` | `grep -rnE "\\bModifierGroupItemCreateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema half (paired type: ModifierGroupItemCreate); **duplicate-export pair #1** | KEPT — false positive, 2 repo-wide hit(s) outside declaration; duplicate-pair deferral, see narrative above |
| 826 | type | `ModifierGroupItem` | `grep -rnE "\\bModifierGroupItem\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | type half (paired schema: ModifierGroupItemSchema) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 827 | type | `ModifierGroupItemCreate` | `grep -rnE "\\bModifierGroupItemCreate\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | type half (paired schema: ModifierGroupItemCreateSchema) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 833 | export | `ProductModifierGroupSchema` | `grep -rnE "\\bProductModifierGroupSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 12 | schema half (paired type: ProductModifierGroup); **duplicate-export pair #2** | KEPT — false positive, 12 repo-wide hit(s) outside declaration; duplicate-pair deferral, see narrative above |
| 839 | export | `ProductModifierGroupCreateSchema` | `grep -rnE "\\bProductModifierGroupCreateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema half (paired type: ProductModifierGroupCreate); **duplicate-export pair #2** | KEPT — false positive, 2 repo-wide hit(s) outside declaration; duplicate-pair deferral, see narrative above |
| 841 | type | `ProductModifierGroup` | `grep -rnE "\\bProductModifierGroup\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | type half (paired schema: ProductModifierGroupSchema) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 842 | type | `ProductModifierGroupCreate` | `grep -rnE "\\bProductModifierGroupCreate\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | type half (paired schema: ProductModifierGroupCreateSchema) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 865 | export | `SettingsKeySchema` | `grep -rnE "\\bSettingsKeySchema\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | schema, no paired type alias | KEPT — false positive, 3 repo-wide hit(s) outside declaration |
| 887 | export | `BillingPaymentMethodsSchema` | `grep -rnE "\\bBillingPaymentMethodsSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema, no paired type alias | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 943 | export | `ReceiptPaperWidthSchema` | `grep -rnE "\\bReceiptPaperWidthSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 1 | schema, no paired type alias | KEPT — false positive, 1 repo-wide hit(s) outside declaration |
| 965 | export | `CajaStatusSchema` | `grep -rnE "\\bCajaStatusSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | schema half (paired type: CajaStatus) | KEPT — false positive, 3 repo-wide hit(s) outside declaration |
| 966 | type | `CajaStatus` | `grep -rnE "\\bCajaStatus\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | type half (paired schema: CajaStatusSchema) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 984 | export | `CajaSessionCreateSchema` | `grep -rnE "\\bCajaSessionCreateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema half (paired type: CajaSessionCreate) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 995 | type | `CajaSessionCreate` | `grep -rnE "\\bCajaSessionCreate\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | type half (paired schema: CajaSessionCreateSchema) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 1001 | export | `CajaEntryTypeSchema` | `grep -rnE "\\bCajaEntryTypeSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 4 | schema, no paired type alias | KEPT — false positive, 4 repo-wide hit(s) outside declaration |
| 1034 | export | `CajaEntryCreateSchema` | `grep -rnE "\\bCajaEntryCreateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema, no paired type alias | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 1047 | export | `CajaReportSummarySchema` | `grep -rnE "\\bCajaReportSummarySchema\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | schema half (paired type: CajaReportSummary) | KEPT — false positive, 3 repo-wide hit(s) outside declaration |
| 1060 | export | `CashReconciliationSchema` | `grep -rnE "\\bCashReconciliationSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | schema half (paired type: CashReconciliation) | KEPT — false positive, 3 repo-wide hit(s) outside declaration |
| 1068 | export | `CajaReportTopProductSchema` | `grep -rnE "\\bCajaReportTopProductSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | schema half (paired type: CajaReportTopProduct) | KEPT — false positive, 3 repo-wide hit(s) outside declaration |
| 1076 | export | `CajaReportStaffSchema` | `grep -rnE "\\bCajaReportStaffSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | schema half (paired type: CajaReportStaff) | KEPT — false positive, 3 repo-wide hit(s) outside declaration |
| 1093 | type | `CajaReportSummary` | `grep -rnE "\\bCajaReportSummary\\b" src/ supabase/functions/ e2e/ scripts/` | 1 | type half (paired schema: CajaReportSummarySchema) | KEPT — false positive, 1 repo-wide hit(s) outside declaration |
| 1094 | type | `CashReconciliation` | `grep -rnE "\\bCashReconciliation\\b" src/ supabase/functions/ e2e/ scripts/` | 1 | type half (paired schema: CashReconciliationSchema) | KEPT — false positive, 1 repo-wide hit(s) outside declaration |
| 1095 | type | `CajaReportTopProduct` | `grep -rnE "\\bCajaReportTopProduct\\b" src/ supabase/functions/ e2e/ scripts/` | 1 | type half (paired schema: CajaReportTopProductSchema) | KEPT — false positive, 1 repo-wide hit(s) outside declaration |
| 1096 | type | `CajaReportStaff` | `grep -rnE "\\bCajaReportStaff\\b" src/ supabase/functions/ e2e/ scripts/` | 1 | type half (paired schema: CajaReportStaffSchema) | KEPT — false positive, 1 repo-wide hit(s) outside declaration |
| 1124 | export | `TabTransferTypeSchema` | `grep -rnE "\\bTabTransferTypeSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | schema half (paired type: TabTransferType) | KEPT — false positive, 3 repo-wide hit(s) outside declaration |
| 1133 | type | `TabTransferType` | `grep -rnE "\\bTabTransferType\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | type half (paired schema: TabTransferTypeSchema) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 1135 | export | `TabTransferSchema` | `grep -rnE "\\bTabTransferSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | schema half (paired type: TabTransfer) | KEPT — false positive, 3 repo-wide hit(s) outside declaration |
| 1148 | export | `TabTransferCreateSchema` | `grep -rnE "\\bTabTransferCreateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema half (paired type: TabTransferCreate) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 1153 | type | `TabTransfer` | `grep -rnE "\\bTabTransfer\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | type half (paired schema: TabTransferSchema) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 1154 | type | `TabTransferCreate` | `grep -rnE "\\bTabTransferCreate\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | type half (paired schema: TabTransferCreateSchema) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 1160 | export | `PoolTableTransferSchema` | `grep -rnE "\\bPoolTableTransferSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema half (paired type: PoolTableTransfer) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 1170 | type | `PoolTableTransfer` | `grep -rnE "\\bPoolTableTransfer\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | type half (paired schema: PoolTableTransferSchema) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 1276 | export | `CartItemSchema` | `grep -rnE "\\bCartItemSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | schema, no paired type alias | KEPT — false positive, 3 repo-wide hit(s) outside declaration |
| 1286 | export | `CartItemCreateSchema` | `grep -rnE "\\bCartItemCreateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema half (paired type: CartItemCreate) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 1288 | export | `CartItemInputSchema` | `grep -rnE "\\bCartItemInputSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | schema half (paired type: CartItemInput) | KEPT — false positive, 3 repo-wide hit(s) outside declaration |
| 1297 | type | `CartItemCreate` | `grep -rnE "\\bCartItemCreate\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | type half (paired schema: CartItemCreateSchema) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 1298 | type | `CartItemInput` | `grep -rnE "\\bCartItemInput\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | type half (paired schema: CartItemInputSchema) | KEPT — false positive, 3 repo-wide hit(s) outside declaration |
| 1304 | export | `domain` | `grep -rnE "\\bdomain\\b" src/ supabase/functions/ e2e/ scripts/` | 287 | standalone value export (the namespace registry object itself) | KEPT — false positive, 287 repo-wide hit(s) outside declaration |
| 1619 | export | `ComboSlotTypeSchema` | `grep -rnE "\\bComboSlotTypeSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema half (paired type: ComboSlotType) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 1620 | type | `ComboSlotType` | `grep -rnE "\\bComboSlotType\\b" src/ supabase/functions/ e2e/ scripts/` | 0 | type half (paired schema: ComboSlotTypeSchema) | DELETED — type-alias half of a live schema/type pair, zero repo-wide hits outside its own declaration |
| 1634 | export | `ComboSlotCreateSchema` | `grep -rnE "\\bComboSlotCreateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 1 | schema half (paired type: ComboSlotCreate) | KEPT — false positive, 1 repo-wide hit(s) outside declaration |
| 1635 | export | `ComboSlotUpdateSchema` | `grep -rnE "\\bComboSlotUpdateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 1 | schema half (paired type: ComboSlotUpdate) | KEPT — false positive, 1 repo-wide hit(s) outside declaration |
| 1638 | type | `ComboSlotCreate` | `grep -rnE "\\bComboSlotCreate\\b" src/ supabase/functions/ e2e/ scripts/` | 1 | type half (paired schema: ComboSlotCreateSchema) | KEPT — false positive, 1 repo-wide hit(s) outside declaration |
| 1639 | type | `ComboSlotUpdate` | `grep -rnE "\\bComboSlotUpdate\\b" src/ supabase/functions/ e2e/ scripts/` | 1 | type half (paired schema: ComboSlotUpdateSchema) | KEPT — false positive, 1 repo-wide hit(s) outside declaration |
| 1650 | export | `ComboSlotOptionCreateSchema` | `grep -rnE "\\bComboSlotOptionCreateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 1 | schema half (paired type: ComboSlotOptionCreate) | KEPT — false positive, 1 repo-wide hit(s) outside declaration |
| 1656 | type | `ComboSlotOptionCreate` | `grep -rnE "\\bComboSlotOptionCreate\\b" src/ supabase/functions/ e2e/ scripts/` | 1 | type half (paired schema: ComboSlotOptionCreateSchema) | KEPT — false positive, 1 repo-wide hit(s) outside declaration |
| 1669 | export | `ComboAvailabilityCreateSchema` | `grep -rnE "\\bComboAvailabilityCreateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 1 | schema half (paired type: ComboAvailabilityCreate) | KEPT — false positive, 1 repo-wide hit(s) outside declaration |
| 1675 | type | `ComboAvailabilityCreate` | `grep -rnE "\\bComboAvailabilityCreate\\b" src/ supabase/functions/ e2e/ scripts/` | 1 | type half (paired schema: ComboAvailabilityCreateSchema) | KEPT — false positive, 1 repo-wide hit(s) outside declaration |
| 1678 | export | `SlotSelectionSchema` | `grep -rnE "\\bSlotSelectionSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | schema, no paired type alias | KEPT — false positive, 3 repo-wide hit(s) outside declaration |
| 1687 | export | `AddComboToTabInputSchema` | `grep -rnE "\\bAddComboToTabInputSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 1 | schema, no paired type alias | KEPT — false positive, 1 repo-wide hit(s) outside declaration |
| 1701 | export | `UomSchema` | `grep -rnE "\\bUomSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | schema half (paired type: Uom) | KEPT — false positive, 3 repo-wide hit(s) outside declaration |
| 1702 | type | `Uom` | `grep -rnE "\\bUom\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | type half (paired schema: UomSchema) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 1705 | export | `BaseUomSchema` | `grep -rnE "\\bBaseUomSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | schema half (paired type: BaseUom) | KEPT — false positive, 3 repo-wide hit(s) outside declaration |
| 1706 | type | `BaseUom` | `grep -rnE "\\bBaseUom\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | type half (paired schema: BaseUomSchema) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 1709 | export | `ManualAdjustReasonSchema` | `grep -rnE "\\bManualAdjustReasonSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema, no paired type alias | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 1740 | export | `IngredientUpdateSchema` | `grep -rnE "\\bIngredientUpdateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema half (paired type: IngredientUpdate) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 1744 | type | `IngredientUpdate` | `grep -rnE "\\bIngredientUpdate\\b" src/ supabase/functions/ e2e/ scripts/` | 1 | type half (paired schema: IngredientUpdateSchema) | KEPT — false positive, 1 repo-wide hit(s) outside declaration |
| 1750 | export | `RefundReasonSchema` | `grep -rnE "\\bRefundReasonSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 4 | schema, no paired type alias | KEPT — false positive, 4 repo-wide hit(s) outside declaration |
| 1758 | export | `RefundItemSchema` | `grep -rnE "\\bRefundItemSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 4 | schema, no paired type alias | KEPT — false positive, 4 repo-wide hit(s) outside declaration |
| 1768 | export | `RefundSchema` | `grep -rnE "\\bRefundSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | schema, no paired type alias | KEPT — false positive, 3 repo-wide hit(s) outside declaration |
| 1778 | export | `RefundCreateSchema` | `grep -rnE "\\bRefundCreateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema half (paired type: RefundCreate) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 1781 | type | `RefundCreate` | `grep -rnE "\\bRefundCreate\\b" src/ supabase/functions/ e2e/ scripts/` | 1 | type half (paired schema: RefundCreateSchema) | KEPT — false positive, 1 repo-wide hit(s) outside declaration |
| 1821 | export | `RecipeSchema` | `grep -rnE "\\bRecipeSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | schema half (paired type: Recipe) | KEPT — false positive, 3 repo-wide hit(s) outside declaration |
| 1827 | export | `RecipeCreateSchema` | `grep -rnE "\\bRecipeCreateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema half (paired type: RecipeCreate) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 1833 | export | `RecipeUpdateSchema` | `grep -rnE "\\bRecipeUpdateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema half (paired type: RecipeUpdate) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 1847 | export | `RecipeItemCreateSchema` | `grep -rnE "\\bRecipeItemCreateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema, no paired type alias | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 1849 | type | `Recipe` | `grep -rnE "\\bRecipe\\b" src/ supabase/functions/ e2e/ scripts/` | 16 | type half (paired schema: RecipeSchema) | KEPT — false positive, 16 repo-wide hit(s) outside declaration |
| 1850 | type | `RecipeCreate` | `grep -rnE "\\bRecipeCreate\\b" src/ supabase/functions/ e2e/ scripts/` | 1 | type half (paired schema: RecipeCreateSchema) | KEPT — false positive, 1 repo-wide hit(s) outside declaration |
| 1851 | type | `RecipeUpdate` | `grep -rnE "\\bRecipeUpdate\\b" src/ supabase/functions/ e2e/ scripts/` | 1 | type half (paired schema: RecipeUpdateSchema) | KEPT — false positive, 1 repo-wide hit(s) outside declaration |
| 1852 | type | `RecipeItem` | `grep -rnE "\\bRecipeItem\\b" src/ supabase/functions/ e2e/ scripts/` | 1 | standalone type alias (no paired XSchema in file) | KEPT — false positive, 1 repo-wide hit(s) outside declaration |
| 1899 | export | `WaitlistEntryStatusSchema` | `grep -rnE "\\bWaitlistEntryStatusSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | schema, no paired type alias | KEPT — false positive, 3 repo-wide hit(s) outside declaration |
| 1913 | export | `PhoneE164Schema` | `grep -rnE "\\bPhoneE164Schema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema, no paired type alias | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 1930 | export | `WaitlistEntryCreateSchema` | `grep -rnE "\\bWaitlistEntryCreateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema, no paired type alias | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 1957 | export | `ComboMixRowSchema` | `grep -rnE "\\bComboMixRowSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 1 | schema, no paired type alias | KEPT — false positive, 1 repo-wide hit(s) outside declaration |
| 1968 | export | `RecipeVarianceRowSchema` | `grep -rnE "\\bRecipeVarianceRowSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 1 | schema, no paired type alias | KEPT — false positive, 1 repo-wide hit(s) outside declaration |
| 1978 | export | `WaitlistMetricsRowSchema` | `grep -rnE "\\bWaitlistMetricsRowSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 1 | schema, no paired type alias | KEPT — false positive, 1 repo-wide hit(s) outside declaration |
| 1987 | export | `RefundRegisterRowSchema` | `grep -rnE "\\bRefundRegisterRowSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 1 | schema, no paired type alias | KEPT — false positive, 1 repo-wide hit(s) outside declaration |
| 1999 | export | `ComboOverrideRowSchema` | `grep -rnE "\\bComboOverrideRowSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 1 | schema, no paired type alias | KEPT — false positive, 1 repo-wide hit(s) outside declaration |
| 2012 | export | `AuditSourceSchema` | `grep -rnE "\\bAuditSourceSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | schema half (paired type: AuditSource) | KEPT — false positive, 3 repo-wide hit(s) outside declaration |
| 2013 | type | `AuditSource` | `grep -rnE "\\bAuditSource\\b" src/ supabase/functions/ e2e/ scripts/` | 1 | type half (paired schema: AuditSourceSchema) | KEPT — false positive, 1 repo-wide hit(s) outside declaration |
| 2030 | export | `AuditLogFiltersSchema` | `grep -rnE "\\bAuditLogFiltersSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema, no paired type alias | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 2055 | export | `OfflineActionSchema` | `grep -rnE "\\bOfflineActionSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 1 | schema, no paired type alias | KEPT — false positive, 1 repo-wide hit(s) outside declaration |
| 2072 | export | `PromotionDiscountTypeSchema` | `grep -rnE "\\bPromotionDiscountTypeSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 9 | schema, no paired type alias | KEPT — false positive, 9 repo-wide hit(s) outside declaration |
| 2075 | export | `PromotionTargetTypeSchema` | `grep -rnE "\\bPromotionTargetTypeSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 10 | schema, no paired type alias | KEPT — false positive, 10 repo-wide hit(s) outside declaration |
| 2106 | export | `PromotionCreateSchema` | `grep -rnE "\\bPromotionCreateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 10 | schema half (paired type: PromotionCreate) | KEPT — false positive, 10 repo-wide hit(s) outside declaration |
| 2114 | export | `PromotionUpdateSchema` | `grep -rnE "\\bPromotionUpdateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema, no paired type alias | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 2122 | type | `PromotionCreate` | `grep -rnE "\\bPromotionCreate\\b" src/ supabase/functions/ e2e/ scripts/` | 1 | type half (paired schema: PromotionCreateSchema) | KEPT — false positive, 1 repo-wide hit(s) outside declaration |
| 2136 | export | `PromotionAvailabilityCreateSchema` | `grep -rnE "\\bPromotionAvailabilityCreateSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema half (paired type: PromotionAvailabilityCreate) | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 2142 | type | `PromotionAvailabilityCreate` | `grep -rnE "\\bPromotionAvailabilityCreate\\b" src/ supabase/functions/ e2e/ scripts/` | 1 | type half (paired schema: PromotionAvailabilityCreateSchema) | KEPT — false positive, 1 repo-wide hit(s) outside declaration |
| 2147 | export | `AppliedPromotionSchema` | `grep -rnE "\\bAppliedPromotionSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 5 | schema half (paired type: AppliedPromotion) | KEPT — false positive, 5 repo-wide hit(s) outside declaration |
| 2164 | type | `AppliedPromotion` | `grep -rnE "\\bAppliedPromotion\\b" src/ supabase/functions/ e2e/ scripts/` | 1 | type half (paired schema: AppliedPromotionSchema) | KEPT — false positive, 1 repo-wide hit(s) outside declaration |

**Task 1 tally: 155 findings, 2 DELETED, 153 KEPT (false positive), 2 duplicate-export pairs deferred (not corrected).**

`npm run typecheck && npm run lint && npm run test` after this batch: clean typecheck, clean lint (only the pre-existing `[boundaries]` legacy-selector-syntax warning, documented out-of-scope since 39-01-LEDGER.md), 151 test files passed + 2 skipped, 1391 tests passed + 15 todo — exact match to the 39-08 baseline, zero regression.

## Task 2 — `edge-function-contracts.ts` (41 findings)

### Zero-hit type-alias findings (7 of 41)

Following the same rule as Task 1, 7 findings had zero repository-wide hits and are the type half of a still-live schema — deleted with no further investigation needed:

| Line | Name | Paired schema | Schema hit count |
|---|---|---|---|
| 80 | `ShiftSummary` (type) | `ShiftSummarySchema` (68) | 2 at the time of the initial scan (both self-referential — see the cluster finding below) |
| 129 | `ReportData` (type) | `ReportDataSchema` (85) | 2 at the time of the initial scan (both self-referential — see below) |
| 201 | `ProcessPaymentEnvelope` (type) | `ProcessPaymentEnvelopeSchema` (193) | 3, genuinely live |
| 414 | `ProcessSplitPaymentEnvelope` (type) | `ProcessSplitPaymentEnvelopeSchema` (405) | 3, genuinely live |
| 856 | `SendReceiptEmailEnvelope` (type) | `SendReceiptEmailEnvelopeSchema` (851) | 3, genuinely live |
| 938 | `RappiMenuSyncResponse` (type) | `RappiMenuSyncResponseSchema` (927) | 3, genuinely live |
| 1358 | `EdgeFunctionName` (type) | derived from `EDGE_FUNCTIONS` const (1292), not a `z.infer` pair | `EDGE_FUNCTIONS` has 1 hit (its own use inside this very type alias) |

**DELETED** (all 7, plus `EdgeFunctionName`'s underlying `keyof typeof EDGE_FUNCTIONS` derivation, which stays valid regardless of how many keys the registry object carries).

### The Task-2-specific gate: contract symbols describing a non-existent edge function

This plan's `<action>` mandates an additional check beyond hit-counting for this file specifically: *"determine which edge function [a contract] describes and check whether that function still exists under `supabase/functions/`... A contract symbol is a genuine deletion candidate only when it describes no function that exists."* Applying that check to every entry in the file's own `EDGE_FUNCTIONS` registry object against `ls supabase/functions/` surfaced exactly one mismatch:

| `EDGE_FUNCTIONS` registry key | `supabase/functions/<key>/` exists? |
|---|---|
| `process-payment` | yes |
| `process-split-payment` | yes |
| `send-receipt-email` | yes |
| `close-shift` | **no** |
| `generate-report` | **no** |
| `void-order` | yes |
| `rappi-sync-menu` | yes |
| `settings-backup` | yes |
| `settings-restore` | yes |
| `settings-email-status` | yes |
| `settings-test-email` | yes |
| `get-server-time` | yes |

`close-shift` and `generate-report` are the only two registry entries with no matching directory. Three corroborating checks confirmed this is a genuine dead cluster rather than a "deployed but directory deleted" false negative (the case 39-03-LEDGER.md's `void-order`/`rappi-webhook` findings warn against assuming too quickly):

1. **No external callers anywhere.** `grep -rn "callCloseShift\|callGenerateReport\|close-shift\|generate-report" src/ e2e/ scripts/` (excluding `edge-function-contracts.ts` itself) returns **zero** hits. Every other contract family in this file shows the identical *internal* self-reference pattern (own type alias + own `.parse()` call + own registry entry) even for confirmed-live functions like `void-order`, so internal-only hits alone don't distinguish live from dead here — the directory check does.
2. **No git history.** `git log --oneline --all -- 'supabase/functions/close-shift' 'supabase/functions/generate-report'` returns nothing — these directories never existed in this repository's history, ruling out "deployed once, source later deleted" (the scenario that makes a missing directory ambiguous).
3. **Superseded by a different architecture.** CLAUDE.md documents `close_caja_session` (a Postgres RPC, wired to `clock-out-staff`) as the live shift-close path, and the Phase 24 operational-reports-suite RPCs (`get_peak_hours_report`, `get_voids_report`, `get_modifier_popularity_report`, `get_payment_methods_report`) as the live report-generation path. Both `callCloseShift` and `callGenerateReport` predate and were never wired to either — they are vestigial client-side contract code for a generic edge-function approach the project moved away from.

**DELETED as a cluster (12 symbols + 2 registry entries):**

- `ShiftSummarySchema` (68) + its already-queued type alias `ShiftSummary` (80) — reclassified from the Task-1-style "kept, nonzero hits" disposition once its only 2 hits were traced: its own type alias (already a deletion candidate) and its one field-level use inside `CloseShiftResponseSchema.summary`, which this cluster also deletes. With both consumers gone, `ShiftSummarySchema` itself is orphaned.
- `ReportDataSchema` (85) + `ReportData` (129) — same cascade, via `GenerateReportResponseSchema.data`.
- `CloseShiftRequestSchema` (548) + `CloseShiftRequest` (553, type)
- `CloseShiftResponseSchema` (558) + `CloseShiftResponse` (564, type)
- `callCloseShift` (584)
- `GenerateReportRequestSchema` (642) + `GenerateReportRequest` (648, type)
- `GenerateReportResponseSchema` (653) + `GenerateReportResponse` (660, type)
- `callGenerateReport` (680)
- The `'close-shift'` and `'generate-report'` entries in the `EDGE_FUNCTIONS` registry object (removed as necessary accompanying cleanup — not independently knip-flagged, since the object literal isn't itself a per-key finding, but leaving a registry entry referencing a just-deleted symbol would not compile).

This is a larger removal than a single flagged line, but it is fully self-contained (traced every dependent before deleting, confirmed nothing outside this 12-symbol cluster references any part of it) and is exactly the scenario the plan's own Task 2 text anticipates and directs — a contract describing a function that was never implemented is a genuine deletion candidate regardless of internal self-reference hit count. No other contract family in the file exhibited this pattern (spot-checked `VoidOrderRequestSchema`, `RappiMenuSyncResponseSchema`, `CreateSettingsBackupRequestSchema`, `GetServerTimeResponseSchema`, `SendReceiptEmailRequestSchema` — all show the same internal-only hit pattern but every one of their target directories exists under `supabase/functions/`, so all were correctly KEPT).

### Full per-finding table (41 rows)

| Line | Kind | Name | Search command | Hits | Pairing | Outcome |
|---|---|---|---|---|---|---|
| 29 | export | `ReceiptDataSchema` | `grep -rnE "\\bReceiptDataSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 9 | schema, no paired type alias | KEPT — false positive, 9 repo-wide hit(s) outside declaration |
| 68 | export | `ShiftSummarySchema` | `grep -rnE "\\bShiftSummarySchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema half (paired type: ShiftSummary) | DELETED — Task 2 gate: describes the `close-shift`/`generate-report` cluster (no `supabase/functions/` directory, never existed per `git log --all`, zero external callers); both hits were self-referential (own type alias + `CloseShiftResponseSchema.summary`, itself deleted); see narrative above |
| 80 | type | `ShiftSummary` | `grep -rnE "\\bShiftSummary\\b" src/ supabase/functions/ e2e/ scripts/` | 0 | type half (paired schema: ShiftSummarySchema) | DELETED — type-alias half of a live schema/type pair, zero repo-wide hits outside its own declaration |
| 85 | export | `ReportDataSchema` | `grep -rnE "\\bReportDataSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema half (paired type: ReportData) | DELETED — Task 2 gate: describes the `close-shift`/`generate-report` cluster (no `supabase/functions/` directory, never existed per `git log --all`, zero external callers); both hits were self-referential (own type alias + `GenerateReportResponseSchema.data`, itself deleted); see narrative above |
| 129 | type | `ReportData` | `grep -rnE "\\bReportData\\b" src/ supabase/functions/ e2e/ scripts/` | 0 | type half (paired schema: ReportDataSchema) | DELETED — type-alias half of a live schema/type pair, zero repo-wide hits outside its own declaration |
| 138 | export | `ProcessPaymentRequestSchema` | `grep -rnE "\\bProcessPaymentRequestSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 22 | schema, no paired type alias | KEPT — false positive, 22 repo-wide hit(s) outside declaration |
| 185 | export | `ProcessPaymentSuccessSchema` | `grep -rnE "\\bProcessPaymentSuccessSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema, no paired type alias | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 193 | export | `ProcessPaymentEnvelopeSchema` | `grep -rnE "\\bProcessPaymentEnvelopeSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | schema half (paired type: ProcessPaymentEnvelope) | KEPT — false positive, 3 repo-wide hit(s) outside declaration |
| 201 | type | `ProcessPaymentEnvelope` | `grep -rnE "\\bProcessPaymentEnvelope\\b" src/ supabase/functions/ e2e/ scripts/` | 0 | type half (paired schema: ProcessPaymentEnvelopeSchema) | DELETED — type-alias half of a live schema/type pair, zero repo-wide hits outside its own declaration |
| 333 | export | `SplitPaymentLegRequestSchema` | `grep -rnE "\\bSplitPaymentLegRequestSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 1 | schema, no paired type alias | KEPT — false positive, 1 repo-wide hit(s) outside declaration |
| 371 | export | `ProcessSplitPaymentRequestSchema` | `grep -rnE "\\bProcessSplitPaymentRequestSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | schema, no paired type alias | KEPT — false positive, 3 repo-wide hit(s) outside declaration |
| 396 | export | `ProcessSplitPaymentSuccessSchema` | `grep -rnE "\\bProcessSplitPaymentSuccessSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema, no paired type alias | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 405 | export | `ProcessSplitPaymentEnvelopeSchema` | `grep -rnE "\\bProcessSplitPaymentEnvelopeSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | schema half (paired type: ProcessSplitPaymentEnvelope) | KEPT — false positive, 3 repo-wide hit(s) outside declaration |
| 414 | type | `ProcessSplitPaymentEnvelope` | `grep -rnE "\\bProcessSplitPaymentEnvelope\\b" src/ supabase/functions/ e2e/ scripts/` | 0 | type half (paired schema: ProcessSplitPaymentEnvelopeSchema) | DELETED — type-alias half of a live schema/type pair, zero repo-wide hits outside its own declaration |
| 548 | export | `CloseShiftRequestSchema` | `grep -rnE "\\bCloseShiftRequestSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | schema half (paired type: CloseShiftRequest) | DELETED — Task 2 gate, close-shift/generate-report cluster; see narrative above |
| 553 | type | `CloseShiftRequest` | `grep -rnE "\\bCloseShiftRequest\\b" src/ supabase/functions/ e2e/ scripts/` | 1 | type half (paired schema: CloseShiftRequestSchema) | DELETED — Task 2 gate, close-shift/generate-report cluster; see narrative above |
| 558 | export | `CloseShiftResponseSchema` | `grep -rnE "\\bCloseShiftResponseSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | schema half (paired type: CloseShiftResponse) | DELETED — Task 2 gate, close-shift/generate-report cluster; see narrative above |
| 564 | type | `CloseShiftResponse` | `grep -rnE "\\bCloseShiftResponse\\b" src/ supabase/functions/ e2e/ scripts/` | 1 | type half (paired schema: CloseShiftResponseSchema) | DELETED — Task 2 gate, close-shift/generate-report cluster; see narrative above |
| 584 | export | `callCloseShift` | `grep -rnE "\\bcallCloseShift\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | standalone value export (not a Schema-suffixed const) | DELETED — Task 2 gate, close-shift/generate-report cluster; see narrative above |
| 642 | export | `GenerateReportRequestSchema` | `grep -rnE "\\bGenerateReportRequestSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | schema half (paired type: GenerateReportRequest) | DELETED — Task 2 gate, close-shift/generate-report cluster; see narrative above |
| 648 | type | `GenerateReportRequest` | `grep -rnE "\\bGenerateReportRequest\\b" src/ supabase/functions/ e2e/ scripts/` | 1 | type half (paired schema: GenerateReportRequestSchema) | DELETED — Task 2 gate, close-shift/generate-report cluster; see narrative above |
| 653 | export | `GenerateReportResponseSchema` | `grep -rnE "\\bGenerateReportResponseSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | schema half (paired type: GenerateReportResponse) | DELETED — Task 2 gate, close-shift/generate-report cluster; see narrative above |
| 660 | type | `GenerateReportResponse` | `grep -rnE "\\bGenerateReportResponse\\b" src/ supabase/functions/ e2e/ scripts/` | 1 | type half (paired schema: GenerateReportResponseSchema) | DELETED — Task 2 gate, close-shift/generate-report cluster; see narrative above |
| 680 | export | `callGenerateReport` | `grep -rnE "\\bcallGenerateReport\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | standalone value export (not a Schema-suffixed const) | DELETED — Task 2 gate, close-shift/generate-report cluster; see narrative above |
| 738 | export | `VoidOrderRequestSchema` | `grep -rnE "\\bVoidOrderRequestSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | schema, no paired type alias | KEPT — false positive, 3 repo-wide hit(s) outside declaration; `void-order` directory confirmed present (also confirmed deployed/reachable in 39-05-LEDGER.md's `18-void-order.spec.ts` investigation) |
| 759 | export | `VoidOrderResponseSchema` | `grep -rnE "\\bVoidOrderResponseSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | schema, no paired type alias | KEPT — false positive, 3 repo-wide hit(s) outside declaration |
| 839 | export | `SendReceiptEmailRequestSchema` | `grep -rnE "\\bSendReceiptEmailRequestSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 9 | schema, no paired type alias | KEPT — false positive, 9 repo-wide hit(s) outside declaration (includes real `edge-function-contracts.test.ts` coverage) |
| 851 | export | `SendReceiptEmailEnvelopeSchema` | `grep -rnE "\\bSendReceiptEmailEnvelopeSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | schema half (paired type: SendReceiptEmailEnvelope) | KEPT — false positive, 3 repo-wide hit(s) outside declaration; `send-receipt-email` directory confirmed present |
| 856 | type | `SendReceiptEmailEnvelope` | `grep -rnE "\\bSendReceiptEmailEnvelope\\b" src/ supabase/functions/ e2e/ scripts/` | 0 | type half (paired schema: SendReceiptEmailEnvelopeSchema) | DELETED — type-alias half of a live schema/type pair, zero repo-wide hits outside its own declaration |
| 927 | export | `RappiMenuSyncResponseSchema` | `grep -rnE "\\bRappiMenuSyncResponseSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | schema half (paired type: RappiMenuSyncResponse) | KEPT — false positive, 3 repo-wide hit(s) outside declaration; `rappi-sync-menu` directory confirmed present |
| 938 | type | `RappiMenuSyncResponse` | `grep -rnE "\\bRappiMenuSyncResponse\\b" src/ supabase/functions/ e2e/ scripts/` | 0 | type half (paired schema: RappiMenuSyncResponseSchema) | DELETED — type-alias half of a live schema/type pair, zero repo-wide hits outside its own declaration |
| 992 | export | `CreateSettingsBackupRequestSchema` | `grep -rnE "\\bCreateSettingsBackupRequestSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | schema, no paired type alias | KEPT — false positive, 3 repo-wide hit(s) outside declaration; `settings-backup` directory confirmed present |
| 998 | export | `CreateSettingsBackupResponseSchema` | `grep -rnE "\\bCreateSettingsBackupResponseSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema, no paired type alias | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 1056 | export | `RestoreSettingsBackupRequestSchema` | `grep -rnE "\\bRestoreSettingsBackupRequestSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | schema, no paired type alias | KEPT — false positive, 3 repo-wide hit(s) outside declaration; `settings-restore` directory confirmed present |
| 1062 | export | `RestoreSettingsBackupResponseSchema` | `grep -rnE "\\bRestoreSettingsBackupResponseSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema, no paired type alias | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 1123 | export | `SettingsEmailStatusResponseSchema` | `grep -rnE "\\bSettingsEmailStatusResponseSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema, no paired type alias | KEPT — false positive, 2 repo-wide hit(s) outside declaration; `settings-email-status` directory confirmed present |
| 1171 | export | `SettingsTestEmailRequestSchema` | `grep -rnE "\\bSettingsTestEmailRequestSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | schema, no paired type alias | KEPT — false positive, 3 repo-wide hit(s) outside declaration; `settings-test-email` directory confirmed present |
| 1177 | export | `SettingsTestEmailResponseSchema` | `grep -rnE "\\bSettingsTestEmailResponseSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 2 | schema, no paired type alias | KEPT — false positive, 2 repo-wide hit(s) outside declaration |
| 1241 | export | `GetServerTimeResponseSchema` | `grep -rnE "\\bGetServerTimeResponseSchema\\b" src/ supabase/functions/ e2e/ scripts/` | 3 | schema, no paired type alias | KEPT — false positive, 3 repo-wide hit(s) outside declaration; `get-server-time` directory confirmed present |
| 1292 | export | `EDGE_FUNCTIONS` | `grep -rnE "\\bEDGE_FUNCTIONS\\b" src/ supabase/functions/ e2e/ scripts/` | 1 | standalone value export (the registry object itself) | KEPT — false positive, 1 repo-wide hit(s) outside declaration (its own use inside `EdgeFunctionName`'s derivation); now carries 10 keys after the close-shift/generate-report entries were removed |
| 1358 | type | `EdgeFunctionName` | `grep -rnE "\\bEdgeFunctionName\\b" src/ supabase/functions/ e2e/ scripts/` | 0 | type half (derived from EDGE_FUNCTIONS const, not a Schema) | DELETED — type-alias half of a live const, zero repo-wide hits outside its own declaration |

**Task 2 tally: 41 findings, 19 DELETED (7 standalone type aliases + 12 close-shift/generate-report cluster symbols), 22 KEPT (false positive, live schema/const with a confirmed-existing `supabase/functions/` directory or genuine external use).**

`npm run typecheck && npm run lint && npm run test` after this batch: clean typecheck, clean lint (same pre-existing `[boundaries]` warning only), and the unit suite matched the 39-08 baseline exactly (151 files / 1391 tests passing) once re-run past a burst of unrelated single-test flakiness. That flakiness (a different, unrelated test failing each of several consecutive `npm run test` runs — `queries.clock.test.ts`, `CajaDashboard.test.tsx`, `groupOrderItemsForReceipt.test.ts`, none touching `domain.ts` or `edge-function-contracts.ts`, each passing cleanly when re-run in isolation) is attributed to CPU/resource contention from the three sibling parallel-wave worktree agents (39-09/39-10/39-11) all running `npm run test` concurrently on the same machine during this session, not to this plan's edits — confirmed by a clean, fully-passing run once contention eased.

## Task 3 — Re-measured Registry Delta

### Method

Regenerated both knip reports fresh a second time (`npx knip --reporter json`, `npx knip --production --reporter json`), against the file state after Task 1 + Task 2's deletions, and recomputed the distinct finding count with the same set-union method used for the "before" snapshot and for 39-01/39-08's baselines (files ∪ exports ∪ types ∪ duplicate-entries, excluding `src/shared/ui/**`). A worktree-local scratch directory (`.scratch-39-09/`, excluded from this measurement and deleted before the final commit) had briefly polluted the raw "after" file-count by 4 (knip picked up the plan's own scratch `.cjs` scripts as newly-unused files) — excluded from the numbers below; confirmed via a before/after diff that zero real source files changed unused-file status.

### Registry-scoped delta (this plan's own `<verify>` metric: exports+types union, `domain.ts` + `edge-function-contracts.ts` only)

| | Before (39-08's published working set) | After (this plan) | Δ |
|---|---|---|---|
| Distinct export/type findings | 196 | **175** | **−21** |

Matches the ledger tally exactly: 2 deletions in `domain.ts` (Task 1) + 19 deletions in `edge-function-contracts.ts` (Task 2: 7 standalone type aliases + 12 close-shift/generate-report cluster symbols) = 21.

### Full-repo delta (39-01's whole-method, for phase-wide comparability)

| Category | Before this plan | After this plan | Δ |
|---|---|---|---|
| Unused files | 43 | 43 | 0 |
| Unused exports | 399 | 391 | −8 |
| Unused types | 204 | 191 | −13 |
| Duplicate-export entries | 6 (3 pairs) | 6 (3 pairs) | 0 |
| **Sum (distinct)** | **652** | **631** | **−21** |

(Minor counting-convention note: 39-08-LEDGER.md's published "before" figure for the same whole-repo method was 649, not 652 — a 3-item difference fully explained by 39-08 counting duplicate-export **pairs** [3] in its sum, where this measurement counts duplicate **entries** [6, i.e. both names in each pair]. Both this plan's "before" and "after" snapshots use the entries convention consistently, so the reported **−21 delta is unaffected** by which convention is chosen; only the absolute totals would shift by a constant +3 if re-expressed in the pairs convention.)

**Whole-file status unchanged for both registry files:** `src/shared/lib/domain.ts` and `src/shared/lib/edge-function-contracts.ts` are not, and were not, flagged as whole-file-dead by knip before or after this plan — both remain fully live, importable registry files. `EDGE_FUNCTIONS` now carries 10 entries (down from 12) after removing the `close-shift`/`generate-report` cluster.

**21 findings deliberately retained as false positives (not deletions):**
- 153 in `domain.ts` — every one traced to a nonzero repository-wide hit (a real consumer somewhere in `src/`, `e2e/`, or via the `domain` namespace registry object), documented individually in the Task 1 table above.
- 22 in `edge-function-contracts.ts` — 20 with a nonzero hit and a confirmed-existing `supabase/functions/` directory for their edge function, plus `EDGE_FUNCTIONS` itself (the registry object) and its remaining live entries.
- 2 duplicate-export pairs (`ModifierGroupItemSchema`/`ModifierGroupItemCreateSchema`, `ProductModifierGroupSchema`/`ProductModifierGroupCreateSchema`) — deferred, not corrected, per the narrative in Task 1 (both names in each pair are independently referenced by live consumers; consolidating touches the `domain` registry object's shape for no dead-code benefit).

The residual 175 findings across both files after this plan are therefore attributable to a recorded decision (knip false positive on a registry file, or a deliberate naming-convention deferral) in every single case — none are unexamined.

### Final verification

```
npm run typecheck   # clean, zero errors
npm run lint         # clean — only the pre-existing [boundaries] legacy-selector-syntax
                       warning (documented out-of-scope since 39-01-LEDGER.md), zero new
                       violations
npm run test          # 151 test files passed + 2 skipped (153), 1391 tests passed + 15 todo
                       (1406) — exact match to the 39-08 baseline, zero regression, after
                       re-running past transient parallel-worktree resource-contention
                       flakiness (see Task 2 note above; each flaky failure passed cleanly
                       in isolation and touched no file this plan modified)
```

No half of any Zod schema/type pair was deleted while the other half remained referenced. No contract for a still-`supabase/functions/`-deployed edge function was deleted — the one cluster that was deleted (`close-shift`/`generate-report`) was independently confirmed via three lines of evidence (zero external callers, no git history of the directory ever existing, superseded by a documented different architecture) to describe functions that were never implemented, not functions that were deployed and later had their source removed.

