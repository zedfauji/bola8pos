---
phase: 28-money-formatter-utility
plan: 07
subsystem: ui
tags: [formatMoney, i18n, react-i18next, order-entry, agent-chat, prep]

# Dependency graph
requires:
  - phase: 28-money-formatter-utility
    provides: "formatMoney/formatMoneyIn/formatPercent/parseMoneyInput in src/shared/lib/format.ts (plan 01), including the showSign option (D-06)"
provides:
  - "Modifier price deltas in ModifierSheet, CartItem, OrderItemCard, and ProductForm rendered via formatMoney({ showSign: true })"
  - "Combo price override and agent-chat product prices rendered via formatMoney"
  - "Prep quantity displays (PrepBatchPreview x3, PrepOnHandCard x1) explicitly exempted from the money formatter with reasoned lint-disable comments"
affects: [28-08-money-formatter-lint-rule]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "showSign: true replaces hand-picked sign-character branches at real production call sites (D-06)"
    - "no-restricted-syntax exemption comment convention for non-money .toFixed(2) sites: '// eslint-disable-next-line no-restricted-syntax -- quantity in a unit of measure, not money' (per 28-RESEARCH.md Pitfall 4)"

key-files:
  created: []
  modified:
    - src/features/add-item-to-tab/ui/ModifierSheet.tsx
    - src/entities/tab/ui/CartItem.tsx
    - src/widgets/OrderPanel/OrderItemCard.tsx
    - src/features/manage-products/ui/ProductForm.tsx
    - src/features/manage-combos/ui/ManageCombosTab.tsx
    - src/features/agent-chat/model/useAgent.ts
    - src/features/agent-chat/ui/ImportPreviewTable.tsx
    - src/features/produce-prep-batch/ui/PrepBatchPreview.tsx
    - src/entities/prep/ui/PrepOnHandCard.tsx

key-decisions:
  - "ProductForm's modifier price-delta preview previously had no currency symbol at all (parens + bare sign + number) — formatMoney migration adds the symbol, which is a correctness improvement in scope for this plan (it's one of the four named showSign call sites), not a separate bug fix"
  - "CartItem and OrderItemCard's differing cents-vs-units conventions for priceDelta were preserved exactly as found (OrderItemCard still divides by 100, CartItem does not) — flagged for separate handling, not normalized here"

patterns-established: []

requirements-completed: [SC-2, SC-4]

coverage:
  - id: D1
    description: "Modifier price deltas in ModifierSheet, CartItem, OrderItemCard, and ProductForm render via formatMoney(delta, { showSign: true })"
    requirement: "SC-2"
    verification:
      - kind: other
        ref: "grep -Eq 'showSign' on all four files + grep -Eq 'priceDelta / 100' on OrderItemCard.tsx (plan verify gates)"
        status: pass
      - kind: other
        ref: "npm run typecheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "Combo price override (ManageCombosTab) and agent-chat product prices (useAgent markdown table, ImportPreviewTable cell) render via formatMoney"
    requirement: "SC-2"
    verification:
      - kind: other
        ref: "grep -Eq \"from '@shared/lib/format'\" on all three files (plan verify gate)"
        status: pass
      - kind: other
        ref: "npm run typecheck"
        status: pass
    human_judgment: false
  - id: D3
    description: "Prep quantity displays (PrepBatchPreview x3, PrepOnHandCard x1) are explicitly exempted from formatMoney with reasoned no-restricted-syntax disable comments, not migrated"
    requirement: "SC-4"
    verification:
      - kind: other
        ref: "grep -Ec exemption-comment counts (3 in PrepBatchPreview.tsx, 1 in PrepOnHandCard.tsx) + grep -Ec formatMoney absence (0 in both) — plan verify gates"
        status: pass
      - kind: other
        ref: "npm run typecheck"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-08-02
status: complete
---

# Phase 28 Plan 07: Order-Entry, Product-Management & Agent-Chat Formatter Migration Summary

**Migrated the last group of hand-built money strings (modifier deltas, combo overrides, agent-chat prices) onto `formatMoney`, exercising D-06's `showSign` option at four real production call sites, and explicitly exempted four prep-quantity displays as non-money.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-08-02T19:43:45Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- Four sign-picking branches (ModifierSheet, CartItem, OrderItemCard, ProductForm) collapsed onto a single `formatMoney(delta, { showSign: true })` call each, with each file's positive-only visibility condition and unit convention preserved exactly
- Combo price override (`ManageCombosTab`), the agent-chat markdown product table (`useAgent`), and the import-preview price cell (`ImportPreviewTable`) now source their currency strings from `formatMoney`
- `PrepBatchPreview`'s three quantity serializations (required amount, stock delta, produced quantity) and `PrepOnHandCard`'s on-hand quantity are explicitly classified as non-money with reasoned `eslint-disable-next-line no-restricted-syntax` comments, matching the `28-RESEARCH.md` Pitfall 4 convention

## Task Commits

Each task was committed atomically:

1. **Task 1: Route modifier price deltas through showSign** - `4052d58` (feat)
2. **Task 2: Migrate combo override prices and agent-chat product prices** - `9bb2c2b` (feat)
3. **Task 3: Exempt the prep quantity displays** - `9561f01` (chore)

**Plan metadata:** committed alongside this SUMMARY (worktree mode — orchestrator handles the metadata commit centrally after merge)

## Files Created/Modified
- `src/features/add-item-to-tab/ui/ModifierSheet.tsx` - Two sign-picking branches collapsed into one `formatMoney(modifier.priceDelta, { showSign: true })` call; the surrounding conditional (positive/negative/free) collapsed to a nonzero/free check since it only chose between strings
- `src/entities/tab/ui/CartItem.tsx` - Positive-only modifier suffix now calls `formatMoney(mod.priceDelta, { showSign: true })`, leading space preserved, no cents division (unchanged)
- `src/widgets/OrderPanel/OrderItemCard.tsx` - Positive-only modifier suffix now calls `formatMoney(mod.priceDelta / 100, { showSign: true })`, the `/ 100` division preserved exactly per the plan's tampering-prevention requirement (T-28-17)
- `src/features/manage-products/ui/ProductForm.tsx` - Modifier price-delta preview in the product form now calls `formatMoney(m.priceDelta, { showSign: true })`; this is an improvement over the prior output which had no currency symbol at all, still wrapped in the pre-existing `i18next/no-literal-string` disable/enable pair for the surrounding parens
- `src/features/manage-combos/ui/ManageCombosTab.tsx` - `formatPrice` helper's combo-override branch returns `formatMoney(product.comboPriceOverride)`, null/undefined fallback to the "sum of children" i18n string unchanged
- `src/features/agent-chat/model/useAgent.ts` - Markdown product-table price cell uses `formatMoney(p.price)`; pipe delimiters, column order, and product-name expression untouched
- `src/features/agent-chat/ui/ImportPreviewTable.tsx` - Price cell's literal `$` + `.toFixed(2)` collapsed into a single `formatMoney(p.price)` expression, cell element and className unchanged
- `src/features/produce-prep-batch/ui/PrepBatchPreview.tsx` - Added reasoned `no-restricted-syntax` disable comments above the `need`, `row.delta`, and `qtyProduced` `.toFixed(2)` serializations; no other changes
- `src/entities/prep/ui/PrepOnHandCard.tsx` - Added a reasoned `no-restricted-syntax` disable comment above the `qtyOnHand.toFixed(2)` serialization; no other changes

## Decisions Made
- `ProductForm`'s modifier price-delta preview previously rendered no currency symbol at all — just `(+12.50)`-style text. Migrating it to `formatMoney` adds the currency symbol, which is in scope: it is one of the four production call sites this plan names for exercising `showSign`, and the plan's action explicitly calls for replacing "a chosen sign character, a literal currency character, and a fixed-point number" at all four sites (this one was simply missing the currency character as a pre-existing minor bug, now corrected as a natural consequence of the migration, not a separately-scoped fix).
- Confirmed and preserved the `CartItem` vs. `OrderItemCard` cents-vs-units discrepancy exactly as the plan required (T-28-17) — `OrderItemCard` still divides `priceDelta` by 100 before formatting, `CartItem` does not. This is a real latent inconsistency between the two components (documented for separate follow-up, not fixed here) — a future plan should investigate why the two rendering paths receive `priceDelta` in different units before harmonizing them.

## Deviations from Plan

**1. [Rule 3 - Blocking] Environment setup gap: no `node_modules` or `.env.local` in the git worktree**
- **Found during:** Task 1 verification (`npx vitest run ...`)
- **Issue:** This plan executed in an isolated git worktree (`.claude/worktrees/agent-a1d6016c84ff547fa`) that had no `node_modules` (never `npm ci`'d) and no `.env.local` (gitignored, not copied by worktree creation), so `npx vitest`/`npx eslint`/`npm run typecheck` could not run at all.
- **Fix:** Symlinked `node_modules` from the main checkout (`/mnt/ai/bola8pos-kiro/bar-pos/node_modules`) into the worktree, and copied `.env.local` from the main checkout into the worktree. Both are gitignored, untracked, and outside any git operation — no risk to repo history.
- **Files modified:** none tracked (symlink + copied dotfile, both gitignored)
- **Verification:** `npx vitest`, `npx eslint`, and `npm run typecheck` all ran successfully afterward
- **Committed in:** N/A (untracked files, not committed)

**2. [Rule 1 - Bug] Fixed import-order lint error introduced by Task 1's `formatMoney` import in CartItem.tsx**
- **Found during:** Task 1 (`npx eslint` on the four touched files)
- **Issue:** Adding `import { formatMoney } from '@shared/lib/format';` above the existing `import type { CartItem as CartItemType } from '@shared/lib/domain';` violated the `import/order` rule (type import must sort before the value import alphabetically by path).
- **Fix:** Reordered the two import lines so the `@shared/lib/domain` type import comes first.
- **Files modified:** `src/entities/tab/ui/CartItem.tsx`
- **Verification:** `npx eslint` clean afterward
- **Committed in:** `4052d58` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking environment gap, 1 blocking lint error)
**Impact on plan:** Both fixes were necessary to run the plan's own verify gates at all; no scope creep into unrelated code.

## Issues Encountered
- **Pre-existing, unrelated integration-test failures during Task 1 verification:** Running the plan's full-directory `npx vitest run src/entities/tab src/widgets/OrderPanel ...` command (which sweeps the whole `src/entities/tab` tree, not just the files this plan touches) surfaced 3 failing integration tests against the real remote Supabase instance: `category-revenue-report.integration.test.ts`, `void-refund-report.integration.test.ts` (both `STALE_VERSION` optimistic-concurrency conflicts), and `pending-total.integration.test.ts` (an assertion expecting 0 open tabs got 55). None of these test files exercise any file this plan modified (they cover `src/entities/tab/model/*-report.ts` RPC wrappers, not the UI components `ModifierSheet`/`CartItem`/`OrderItemCard`/`ProductForm` touched here). This is consistent with 5 other sibling worktree agents running the same integration suite concurrently against the same shared remote Supabase test data in this wave — the failures are data races from parallel test runs, not regressions from this plan's changes. Per the executor's scope-boundary rule, this was logged and left unfixed rather than auto-fixed. No `deferred-items.md` file exists yet in this phase directory to append to; flagging here for the orchestrator/verifier to note if it re-runs the full suite post-merge (failures should not reproduce once only one agent is running against the shared test database).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All nine files listed in this plan's `files_modified` frontmatter were touched, matching exactly (verified via `git diff --name-only` against the plan's base commit)
- No i18n catalog file was modified by this plan, consistent with the plan's stated scope
- D-06's `showSign` option is now exercised by four real production call sites (ModifierSheet, CartItem, OrderItemCard, ProductForm)
- Plan 08 (money-formatter lint rule, same wave) can proceed independently — the four `no-restricted-syntax` exemption comments added in Task 3 are pre-positioned for whatever selector plan 08 lands, using the exact comment text from `28-RESEARCH.md` Pitfall 4's documented convention

---
*Phase: 28-money-formatter-utility*
*Completed: 2026-08-02*
