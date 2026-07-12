---
phase: 20-promotions-engine
plan: 02
subsystem: api
tags: [zod, tanstack-query, promotions, fsd, domain-schema]

# Dependency graph
requires:
  - phase: 20-promotions-engine (plan 01, schema foundations)
    provides: promotions/promotion_availability/applied_promotions column naming (assumed, not yet verified live — this plan is interface-first)
provides:
  - Zod schemas for promotions (PromotionSchema/Create/Update, PromotionAvailabilitySchema/Create, AppliedPromotionSchema) in domain.ts, the single source of truth for column ↔ field naming
  - promotion.apply audit action registered in AuditActionSchema
  - entities/promotion/ FSD slice (7 TanStack Query hooks + promotionKeys + explicit-export barrels), mirroring entities/combo
affects: [20-03 (DB migrations must match this plan's field/column naming), 20-04 (admin UI consumes entities/promotion hooks), 20-05, 20-06 (removes supabase-as-any cast), 20-07 (banner consumes usePromotionActive)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zod Schema/CreateSchema(.omit)/UpdateSchema(.partial().required) triad, refine attached after omit/partial (zod v4 ZodEffects still supports z.infer)"
    - "entities/<name>/model/queries.ts with file-level eslint-disable + `const db = supabase as any` pre-regen cast, mirrors entities/combo and entities/prep"

key-files:
  created:
    - src/entities/promotion/model/queries.ts
    - src/entities/promotion/model/types.ts
    - src/entities/promotion/model/index.ts
    - src/entities/promotion/index.ts
    - src/entities/promotion/model/queries.test.ts
  modified:
    - src/shared/lib/domain.ts
    - src/shared/lib/domain.test.ts
    - src/shared/lib/audit-actions.ts

key-decisions:
  - "PromotionDiscountTypeSchema/PromotionTargetTypeSchema are new, distinct enums — never reuse/extend DiscountType/DiscountScope (Pitfall 5)"
  - "Percentage-cap validation (discountValue <= 100 when discountType==='percentage') implemented as a single refine() predicate reused across PromotionSchema/PromotionCreateSchema/PromotionUpdateSchema, applied AFTER .omit()/.partial() since refine() returns ZodEffects (cannot itself be .omit()'d)"
  - "useMutationCreatePromotion/useMutationUpdatePromotion/useMutationDeletePromotion use raw supabase-as-any calls (throw-on-error style, mirroring entities/combo/entities/prep) rather than the Result<T>-wrapped style used in entities/category — plan explicitly modeled this slice on entities/combo"

patterns-established:
  - "Promotion schema triad in domain.ts is now the naming source of truth Plan 20-03's migration must match column-for-column"

requirements-completed: [SC-1, SC-4]

# Metrics
duration: ~18min
completed: 2026-07-09
---

# Phase 20 Plan 02: Promotion Contracts (domain.ts + entities/promotion) Summary

**Zod schema contracts for the promotions engine (discount/target enums, promotion/availability/applied-promotion shapes) plus a 7-hook `entities/promotion/` TanStack Query slice cloned from `entities/combo`, locking naming ahead of the DB migration and admin UI plans.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-07-09T19:01:45-06:00 (worktree base commit)
- **Completed:** 2026-07-09T19:18:48-06:00 (Task 2 commit)
- **Tasks:** 2/2 completed
- **Files modified:** 8 (3 modified, 5 created)

## Accomplishments
- Added `PromotionDiscountTypeSchema`, `PromotionTargetTypeSchema`, `PromotionSchema` (+Create/Update), `PromotionAvailabilitySchema` (+Create), and the immutable `AppliedPromotionSchema` to `domain.ts`, all distinct from the legacy `DiscountType`/`DiscountScope` enums used by the manual-payment-discount feature.
- Registered `promotion.apply` in `AuditActionSchema`/`AuditAction` so the future `evaluate_promotions` RPC can call `record_audit`.
- Built `entities/promotion/` FSD slice: `promotionKeys` factory + `usePromotions`/`usePromotion`/`useMutationCreatePromotion`/`useMutationUpdatePromotion`/`useMutationDeletePromotion`/`usePromotionAvailabilityWindows`/`usePromotionActive`, mirroring `entities/combo`'s query/mutation shape and fail-open RPC pattern.

## Task Commits

Each task was committed atomically:

1. **Task 1: Promotion Zod schemas + promotion.apply audit action** - `6b11112` (feat)
2. **Task 2: entities/promotion slice (types + queries + barrels) + hook stubs** - `633ceeb` (feat, bundles a Rule 1 lint fix to Task 1's test file — see Deviations)

_Note: no plan-metadata commit in this run — per parallel-executor instructions, STATE.md/ROADMAP.md updates are owned by the orchestrator after all wave agents complete._

## Files Created/Modified
- `src/shared/lib/domain.ts` - +8 new exported schemas/types (Promotion family, PromotionAvailability family, AppliedPromotion), appended after the OfflineAction section
- `src/shared/lib/domain.test.ts` - +12 tests: PromotionDiscountTypeSchema (2), PromotionTargetTypeSchema (2), PromotionSchema/PromotionCreateSchema (4), AppliedPromotionSchema (1), AuditActionSchema promotion.apply (1) — all green
- `src/shared/lib/audit-actions.ts` - added `'promotion.apply'` to `AuditActionSchema` enum + `PROMOTION_APPLY` to `AuditAction` const
- `src/entities/promotion/model/queries.ts` - `promotionKeys` + 7 hooks + `mapPromotionRow` mapper (exported for testability), file-level eslint-disable + `supabase as any` pre-regen cast
- `src/entities/promotion/model/types.ts` - re-export barrel for Promotion* types/schemas from domain.ts
- `src/entities/promotion/model/index.ts` / `src/entities/promotion/index.ts` - explicit named-export barrels (no `export *`)
- `src/entities/promotion/model/queries.test.ts` - 3 tests: `promotionKeys` shape (2), `usePromotions` snake_case→camelCase row mapping (1)

## Decisions Made
- Percentage-cap refine (`discountType !== 'percentage' || discountValue <= 100`) is a single reusable predicate function applied to `PromotionSchema`, `PromotionCreateSchema`, and `PromotionUpdateSchema` individually (attached via `.refine()` after `.omit()`/`.partial()`, since Zod's `ZodEffects` return type from `.refine()` can't itself be `.omit()`'d). The `PromotionUpdateSchema` variant treats `undefined` discountType/discountValue as pass (no-op on partial updates that don't touch pricing fields).
- `entities/promotion/model/queries.ts` mutation hooks use the raw throw-on-error `supabase as any` style (matching `entities/combo`/`entities/prep`), not the `Result<T>`-wrapped style used in `entities/category` — the plan's `<read_first>` explicitly pointed at `entities/combo/model/queries.ts` as the clone source, and combo has no CRUD mutations to diverge from, so `entities/prep`'s mutation-hook shape (also throw-style) was used as the closest analog.
- `usePromotionActive`'s query key intentionally collides with `promotionKeys.availability(id)` (the base) while `usePromotionAvailabilityWindows` appends `'windows'` — this exactly mirrors `entities/combo`'s `useComboAvailability`/`useComboAvailabilityWindows` key-scoping pattern.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed 3 unused-variable lint errors in domain.test.ts introduced by Task 1**
- **Found during:** Task 2 (`npm run lint -- src/entities/promotion`, which lints the whole `src` tree per this project's hardcoded `eslint src --max-warnings 0` script)
- **Issue:** Task 1's `PromotionCreateSchema` tests used `const { id: _id, createdAt: _createdAt, ...draft } = validPromotion` three times; this project's eslint config only sets `argsIgnorePattern: '^_'` for `@typescript-eslint/no-unused-vars` (no `varsIgnorePattern`), so underscore-prefixed destructured variables still error.
- **Fix:** Refactored the test fixture to build `draft` (without `id`/`createdAt`) directly as an object literal, then derive `validPromotion = { ...draft, id: UUID, createdAt: NOW }` for the round-trip test — no destructure-omit needed.
- **Files modified:** `src/shared/lib/domain.test.ts`
- **Verification:** `npx vitest run src/shared/lib/domain.test.ts` (67/67 pass) + `npm run lint` (0 errors, project-wide)
- **Committed in:** `633ceeb` (bundled with Task 2's commit, since it was discovered during Task 2's verification step)

---

**Total deviations:** 1 auto-fixed (Rule 1 — lint bug in previously-committed test file)
**Impact on plan:** No scope creep — pure lint-error fix in this plan's own Task-1 output, caught by this plan's own Task-2 verification step.

## Issues Encountered
- The worktree had no `node_modules/` and no `.env.local` (fresh worktree checkout). Ran `npm ci` (lockfile-exact install, not a new/different package) and copied `.env.local` from the main repo checkout to unblock `npx vitest run` (the project's Vitest global-setup requires live Supabase credentials even for schema-only unit tests). Neither action modified any tracked file.

## User Setup Required

None - no external service configuration required. (The `.env.local` copy above is local dev-environment bootstrapping only, not a new secret or service.)

## Next Phase Readiness
- `domain.ts`'s Promotion/PromotionAvailability/AppliedPromotion schemas are now the authoritative column-naming contract Plan 20-01/20-03's migrations must match (per this plan's `key_links`).
- `entities/promotion/` is ready for Plan 20-04's admin UI (`ManagePromotionsTab`/`PromotionBuilderForm`/`PromotionAvailabilityEditor`) to consume directly.
- `promotion.apply` audit action is registered and ready for the `evaluate_promotions` RPC (Plan 20-05/20-06) to call via `record_audit`.
- No blockers. The `supabase as any` cast in `queries.ts` and the RPC name `is_promotion_available` (not yet defined server-side) are expected to resolve once Plan 20-01/20-03's migrations land and Plan 20-06 regenerates `supabase.types.ts`.

---
*Phase: 20-promotions-engine*
*Completed: 2026-07-09*
