---
phase: 25-receipt-item-grouping-2-level
plan: 01
subsystem: ui
tags: [receipt-formatting, thermal-printer, i18n, fast-check, zod]

# Dependency graph
requires: []
provides:
  - "groupByCategory<T> and formatModifierLines in src/shared/lib/groupOrderItemsForReceipt.ts — the shared 2-level (Category → Item) grouping utility all Phase 25 consumers bind to"
  - "ReceiptDataSchema.items[].categoryId/.categoryName/.modifierNames — the wire contract plan 02's process-payment Edge Function fills"
  - "buildThermalReceiptText and buildPreChequeText both render category headers + modifier lines via the shared grouping call"
affects: [25-02-process-payment-edge-function, 25-03-kds-card, 25-04-caja-report-top-products]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure grouping module with zero cross-module imports (usable from both shared/lib and widgets)"
    - "Sanitize-before-render for any catalog-authored string reaching a raw ESC/POS byte stream"

key-files:
  created:
    - src/shared/lib/groupOrderItemsForReceipt.ts
    - src/shared/lib/groupOrderItemsForReceipt.test.ts
  modified:
    - src/shared/lib/edge-function-contracts.ts
    - src/shared/lib/receipt-format.ts
    - src/shared/lib/receipt-format.test.ts
    - src/shared/lib/i18n/locales/es-MX/receipt.json
    - src/shared/lib/i18n/locales/en-US/receipt.json
    - src/features/print-precheque/usePrintPreCheque.ts

key-decisions:
  - "modifierNames uses z.array(z.string()).optional() instead of the plan's specified .default([]) — under this Zod version .default() makes the z.infer output field required, which broke the 5 existing ReceiptData literal call sites the plan requires to stay untouched. Runtime call sites fall back with `item.modifierNames ?? []`."
  - "CategorizedRow fields are typed `categoryId?: string | null | undefined` (not the plan's literal `categoryId: string | null`) so ReceiptData['items'] elements — which are optional under the Zod schema — satisfy the generic constraint directly under exactOptionalPropertyTypes, without an intermediate mapping step at each call site."
  - "The 3 pre-cheque test fixtures' categoryId/categoryName widening (originally assigned to Task 3 in the plan) was done in Task 2 instead, since Task 2's own acceptance criteria already requires a clean `npm run typecheck`."

patterns-established:
  - "groupByCategory<T extends CategorizedRow>(rows): CategoryGroup<T>[] — sorted named groups (localeCompare on categoryName) with a single trailing uncategorized bucket; grouping key is categoryId, not categoryName, so two categories sharing a display name stay distinct."
  - "formatModifierLines(names): string[] — the two-space-plus-sign modifier line convention, now the single source both receipt text builders route through."

requirements-completed: [SC-1, SC-2, SC-3]

coverage:
  - id: D1
    description: "groupByCategory groups items into sorted category buckets with a trailing uncategorized bucket"
    requirement: "SC-1"
    verification:
      - kind: unit
        ref: "src/shared/lib/groupOrderItemsForReceipt.test.ts#groupByCategory"
        status: pass
      - kind: unit
        ref: "src/shared/lib/groupOrderItemsForReceipt.test.ts#groupByCategory properties"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both buildThermalReceiptText and buildPreChequeText consume groupByCategory/formatModifierLines; no hand-rolled modifier loop remains"
    requirement: "SC-2"
    verification:
      - kind: unit
        ref: "src/shared/lib/receipt-format.test.ts#buildThermalReceiptText / buildPreChequeText"
        status: pass
      - kind: other
        ref: "grep -n 'for (const mod of' src/shared/lib/receipt-format.ts (no matches)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Single-category input degenerates to a pass-through group; existing receipt/pre-cheque tests pass unmodified apart from mechanical fixture widening"
    requirement: "SC-3"
    verification:
      - kind: unit
        ref: "src/shared/lib/groupOrderItemsForReceipt.test.ts#groupByCategory properties > single-category degeneracy"
        status: pass
      - kind: unit
        ref: "src/shared/lib/receipt-format.test.ts#single-category items produce no category header line"
        status: pass
    human_judgment: false

# Metrics
duration: 45min
completed: 2026-07-26
status: complete
---

# Phase 25 Plan 01: Category+Modifier Grouping Tracer Summary

**Shared `groupByCategory<T>`/`formatModifierLines` utility locked against the 32-column thermal receipt builders, with both `buildThermalReceiptText` and `buildPreChequeText` now rendering category headers and indented modifier lines from one grouping call.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3/3 completed
- **Files modified:** 9 (2 created, 7 modified)

## Accomplishments

- New pure module `groupOrderItemsForReceipt.ts` exporting `groupByCategory<T>` (sorted named groups, trailing uncategorized bucket, ESC/control-byte sanitization) and `formatModifierLines` (two-space plus-sign convention).
- `ReceiptDataSchema.items` extended with optional `categoryId`/`categoryName`/`modifierNames`, the wire contract for plan 02's `process-payment` Edge Function.
- `buildThermalReceiptText` rewired to group items via `groupByCategory`, emitting a centered category header only when 2+ groups exist, plus modifier lines per item — single-category receipts stay byte-identical to pre-migration output.
- `buildPreChequeText` mirrors the same grouping/header/modifier convention (D-05); the inline two-space modifier loop is gone from `receipt-format.ts` entirely.
- `usePrintPreCheque.ts` wires `item.product?.category?.id`/`.name` straight from the existing `tabListSelect` join — zero new queries.
- `receipt.category.other` i18n key added to both locales (es-MX: "Otros", en-US: "Other").
- 7 unit tests + 4 property tests (3 fast-check properties, `numRuns: 200`) proving grouping/sorting/ordering/sanitization invariants, plus 2 concrete `buildThermalReceiptText` regression cases (2-category+modifier fixture, single-category degenerate fixture).

## Task Commits

1. **Task 1: End-to-end category+modifier slice — utility, contract, thermal receipt** - `40ab310` (feat, tracer)
2. **Task 2: Pre-cheque consumes the same grouping (D-05)** - `28fa838` (feat)
3. **Task 3: Property tests for the single-level degenerate case (SC-3)** - `3ff4011` (test)

**Plan metadata:** pending (this commit)

## Files Created/Modified

- `src/shared/lib/groupOrderItemsForReceipt.ts` - `groupByCategory<T>`, `formatModifierLines`, `CategoryGroup<T>`, `CategorizedRow`, module-private `sanitize()`
- `src/shared/lib/groupOrderItemsForReceipt.test.ts` - unit + property-based test suite
- `src/shared/lib/edge-function-contracts.ts` - `ReceiptDataSchema.items` gains `categoryId`/`categoryName`/`modifierNames`
- `src/shared/lib/receipt-format.ts` - both text builders rewired to `groupByCategory`/`formatModifierLines`; `PreChequeData.items` gains required `categoryId`/`categoryName`
- `src/shared/lib/receipt-format.test.ts` - 3 fixtures widened, 2 new category/modifier regression cases
- `src/shared/lib/i18n/locales/es-MX/receipt.json` / `en-US/receipt.json` - `receipt.category.other` key
- `src/features/print-precheque/usePrintPreCheque.ts` - item mapping now includes `categoryId`/`categoryName`

## Decisions Made

- Switched `modifierNames` from the plan's specified `.default([])` to `.optional()` on the Zod schema — see Deviations below.
- Widened `CategorizedRow`'s fields to `categoryId?: string | null | undefined` (not the plan's literal `string | null`) so `ReceiptData['items']` elements satisfy the generic constraint under `exactOptionalPropertyTypes` without a mapping step at each call site.
- Moved the 3 pre-cheque fixture widenings from Task 3 (as plan-assigned) into Task 2, since Task 2's own acceptance criteria requires `npm run typecheck` to exit 0 and those fixtures were the only remaining typecheck blocker.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `modifierNames` schema field switched from `.default([])` to `.optional()`**
- **Found during:** Task 1 (`npm run typecheck` verification)
- **Issue:** The plan specified `modifierNames: z.array(z.string()).default([])`. Under this repo's Zod version, `.default()` makes the field required (non-optional) in `z.infer`'s output type, which is what `ReceiptData` resolves to. This broke the 5 existing `ReceiptData` object-literal call sites the plan explicitly requires to "keep type-checking untouched" (`edge-function-contracts.test.ts`, `pos-printer.test.ts`, `receipt-format.test.ts`, `ReceiptPreview.stories.tsx`, `ReceiptPreview.test.tsx`, `PaymentModal.test.tsx` — 6, not 5; the plan's count was off by one).
- **Fix:** Changed to `.optional()`. Runtime call sites needing a guaranteed array use `item.modifierNames ?? []` (already present in `buildThermalReceiptText`/`buildPreChequeText`).
- **Files modified:** `src/shared/lib/edge-function-contracts.ts`
- **Verification:** `npm run typecheck` exits 0; all 6 previously-broken call sites compile unchanged.
- **Committed in:** `40ab310` (Task 1 commit)

**2. [Rule 1 - Bug] `CategorizedRow` fields widened to include explicit `| undefined`**
- **Found during:** Task 1 (`npm run typecheck` verification, after fix #1)
- **Issue:** `CategorizedRow` as specified (`{ categoryId: string | null; categoryName: string | null }`) is incompatible under `exactOptionalPropertyTypes` with `ReceiptData['items'][number]`'s actual inferred type (`categoryId?: string | null | undefined`), producing `TS2345`/cascading `TS2339` errors when `buildThermalReceiptText` passed `receipt.items` directly into `groupByCategory`.
- **Fix:** Per this repo's own CLAUDE.md convention ("Never write `prop?: string` for mutation inputs — write `prop: string | undefined` instead"), redefined `CategorizedRow` as `{ categoryId?: string | null | undefined; categoryName?: string | null | undefined }`, matching the Zod-inferred shape exactly. Runtime logic in `groupByCategory` was restructured to avoid relying on narrowing through a separate boolean (`isUncategorized`) that TS couldn't propagate back onto the optional-typed field.
- **Files modified:** `src/shared/lib/groupOrderItemsForReceipt.ts`
- **Verification:** `npm run typecheck` exits 0.
- **Committed in:** `40ab310` (Task 1 commit)

**3. [Rule 1 - Bug] Raw control bytes accidentally written into the `sanitize()` regex literal**
- **Found during:** Task 1 (post-write file inspection)
- **Issue:** The `Write` tool call for `groupOrderItemsForReceipt.ts` rendered the intended ` --` regex range as literal raw control bytes (NUL, 0x1F, DEL, and the UTF-8 encoding of U+009F) embedded directly in the source file, rather than as `\u`-escape sequences.
- **Fix:** Rewrote the character class using explicit ` --` escape sequences via a byte-level Python replace (the raw bytes made string-based `Edit` matching unreliable).
- **Files modified:** `src/shared/lib/groupOrderItemsForReceipt.ts`
- **Verification:** `od -c` confirmed no raw control bytes remain in the file; `sanitize()` behavior unit-tested (control-character-stripping test passes).
- **Committed in:** `40ab310` (Task 1 commit)

**4. [Rule 3 - Blocking] `node_modules` missing in worktree; `.env.local` missing in worktree**
- **Found during:** Task 1 (test run attempt)
- **Issue:** This git worktree had no `node_modules` (platform-specific, gitignored, not carried into a fresh worktree checkout) and no `.env.local` (also gitignored; `src/test/global-setup.ts` requires `VITE_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` to run the unit suite).
- **Fix:** Ran `npm ci` in the worktree (lockfile hash differed from the main checkout, so a symlink to the main `node_modules` was not safe) and copied `.env.local` from the main checkout.
- **Files modified:** none tracked (node_modules and .env.local are gitignored; not committed)
- **Verification:** `npx vitest run --project unit ...` connects to Supabase and runs successfully.

---

**Total deviations:** 4 auto-fixed (3 Rule 1 - bug, 1 Rule 3 - blocking)
**Impact on plan:** All auto-fixes were necessary for the plan's own acceptance criteria (`npm run typecheck` exits 0) to hold. No scope creep — no files outside the plan's declared `<files>` lists were touched except the deferred-items.md log and the local, gitignored worktree setup (node_modules, .env.local).

## Issues Encountered

- 2 pre-existing typecheck errors in files untouched by this plan (`src/entities/tab/model/queries.ts:791`, `src/shared/lib/agent/rag.ts:60`) were present before and after this plan's changes. Logged to `.planning/phases/25-receipt-item-grouping-2-level/deferred-items.md`, not fixed (scope boundary — not caused by this plan's changes).
- The tracer feedback gate (Task 1's checkpoint) was resolved via the autonomous path: plan frontmatter is `autonomous: true` with no `checkpoint:*` tasks anywhere in the plan, this plan ran as a parallel worktree sub-agent with no interactive channel, and `AUTO_CFG`/`AUTO_CHAIN` were both `false` in `.planning/config.json`. Task 1's own `<verify>` (vitest + typecheck) was re-run and passed before proceeding to Task 2, matching the autonomous-run tracer-gate behavior described in the executor workflow.

## Next Phase Readiness

- `groupByCategory<T>`, `formatModifierLines`, and `CategoryGroup<T>` are locked and proven against the byte-width-constrained thermal receipt surface — waves 2's plans (02 process-payment Edge Function, 03 KDS card, 04 caja report top products) can bind to this interface directly.
- `ReceiptDataSchema.items[].categoryId`/`.categoryName`/`.modifierNames` is the concrete wire contract plan 02 must fill from the server side.
- No blockers for plan 02/03/04.

---
*Phase: 25-receipt-item-grouping-2-level*
*Completed: 2026-07-26*

## Self-Check: PASSED

All 10 claimed files found on disk; all 3 task commits (`40ab310`, `28fa838`, `3ff4011`) verified present in `git log --oneline --all`.
