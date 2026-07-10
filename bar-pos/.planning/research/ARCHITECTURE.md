# Architecture Research

**Domain:** UI standardization pass on a live FSD-architected Tauri POS
**Researched:** 2026-07-10
**Confidence:** HIGH (grounded in direct codebase inspection, not external sources — no framework/library ambiguity involved)

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│ app/  (providers, router, Tauri init, global CSS)                 │
│   router.tsx lazy-loads 17 pages, wraps each in <ProtectedRoute>  │
├──────────────────────────────────────────────────────────────────┤
│ pages/  (17 route containers — currently NOT thin)                │
│   Each page hand-rolls its own shell:                             │
│     <div className="flex h-screen flex-col">                     │
│       <BackToHomeButton /> | custom back-button markup            │
│       <main className="flex-1 overflow-auto p-6 md:p-8">          │
│         ...widgets...                                             │
├──────────────────────────────────────────────────────────────────┤
│ widgets/  (40 composite panels — OrderPanel, PaymentModal, ...)   │
├──────────────────────────────────────────────────────────────────┤
│ features/  (one action per folder — process-payment, split-tab..) │
├──────────────────────────────────────────────────────────────────┤
│ entities/  (domain models — tab, staff, inventory, pool, ...)     │
├──────────────────────────────────────────────────────────────────┤
│ shared/  (70 shadcn primitives + 2 UNRECONCILED layout shells:    │
│   AppShell.tsx  — 0 real consumers, sidebar-nav design, DEAD      │
│   PageContainer.tsx — used in 8/17 pages, title+actions wrapper   │
│   AppNav (widget, not shared) — 0 real consumers, DEAD, sidebar   │
│   BackToHomeButton.tsx — used in 14/17 pages, always → /home      │
└──────────────────────────────────────────────────────────────────┘
```

**Live evidence gathered from the repo (not assumption):**
- `grep -rl "AppShell" src` → only `AppShell.tsx` itself. Zero pages import it.
- `grep -rl "AppNav" src` → only `AppNav.tsx` itself. Zero pages import it.
- `grep -rl "PageContainer" src` → 8 pages (`kds-bar`, `kds`, `kitchen-prep`, `pool-table-status`, `pool-tables`, `rappi`, `rbac`, `waitlist`).
- `grep -rl "BackToHomeButton" src` → 14 pages, but `pool-table-status/index.tsx` hand-rolls an *identical* back-button block (`px-4 pt-4` + ghost `Button` + `ChevronLeft` + `Link`) pointing at `/pool-tables` instead of `/home` — this is the exact "custom component shadows a shared primitive" pattern the milestone is looking for, and it's a legitimate variant (different destination), not a mistake — the fix is to parametrize, not delete.
- Raw `<button>` JSX appears in 28 files and raw `<input>` in 8 files under `pages/widgets/features` (ripgrep count) — real, measurable drift, not a hypothesis.
- The real navigation model is **not** a persistent sidebar (`AppShell`/`AppNav` describe an abandoned design) — it's a big-box `/home` dashboard (`HomeDashboard` widget) with per-page "back" links. Any standardization pass must design *around* the pattern that's actually live, not resurrect the dead sidebar scaffolding.
- `CLAUDE.md`'s routes table lists 13 routes; the router (`src/app/router.tsx`) currently registers 17 (`audit`, `kds`, `kds-bar`, `kitchen-prep` are undocumented additions). The milestone context's "12 routes" is stale — treat 17 as ground truth and update `CLAUDE.md` as part of this milestone's docs sweep.

### Component Responsibilities

| Component | Responsibility | Current State |
|-----------|----------------|----------------|
| `shared/ui/PageContainer.tsx` | Title + description + actions + max-width + padding wrapper | Real, in use, but only in 8/17 pages — the closest thing to a "canonical shell" already established |
| `shared/ui/BackToHomeButton.tsx` | Back-nav affordance | Real, in use, hardcoded to `/home` — needs generalizing to `to`/`label` props to absorb the `pool-table-status` duplicate |
| `shared/ui/AppShell.tsx` | Sidebar + header layout | Dead code — 0 consumers, describes a navigation paradigm the app no longer uses |
| `widgets/AppNav` | Sidebar nav content | Dead code — 0 consumers, same abandoned paradigm as `AppShell` |
| `widgets/HomeDashboard` | Actual primary navigation ("big-box nav dashboard" per `CLAUDE.md`) | Real, live, is the thing pages link back to |
| `eslint-plugin-boundaries` config | Enforces `app→pages→widgets→features→entities→shared` import direction | Already enforced, blocking — any new drift-prevention rule should extend this config, not create a parallel mechanism |

## Recommended Project Structure

No new top-level folders. Everything needed already has a home in the existing FSD tree:

```
src/
├── shared/ui/
│   ├── PageContainer.tsx      # EXTEND — this is the canonical page shell, not a new app/layout/
│   ├── BackToHomeButton.tsx   # EXTEND — generalize to BackButton(to?, label?) or leave as a
│   │                          #   thin default wrapper around a new lower-level BackButton
│   ├── AppShell.tsx           # DECIDE — delete (dead code, no callers) or repurpose only if a
│   │                          #   persistent-nav redesign is explicitly requested; do not let it
│   │                          #   quietly become "the" shell just because it exists
│   └── [any new primitive the audit surfaces, e.g. a spacing/token helper]
├── widgets/
│   └── AppNav/                # DECIDE — same as AppShell: delete or explicitly re-adopt, don't
│                               #   leave two dead nav paradigms sitting next to the live one
├── pages/**/index.tsx          # MODIFY ONLY — swap hand-rolled shell markup for PageContainer +
│                               #   BackButton; no new logic, still thin containers per CLAUDE.md
└── (scripts/, not src/)
    └── audit-ui-drift.ts       # NEW, dev-tooling only — lives outside src/, never imported by
                                 #   app code, so it cannot create a cross-layer violation

e2e/
├── 43-visual-regression-*.spec.ts   # NEW specs, same directory, next free numbers after 42
└── [42 existing specs, untouched]
```

### Structure Rationale

- **Shell lives in `shared/ui/`, not a new `app/layout/`:** `app/` in this codebase is explicitly scoped (per `CLAUDE.md`) to "Providers, router, Tauri initialization, global CSS" — process-level concerns, not presentational components. A layout shell that takes `children`/`header`/`actions` as props and renders only Tailwind markup has zero business logic and zero process concerns — it is by definition a `shared/ui` primitive, identical in kind to the `PageContainer`/`AppShell` that already exist there. Putting it in `app/` would also be structurally backwards: `app/router.tsx` lazy-imports *pages*, so `app/` sits above `pages/` in the composition graph. If the shell lived in `app/`, every page would need to import upward from `app/`, which the FSD boundaries plugin will reject (only `app → pages` is a legal direction, never `pages → app`).
- **No new dependency for the audit:** ripgrep-style greps (already demonstrated: 28 files, 8 files) plus an ESLint rule addition to the existing `eslint-plugin-boundaries` config cover this. Do not add an AST-scanning package or a custom lint plugin for a task this small.
- **No new dependency for visual regression:** `@playwright/test` v1.59 (already installed) ships `toHaveScreenshot()`. `@chromatic-com/storybook` is already installed but is a Storybook-publishing/visual-diff *service* integration, unrelated to Playwright E2E screenshots — don't conflate the two or add a paid service for this.

## Architectural Patterns

### Pattern 1: Shared Layout Shell as a `shared/ui` Primitive (Q1)

**What:** Extend `PageContainer` (already the closest thing to a canonical shell, already used in 8/17 pages) to also accept an optional `backTo`/`backLabel` pair, absorbing `BackToHomeButton`'s behavior and the duplicate hand-rolled version in `pool-table-status`. Every page becomes `<PageContainer title="..." backTo="/pool-tables">{widgets}</PageContainer>` instead of hand-building the `flex h-screen flex-col` + `main` scaffold.

**When to use:** Every page in `src/pages/`. This is the default, not an opt-in.

**Trade-offs:** Touches all 17 pages eventually (see rollout order below), but each touch is a pure markup swap with no logic change — low risk per file, and each page still imports only from `shared/`, `widgets/`, `features/`, `entities/` as FSD already requires. No boundary rule changes needed.

**Example:**
```tsx
// Before (src/pages/pool-table-status/index.tsx today)
<div className="flex h-screen flex-col">
  <div className="px-4 pt-4">
    <Button variant="ghost" size="sm" asChild>
      <Link to="/pool-tables"><ChevronLeft className="mr-1 h-4 w-4" />Pool Tables</Link>
    </Button>
  </div>
  <main className="flex-1 overflow-auto">
    <PageContainer title="Table Status"><TableStatusPanel tableId={tableId} /></PageContainer>
  </main>
</div>

// After
<PageContainer title="Table Status" backTo="/pool-tables" backLabel="Pool Tables">
  <TableStatusPanel tableId={tableId} />
</PageContainer>
```

### Pattern 2: Drift Audit as Tooling, Not Source (Q2)

**What:** A read-only script under `scripts/` (or a documented `rg` invocation in a checklist doc) that scans only `src/pages/**`, `src/widgets/**`, `src/features/**` for: raw `<button`/`<input`/`<select`/`<table`, inline hex/rgb colors, ad-hoc padding/margin values outside the Tailwind default scale, and JSX components whose name looks like a shadow of a `shared/ui` export (e.g. a local `CustomModal` next to `shared/ui/dialog.tsx`). `entities/` is out of scope (data models, minimal UI) and `shared/` is out of scope (it's the reference implementation, not a drift target).

**When to use:** Once, up front, to produce the fix backlog. Optionally promote the highest-value checks (raw `<button>`/`<input>`) into a blocking ESLint rule afterward so drift can't reaccumulate.

**Trade-offs:** A one-off script finds the backlog but doesn't prevent regression; an ESLint rule prevents regression but is a small ongoing maintenance surface. Do both, script first to scope the work, lint rule after the pass lands as a guardrail.

**Example:**
```bash
# what was actually run against this repo to seed the finding above
grep -rl "<button" src/pages src/widgets src/features --include="*.tsx"   # 28 files
grep -rl "<input"  src/pages src/widgets src/features --include="*.tsx"   # 8 files
```

**Why this stays boundary-safe:** the script lives in `scripts/`, never in `src/`, and is invoked via an `npm run` script — it is never `import`ed by application code, so it cannot participate in (or violate) the `app→pages→widgets→features→entities→shared` graph at all. The *fixes* it identifies don't add imports either — they replace a raw HTML tag with a `shared/ui` import in a file whose layer (`pages`/`widgets`/`features`) is already permitted to import from `shared/` today.

### Pattern 3: Visual Regression as New Specs in the Existing `e2e/` Suite (Q3)

**What:** New Playwright spec files in the same `e2e/` directory, following the existing `NN-topic.spec.ts` numbering (next free integer after `42-tip-distribution.spec.ts` is `43`), using `expect(page).toHaveScreenshot()`. Do not create a parallel `e2e-visual/` directory or a second Playwright config — `playwright.config.ts` already has a single `testDir: './e2e'`.

**When to use:** Separate spec files per page/area, kept apart from the 22 existing functional specs, so a pixel-diff failure never gets conflated with a functional regression in CI output.

**Trade-offs:** This app has several sources of screenshot flakiness that must be handled before the suite is trustworthy: `POSButton`'s `active:scale-95 transition-transform`, `Sheet`/`Dialog` enter/exit animations, `LiveTimeDisplay`/`TimerDisplay` widgets ticking in real time, and Supabase Realtime pushing live data. Mitigate with Playwright's `mask` option on dynamic regions, `prefers-reduced-motion` emulation, a non-zero `maxDiffPixelRatio`, and running these specs against seeded/static fixture views rather than pages with live timers wherever possible.

**Example:**
```ts
// e2e/43-visual-regression-static-pages.spec.ts
import { test, expect } from './fixtures';
import { loginAs } from './helpers/auth';

test('settings page matches baseline', async ({ page }) => {
  await loginAs(page, 'admin');
  await page.goto('/settings');
  await expect(page).toHaveScreenshot('settings-page.png', {
    maxDiffPixelRatio: 0.02,
  });
});
```

## Data Flow

### Page Composition Flow (after standardization)

```
router.tsx (lazy import)
    ↓
pages/<route>/index.tsx           — imports PageContainer from shared/ui, widgets it needs
    ↓
PageContainer (shared/ui)         — renders SectionHeader, optional BackButton, children slot
    ↓
widgets/*                         — unchanged, still compose features + entities
```

No new data flow is introduced — this is a presentational refactor. The one behavioral risk is on payment-critical pages where "swap raw `<button>` for `<Button>`/`<POSButton>`" can silently change `type="submit"` semantics, `disabled` handling, or event bubbling if not checked — treat every such swap on `pos/`, `payments/`, `PaymentModal`, `PaymentPane` as a functional change requiring the relevant E2E spec to re-pass, not a pure style change.

## Anti-Patterns

### Anti-Pattern 1: Resurrecting `AppShell`/`AppNav` as "the" shared shell

**What people do:** See an existing `AppShell.tsx` in `shared/ui` and a `AppNav` widget, assume they're the sanctioned-but-unused layout system, and wire them in.
**Why it's wrong:** Both are dead code describing a persistent-sidebar navigation paradigm the app already abandoned in favor of the `/home` big-box dashboard + per-page back-links. Reviving them mid-milestone reintroduces a second, competing navigation model.
**Do this instead:** Extend `PageContainer` (already live, already used in 8/17 pages) and `BackToHomeButton` (already live, already used in 14/17 pages) — the patterns already in production use. Delete or explicitly flag `AppShell`/`AppNav` as out of scope for this milestone rather than silently building on top of them.

### Anti-Pattern 2: New pixel-diff dependency

**What people do:** Reach for Percy/Chromatic-as-a-service/`pixelmatch` as a standalone package for the visual regression suite.
**Why it's wrong:** `@playwright/test` v1.59 is already installed and ships `toHaveScreenshot()` — a complete, zero-additional-dependency screenshot-diff mechanism that already integrates with the existing `playwright.config.ts` and CI invocation (`npm run test:e2e`). `@chromatic-com/storybook` is already installed for a different purpose (Storybook, not E2E) and should not be conflated with this suite.
**Do this instead:** Use `toHaveScreenshot()` in new `e2e/` specs. Only reach for an external service if the team later wants cross-browser/cross-OS diffing or a hosted review UI — not needed for a single-Windows-desktop-app POS.

### Anti-Pattern 3: Bundling a shared/ui primitive change with a payment-page consumer change in one PR

**What people do:** Edit `PageContainer` and `PaymentModal`/`pos/index.tsx` together because "it's all the same layout fix."
**Why it's wrong:** If a regression appears in the payment flow, you can't tell whether the shared primitive or the page-level swap caused it, and you've coupled a zero-risk shared/ui change to a payment-critical page in the same review/rollback unit.
**Do this instead:** Land and verify shared/ui primitive changes (with Storybook stories + unit tests, per existing convention) in their own PR first. Only then touch consuming pages, one PR per page or small page-group, payment-critical pages last and isolated.

### Anti-Pattern 4: Treating `entities/` or `shared/` as drift-audit targets

**What people do:** Run the raw-`<button>` grep across all of `src/` including `entities/` and `shared/ui/` itself.
**Why it's wrong:** `shared/ui/button.tsx` *is* the shadcn primitive — it necessarily contains a raw `<button>` internally; flagging it as "drift" is a false positive. `entities/` is data-model layer with minimal, mostly non-drift-relevant UI.
**Do this instead:** Scope the audit to `pages/`, `widgets/`, `features/` only, exactly as stated in the milestone context.

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `pages/* ↔ shared/ui/PageContainer` | Direct import (already-legal FSD direction) | No new boundary; this is the same relationship 8 pages already have |
| `pages/* ↔ shared/ui/BackToHomeButton` (to be generalized) | Direct import | Generalizing its props is a non-breaking superset change |
| `scripts/audit-ui-drift.ts ↔ src/**` | Filesystem read only, no `import` | Lives outside the module graph entirely — cannot violate `eslint-plugin-boundaries` |
| `eslint.config.*` (drift-prevention rule) ↔ `src/pages,widgets,features` | Static analysis at lint time | Extends the existing `eslint-plugin-boundaries` setup rather than adding a second lint mechanism |
| `e2e/43+.spec.ts ↔ playwright.config.ts` | Config: `testDir`, `snapshotDir`/default, `mask`, `maxDiffPixelRatio` | Same config file the 22 existing specs use; no new project/config block needed |
| `PaymentModal`/`pos`/`payments` pages ↔ existing payment E2E specs (`05-payments`, `17-payment-pane`, `34-split-bill`, `35-refund`, `41-split-payment`, `42-tip-distribution`) | Regression gate | Every markup swap on these pages must keep these 6 specs green before/after — treat as the acceptance test for "visual-only, not functional" change |

## Rollout Order (risk-tiered, Q4)

| Tier | Pages / Work | Why this order |
|------|--------------|-----------------|
| 0 — Audit | `scripts/audit-ui-drift.ts` run across `pages/widgets/features`; no code changes | Zero risk, produces the fix backlog and confirms scope (already partially done above: 28 raw-button files, 8 raw-input files) |
| 1 — Primitives | Extend `PageContainer`, generalize `BackToHomeButton`, decide fate of `AppShell`/`AppNav`, add any new `shared/ui` primitive the audit surfaces | `shared/ui` has zero business logic and already requires Storybook coverage per `CLAUDE.md` — safest layer to change first, verifiable in isolation before any page uses it |
| 2 — Low-risk pages | `login`, `home`, `settings`, `staff`, `rbac`, `audit`, `waitlist`, `rappi`, `reports` | Read-heavy or admin-only, no direct money-mutation actions inline on the page itself; mostly static content, also the easiest first targets for the visual-regression suite (fewer live timers/realtime widgets) |
| 3 — Operational pages | `pool-tables`, `pool-table-status`, `inventory`, `kitchen-prep`, `kds`, `kds-bar` | Operationally important, real-time data present (pool timers, KDS boards), but not the direct payment-mutation path — good middle ground to prove the masking/threshold approach for visual regression on dynamic content before touching payments |
| 4 — Payment-critical, last | `pos`, `payments`, and widgets in the payment path: `PaymentModal`, `PaymentPane`, `TabDrawer`, `RefundsList`/`RefundsRegister`, `CajaDashboard` | Highest blast radius if a "pure markup" swap accidentally changes `type`/`disabled`/event-bubbling behavior on a checkout button. Rule for this tier: one page/widget per PR, visual-only changes verified against the 6 existing payment E2E specs before merge, new visual-regression specs for these pages added only after the masking/threshold pattern is proven stable in Tier 2/3 |

### Rollout Priorities

1. **First and cheapest win:** Tier 0 audit + Tier 1 primitive extension — no page touched yet, but the shell/back-button/audit tooling all exist and are verified before any page-level PR opens.
2. **Highest-value, lowest-risk fixes:** raw `<button>`/`<input>` swaps on Tier 2 pages — mechanical, high file count (28/8 across the whole app), builds reviewer confidence in the pattern before it's applied near money.
3. **Last and most careful:** Tier 4. Never combine a Tier 1 (primitive) change and a Tier 4 (payment page) change in the same PR (see Anti-Pattern 3).

## Sources

Grounded entirely in direct repository inspection (no external documentation needed — this is an internal architecture-integration question, not a library/framework question):
- `bar-pos/CLAUDE.md` — FSD layer rules, import direction, routes table (found stale: lists 13 routes, 17 are registered)
- `bar-pos/src/app/router.tsx` — actual registered routes (17)
- `bar-pos/src/pages/*/index.tsx` (all 17) — page shell patterns, spot-checked `home`, `pos`, `inventory`, `reports`, `pool-table-status`
- `bar-pos/src/shared/ui/AppShell.tsx`, `PageContainer.tsx`, `BackToHomeButton.tsx`, `POSButton.tsx` — existing layout/primitive inventory
- `bar-pos/src/widgets/AppNav/ui/AppNav.tsx` — confirmed dead/unused via `grep -rl`
- `bar-pos/tailwind.config.ts` — confirms CSS-variable-driven design tokens already in place (no new design system needed, matches `PROJECT.md` constraint)
- `bar-pos/playwright.config.ts` and `bar-pos/e2e/*.spec.ts` (22 files) — existing E2E suite structure, numbering convention, no visual regression currently present (`grep -rl "toHaveScreenshot" e2e` → none)
- `bar-pos/package.json` — confirms `@playwright/test` v1.59 and `@chromatic-com/storybook` already installed, no pixel-diff package present
- `.planning/PROJECT.md` — milestone scope, "no new design system" constraint

---
*Architecture research for: UI Standardization milestone (v2.2) integration with existing FSD*
*Researched: 2026-07-10*
