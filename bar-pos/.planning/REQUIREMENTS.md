# Requirements — Milestone v2.2: UI Standardization

Scoped from `.planning/research/SUMMARY.md`. Enforcement of existing shadcn/Tailwind conventions across all 17 routes — no new design system, no visual redesign, no UX flow changes.

## v2.2 Requirements

### Audit

- [ ] **AUDIT-01**: A drift audit exists identifying every raw `<button>`/`<input>`, hardcoded hex color, and arbitrary-value Tailwind class across `pages/`, `widgets/`, `features/` (17 routes)
- [ ] **AUDIT-02**: Audit output is a checklist/backlog mapped to specific files, usable to scope subsequent fix phases

### Shell

- [x] **SHELL-01**: Every route uses a single shared layout shell (`PageContainer` extended with `backTo`/`backLabel`) instead of ad-hoc per-page wrappers
- [x] **SHELL-02**: Dead `AppShell`/`AppNav` components (zero real consumers) are removed, not resurrected
- [x] **SHELL-03**: `CLAUDE.md` routes table is corrected to match the router's actual 17 registered routes

### Token

- [ ] **TOKEN-01**: Hardcoded hex/rgb color values in `pages/widgets/features` are replaced with existing Tailwind CSS-variable tokens (`--background`, `--primary`, `--pos-accent`, `--pos-danger`, etc.)
- [ ] **TOKEN-02**: Arbitrary-value spacing classes (e.g. `p-[13px]`) are replaced with the existing Tailwind spacing scale

### Component

- [ ] **COMPONENT-01**: Raw `<button>` elements outside `shared/ui` are replaced with `POSButton` (or the correct shared primitive)
- [ ] **COMPONENT-02**: Raw `<input>` elements outside `shared/ui` are replaced with the correct shared form primitive (`FormField`, `MoneyInput`, etc.), except where a signed-delta/no-clamp field intentionally opts out (documented pattern from Phase 17)
- [ ] **COMPONENT-03**: Duplicate one-off components that shadow an existing `shared/ui` primitive (e.g. the `pool-table-status` hand-rolled back button) are removed in favor of the shared primitive
- [ ] **COMPONENT-04**: Payment-critical surfaces (POS, payments, split-payment, refund, tip-distribution) receive only markup/class-level swaps — zero prop/handler/validation behavior change, verified by existing E2E specs (`05-payments`, `41-split-payment`, `42-tip-distribution`, `06-transfer`, `09-rbac`) passing unchanged

### Touch

- [ ] **TOUCH-01**: All interactive elements meet a 44px minimum touch target (app floor, above WCAG's 24px legal minimum)
- [ ] **TOUCH-02**: Frequent-action controls (add item, confirm) use the 56px `POSButton` size; critical/rare high-stakes actions (process payment, void order, close tab) use the 72px size
- [ ] **TOUCH-03**: Adjacent touch targets in grids (product grid, quantity steppers) maintain adequate spacing to avoid mis-taps

### Focus

- [ ] **FOCUS-01**: All interactive elements have a visible `focus-visible` state using the existing `--ring` token
- [ ] **FOCUS-02**: Primary action buttons use a higher-contrast/thicker focus ring than the shadcn default subtle ring
- [ ] **FOCUS-03**: Tab order across forms and keypad/search inputs (`PINKeypad`, `SearchInput`) is verified sane for keyboard/barcode-scanner input

### Visual

- [x] **VISUAL-01**: A Playwright visual-regression config exists, isolated from the existing functional E2E config (headless, bundled Chromium, no `slowMo`)
- [x] **VISUAL-02**: Screenshot baselines are captured for all 17 routes, only after the audit/shell/component/token/touch/focus fixes are complete (not before — a pre-fix baseline would freeze current inconsistencies)
- [x] **VISUAL-03**: Dynamic/live regions (timers, realtime KDS boards, toasts) are masked or excluded from diffing to avoid flaky screenshots

### Docs

- [x] **DOCS-01**: A design tokens reference doc exists, documenting the existing color/spacing/typography tokens already defined in `tailwind.config.ts` and `index.css` (no new tokens invented)

### Lint

- [ ] **LINT-01**: A drift-detection lint rule (via `eslint-plugin-tailwindcss` and/or `no-restricted-syntax`) is added to prevent regression, added only after the codebase conforms (post-fix, not pre-fix, to avoid a wall of pre-existing violations)

## Future Requirements (Deferred)

- Visual regression suite promoted to a CI merge-gate — deferred until local baseline proves stable across multiple runs (CI currently runs no E2E at all)
- Storybook `addon-a11y` CI enforcement — already installed but not wired into `npm run test`; nice-to-have, not blocking this milestone

## Out of Scope

- Full visual redesign (new color palette, new layout paradigm) — explicitly excluded by milestone framing; revisit only as its own scoped initiative with design input
- New component library / design-system tooling (swap shadcn, add Chromatic/Percy/token SaaS) — violates "no new design system"; existing `@chromatic-com/storybook` devDependency stays unused
- UX flow changes bundled into appearance fixes (e.g. reordering checkout steps while touching `PosPage.tsx`) — couples a pure-appearance milestone to behavior risk; any flow change is its own ticket
- Cross-browser/cross-OS visual regression matrix — single-platform Tauri/Windows desktop app, no product justification
- Gloved/wet-hand and bar-lighting-specific hardware validation — no authoritative spec exists; flagged for real-world feedback during rollout, not a milestone deliverable

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUDIT-01 | Phase 29 | Pending |
| AUDIT-02 | Phase 29 | Pending |
| SHELL-01 | Phase 30 | Complete |
| SHELL-02 | Phase 30 | Complete |
| SHELL-03 | Phase 30 | Complete |
| TOKEN-01 | Phase 31 | Pending |
| TOKEN-02 | Phase 31 | Pending |
| COMPONENT-01 | Phase 31 | Pending |
| COMPONENT-02 | Phase 31 | Pending |
| COMPONENT-03 | Phase 31 | Pending |
| TOUCH-01 | Phase 32 | Pending |
| TOUCH-02 | Phase 32 | Pending |
| TOUCH-03 | Phase 32 | Pending |
| FOCUS-01 | Phase 32 | Pending |
| FOCUS-02 | Phase 32 | Pending |
| FOCUS-03 | Phase 32 | Pending |
| COMPONENT-04 | Phase 33 (E2E gate closed by Phase 33.1) | Complete |
| VISUAL-01 | Phase 34 | Complete |
| VISUAL-02 | Phase 34 | Complete |
| VISUAL-03 | Phase 34 | Complete |
| DOCS-01 | Phase 35 | Complete |
| LINT-01 | Phase 35 | Pending |

**Coverage:** 22/22 v2.2 requirements mapped. No orphans, no duplicates.
