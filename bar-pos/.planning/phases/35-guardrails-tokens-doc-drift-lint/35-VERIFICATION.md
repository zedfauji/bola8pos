---
phase: 35-guardrails-tokens-doc-drift-lint
verified: 2026-07-17T18:50:06Z
status: passed
score: 8/8 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 35: Guardrails — Tokens Doc + Drift Lint Verification Report

**Phase Goal:** Document the existing design tokens and add drift-detection lint, both deferred to last because a strict rule only makes sense once the codebase already conforms — adding it earlier would fail against every pre-existing violation Phase 29 catalogued.
**Verified:** 2026-07-17T18:50:06Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `DESIGN-TOKENS.md` exists at repo root documenting color/border-radius/spacing/typography tokens plus touch-target (44/56/72px) and focusEmphasis conventions | ✓ VERIFIED | Read full file: `<!-- GENERATED:START/END -->` markers present; 20-row Colors table + 4-row Border Radius table inside markers; hand-written "Touch Targets" (44/56/72px), "Focus Emphasis" (default/high), "Dark Mode", and "Do / Don't" sections outside markers |
| 2 | `npm run docs:tokens` is idempotent — a second run on unchanged source produces no git diff | ✓ VERIFIED | Ran `npm run docs:tokens`; `git diff --exit-code DESIGN-TOKENS.md` exited 0 (no diff) |
| 3 | Generated token tables reflect real values in `tailwind.config.ts`/`src/app/globals.css` — no invented tokens | ✓ VERIFIED | Manually diffed every color/oklch value and border-radius formula in DESIGN-TOKENS.md against `tailwind.config.ts` lines 12-57 and `globals.css` lines 10-29 — exact match, no fabricated tokens; doc correctly states no custom spacing/typography scale exists |
| 4 | The day-of-week toggle in `PromotionAvailabilityEditor.tsx` renders the shared `Button`, not a native `<button>` | ✓ VERIFIED | Read file lines 84-109: `<Button variant="outline" ...>` wraps the day-toggle chip, matching the fixed `ComboAvailabilityEditor.tsx` sibling shape |
| 5 | `eslint-plugin-tailwindcss@3.18.3` is installed as an EXACT-pinned devDependency | ✓ VERIFIED | `package.json:117` → `"eslint-plugin-tailwindcss": "3.18.3"` (no caret/range) |
| 6 | A raw button/non-exempt raw input/hex literal/rgb(a) literal/arbitrary-value spacing class introduced in `src/pages\|widgets\|features` fails `npm run lint` at error severity; native `type=color/time/date/file` inputs are NOT flagged | ✓ VERIFIED | Live-fired all 5 `no-ui-drift.js` selectors against disposable fixtures created and deleted during this verification: raw `<button>` → error (exit 1); `export *` + hex literal + `p-[13px]` → 3 errors + barrel-ban error (exit 1); `<input type="date">` → 0 errors (exit 0, exemption holds) |
| 7 | The pre-existing barrel-export (`export *`) ban still fires in `pages/widgets/features` | ✓ VERIFIED | Same disposable-fixture run above: `export * from './fake-module'` produced `no-restricted-syntax` error citing "Barrel exports (export *) are banned" |
| 8 | `npm run lint` passes clean against the full codebase (D-14) — zero violations, zero warnings | ✓ VERIFIED | Ran `npm run lint` directly; exit code 0, only two non-error informational lines (multi-tsconfig notice + a boundaries-plugin legacy-selector-syntax warning that is not a lint error/warning against source files) |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `DESIGN-TOKENS.md` | Root reference doc, generated + hand-written sections | ✓ VERIFIED | Exists on disk (5542 bytes), correct content. Not git-tracked — `bar-pos/.gitignore:65` (`*.md`, `!CLAUDE.md`) also ignores `FSD-STRUCTURE.md`/`DOMAIN-CONTRACTS.md`/`SUPABASE-CONTRACTS.md` identically (confirmed via `git check-ignore -v`), so this is pre-existing, deliberate project convention, not a gap |
| `scripts/generate-design-tokens.ts` | Idempotent generator | ✓ VERIFIED | Exists, committed at `cceaae3`; structured-reads `tailwind.config.ts` + regex-reads `globals.css`; marker-replace write proven idempotent |
| `package.json` `docs:tokens` script | npm script wired to generator | ✓ VERIFIED | `package.json:32` → `"docs:tokens": "npx tsx scripts/generate-design-tokens.ts"` |
| `eslint-rules/no-ui-drift.js` | Exports `uiDriftSelectors` (5 selectors) | ✓ VERIFIED | Exports exactly 5 `{selector, message}` objects: raw button, raw input w/ type exemption, hex literal, rgb(a) literal, arbitrary-spacing class |
| `eslint.config.js` | pages/widgets/features-scoped config object with tailwindcss plugin + merged no-restricted-syntax | ✓ VERIFIED | Lines 137-182: scoped `files: ['src/pages/**/*.tsx', 'src/widgets/**/*.tsx', 'src/features/**/*.tsx']`, `ignores` test/stories, registers `tailwindcss` plugin (`no-custom-classname`+`enforces-shorthand` at error, `no-arbitrary-value` intentionally omitted), `no-restricted-syntax` restates `ExportAllDeclaration` + spreads `uiDriftSelectors`, placed after the repo-wide block |
| `eslint-plugin-tailwindcss@3.18.3` devDependency | Exact pin | ✓ VERIFIED | `package.json:117`, `require.resolve` succeeds |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `scripts/generate-design-tokens.ts` | `tailwind.config.ts` + `src/app/globals.css` | default-import + regex read, marker-replace write | ✓ WIRED | Re-ran generator live; output byte-identical to committed file; hand-written sections untouched |
| `eslint.config.js` scoped config object | `eslint-rules/no-ui-drift.js` | `import { uiDriftSelectors }` spread into `no-restricted-syntax` array | ✓ WIRED | Line 14 imports; line 179 spreads; confirmed firing via live eslint run against disposable fixtures |
| `eslint.config.js` scoped config object | `eslint-plugin-tailwindcss` | `plugins: { tailwindcss }`, `settings.tailwindcss.config` (absolute path) | ✓ WIRED | `npm run lint` invokes the plugin without the "Could not resolve tailwindcss" crash noted as a fixed deviation in 35-03-SUMMARY; clean exit |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Raw `<button>` in a features file fails lint | `npx eslint` on disposable fixture with `<button>` | exit 1, `no-restricted-syntax` error naming DESIGN-TOKENS.md | ✓ PASS |
| `export *` + hex literal + `p-[13px]` all fail lint in one file | `npx eslint` on disposable fixture | exit 1, 3 errors (barrel ban, hex, spacing) | ✓ PASS |
| `<input type="date">` is exempt | `npx eslint` on disposable fixture | exit 0, no errors | ✓ PASS |
| Full-codebase lint is clean | `npm run lint` | exit 0 | ✓ PASS |
| Design-tokens generator is idempotent | `npm run docs:tokens && git diff --exit-code DESIGN-TOKENS.md` | exit 0, no diff | ✓ PASS |
| `npm run typecheck` | `npm run typecheck` | 2 pre-existing errors only (`src/entities/tab/model/queries.ts:780`, `src/shared/lib/agent/rag.ts:60`) | ✓ PASS (both confirmed pre-dating Phase 35 — commits `a435f7f` 2026-07-13 and `45e2c0b` 2026-04-27, before phase start `3c25cd1` 2026-07-15; documented in `deferred-items.md`) |

All disposable fixture files created during this verification were deleted immediately after use; `git status --porcelain` confirms no stray files remain.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DOCS-01 | 35-01 | Design tokens reference doc exists, documenting existing tokens (no new tokens invented) | ✓ SATISFIED | DESIGN-TOKENS.md verified truths 1-3 above; REQUIREMENTS.md traceability row marked Complete |
| LINT-01 | 35-02, 35-03 | Drift-detection lint rule added post-conformance to prevent regression | ✓ SATISFIED | Verified truths 4-8 above; live-fired all 5 selectors + barrel ban; `npm run lint` clean; REQUIREMENTS.md traceability row marked Complete |

No orphaned requirements — REQUIREMENTS.md maps only DOCS-01 and LINT-01 to Phase 35, both claimed by the plans.

### Anti-Patterns Found

None blocking. Scanned `eslint-rules/no-ui-drift.js`, `eslint.config.js`, `scripts/generate-design-tokens.ts`, and the modified files (`PromotionAvailabilityEditor.tsx`, `CategoryForm.tsx`, `CategoryTreeEditor.tsx`, `InventoryPagePanel.tsx`) for TODO/FIXME/XXX/placeholder markers — none found. The 4 `eslint-disable-next-line` directives all carry `-- 31-CONTEXT.md D-0x` justifications (not bare suppressions) and produce no unused-directive warnings, confirming each actually suppresses a live match.

Two pre-existing `npm run typecheck` errors remain (unrelated files, predate Phase 35, logged in `deferred-items.md`) — informational only, not a Phase 35 regression and not part of this phase's lint gate (ESLint and `tsc --noEmit` are separate gates in this repo; the plan's verify commands target `npm run lint`, which is clean).

### Human Verification Required

None. All must-haves are programmatically verifiable (file existence/content, generator idempotency, live ESLint firing against fixtures, requirement traceability) and were directly executed during this verification, not inferred from SUMMARY narrative.

### Gaps Summary

None. All 8 observable truths verified directly against the running toolchain (not SUMMARY claims): the design-tokens doc and generator are real and idempotent, and the drift-lint guardrail genuinely fires on all 4 drift categories, respects the type-based input exemption, preserves the pre-existing barrel-export ban, and leaves `npm run lint` clean across the full codebase. DOCS-01 and LINT-01 are both satisfied, closing the v2.2 UI Standardization milestone (22/22 requirements now Complete per REQUIREMENTS.md traceability).

---

_Verified: 2026-07-17T18:50:06Z_
_Verifier: Claude (gsd-verifier)_
