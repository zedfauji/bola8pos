---
phase: 35-guardrails-tokens-doc-drift-lint
plan: 03
subsystem: ui
tags: [eslint, tailwindcss, lint, guardrails, react]

# Dependency graph
requires:
  - phase: 35-guardrails-tokens-doc-drift-lint
    provides: "35-01's DESIGN-TOKENS.md (cross-referenced by lint messages) + 35-02's raw-button cleanup and exact-pinned eslint-plugin-tailwindcss@3.18.3 devDependency"
provides:
  - "eslint-rules/no-ui-drift.js exporting uiDriftSelectors (5 no-restricted-syntax selectors: raw button, raw input with type exemption, hex literal, rgb/rgba literal, arbitrary-spacing class)"
  - "eslint.config.js pages/widgets/features-scoped guardrail: eslint-plugin-tailwindcss (no-custom-classname + enforces-shorthand) + uiDriftSelectors, all at error severity, npm run lint clean"
  - "4 pre-negotiated Phase-31 exception sites converted from prose comments to real eslint-disable-next-line directives"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "no-restricted-syntax selector array pattern: project-specific AST rules live in eslint-rules/*.js as a plain array, spread into the existing rule key (never a second no-restricted-syntax config object on an overlapping files glob) to avoid ESLint flat-config's per-key replace-not-merge semantics"
    - "eslint-plugin-tailwindcss settings.tailwindcss.config must be an absolute path — its require.resolve(tailwindcss, {paths}) call does not reliably resolve a relative dirname"

key-files:
  created:
    - eslint-rules/no-ui-drift.js
  modified:
    - eslint.config.js
    - src/features/manage-products/ui/CategoryForm.tsx
    - src/features/manage-categories/ui/CategoryTreeEditor.tsx
    - src/widgets/InventoryPagePanel.tsx
    - src/features/adjust-stock-movement/ui/AdjustStockMovementDialog.tsx
    - src/features/manage-modifier-inventory-rules/ui/ModifierIngredientRulesDialog.tsx
    - src/features/manage-recipe/ui/RecipeEditorTab.tsx
    - src/features/produce-prep-batch/ui/PrepBatchPreview.tsx
    - src/widgets/PaymentModal/ui/PaymentForm.tsx
    - .planning/phases/35-guardrails-tokens-doc-drift-lint/deferred-items.md
    - ~20 other files (tailwindcss/enforces-shorthand auto-fix only, h-N w-N -> size-N, behavior-neutral)

key-decisions:
  - "settings.tailwindcss.config resolved via path.resolve(import.meta.dirname, 'tailwind.config.ts') instead of the plan's literal './tailwind.config.ts' — the plugin's internal require.resolve('tailwindcss', {paths: [dirname(config)]}) returns undefined for a relative dirname ('.') in this environment, verified directly against local-pkg's resolveModule; an absolute path resolves correctly"
  - "3 categories of genuine (non-whitelist-worthy) drift newly surfaced by tailwindcss/no-custom-classname were fixed, not suppressed: shadow-xs (a Tailwind v4-only rename, dead class under this repo's pinned v3) -> shadow-sm in 2 files; text-pos-muted (a token that was never defined in tailwind.config.ts or globals.css, dead class) -> text-muted-foreground in 3 files; hover:bg-[var(--pos-accent)]/90 (opacity modifiers don't decompose non-hsl/rgb CSS-var color tokens, confirmed via a live postcss+tailwindcss compile that emitted zero CSS for the hover variant) -> hover:opacity-90 in PaymentForm.tsx's primary payment CTA"

patterns-established:
  - "Disposable-fixture positive-proof pattern for eslint no-restricted-syntax selectors: create a throwaway .tsx fixture + throwaway flat-config, run eslint against it standalone, assert exact violation count and the negative (exempt) case, then delete both files before committing — proves a selector fires rather than trusting a 0-violation run as ambiguous between clean and broken"

requirements-completed: [LINT-01]

coverage:
  - id: D1
    description: "eslint-rules/no-ui-drift.js exports uiDriftSelectors (5 selectors), proven firing via a disposable fixture (each of raw button/raw input/hex/rgba/arbitrary-spacing fires exactly once; type=date input does not fire) then deleted, not committed"
    requirement: "LINT-01"
    verification:
      - kind: other
        ref: "node --input-type=module shape-check command (Task 1 verify) + disposable npx eslint run against .eslint-drift-fixture.tsx (5 errors, exit 1, then both fixture files deleted)"
        status: pass
    human_judgment: false
  - id: D2
    description: "eslint.config.js wires eslint-plugin-tailwindcss (no-custom-classname + enforces-shorthand, no-arbitrary-value intentionally omitted per D-15) and uiDriftSelectors into a new pages/widgets/features-scoped config object; ExportAllDeclaration restated so the barrel-export ban survives the scoped merge (verified via a temporary export * insertion that errored, then reverted)"
    requirement: "LINT-01"
    verification:
      - kind: other
        ref: "npx eslint on a features/ file with a temporary `export * from './fake'` line appended -> no-restricted-syntax ExportAllDeclaration error, exit 1; line reverted and re-verified clean"
        status: pass
    human_judgment: false
  - id: D3
    description: "npm run lint exits 0 with zero warnings against the full codebase (D-14) after fixing all real drift the new rules surfaced (65 initial violations: 57 auto-fixable shorthand + 8 requiring manual review, all resolved)"
    requirement: "LINT-01"
    verification:
      - kind: unit
        ref: "npm run lint (exit 0) + npm run typecheck (exit 0, only 2 pre-existing unrelated errors) + npm run test -- --run (1225 passed, 15 todo, 2 skipped files, no regressions)"
        status: pass
    human_judgment: false
  - id: D4
    description: "4 pre-negotiated Phase-31 exception sites (CategoryForm.tsx x2, CategoryTreeEditor.tsx x1, InventoryPagePanel.tsx x1) carry real eslint-disable-next-line no-restricted-syntax directives citing 31-CONTEXT.md decision IDs, not prose-only comments"
    requirement: "LINT-01"
    verification:
      - kind: other
        ref: "manual read of all 4 sites post-edit + npm run lint clean (no unused-disable-directive warnings, confirming each directive actually suppresses a real match)"
        status: pass
    human_judgment: false

duration: ~45min
completed: 2026-07-17
status: complete
---

# Phase 35 Plan 3: Wire Drift-Detection Lint Guardrails Summary

**eslint-rules/no-ui-drift.js (5 AST selectors) + eslint-plugin-tailwindcss folded into eslint.config.js at error severity, scoped to src/pages|widgets|features, closing LINT-01 with a zero-violation `npm run lint` gate across the full codebase — this is the last plan of the v2.2 UI Standardization milestone**

## Performance

- **Duration:** ~45 min
- **Tasks:** 2
- **Files modified:** 31 (1 new: eslint-rules/no-ui-drift.js; 1 config: eslint.config.js; 8 files with genuine drift fixes; ~20 files touched only by the auto-fixable `tailwindcss/enforces-shorthand` fixer; 1 deferred-items.md note)

## Accomplishments
- `eslint-rules/no-ui-drift.js` created: 5 `no-restricted-syntax` selector objects (raw `<button>`, raw `<input>` with a structural `type=color/time/date/file` exemption, exact hex-color literal, `rgb()`/`rgba()` literal, D-15's narrow arbitrary-value spacing-prefix selector), ported 1:1 from `scripts/audit-ui-drift.ts`'s regex categories. Proven firing via a disposable fixture + disposable flat-config (both created, run, and deleted within the task — never committed): all 5 fired exactly once, and the `type="date"` input correctly did NOT fire.
- `eslint.config.js` gained one new flat-config object scoped to `src/pages/**/*.tsx`, `src/widgets/**/*.tsx`, `src/features/**/*.tsx` (test/stories ignored), registering `eslint-plugin-tailwindcss` (`no-custom-classname` + `enforces-shorthand` at `error`; `no-arbitrary-value` intentionally NOT enabled per D-15 — it would flag ~70 pre-existing non-drift arbitrary-size classes) and spreading `uiDriftSelectors` into a `no-restricted-syntax` array that also restates the `ExportAllDeclaration` barrel-export ban (mandatory per ESLint flat-config's per-key replace-not-merge semantics — verified the ban still fires via a temporary `export *` insertion/reversion in a features/ file).
- Fixed a real plugin-config bug found during verification: `settings.tailwindcss.config: './tailwind.config.ts'` (the plan's literal instruction) made the plugin throw `Could not resolve tailwindcss` on every file — traced to `local-pkg`'s `resolveModule` returning `undefined` for a relative `paths` entry. Switched to an absolute path via `path.resolve(import.meta.dirname, 'tailwind.config.ts')`.
- Converted the 4 pre-negotiated Phase-31 exception sites (`CategoryForm.tsx` x2 hex literals, `CategoryTreeEditor.tsx` x1 hex literal, `InventoryPagePanel.tsx` x1 signed-delta number input) from prose-only comments to real `eslint-disable-next-line no-restricted-syntax -- <decision id>` directives.
- Turning the rules on surfaced 65 real violations across the codebase. 57 were `tailwindcss/enforces-shorthand` findings (e.g. `h-4 w-4` -> `size-4`), fixed via `npm run lint:fix` (behavior-neutral, Tailwind's own documented equivalence). The remaining 8 were genuine `tailwindcss/no-custom-classname` drift not covered by any documented exception — each was root-cause-fixed rather than whitelisted:
  - `shadow-xs` (2 files: `AdjustStockMovementDialog.tsx`, `InventoryPagePanel.tsx`) -> `shadow-sm`. `shadow-xs` is a Tailwind v4-only utility rename; under this repo's pinned Tailwind v3 it compiles to zero CSS (confirmed via a live `postcss([tailwindcss(...)])` compile). Net effect: these 2 form inputs now actually render their intended subtle shadow.
  - `text-pos-muted` (3 files: `ModifierIngredientRulesDialog.tsx`, `RecipeEditorTab.tsx`, `PrepBatchPreview.tsx`) -> `text-muted-foreground`. `pos-muted` was never defined in `tailwind.config.ts` or `globals.css` — confirmed via grep — so the class rendered no color at all. `text-muted-foreground` is the real, already-established token used identically elsewhere across the codebase.
  - `hover:bg-[var(--pos-accent)]/90` (`PaymentForm.tsx`'s primary payment CTA) -> `hover:opacity-90`. Confirmed via a live postcss compile that Tailwind's opacity-modifier syntax cannot decompose a `var(...)`-valued arbitrary color (same root cause silently affects `shared/ui/button.tsx`'s `bg-primary/80`, which is out of this rule's D-12-exempt scope and left untouched) — the hover state was previously dead CSS on this payment-critical button; it now actually dims on hover.
- `npm run lint` exits 0 with zero warnings against the full codebase (D-14). `npm run typecheck` shows only the 2 pre-existing, unrelated errors tracked since earlier phases. Full unit suite: 1225 passed / 15 todo / 2 skipped files, no regressions.

## Task Commits

1. **Task 1: Create eslint-rules/no-ui-drift.js and prove all 5 selectors fire** - `e3bc2e3` (feat)
2. **Task 2: Wire the rules into eslint.config.js, convert the 4 exception sites, and pass the D-14 clean-lint gate** - `1de3da2` (feat)

**Plan metadata:** pending final `docs(35-03)` commit (this SUMMARY.md + STATE.md/ROADMAP.md/REQUIREMENTS.md)

## Files Created/Modified
- `eslint-rules/no-ui-drift.js` - exports `uiDriftSelectors`, 5 AST selector objects for raw button/input/hex/rgb/spacing drift
- `eslint.config.js` - new pages/widgets/features-scoped config object wiring eslint-plugin-tailwindcss + uiDriftSelectors
- `src/features/manage-products/ui/CategoryForm.tsx` - 2 prose comments -> real eslint-disable-next-line directives
- `src/features/manage-categories/ui/CategoryTreeEditor.tsx` - 1 prose comment -> real eslint-disable-next-line directive
- `src/widgets/InventoryPagePanel.tsx` - 1 prose comment -> real eslint-disable-next-line directive; `shadow-xs` -> `shadow-sm`
- `src/features/adjust-stock-movement/ui/AdjustStockMovementDialog.tsx` - `shadow-xs` -> `shadow-sm`
- `src/features/manage-modifier-inventory-rules/ui/ModifierIngredientRulesDialog.tsx` - `text-pos-muted` -> `text-muted-foreground` (x2)
- `src/features/manage-recipe/ui/RecipeEditorTab.tsx` - `text-pos-muted` -> `text-muted-foreground` (x2)
- `src/features/produce-prep-batch/ui/PrepBatchPreview.tsx` - `text-pos-muted` -> `text-muted-foreground`
- `src/widgets/PaymentModal/ui/PaymentForm.tsx` - `hover:bg-[var(--pos-accent)]/90` -> `hover:opacity-90`
- `.planning/phases/35-guardrails-tokens-doc-drift-lint/deferred-items.md` - logs an undetected `shadow-xs` sibling in `IngredientForm.tsx` (invisible to the plugin's static scan)
- ~20 additional files across `src/features`, `src/pages`, `src/widgets` - `tailwindcss/enforces-shorthand` auto-fixes only (`h-N w-N` -> `size-N`, `gap-x-N gap-y-N` -> `gap-N`, `px-N py-N` -> `p-N`), behavior-neutral

## Decisions Made
- `settings.tailwindcss.config` uses an absolute path (`path.resolve(import.meta.dirname, ...)`) instead of the plan's literal relative string — a real environment bug found while executing, not a plan deviation in intent.
- The 3 categories of genuine drift newly surfaced by `no-custom-classname` were root-cause-fixed rather than whitelisted, per the plan's explicit "Do NOT whitelist a class that is actually a typo/drift" instruction. All 3 fixes are class-name-only swaps to the correct existing token/utility with no layout or component-structure change.
- `hover:bg-[var(--pos-accent)]/90` was replaced with `hover:opacity-90` rather than a color-mix-based arbitrary value, keeping the fix simple and consistent with the button's existing solid-fill styling; this is the only fix in this plan that changes rendered (rather than purely dead) CSS behavior — previously no hover feedback rendered at all on this button, now it does.
- Left `shared/ui/switch.tsx`'s identical `shadow-xs` and `src/features/manage-ingredients/ui/IngredientForm.tsx`'s identical `shadow-xs` untouched: the former is structurally out of the rule's D-12-exempt scope; the latter lives in a bare string constant invisible to the plugin's callee/className scan, so it was not surfaced by this task's changes (scope-boundary rule) — logged to `deferred-items.md`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `settings.tailwindcss.config` relative path caused every file to error, not lint**
- **Found during:** Task 2, first `npm run lint` run after wiring the plugin
- **Issue:** The plan's literal `config: './tailwind.config.ts'` made `eslint-plugin-tailwindcss`'s `no-custom-classname` rule throw `Error: Could not resolve tailwindcss` on the very first linted file, aborting the whole run. Traced via direct `node -e` reproduction to `local-pkg`'s `resolveModule('tailwindcss', { paths: ['.'] })` returning `undefined`, while the identical call with an absolute path resolves correctly.
- **Fix:** Changed `config` to `path.resolve(import.meta.dirname, 'tailwind.config.ts')`.
- **Files modified:** `eslint.config.js`
- **Verification:** `npm run lint` proceeds past the config-loading step and reports real classname violations instead of crashing.
- **Committed in:** `1de3da2` (Task 2 commit)

**2. [Rule 1 - Bug] `shadow-xs` is a dead class under this repo's pinned Tailwind v3**
- **Found during:** Task 2, `npm run lint` after wiring `tailwindcss/no-custom-classname`
- **Issue:** `shadow-xs` (used in `AdjustStockMovementDialog.tsx`, `InventoryPagePanel.tsx`, plus 2 out-of-scope siblings) is a Tailwind v4-only utility name; Tailwind v3's shadow scale has no `xs` step. Confirmed via a live `postcss([tailwindcss(...)])` compile that the class generates zero CSS.
- **Fix:** Replaced with `shadow-sm`, the real v3 utility matching the intended subtle input shadow (also the pre-v4 shadcn convention this code was likely copied from).
- **Files modified:** `src/features/adjust-stock-movement/ui/AdjustStockMovementDialog.tsx`, `src/widgets/InventoryPagePanel.tsx`
- **Verification:** `npm run lint` clean on both files; visual effect is a net-new (previously absent) subtle shadow, no regression.
- **Committed in:** `1de3da2` (Task 2 commit)

**3. [Rule 1 - Bug] `text-pos-muted` referenced a token that was never defined**
- **Found during:** Task 2, `npm run lint` after wiring `tailwindcss/no-custom-classname`
- **Issue:** `text-pos-muted` (used in 3 in-scope feature files, plus 2 out-of-scope siblings in `entities/`/`shared/ui/`) has no corresponding entry in `tailwind.config.ts`'s `colors` map or any `--pos-muted` CSS variable in `globals.css` — confirmed via grep. The class generated zero CSS everywhere it was used.
- **Fix:** Replaced with `text-muted-foreground`, the real, already-established token (`colors.muted.foreground = var(--muted-foreground)`) used identically across dozens of other files in the codebase.
- **Files modified:** `src/features/manage-modifier-inventory-rules/ui/ModifierIngredientRulesDialog.tsx`, `src/features/manage-recipe/ui/RecipeEditorTab.tsx`, `src/features/produce-prep-batch/ui/PrepBatchPreview.tsx`
- **Verification:** `npm run lint` clean on all 3 files; these labels/hints now render in the intended muted gray instead of the inherited default text color.
- **Committed in:** `1de3da2` (Task 2 commit)

**4. [Rule 1 - Bug] `hover:bg-[var(--pos-accent)]/90` was dead CSS on the primary payment CTA**
- **Found during:** Task 2, `npm run lint` after wiring `tailwindcss/no-custom-classname`
- **Issue:** Opacity modifiers (`/90`) on an arbitrary color value cannot be applied when the value is an opaque `var(...)` reference that Tailwind cannot decompose into a color-mix-able form — confirmed via a live `postcss([tailwindcss(...)])` compile that emitted zero CSS for the `hover:` variant (only the base `bg-[var(--pos-accent)]` rule compiled). This is the same root cause as `shared/ui/button.tsx`'s pre-existing `bg-primary/80` pattern, which is out of this rule's scope.
- **Fix:** Replaced with `hover:opacity-90`, which dims the whole button on hover using a real, functioning Tailwind utility — visually equivalent intent, now actually renders.
- **Files modified:** `src/widgets/PaymentModal/ui/PaymentForm.tsx`
- **Verification:** `npm run lint` clean; the hover state now visibly changes (previously it did not).
- **Committed in:** `1de3da2` (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (1 blocking config-path bug, 3 genuine dead-CSS drift bugs newly surfaced by the new lint rules)
**Impact on plan:** All 4 fixes were necessary to reach the D-14 zero-violation gate and are either pure config corrections or class-name-only swaps to the correct existing token/utility. No scope creep beyond what turning on the new rules directly surfaced.

## Issues Encountered
None beyond the 4 deviations documented above. The 2 pre-existing, unrelated `npm run typecheck` errors (`src/entities/tab/model/queries.ts:780`, `src/shared/lib/agent/rag.ts:60`) remain, tracked in `deferred-items.md` since Plan 35-02.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- LINT-01 is fully satisfied: `eslint-rules/no-ui-drift.js` + the wired `eslint.config.js` guardrail enforce all 4 of Phase 29's drift categories at `error` severity, and `npm run lint` passes clean against the full codebase.
- This is the last plan of the v2.2 UI Standardization milestone. No further phases are queued in this milestone; the guardrail is now live and will fail CI on any future regression in `src/pages|widgets|features`.
- One residual, low-priority item logged (not blocking): `IngredientForm.tsx`'s `shadow-xs` sibling, undetected by the plugin's static scan due to living in a bare string constant.

---
*Phase: 35-guardrails-tokens-doc-drift-lint*
*Completed: 2026-07-17*

## Self-Check: PASSED

- FOUND: eslint-rules/no-ui-drift.js
- FOUND: e3bc2e3 (Task 1 commit)
- FOUND: 1de3da2 (Task 2 commit)
