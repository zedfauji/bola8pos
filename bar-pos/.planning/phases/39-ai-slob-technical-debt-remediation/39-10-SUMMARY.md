---
phase: 39-ai-slob-technical-debt-remediation
plan: 10
subsystem: testing
tags: [knip, dead-code, entities, fsd, zustand, tanstack-query]

requires:
  - phase: 39-08
    provides: "Post-decision knip baseline and the 148-finding src/entities/ non-barrel working set this plan executed against"
provides:
  - "148 entities-layer non-barrel export/type findings dispositioned per-declaration (121 deleted, 27 kept with recorded reasons)"
  - "inventoryStore/useInventoryStore duplicate-export pair explicitly resolved (deferred, both kept, reason recorded)"
  - "Fresh post-sweep knip baseline for src/entities/ (27 residual findings, all attributable)"
affects: ["39-09", "39-11"]

actuals:
  tokens: 28340
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Path-aware import-graph resolution over bare-identifier grep: for re-export shims of @shared/lib/domain schemas, a bare-identifier hit count is dominated by consumers reaching the symbol via a *different* origin (typically domain.ts directly) — a purpose-built script resolving every import/export...from statement (relative + tsconfig alias, multi-line-safe, namespace-import member-access tracing) to a per-file reached-names map is the only way to tell whether THIS file's declaration is actually consumed."
    - "Export-keyword-strip vs full-declaration-removal: when a flagged 'unused export' is still called internally by a sibling export in the same file (e.g. a TanStack Query key factory referenced by the file's own hooks), the correct fix is dropping only the `export` keyword, not deleting the declaration."
    - "Reverse paired-declaration caution: a locally-declared Zod schema (not a domain.ts re-export) can be flagged dead as a standalone export while the `type X = z.infer<typeof Schema>` derived from it is very much alive elsewhere — deleting the schema silently breaks the type. Verified per-file for any non-re-export-shim `model/types.ts`."

key-files:
  modified:
    - "16 src/entities/*/model/types.ts files (85 dead re-export/type declarations removed, 9 kept)"
    - "18 src/entities/*/model/store.ts and model/queries.ts files, plus queries-reports.ts (39 dead exports removed — full deletion or export-keyword-strip depending on internal usage, 16 kept)"
    - "src/entities/inventory/model/store.ts — inventoryStore/useInventoryStore duplicate-export pair resolved (deferred, documented in a code comment)"
    - ".planning/phases/39-ai-slob-technical-debt-remediation/39-10-LEDGER.md — full per-finding disposition table (148 rows) + delta re-measurement"

key-decisions:
  - "inventoryStore/useInventoryStore duplicate export: both kept. inventoryStore is consumed by production widgets (LowStockAlert, CartPanel) that are outside this plan's file scope; useInventoryStore is used internally within the entities slice. Consolidating requires editing src/widgets/**, deferred to a future dependency-cleanup phase."
  - "KdsOrderItemSchema kept despite being flagged as an unused standalone export — its z.infer-derived type KdsOrderItem is heavily used in production (kds/model/store.ts, kds/model/queries.ts, widgets/KdsBoard/index.tsx); deleting the schema would have broken the type."
  - "CreatePayment/CreatePaymentSchema and OrderItem kept because deleting them would break still-present files this plan does not touch (payment/model/store.ts and tab/ui/TabDetail.tsx, both whole-file-dead candidates or already-adjudicated false positives out of this plan's scope)."
  - "2 newly-surfaced findings (buildCategoryTree, CategoryNode in category/model/types.ts) emerged as a byproduct of this plan's own deletion of useCategoryTree — left kept rather than deleted because the entities/category/model/index.ts barrel still forwards them; barrel-level disposition is 39-08's territory, not this plan's."

patterns-established:
  - "Path-aware import-graph resolution as a standard companion to bare-identifier grep for re-export-shim dead-code sweeps"

requirements-completed: [D-01, D-07]

coverage:
  - id: D1
    description: "148 src/entities/ non-barrel knip findings dispositioned per-declaration with recorded search evidence, barrel check, and outcome"
    requirement: "D-07"
    verification:
      - kind: other
        ref: "test -f 39-10-LEDGER.md && grep -c '\\*\\*DELETE\\*\\*\\|\\*\\*KEEP\\*\\*' 39-10-LEDGER.md"
        status: pass
    human_judgment: false
  - id: D2
    description: "inventoryStore/useInventoryStore duplicate-export pair resolved with a recorded reason"
    requirement: "D-07"
    verification:
      - kind: other
        ref: "grep -q 'Duplicate-export pair' src/entities/inventory/model/store.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "npm run typecheck, npm run lint, and npm run test pass after the full sweep"
    requirement: "D-01"
    verification:
      - kind: other
        ref: "npm run typecheck && npm run lint && npm run test"
        status: pass
    human_judgment: false

duration: "~50 min (incl. environment setup: npm ci + .env.local restore)"
completed: "2026-08-06"
status: complete
---

# Phase 39 Plan 10: Entities Layer Dead-Declaration Sweep Summary

**148 entities-layer non-barrel knip findings dispositioned one declaration at a time (121 deleted, 27 kept with recorded reasons), the inventoryStore/useInventoryStore duplicate export explicitly resolved (deferred, both kept), and the layer's residual dead-code count re-measured to 27 — all attributable.**

## Performance

- **Duration:** ~50 min active execution (includes worktree environment setup: `npm ci` + `.env.local` restore per the documented gap)
- **Tasks:** 3 (Task 1 model/types.ts sweep, Task 2 store/queries/queries-reports/ui sweep + duplicate-export resolution, Task 3 delta re-measurement)
- **Files modified:** 35 (16 `model/types.ts` in Task 1, 18 `model/store.ts`/`model/queries.ts`/`queries-reports.ts` in Task 2, plus `39-10-LEDGER.md`)

## Accomplishments

- Rebuilt the exact 148-finding `src/entities/` non-barrel working set fresh in this worktree (`npx knip --reporter json` + `--production`) — matched 39-08-LEDGER.md's stated working set for this plan exactly.
- Built a purpose-built full-repo import-graph resolution script (multi-line-safe, comment-stripped, resolving relative + all 6 tsconfig path aliases, tracing namespace-import `alias.property` member access) to distinguish "reached via this exact file's module path" from "the same symbol name is used somewhere via a different origin" — the latter dominates bare-identifier grep counts for `@shared/lib/domain` re-export shims (worked example in the ledger: `CategorySchema` has 33 bare-identifier hits, zero of which reach `entities/category/model/types.ts`'s re-export).
- Removed 85 dead declarations across 16 `model/types.ts` re-export-shim files (Task 1), keeping 9 that were barrel-forwarded, test/story-reachable, or feed a live derived type (`KdsOrderItemSchema` → `KdsOrderItem`, caught via a reverse paired-declaration check not automatable from knip's own report).
- Removed 39 dead declarations across 18 `model/store.ts`/`model/queries.ts`/`queries-reports.ts` files (Task 2), correctly distinguishing "truly dead, remove the whole declaration" (23 findings) from "still used internally by a sibling export in the same file, strip only the `export` keyword" (11 findings, mostly TanStack Query key factories like `cajaKeys`/`settingsKeys`/`prepKeys`) — kept 16 test/story-reachable production-mode-only false positives.
- Resolved the `inventoryStore`/`useInventoryStore` duplicate-export pair: both genuinely consumed by disjoint caller sets (widgets use `inventoryStore`, the entities slice itself uses `useInventoryStore`) — deferred consolidation (would require editing out-of-scope `src/widgets/**` files) with the reasoning recorded in a code comment above the declaration.
- Cleaned up every dangling import/helper left unreferenced by a deletion (`handleVersionError`, `TERMINAL_ID`, `generateIdempotencyKey`, `TablesInsert`, `CategoryCreate`/`CategoryUpdate`, `QueryKey`, `WaitlistEntryStatus`, `useMemo`/`buildCategoryTree`/`CategoryNode` imports) — `noUnusedLocals`/`noUnusedParameters` catch these immediately, so each was fixed before the next `npm run typecheck` gate.
- Re-measured the delta: 148 → 27 non-barrel findings (−121, −82%), with all 27 residual findings individually attributable (25 recorded KEEP decisions + 2 barrel-protected byproduct newly surfaced by this plan's own Task 2 deletion).
- `npm run typecheck && npm run lint && npm run test` all green after every batch — 1391 tests passed, 15 todo, exact match to the pre-plan baseline (one transient fast-check property-test flake in an unrelated out-of-scope file, confirmed not caused by this plan via isolation run + full-suite re-run).

## Task Commits

Each task was committed atomically:

1. **Task 1: Sweep the type-alias findings across entities model/types.ts files** — `536500b` (feat)
2. **Task 2: Sweep the store, queries, and ui findings, and resolve the inventory duplicate export** — `10d29de` (feat)
3. **Task 3: Re-measure the entities-layer delta** — `ebbec94` (docs)

## Files Created/Modified

- `.planning/phases/39-ai-slob-technical-debt-remediation/39-10-LEDGER.md` — the full 148-row disposition table, method, worked examples, and the delta re-measurement
- 16 `src/entities/*/model/types.ts` files — dead re-export/type declarations removed, live ones preserved
- 18 `src/entities/*/model/store.ts`, `model/queries.ts`, and `tab/model/queries-reports.ts` — dead exports removed (full-declaration or export-keyword-only, per internal-usage evidence)
- `src/entities/inventory/model/store.ts` — duplicate-export resolution comment added, no structural change

## Decisions Made

See `key-decisions` in frontmatter — the four load-bearing calls this plan made beyond mechanical deletion: the `inventoryStore`/`useInventoryStore` deferral, `KdsOrderItemSchema`'s reverse paired-declaration keep, `CreatePayment`/`OrderItem`'s keep-because-an-untouched-file-still-imports-them, and the `buildCategoryTree`/`CategoryNode` barrel-protected byproduct.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — bug in my own deletion pass, caught before commit] Deleting a function left its now-sole-caller's helper imports/consts dangling**

- **Found during:** Task 2, after deleting `useMutationUpdateTabStatus` and `useMutationRecordTabPayment` from `tab/model/queries.ts`
- **Issue:** `npm run typecheck` failed with `TS6133` for `handleVersionError` and `TERMINAL_ID` — both were used exclusively inside the two deleted functions.
- **Fix:** Removed the now-dangling import and const declaration (also proactively checked and removed several other cases across the same commit: `generateIdempotencyKey`, `TablesInsert`, `CategoryCreate`/`CategoryUpdate`, `QueryKey`, `WaitlistEntryStatus`, `useMemo`/`buildCategoryTree`/`CategoryNode` imports in `category/model/queries.ts`).
- **Files affected:** `src/entities/tab/model/queries.ts`, `src/entities/category/model/queries.ts`, `src/entities/waitlist/model/queries.ts`, `src/entities/rappi-order/model/queries.ts`, `src/entities/product/model/queries.ts`
- **Verification:** `npm run typecheck` clean after each fix
- **Committed in:** `10d29de` (Task 2 commit — fixed before the commit, not a separate commit)

**2. [Rule 1 — corrected a measurement gap before it affected dispositions] Multi-line import statements were invisible to the first version of the import-graph resolver**

- **Found during:** Task 1/2, while cross-checking `computePctTotals` and 11 similar findings against the fresh import-graph
- **Issue:** The resolver's initial regex bounded the import clause to a single line (`[^;\n]*?`), silently missing every multi-line `import {\n  a,\n  b,\n} from '...'` statement — 20 findings that were genuinely reached only from test files were initially misclassified as "not reached at all" by the script (though correctly resolved via the separate knip-per-mode cross-check step, so no wrong deletion resulted).
- **Fix:** Widened the bound to `[^;]*?` (newline-permitting, semicolon-bounded) before finalizing any disposition.
- **Files affected:** None (analysis tooling only)
- **Verification:** Re-ran the resolver; cross-checked the corrected reach set against the knip per-mode results for consistency
- **Committed in:** N/A (pre-commit analysis correction)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — one a real dangling-import bug from my own deletions, one an analysis-tooling correction that never reached a wrong deletion since the knip-per-mode cross-check independently caught the same findings). **Impact on plan:** No scope creep — both fixes were necessary to reach a correct, typecheck-clean disposition set.

## Issues Encountered

One transient test failure (`src/shared/lib/groupOrderItemsForReceipt.test.ts`, a fast-check property test in a file this plan does not touch) on one of several full-suite runs — passed in isolation and on an immediate full-suite re-run, confirmed pre-existing flakiness unrelated to this plan's changes, not fixed (out of scope per the deviation-rules scope boundary).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The entities-layer non-barrel working set is down to 27 findings, all individually attributable in `39-10-LEDGER.md` — no unexplained residual.
- 2 findings (`buildCategoryTree`, `CategoryNode` in `category/model/types.ts`) are a byproduct of this plan's own work and are barrel-protected (`entities/category/model/index.ts` still forwards them) — flagged for a future barrel-decision pass, same class of work as 39-08.
- 7 whole-file-dead candidates under `src/entities/` remain untouched, exactly as 39-08-LEDGER.md surfaced them — out of this plan's scope, available for a future whole-file-deletion pass.
- No blockers for plans 39-09 or 39-11 (disjoint file scopes — `src/shared/lib/domain.ts`+`edge-function-contracts.ts` and `src/shared/`+`src/features/` respectively).

## Self-Check

- FOUND: `.planning/phases/39-ai-slob-technical-debt-remediation/39-10-LEDGER.md`
- FOUND: commit `536500b` (Task 1)
- FOUND: commit `10d29de` (Task 2)
- FOUND: commit `ebbec94` (Task 3)
- CONFIRMED: `npm run typecheck && npm run lint && npm run test` pass at HEAD

## Self-Check: PASSED

---
*Phase: 39-ai-slob-technical-debt-remediation*
*Completed: 2026-08-06*
