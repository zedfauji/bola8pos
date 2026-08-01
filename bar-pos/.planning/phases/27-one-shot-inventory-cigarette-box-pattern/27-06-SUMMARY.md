---
phase: 27-one-shot-inventory-cigarette-box-pattern
plan: 06
subsystem: ui
tags: [react, zod, i18n, product-form, open-units]

# Dependency graph
requires:
  - phase: 27-one-shot-inventory-cigarette-box-pattern
    provides: "27-05's ProductSchema.unitsPerPackage/.parentProductId fields and ProductCreateSchema/ProductUpdateSchema derivations"
provides:
  - "Admin write path for products.units_per_package and products.parent_product_id via the existing product-management form"
  - "mapProductRow/productUpdateToRow/useMutationCreateProduct in src/entities/product/model/queries.ts read+write both new columns"
affects: ["27-07/27-08 (admin Open-Units tab UI can now expect real package/loose-piece products to configure against)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pre-type-regen `(row as { col?: T }).col ?? null` / `(row as Record<string, unknown>).col = ...` escape hatch (CLAUDE.md) reused verbatim for the two new products columns, matching the existing barcode precedent"
    - "Form-local raw string input state (e.g. unitsPerPackageInput) kept separate from the coerced submit-time value (unitsPerPackage) so the coerced name can appear as an object-shorthand key in both safeParse payload literals"

key-files:
  created: []
  modified:
    - src/entities/product/model/queries.ts
    - src/features/manage-products/ui/ProductForm.tsx
    - src/features/manage-products/ui/CatalogProductsTab.tsx
    - src/shared/lib/i18n/locales/es-MX/featMgmt.json
    - src/shared/lib/i18n/locales/en-US/featMgmt.json

key-decisions:
  - "useMutationCreateProduct's insertRow assigns unitsPerPackage/parentProductId unconditionally (no `!== undefined` guard) — unlike the update-mapper's guarded assignments, `ProductCreate`'s type has both keys required-but-nullable (not optional), so TypeScript flags the `!== undefined` check as `@typescript-eslint/no-unnecessary-condition` (always true). The update-mapper's guard is correct and necessary there because `Partial<ProductUpdate>` makes the keys genuinely optional."
  - "New i18n keys are genuine bilingual copy, not migrated literals — es-MX carries natural Spanish (\"Piezas por paquete\", \"No es una pieza suelta\") and en-US carries the English equivalent, per CLAUDE.md's catalog rule for new (non-migrated) strings."

requirements-completed: [SC-1, SC-3]

coverage:
  - id: D1
    description: "mapProductRow/productUpdateToRow/useMutationCreateProduct in src/entities/product/model/queries.ts read and write products.units_per_package and products.parent_product_id, with update-path null-clearing preserved via undefined guards"
    verification:
      - kind: unit
        ref: "npx vitest run --project unit src/entities/product (14 tests, existing suite green against the newly required-nullable ProductSchema fields)"
        status: pass
      - kind: other
        ref: "grep -c units_per_package/parent_product_id queries.ts >= 3 each; grep -c 'unitsPerPackage !== undefined'/'parentProductId !== undefined' == 1 each; no base_price/unitsPerPackage division present"
        status: pass
    human_judgment: false
  - id: D2
    description: "ProductForm gains a units-per-package number field and a parent-package select, both persisting through create and edit, in both es-MX and en-US locales, with no price derived from the package price"
    verification:
      - kind: unit
        ref: "npx vitest run --project unit src/features/manage-products (existing suite green)"
        status: pass
      - kind: other
        ref: "npm run lint (i18next/no-literal-string gate clean); node -e locale key-parity check (21 identical keys); grep -c 'unitsPerPackage,' ProductForm.tsx == 2; no basePrice/unitsPerPackage division present"
        status: pass
    human_judgment: false

# Metrics
duration: ~35min
completed: 2026-08-01
status: complete
---

# Phase 27 Plan 06: Product-Admin Open-Unit Fields Summary

**Wired `products.units_per_package` and `products.parent_product_id` into the existing admin product form (number field + parent-package select), extending the three entity mappers that read/write products, so the open-unit feature is configurable without hand-written SQL.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-01
- **Tasks:** 2 of 2 complete
- **Files modified:** 5

## Accomplishments

- `mapProductRow` now reads both new columns off the raw Supabase row (untyped-column escape hatch, matching the existing `barcode` precedent) so every product read satisfies 27-05's required-nullable `ProductSchema` fields instead of throwing.
- `productUpdateToRow` gained two `!== undefined`-guarded assignments so a `null` patch value (clearing a link, un-flagging a package) reaches the update row rather than being silently dropped by a truthiness check.
- `useMutationCreateProduct`'s `insertRow` writes both columns unconditionally (they're required-but-nullable on `ProductCreate`, not optional, so no undefined guard is needed or type-correct there) — a product can now be created already configured as a package or loose piece.
- `ProductForm` gained a **units-per-package** number field (D-02, set on the package product; a value below 1 blocks submit with a friendly `fieldErrors` message backed by 27-05's `positive()` Zod check and the table's `CHECK` constraint as the real backstops) and a **parent-package** select (D-01, set on the loose-piece product; options are filtered to products whose `unitsPerPackage` is set and exclude the product currently being edited, per T-27-18).
- Both new keys were added to **both** `ProductUpdateSchema` and `ProductCreateSchema` `safeParse` payload literals — the plan explicitly flagged an edit touching only one path as the likeliest silent bug here.
- `CatalogProductsTab` now passes its already-fetched product list into `ProductForm` (both the create-dialog and edit-dialog instances) as the new `products` prop, so the form stays presentational/props-only.
- Added 6 new `manageProducts.productForm.*` i18n keys to both `es-MX` and `en-US` locale files (label/hint for each field, the "not a loose piece" placeholder, and the below-minimum validation message) — genuine bilingual copy per CLAUDE.md's catalog rule for new strings, key sets verified identical across both locales.
- No code anywhere in this plan reads a parent product's `base_price` or divides by `unitsPerPackage` — verified by a negative grep in both changed files (D-03).

## Task Commits

Each task was committed atomically:

1. **Task 1: Read and write both open-unit columns in the product entity mappers** - `bf9535b` (feat)
2. **Task 2: Units-per-package and parent-package fields on the product form** - `e1cd6db` (feat)

**Plan metadata:** this SUMMARY.md commit (pending)

## Files Created/Modified

- `src/entities/product/model/queries.ts` - `mapProductRow` reads `unitsPerPackage`/`parentProductId`; `productUpdateToRow` writes both with undefined guards; `useMutationCreateProduct`'s `insertRow` writes both unconditionally
- `src/features/manage-products/ui/ProductForm.tsx` - new `products` prop, `unitsPerPackageInput`/`parentProductIdInput` state, `parentPackageOptions` derived list, two new `FormField`s, both `safeParse` payloads extended
- `src/features/manage-products/ui/CatalogProductsTab.tsx` - passes `products ?? []` into both `ProductForm` instances (create dialog + edit dialog)
- `src/shared/lib/i18n/locales/es-MX/featMgmt.json` - 6 new `manageProducts.productForm.*` keys (natural Spanish copy)
- `src/shared/lib/i18n/locales/en-US/featMgmt.json` - matching 6 keys (English copy)

## Decisions Made

See `key-decisions` in the frontmatter:
1. `insertRow`'s two new assignments in `useMutationCreateProduct` are unconditional, not `!== undefined`-guarded like the update-mapper's — `ProductCreate`'s type makes both keys required (nullable, not optional), so ESLint's `@typescript-eslint/no-unnecessary-condition` correctly flags a redundant guard there; the update-mapper's guard remains correct because `Partial<ProductUpdate>` genuinely makes the keys optional.
2. New i18n copy is real Spanish/English (not the "byte-identical to the pre-migration literal" rule, which only applies to strings that existed as hardcoded literals before the i18n migration) — this is brand-new UI copy.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed the `!== undefined` guard from the create-path column assignments**
- **Found during:** Task 1, running `npm run lint` after the initial edit (which mirrored the plan's literal guard text onto the create path).
- **Issue:** The plan's action text describes "the same two guarded assignments onto `insertRow`" as for `productUpdateToRow`, but `product.unitsPerPackage`/`product.parentProductId` on `CreateProductInput` (`ProductCreate & {...}`) are required-but-nullable, not optional — TypeScript therefore knows the `!== undefined` check is always `true`, and `@typescript-eslint/no-unnecessary-condition` (a lint error, not a warning) fails the build.
- **Fix:** Assign both columns unconditionally in the create path (`(insertRow as Record<string, unknown>).units_per_package = product.unitsPerPackage;` and the parent-id equivalent), keeping the guard only where the type is genuinely optional (`productUpdateToRow`'s `Partial<...>` input).
- **Files modified:** `src/entities/product/model/queries.ts`
- **Commit:** `bf9535b`

---

**Total deviations:** 1 (Rule 1 auto-fix)
**Impact on plan:** No scope creep — a mechanical type-correctness fix required to satisfy the project's zero-warning lint gate; behavior (both columns always written on create) is unchanged from what the plan intended.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None. Both new columns are already live in the database (27-02) and already typed on `ProductSchema` (27-05); this plan is pure client-layer UI/mapper work with no migration and no live push required.

## Next Phase Readiness

Plan 27-06 is complete. An admin can now configure any product as an openable package (units-per-package) and link a loose-piece product to it, entirely from the existing product-management form, in both shipped locales, with both values round-tripping through create and edit. Plans 27-07/27-08 (the admin Open-Units tab UI, binding to 27-05's `useOpenUnits`/mutation hooks) can now assume real package/loose-piece product pairs exist to open units against, without requiring hand-written SQL to set them up first.

---

## Self-Check: PASSED

- `src/entities/product/model/queries.ts` (units_per_package/parent_product_id in mapProductRow/productUpdateToRow/useMutationCreateProduct) — FOUND
- `src/features/manage-products/ui/ProductForm.tsx` (unitsPerPackage field + parentProductId select) — FOUND
- `src/features/manage-products/ui/CatalogProductsTab.tsx` (products prop passed to ProductForm) — FOUND
- `src/shared/lib/i18n/locales/es-MX/featMgmt.json` / `en-US/featMgmt.json` (6 new productForm keys, parity verified) — FOUND
- Commit `bf9535b` — FOUND in `git log --oneline`
- Commit `e1cd6db` — FOUND in `git log --oneline`
- `npx vitest run --project unit --reporter=dot src/features/manage-products src/entities/product` — 14 passed, 0 failed — CONFIRMED
- `npm run test` (full unit suite) — 147/149 files (2 skipped), 1352/1367 tests passed, 15 todo, 0 failed — CONFIRMED
- `npm run typecheck` — clean — CONFIRMED
- `npm run lint` — clean — CONFIRMED

---
*Phase: 27-one-shot-inventory-cigarette-box-pattern*
*Completed: 2026-08-01*
