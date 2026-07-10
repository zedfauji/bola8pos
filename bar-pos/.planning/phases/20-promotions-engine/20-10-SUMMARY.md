---
phase: 20-promotions-engine
plan: 10
subsystem: database
tags: [supabase, postgres, zod, react, fsd, happy-hour-retirement]

# Dependency graph
requires:
  - phase: 20-promotions-engine (plan 09, D-07 parity gate + human UAT approval)
    provides: "Human approval ('Proceed on automated gates only', 2026-07-10) authorizing the destructive column drop, once Task 2 of this plan is executed"
provides:
  - "Every DB-typed consumer of categories.happy_hour_start/end and products.happy_hour_price neutralized — none read or write the raw columns anymore; all supply the vestigial null Zod fields instead"
  - "CategoryForm.tsx / ProductForm.tsx: happy-hour input fields removed; admins can no longer edit HH via the Category/Product forms"
  - "domain.ts: happyHourStart/End/Price documented as deprecated-but-vestigial (Phase 20, D-01), still nullable, pending Plan 20-11 removal"
  - "Task 2 (the DROP COLUMN migration + BLOCKING push) NOT executed — plan paused at the checkpoint per the plan's autonomous:false + gate=blocking-human contract"
affects: [20-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Non-JSDoc-tag deprecation comments (\"DEPRECATED — ...\" instead of the literal `@deprecated` JSDoc tag) used in domain.ts to document vestigial fields without tripping @typescript-eslint/no-deprecated at the remaining (Plan-20-11-scoped) client display consumers"

key-files:
  created: []
  modified:
    - src/entities/category/model/queries.ts
    - src/entities/product/model/queries.ts
    - src/features/manage-products/ui/CategoryForm.tsx
    - src/features/manage-products/ui/ProductForm.tsx
    - src/features/manage-products/ui/CatalogCategoriesTab.tsx
    - src/shared/lib/domain.ts
    - src/entities/tab/model/queries.ts
    - src/entities/inventory/model/queries.ts
    - .planning/phases/20-promotions-engine/deferred-items.md

key-decisions:
  - "Expanded Task 1's scope beyond the plan's stated files_modified to also neutralize entities/tab/model/queries.ts and entities/inventory/model/queries.ts — both read raw happy_hour_* columns off DB rows (tabListSelect's explicit category column list; row mappers on fully-typed Tables<> joins) and would have broken Task 2's own typecheck-green acceptance criterion plus the live core order-taking select once the columns are dropped (Rule 1/3, not architectural — same neutralization pattern as the plan's originally-listed files)"
  - "Used a plain 'DEPRECATED — ...' doc comment in domain.ts instead of the plan-specified literal JSDoc @deprecated tag — the real @deprecated tag trips @typescript-eslint/no-deprecated (max-warnings 0) at ProductCard.tsx/CatalogProductsTab.tsx/domain-helpers.ts, none of which are in this plan's scope (Plan 20-11 removes them); the literal tag would have broken npm run lint project-wide from this plan's own commit until 20-11 lands (Rule 1 — bug)"
  - "CategoryForm/ProductForm still pass happyHourStart/End/Price: null explicitly in their Zod-parsed submit payloads (not omitted) — the domain.ts fields are nullable but not optional, so the schema key must still be present even with no UI input for it"
  - "CategoryTreeEditor.tsx required no changes — it already had no HH editing affordance and already passed happyHourStart/End: null in its create payload"

requirements-completed: []

# Metrics
duration: ~70min
completed: 2026-07-10
---

# Phase 20 Plan 10: Retire Happy-Hour Storage (Prep Tasks) Summary

**Task 1 complete and committed: every DB-typed consumer of the legacy `happy_hour_start/end`/`happy_hour_price` columns (including two files not in the plan's original list) now supplies the vestigial null Zod field instead of reading/writing the raw column, and HH admin editing is removed from the Category/Product forms. Task 2 (the destructive `DROP COLUMN` migration + BLOCKING push) was intentionally NOT executed — the plan paused at its checkpoint exactly as instructed, awaiting explicit human approval on the irreversible step.**

## Performance

- **Duration:** ~70 min
- **Tasks:** 1/2 completed (Task 2 is the BLOCKING checkpoint — paused, not executed)
- **Files modified:** 9 (0 created)

## Accomplishments

- `entities/category/model/queries.ts` + `entities/product/model/queries.ts`: `mapCategoryRow`/`mapProductRow` no longer read `happy_hour_start`/`happy_hour_end`/`happy_hour_price` off Supabase rows — they supply `null` directly for the now-vestigial Zod fields. `useMutationCreateCategory`/`useMutationUpdateCategory`/`useMutationCreateProduct`/`productUpdateToRow` no longer write those columns. The now-unused `categoryTimeForDb` HH-time-normalization helper was removed from both files.
- `CategoryForm.tsx`: removed the "Happy hour start"/"Happy hour end" time inputs, their local state, and the paired-fields validation; the submit payload still supplies `happyHourStart: null, happyHourEnd: null` (required key, nullable value) with a comment pointing to Settings → Promotions.
- `ProductForm.tsx`: removed the "Happy hour price" `MoneyInput` field and its local state; submit payload supplies `happyHourPrice: null`.
- `CatalogCategoriesTab.tsx`: removed the per-row "Happy hour HH:MM–HH:MM" display line and updated the tab's helper text to point at Settings → Promotions.
- `domain.ts`: `Category.happyHourStart`/`happyHourEnd` and `Product.happyHourPrice` documented as deprecated-but-vestigial with a plain comment (see Deviations — not a literal `@deprecated` JSDoc tag), kept `.nullable()` per the plan's bound-blast-radius intent.
- **Scope expansion (Rule 1/3):** `entities/tab/model/queries.ts` (the `tabListSelect` query backing `useTabs`/`useTab`/`useSubTabs` — the core order-taking read path) and `entities/inventory/model/queries.ts` both directly read raw `happy_hour_*` columns and were not in the plan's file list. Left unfixed, Task 2's own "typecheck green after the drop" acceptance criterion would fail, and the live `tabListSelect` query (which explicitly lists `happy_hour_start, happy_hour_end` in its embedded category select) would 500 the moment the columns are dropped. Neutralized both using the same pattern.
- `npm run typecheck`: green (only the 2 pre-existing documented errors remain — `tab/model/queries.ts:778`, `agent/rag.ts:60`, both predate Phase 20).
- `npm run lint`: exit 0 (0 errors, 0 warnings; only the pre-existing informational `eslint-plugin-boundaries` legacy-selector notice).
- `grep -rn "happy_hour" <the plan's 4 originally-listed files>`: zero matches (verify command's negated-grep criterion satisfied).
- Full unit suite: 1247/1248 pass (only the pre-existing documented `useCloseTab.test.ts:95` failure, unrelated, since Phase 15) — no regressions from this plan's changes.

## Task Commits

Each completed task was committed atomically:

1. **Task 1: Neutralize DB-typed HH consumers + remove HH admin editing** - `f948c8d` (feat)
2. **Deferred-items documentation update** - `4b4f298` (docs, this session's own deviation log)
3. **Task 2: [BLOCKING] Drop legacy happy_hour columns + push + update types** - NOT STARTED. Per the checkpoint_note and this plan's `autonomous: false` / `gate="blocking-human"` contract, execution paused here. See "Checkpoint" below.

_Note: no plan-metadata commit in this run — per parallel-executor instructions, STATE.md/ROADMAP.md updates are owned by the orchestrator after all wave agents complete. Because Task 2 has not run/been approved, this plan is NOT being marked complete._

## Files Created/Modified

- `src/entities/category/model/queries.ts` - stopped reading/writing happy_hour_start/end; removed categoryTimeForDb helper
- `src/entities/product/model/queries.ts` - stopped reading/writing happy_hour_price and happy_hour_start/end (duplicate category mapper in this file too); removed categoryTimeForDb helper
- `src/features/manage-products/ui/CategoryForm.tsx` - removed HH start/end inputs + validation
- `src/features/manage-products/ui/ProductForm.tsx` - removed HH price input
- `src/features/manage-products/ui/CatalogCategoriesTab.tsx` - removed HH window display line
- `src/shared/lib/domain.ts` - documented the 3 HH fields as deprecated/vestigial (plain comment, not JSDoc `@deprecated` tag)
- `src/entities/tab/model/queries.ts` - (scope expansion) stopped reading happy_hour_price/start/end; removed the 2 HH columns from `tabListSelect`'s explicit category column list
- `src/entities/inventory/model/queries.ts` - (scope expansion) stopped reading happy_hour_price/start/end off the products/categories join
- `.planning/phases/20-promotions-engine/deferred-items.md` - logged this session's deviations + a flagged (not fixed) runtime-only gap in Plan 20-09's `hh-parity.integration.test.ts`

## Decisions Made

See `key-decisions` in frontmatter (scope expansion to tab/inventory queries.ts; plain-comment deprecation instead of JSDoc `@deprecated` tag; explicit-null payloads in the forms; CategoryTreeEditor needed no changes).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1/3 - Bug/Blocking] Scope expansion: `entities/tab/model/queries.ts` + `entities/inventory/model/queries.ts` also read raw `happy_hour_*` columns**
- **Found during:** Task 1, while grepping the full `src/` tree for `happy_hour`/`happyHour` to confirm the plan's file list was complete before editing.
- **Issue:** Neither file is in Plan 20-10's `files_modified`, but both directly read `happy_hour_start`/`happy_hour_end`/`happy_hour_price` off typed Supabase rows — `tab/model/queries.ts`'s `CategoryEmbed` interface + an explicit column list inside the `tabListSelect` query string (used by `useTabs`/`useTab`/`useSubTabs`, the core order-taking read path), and `inventory/model/queries.ts`'s `mapInventoryRow` reading off fully-typed `Tables<'products'>`/`Tables<'categories'>` joins. Left as-is, Task 2's own acceptance criterion ("`npm run typecheck` exits 0" after the drop) would fail with TS2339, and the live `tabListSelect` query would 500 at runtime the instant the columns are dropped (PostgREST "column does not exist").
- **Fix:** Applied the identical "supply `null` for the vestigial Zod field" pattern already used in the plan's listed files; removed `happy_hour_start`/`happy_hour_end` from `tabListSelect`'s embedded category select string.
- **Files modified:** `src/entities/tab/model/queries.ts`, `src/entities/inventory/model/queries.ts`
- **Verification:** `npm run typecheck` green (only the 2 pre-existing errors), `npm run lint` exit 0, full unit suite 1247/1248 (same pre-existing failure only).
- **Committed in:** `f948c8d` (Task 1 commit)

**2. [Rule 1 - Bug] `@deprecated` JSDoc tag replaced with a plain "DEPRECATED" comment**
- **Found during:** Task 1, first `npm run lint` run after adding the plan-specified literal `@deprecated` JSDoc tags to `domain.ts`.
- **Issue:** The project's ESLint config enforces `@typescript-eslint/no-deprecated` at `max-warnings 0`. A literal `@deprecated` tag on `happyHourStart`/`happyHourEnd`/`happyHourPrice` immediately flagged every remaining consumer of those fields (`ProductCard.tsx`, `CatalogProductsTab.tsx`, `domain-helpers.ts`'s `resolveProductPrice`/`isHappyHourActive`) as lint errors — none of those files are in this plan's scope; removing them is explicitly Plan 20-11's job. This would have broken `npm run lint` project-wide from this plan's own commit forward.
- **Fix:** Replaced the JSDoc `@deprecated` tag with a plain "DEPRECATED — ..." doc comment (same information, different syntax) that documents the same intent without invoking the linter rule.
- **Files modified:** `src/shared/lib/domain.ts`
- **Verification:** `npm run lint` exit 0 (confirmed both before finding the issue — 12 errors — and after the fix — 0 errors).
- **Committed in:** `f948c8d` (Task 1 commit)

---

**Total deviations:** 2 (1 Rule 1/3 scope-expansion, 1 Rule 1 bug-fix)
**Impact on plan:** Both fixes were necessary for Task 1's own stated acceptance criteria (typecheck/lint green) to hold, and for Task 2's acceptance criteria to remain achievable once approved. No architectural changes; no scope creep beyond what correctness required.

## Issues Encountered

- **`node_modules`/`.env.local` missing in the fresh worktree** — same recurring situation documented in every prior Phase 20 plan's SUMMARY.md. Ran `npm ci` and copied `.env.local` from the main checkout (`D:/Projects/Code/POS/bola8pos-kiro/bar-pos/.env.local`); neither is a tracked/committed change.
- **Flagged, not fixed (out of scope):** `src/entities/promotion/model/hh-parity.integration.test.ts` (created by Plan 20-09) directly inserts/selects the raw `happy_hour_*` columns against a `createClient(...) as any` client. Because the client is cast to `any`, this does NOT break `npm run typecheck` (confirmed green). It WILL fail at runtime once Task 2's column drop is pushed live — the test file's own comment already acknowledges "this plan runs BEFORE Plan 20-10's column drop." Logged in `deferred-items.md` for whoever executes Task 2 / runs a subsequent full `npm run test`, so it isn't mistaken for a new regression. Not fixed here — it's a Plan 20-09 test file, outside both this plan's and Plan 20-11's `files_modified`.
- A pre-existing, unrelated snapshot drift (`src/shared/lib/__snapshots__/buildStartTicketText.test.ts.snap`, line-ending normalization only) was already present in the working tree before this session started (visible in the initial `git status`). Left untouched and unstaged — not part of this plan's changes.

## User Setup Required

None beyond the checkpoint itself below — no new external service configuration.

## Checkpoint: Task 2 — [BLOCKING] Drop legacy happy_hour columns + push + update types

**Status: PAUSED, per plan contract (`autonomous: false`, `gate="blocking-human"`) and the explicit `<checkpoint_note>` instruction not to self-approve the destructive push.**

**What's ready:** Task 1's non-destructive prep is complete and committed (`f948c8d`). No code anywhere in the touched surface (including the two scope-expansion files) reads or writes the `happy_hour_start`/`happy_hour_end`/`happy_hour_price` columns anymore — `npm run typecheck`/`lint`/`test` are all green. Plan 20-09's UAT gate (human-approved 2026-07-10, "Proceed on automated gates only") already authorizes this drop.

**What Task 2 still requires (NOT executed by this agent):**
1. Create `supabase/migrations/20260711000001_drop_happy_hour_columns.sql` (BEGIN/COMMIT, `ALTER TABLE categories DROP COLUMN IF EXISTS happy_hour_start/end`, `ALTER TABLE products DROP COLUMN IF EXISTS happy_hour_price`).
2. Run `npx supabase db push` (BLOCKING, irreversible) + `NOTIFY pgrst, 'reload schema';` if needed.
3. Verify via `information_schema.columns` that all three columns are gone live.
4. Regenerate/edit `src/shared/lib/supabase.types.ts` to remove the three columns from `categories`/`products` Row/Insert/Update.
5. Re-run `npm run typecheck` to confirm green post-drop.

**Known pre-existing risk for whoever runs Task 2:** `src/entities/promotion/model/hh-parity.integration.test.ts` (Plan 20-09) will start failing at runtime once the columns are dropped (its `beforeAll` fixture inserts rows with `happy_hour_*` fields against a live DB) — this is expected per that test's own documentation, not a new defect, but will show up as a new `npm run test` failure if the full suite is re-run after the push. See `deferred-items.md` ("Plan 20-10, Task 1" section) for full detail.

**Resume signal per the plan:** Type "approved" once the three columns are confirmed dropped live and typecheck is green — this requires a human/orchestrator decision on the irreversible push itself; this agent does not self-approve it.

## Next Phase Readiness

- Task 1's prep work is fully committed and verified; Plan 20-10's Task 2 (the destructive drop) is unblocked and ready to run, pending explicit approval on the checkpoint above.
- Plan 20-11 (pure client calc-path removal — `resolveProductPrice`/`isHappyHourActive`/`ProductCard.tsx`/`ModifierSheet.tsx`/`TableStatusPanel`) depends on this plan (`depends_on: ["20-10"]`) and remains blocked until Task 2 completes.
- The `hh-parity.integration.test.ts` runtime gap (flagged above) is a candidate for a small follow-up fix/retirement once Task 2 lands — not currently assigned to any plan's `files_modified`.

---
*Phase: 20-promotions-engine*
*Completed: 2026-07-10 (Task 1 only; Task 2 paused at its blocking checkpoint)*
