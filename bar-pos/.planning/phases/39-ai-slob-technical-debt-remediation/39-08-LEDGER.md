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
