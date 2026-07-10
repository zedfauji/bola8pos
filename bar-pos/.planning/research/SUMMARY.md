# Project Research Summary

**Project:** UI Standardization milestone (v2.2) — bar-pos
**Domain:** Design-system enforcement pass on a live, shipping Tauri 2 + React 19 + Supabase POS
**Researched:** 2026-07-10
**Confidence:** HIGH

## Executive Summary

This milestone is enforcement, not invention. The stack, tokens, and 50+ `shared/ui` primitives already exist (`PageContainer`, `POSButton`, `BackToHomeButton`, Tailwind CSS-variable theme) — the work is auditing 17 live routes (router registers 17, `CLAUDE.md`'s table is stale at 13) for drift (28 files with raw `<button>`, 8 with raw `<input>`, two dead nav paradigms `AppShell`/`AppNav` with zero consumers) and mechanically converting them to the canonical primitives. No new core technology is needed; only two small dev dependencies (`eslint-plugin-tailwindcss@^3.18.3` pinned to the v3 line, `@axe-core/playwright@^4.12.1`) plus the already-installed `@playwright/test` `toHaveScreenshot()` for visual regression.

The recommended approach is a risk-tiered rollout: audit first (read-only, zero risk) → extend `shared/ui` primitives (`PageContainer`, `BackToHomeButton`) in isolation → sweep low-risk admin/read-heavy pages → operational/realtime pages (pool tables, KDS) → payment-critical pages last, one PR at a time, never combined with a primitive change in the same PR. Visual-regression baselines must be captured only *after* the fix pass, in an isolated Playwright project (bundled Chromium, headless, no `slowMo`), against static/masked views — never against pages with live timers or Supabase realtime pushes.

The single biggest risk is scope creep from "pure UI consistency" into money-correctness or touch-target regressions: replacing `POSButton` with bare `Button` silently shrinks touch targets from 44-72px to 28-32px, and touching payment/split/refund/tip form components while "just swapping" a primitive can change validation/rounding behavior. Both must be treated as explicit behavior changes requiring sign-off and the corresponding E2E specs (`05-payments`, `41-split-payment`, `42-tip-distribution`, `06-transfer`, `09-rbac`), not silent consistency edits. A secondary risk is a visual-regression suite that's flaky (live timers, CI/local environment mismatch) or maintained by rubber-stamped `--update-snapshots` — both defeat the suite's purpose within weeks.

## Key Findings

### Recommended Stack

No new architectural technology. Two new devDependencies extend already-installed tooling: `eslint-plugin-tailwindcss@^3.18.3` (must pin the 3.x line — `latest`/4.x requires Tailwind v4, this project is locked to v3.4.19) lints class-string consistency against `tailwind.config.ts`; `@axe-core/playwright@^4.12.1` injects real-DOM accessibility scans into Playwright specs. Visual regression needs zero new packages — `toHaveScreenshot()` covers it, but requires a **second** Playwright config (headless, bundled Chromium, no `channel: 'chrome'`, no `slowMo`).

**Core technologies:**
- `eslint-plugin-tailwindcss@^3.18.3` (pinned): class-string consistency lint
- `@axe-core/playwright@^4.12.1`: accessibility scans in real rendered DOM
- `@playwright/test` `toHaveScreenshot()` (already installed): visual regression, own config/project

### Expected Features

**Must have:** component inventory/audit across 17 routes; shared layout shell (`PageContainer` + generalized `BackToHomeButton`) on all routes; component consistency pass (`POSButton`, `StatusBadge`, `EmptyState`, `DataTable`, `FormField`); spacing/color token discipline; touch-target audit to 44px floor (56/72px for frequent/critical actions); focus-visible states; post-fix Playwright screenshot baseline.

**Should have:** design tokens reference doc; automated drift-detection lint (after conformance); visual regression as CI gate (after stability proven); Storybook `addon-a11y` CI enforcement.

**Defer:** full visual redesign; new component library/token SaaS; cross-browser/OS visual regression matrix.

### Architecture Approach

Fits existing FSD tree, zero new top-level folders. `PageContainer` (8/17 pages already) is the canonical shell to extend with `backTo`/`backLabel`. `AppShell`/`AppNav` are dead code (zero consumers, abandoned sidebar paradigm) — do not resurrect. Drift audit lives in `scripts/` (filesystem-read only, never imported, can't violate `eslint-plugin-boundaries`). Visual specs are new files in existing `e2e/` (`43-*.spec.ts` onward).

**Major components:** `shared/ui/PageContainer.tsx` (extend), `shared/ui/BackToHomeButton.tsx` (generalize), `scripts/audit-ui-drift.ts` (new, scoped to `pages/widgets/features`), `e2e/43+.spec.ts` (new Playwright project).

### Critical Pitfalls

1. **`POSButton`→`Button` swap shrinks touch targets** (44-72px → 28-32px) — treat as reviewed behavior change on touchscreen-primary surfaces.
2. **Visual baselines won't reproduce local vs CI** — isolate in own Playwright project (bundled Chromium, headless).
3. **Visual diffs flake on live timers/realtime** — screenshot only static/seeded views, mask dynamic regions.
4. **Scope creep into payment-critical behavior** — form-primitive swaps in payment/split/refund/tip paths out of scope unless zero prop/handler change.
5. **`exactOptionalPropertyTypes`/`noUncheckedIndexedAccess` mass breakage** on shared prop-contract changes (`POSButton` has 50 usages) — land as isolated commit with full-repo typecheck.

## Implications for Roadmap

### Phase 1: Audit + Primitive Extension
**Rationale:** Read-only audit and safest layer (`shared/ui`) first.
**Delivers:** Drift backlog, extended `PageContainer`/`BackToHomeButton`.
**Avoids:** Prop-contract breakage via isolated commit + full typecheck.

### Phase 2: Low-Risk Page Sweep (login, home, settings, staff, rbac, audit, waitlist, rappi, reports)
**Rationale:** No money-mutation, mostly static — safest place to prove the pattern.
**Delivers:** Consistent shell/primitives; first visual-regression baselines.

### Phase 3: Operational/Realtime Page Sweep (pool-tables, pool-table-status, inventory, kitchen-prep, kds, kds-bar)
**Rationale:** Real-time data present but not payment path — proves masking/threshold approach.
**Delivers:** Touch-target + focus-visible fixes, sizing/contrast-only (no reordering).
**Avoids:** Muscle-memory breakage from moved/resized controls.

### Phase 4: Payment-Critical Pages (last, isolated)
**Rationale:** Highest blast radius — one page/widget per PR.
**Delivers:** pos, payments, PaymentModal, PaymentPane, TabDrawer, refund/tip surfaces standardized, zero behavior change.
**Avoids:** Payment scope creep, E2E/RBAC regressions — exit criterion: `05-payments`, `41-split-payment`, `42-tip-distribution`, `06-transfer`, `09-rbac` pass unchanged.

### Phase 5: Guardrails (drift-prevention + docs)
**Rationale:** Strict lint only makes sense once codebase conforms.
**Delivers:** ESLint drift rule, tokens reference doc, `CLAUDE.md` routes-table fix (13→17), CI-gate-vs-manual decision for visual regression.

### Research Flags
Needs research at plan time: Phase 1 (Playwright visual-regression environment pinning/CI-gate decision).
Standard patterns: Phase 2, 3 (mechanical page sweeps), Phase 5 (reuses existing `eslint-plugin-boundaries`/`no-restricted-syntax`).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Verified via npm registry + installed package.json |
| Features | MEDIUM-HIGH | Grounded in codebase + WCAG 2.2; gloved-hand/bar-lighting notes flagged LOW |
| Architecture | HIGH | Direct repo inspection, no external dependency |
| Pitfalls | HIGH | Checked against repo code/config directly |

**Overall confidence:** HIGH

### Gaps to Address
- Gloved/wet-hand and bar-lighting touch guidance has no authoritative spec — validate with real feedback during Phase 3.
- Visual-regression CI-gate-vs-manual undecided — default to manual/pinned-container (CI runs no E2E today); confirm at Phase 1 planning.
- `CLAUDE.md` routes table stale (13 vs actual 17) — fix in Phase 5.

## Sources

**Primary:** direct repo inspection (`src/shared/ui/*`, all 17 pages, `router.tsx`, `tailwind.config.ts`, `playwright.config.ts`, `ci.yml`, `CLAUDE.md`, `PROJECT.md`); npm registry metadata; W3C WAI SC 2.5.8.
**Secondary:** Playwright visual-testing best-practice guides, Apple HIG/Material touch-target conventions, eslint-plugin-tailwindcss GitHub docs.
**Tertiary:** gloved/wet-hand and bar-lighting touch guidance — domain inference, no dedicated spec.
