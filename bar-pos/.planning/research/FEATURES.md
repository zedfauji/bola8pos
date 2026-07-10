# Feature Research

**Domain:** UI standardization / design-system-enforcement pass for an existing touchscreen bar/restaurant POS
**Researched:** 2026-07-10
**Confidence:** MEDIUM-HIGH (grounded in codebase inventory + WCAG 2.2 official spec; ecosystem patterns for "enforcement, not redesign" milestones are well-trodden but sparsely documented as a named discipline)

## Codebase Grounding (why this isn't generic)

Before categorizing, what already exists (confirmed by reading the repo, not assumed):

- `src/shared/ui/` already has ~50 primitives: `POSButton` (44/56/72px touch sizes), `AppShell` (responsive sidebar shell), `PageContainer`, `SplitLayout`, `SectionHeader`, `MoneyDisplay`, `StatusBadge`, `DataTable`, `ConfirmDialog`, `FormField`, `EmptyState`, `LoadingSkeletons`, `PINKeypad`, etc. — plus Storybook stories for `ColorPalette`, `Spacing`, `Typography` (design tokens already have a visual reference, just maybe not enforced).
- `eslint-plugin-boundaries` already enforces FSD layer direction — this is the existing enforcement mechanism to extend, not a new tool to introduce.
- Storybook already has `@storybook/addon-a11y` installed (`package.json`) — a11y auditing infra exists, likely underused.
- Playwright `@playwright/test` v1.59 already installed and configured (`playwright.config.ts`) with `screenshot: 'on'` — native `toHaveScreenshot()` visual-diff capability exists out of the box, **no new library needed** for visual regression.
- 12 routes registered in `src/app/router.tsx`; each currently composes widgets independently — no confirmed single shared page-shell wrapper applied uniformly (worth auditing).
- `tailwind.config.ts` uses shadcn v4 `oklch()` CSS-variable tokens (`--background`, `--primary`, `--pos-accent`, `--pos-danger`, etc.) — tokens exist; the question is whether every widget/page consumes them vs. hardcoded hex/rgb values.

This grounds the milestone as **enforcement of existing conventions**, not invention of new ones. That framing drives every category below.

## Feature Landscape

### Table Stakes (Users Expect These)

These are the non-negotiable deliverables for any "UI consistency pass" milestone — skipping them means the milestone didn't actually happen.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Component inventory / audit | Can't enforce consistency without knowing what exists and where it's violated. Standard first step in every design-system-enforcement initiative (audit → gap list → fix). | LOW | Grep-based: find raw `<button>`, `<input>`, hardcoded hex colors, one-off `className="p-3 rounded"` patterns across all 12 routes. Output a checklist/table, not code. |
| Shared layout shell applied to all 12 routes | Users (bartenders/managers) build muscle memory around nav position, header height, back-button placement. Inconsistent shell across routes is the #1 visible "unpolished" signal. | MEDIUM | `AppShell.tsx` + `AppNav` widget already exist — verify/enforce every page in `src/pages/*` actually uses them instead of ad-hoc wrappers. |
| Component consistency (swap one-offs for `shared/ui` primitives) | Same control (button, badge, input, empty state) rendered differently on different screens erodes trust in the software — feels buggy even when functionally correct. | MEDIUM-HIGH | Mechanical but touches every page; `POSButton`, `StatusBadge`, `EmptyState`, `DataTable`, `FormField` already exist as the canonical targets. |
| Spacing/color token discipline | Tailwind + CSS-variable theme already defined (`tailwind.config.ts`); hardcoded `#hex` or arbitrary `p-[13px]` values silently break dark-mode theming and any future token change. | LOW-MEDIUM | Grep for hex codes and arbitrary Tailwind values (`className=".*\[[0-9]`) as the audit signal. |
| Touch-target size audit + fix | This is a touchscreen POS used behind a bar — undersized targets cause mis-taps during rush, direct revenue/order-accuracy impact. | MEDIUM | `POSButton` touch sizes (44/56/72px) already exist — audit finds raw `<button>`/icon-buttons below 44px CSS and swaps them in. |
| Focus-visible states on all interactive elements | Keyboard/hardware-scanner navigation (barcode guns, external keyboards common in POS hardware) and accessibility compliance both need visible focus, not just hover. | LOW-MEDIUM | Tailwind + shadcn `focus-visible:ring-*` utilities are already the project convention (see `button.tsx`) — audit for gaps, not new implementation. |
| Basic visual regression baseline (screenshot diff) | Any refactor of shared components risks silent visual breakage across 12 routes; manual QA doesn't scale. Table stakes for a milestone whose entire purpose is "don't change behavior, only appearance/consistency." | MEDIUM | Playwright `toHaveScreenshot()` — already installed, no new dependency. Needs baseline capture per route + CI wiring. |

### Differentiators (Competitive Advantage)

Not required to call the milestone "done," but raise the ceiling and reduce future drift.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Design tokens reference doc (not new tokens — documentation of existing ones) | Turns the informal `ColorPalette.stories.tsx` / `Spacing.stories.tsx` / `Typography.stories.tsx` Storybook stories into a canonical lookup so future PRs (human or AI-authored) don't reinvent spacing/color decisions. | LOW | Mostly writing — the tokens already exist in `tailwind.config.ts` + `index.css` variables; this is packaging, not design work. |
| Automated drift-detection lint rule (custom ESLint rule or `no-restricted-syntax`) | Prevents regression after the milestone ends — the codebase already leans on `eslint-plugin-boundaries` for FSD; extending that enforcement culture to UI primitives (e.g., ban raw `<button>` outside `shared/ui`, ban hex colors) fits existing tooling rather than adding a new system. | MEDIUM | Use `eslint-plugin-boundaries`'s custom rule support or simple `no-restricted-syntax` / `eslint-plugin-tailwindcss` (arbitrary-value warnings) — evaluate `eslint-plugin-tailwindcss` for the "no arbitrary values" rule before hand-rolling. |
| Visual regression as a CI gate (not just local baseline) | Elevates the Playwright screenshot suite from "nice local check" to "PR blocker" — catches regressions before merge instead of after. | MEDIUM | Depends on CI runner producing pixel-stable screenshots (font rendering, animation timing) — needs `--update-snapshots` workflow decided, and CI OS/GPU must match baseline capture environment or diffs will be noisy false positives. |
| Storybook a11y addon enforcement (already installed, likely not gated) | `@storybook/addon-a11y` is already a devDependency — turning on its CI-mode checks (`test-runner` with a11y assertions) is a near-zero-cost differentiator since the tool is already present. | LOW | Check current Storybook config for whether a11y checks currently just warn in the UI vs. run in `npm run test` — wiring is small if the addon is already installed. |

### Anti-Features (Commonly Requested, Often Problematic)

The single biggest risk on a milestone scoped "enforce existing conventions, no redesign" is scope creep back into a redesign. These are the traps.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Full visual redesign (new color palette, new layout paradigm) | "While we're touching every page anyway, let's also make it look better" | Explicitly out of scope per milestone framing; also 12-route redesign is a much larger, riskier change with no design spec input, and risks breaking muscle memory for bartenders mid-shift. | Ship consistency now; log redesign ideas as a future milestone candidate with actual design input. |
| New component library / design system tool (e.g., swap shadcn for another kit, add Storybook Chromatic, add a token-management SaaS) | "A real design system needs proper tooling" | The project already has shadcn/ui + Tailwind + Storybook fully wired; introducing a second UI kit or token pipeline mid-milestone creates exactly the inconsistency this milestone is meant to remove. Violates the "no new design system" framing directly. | Use only what's already installed: shadcn primitives, existing Tailwind tokens, existing Storybook addons (`addon-a11y`, `addon-docs`). |
| Changing UX flows while touching a page ("since I'm in `PosPage.tsx`, let me also reorder the checkout steps") | Tempting because the code is already open and context is loaded | Couples a pure-appearance milestone to behavior changes, which reintroduces E2E test risk across all 22 existing specs and defeats the "no redesign" scope boundary. Also makes visual-regression diffs meaningless (can't tell if a diff is "expected new layout" or "unintended change"). | Any UX flow change goes into a separate ticket/phase with its own E2E coverage plan. This milestone touches only markup/classes/component swaps, not logic or step order. |
| Pixel-perfect 1:1 screenshot matching across all OS/browser/DPI combinations | Sounds like "real" visual regression coverage | Font rendering, subpixel AA, and GPU differences between local dev machines and CI runners make cross-environment pixel-perfect diffing high-maintenance and flaky — teams commonly abandon visual regression suites entirely after chasing false positives. | Run Playwright screenshot diffs in a single consistent environment (CI Docker image or one dedicated machine), with a documented tolerance threshold (`maxDiffPixelRatio`), matching the project's existing Playwright config discipline (single `chromium` project, `workers: 1`). |
| Building a brand-new custom "design token linter" from scratch | Feels like the "proper" enforcement solution | The codebase's own laziness ladder applies here too: an off-the-shelf ESLint plugin (or a handful of `no-restricted-syntax` regex rules) covers 90% of drift detection (hex colors, arbitrary Tailwind values, raw HTML elements) without maintaining a custom AST tool. | Prefer `eslint-plugin-tailwindcss` + `no-restricted-syntax` additions to the existing `eslint.config.*` over a bespoke rule engine. |

## Feature Dependencies

```
Component inventory / audit
    └──requires──> (nothing — read-only grep/scan of existing codebase)

Shared layout shell applied to all 12 routes
    └──requires──> Component inventory / audit (must know which pages deviate before fixing them)

Component consistency (swap one-offs)
    └──requires──> Component inventory / audit
    └──requires──> Shared layout shell (fixing shell first avoids re-touching the same files twice)

Spacing/color token discipline
    └──requires──> Component inventory / audit

Touch-target size audit + fix
    └──requires──> Component inventory / audit
    └──enhances──> Component consistency (same pass, same files — bundle these two)

Focus-visible states
    └──enhances──> Component consistency (same pass)

Visual regression baseline (Playwright screenshots)
    └──requires──> Component consistency, Shared layout shell, Spacing/color fixes to be DONE FIRST
    (baseline must be captured against the corrected UI, not the pre-fix state — capturing
     "before" screenshots as the frozen baseline would lock in the inconsistencies this
     milestone exists to remove)

Design tokens reference doc
    └──enhances──> Spacing/color token discipline (documents what the audit already fixed)

Automated drift-detection lint rule
    └──requires──> Component consistency, Spacing/color token discipline (rules should encode
                    the end-state convention, written after the codebase actually conforms —
                    otherwise the linter has hundreds of pre-existing violations on day one)

Visual regression as CI gate
    └──requires──> Visual regression baseline (local-only)
```

### Dependency Notes

- **Visual regression baseline requires the fix passes to be done first:** capturing Playwright screenshots before the consistency pass just freezes the current inconsistencies as "correct." Sequence the audit + fixes as earlier phases, screenshot baseline capture as a later phase.
- **Touch-target + focus-visible enhance component consistency rather than gating it:** these three touch the same files (shared/ui swaps), so bundling them into one phase avoids re-opening files twice — but conceptually they're independent checks, not a hard dependency chain.
- **Drift-detection lint rule requires the codebase to already conform:** turning on a strict ESLint rule before the fix pass means it fails on every existing violation, which is either a wall of pre-existing errors to `eslint-disable` (defeats the purpose) or a blocked CI. Land the fixes first, then add the guardrail.
- **CI gate for visual regression depends on a stable local baseline first:** flaky CI screenshot diffs (font/GPU variance) are the most common reason visual regression suites get disabled — validate stability locally/in one CI run before making it a merge-blocking gate.

## MVP Definition

Given this is a scoped milestone (not a product MVP), "Launch With" = the deliverables that make the milestone claim true; "Add After" = differentiators that raise durability; "Future" = explicitly deferred to avoid scope creep.

### Launch With (v2.2 milestone)

- [ ] Component inventory / audit across all 12 routes — establishes the actual gap list, nothing else can be scoped without it
- [ ] Shared layout shell (`AppShell` + `AppNav`) verified/applied consistently on all 12 routes
- [ ] Component consistency pass — swap one-off markup for `shared/ui` primitives (`POSButton`, `StatusBadge`, `EmptyState`, `DataTable`, `FormField`, etc.)
- [ ] Spacing/color token discipline — remove hardcoded hex/arbitrary values, use theme tokens
- [ ] Touch-target audit + fix to WCAG 2.2 SC 2.5.8 minimum (24×24 CSS px) with POS-appropriate targets (see Accessibility section below)
- [ ] Focus-visible states verified on all interactive elements
- [ ] Playwright screenshot-diff baseline captured for all 12 routes (local/CI, post-fix)

### Add After Validation (v2.x)

- [ ] Design tokens reference doc — write once the audit/fix pass has stabilized what the tokens actually are in practice
- [ ] Automated drift-detection lint rule(s) — add once the codebase conforms, to prevent regression
- [ ] Visual regression suite promoted to a CI merge-gate — once local baseline proves stable (low flake rate) across a few runs

### Future Consideration (v3+ / explicitly deferred)

- [ ] Full visual redesign — explicitly out of scope for this milestone; revisit only as its own scoped initiative with design input
- [ ] Cross-browser/cross-OS visual regression matrix — the app is a single-platform Tauri/Windows desktop app; multi-browser diffing has no product justification here
- [ ] New component library / token-management tooling — no evidence of need; current shadcn+Tailwind stack is sufficient

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| Component inventory / audit | HIGH (unblocks everything) | LOW | P1 |
| Shared layout shell consistency | HIGH | MEDIUM | P1 |
| Component consistency pass | HIGH | MEDIUM-HIGH | P1 |
| Touch-target audit + fix | HIGH (operational risk on touchscreen) | MEDIUM | P1 |
| Spacing/color token discipline | MEDIUM | LOW-MEDIUM | P1 |
| Focus-visible states | MEDIUM | LOW-MEDIUM | P1 |
| Visual regression baseline | MEDIUM (protects future work) | MEDIUM | P1 |
| Design tokens reference doc | LOW-MEDIUM | LOW | P2 |
| Automated drift-detection lint | MEDIUM (prevents regression) | MEDIUM | P2 |
| Visual regression CI gate | MEDIUM | MEDIUM (flake risk) | P2 |
| Full redesign | — | HIGH | P3 (out of scope) |

**Priority key:**
- P1: Must have — makes the milestone's own stated goal true
- P2: Should have — durability/regression-prevention, can slip to a follow-up phase without invalidating the milestone
- P3: Explicitly out of scope for this milestone

## Accessibility / Touch-Target Standards for Bar-Restaurant POS Touchscreens

This is domain-specific guidance, not generic web a11y — a POS behind a bar has different failure modes than a marketing website: wet/gloved hands, dim/uneven bar lighting, rushed taps during service, staff standing (not seated close to the screen).

| Standard | Value | Source / Confidence | POS-specific notes |
|----------|-------|----------------------|---------------------|
| WCAG 2.2 SC 2.5.8 Target Size (Minimum) — Level AA | 24×24 CSS px minimum, with a spacing exception (undersized targets need a 24px-diameter exclusion circle from neighbors) | HIGH — official W3C spec, [Understanding SC 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | This is the **legal minimum floor**, not the target for this app. Treat 24×24 as "never go below," not "aim for." |
| WCAG 2.5.5 Target Size (Enhanced) — Level AAA | 44×44 CSS px, no spacing exception | HIGH — official spec | This app's `POSButton` `default` size (44px) already meets AAA, not just AA — codebase convention is already ahead of the legal minimum. Keep it that way; don't let the audit "fix" things down to 24px just because it's compliant. |
| Apple HIG touch target | 44×44 pt | MEDIUM — industry convention, widely cited | Matches this codebase's existing `POSButton` `default` size — treat 44px as the floor for this app's touchscreen, not 24px. |
| Material Design touch target | 48×48 dp | MEDIUM — industry convention | Close to the 44px floor; not a hard requirement here since the app isn't Material-themed, but reinforces 44px+ as industry-standard for touch, well above the WCAG AA legal minimum. |
| Recommended floor for THIS app | **44px minimum for all interactive elements**, 56px for frequent-action buttons (add item, confirm), 72px for critical/rare high-stakes actions (process payment, void order, close tab) | MEDIUM — synthesized from existing `POSButton.tsx` comments + industry standards; not independently re-derived, but the existing convention already encodes the right reasoning (bartender use, primary-action emphasis) | The codebase's own `POSButton` doc comment already states this design intent correctly — the "standardization" work here is enforcement (finding raw `<button>` / `<Button>` usages below these sizes), not invention. |
| Gloved/wet-hand tolerance | No formal WCAG number exists; general guidance from POS/kiosk hardware vendors is to bias toward the higher end of touch-target ranges (44–56px+) and increase spacing between adjacent targets, not just target size | LOW — no single authoritative spec found; this is a domain inference, flag for validation if the team wants a harder number | Practical implication: prefer the `large` (56px) `POSButton` variant over `default` (44px) for any control likely to be tapped mid-rush (item grid buttons, quantity steppers) — reserve 44px only for secondary/rarely-used controls (settings toggles, filters). |
| Spacing between adjacent targets | WCAG 2.5.8's spacing exception effectively requires ~24px minimum center-to-center clearance for sub-24px targets; best practice for touch UIs generally recommends ≥8px gaps between 44px+ targets to avoid mis-taps | MEDIUM | Audit should check `gap-*` / margin utilities between adjacent buttons in grids (e.g., product grid, quantity controls), not just individual target size. |
| Focus visibility under bar lighting | No WCAG-specific "bar lighting" criterion exists (WCAG 1.4.11 Non-text Contrast requires 3:1 contrast for UI component boundaries/focus indicators against adjacent colors, Level AA) | HIGH for the underlying 1.4.11 requirement, LOW for "bar lighting" as a distinct researched category — flag for validation | Practically: this app is dark-mode-default (`darkMode: 'media'`) which already helps in dim environments, but low-contrast focus rings (thin, low-opacity) that look fine on a calibrated dev monitor can become invisible under harsh/uneven bar lighting or on lower-quality POS touchscreen hardware. Audit should check `focus-visible:ring-*` opacity/width against the `--ring` token, not just presence — prefer a visibly thick (2px+), high-contrast ring over the shadcn default subtle ring for primary action buttons. |
| Keyboard/scanner focus order (not just touch) | WCAG 2.4.3 Focus Order (Level A) — still relevant even on a touch-primary app, since POS hardware commonly pairs with barcode scanners (keyboard-emulation) and staff sometimes use an external keyboard for PIN/search entry | HIGH | Verify `PINKeypad`, `SearchInput`, and form fields have a sane tab order per page — this is a low-cost check to bundle into the same audit pass since `Storybook addon-a11y` already flags focus-order issues per component. |

**Practical recommendation for the audit checklist:** treat 44px as the app-wide floor (not WCAG's 24px legal minimum), reserve 56–72px for high-frequency or high-stakes actions per the existing `POSButton` convention, verify focus rings are high-contrast/thick rather than the shadcn default subtle style, and use `@storybook/addon-a11y` (already installed) to catch contrast/focus-order violations at the component level before they reach the full-page visual regression suite.

## Sources

- Codebase inspection: `src/shared/ui/` (component inventory), `src/shared/ui/README.md` (FSD placement rules), `src/shared/ui/AppShell.tsx`, `src/shared/ui/POSButton.tsx`, `tailwind.config.ts`, `playwright.config.ts`, `package.json`, `.planning/PROJECT.md`, `CLAUDE.md` — HIGH confidence, primary source
- [W3C WAI — Understanding SC 2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) — HIGH confidence, official spec
- [wcag22aa.org — Target Size (Minimum) SC 2.5.8](https://wcag22aa.org/new-criteria/target-size/) — MEDIUM confidence, secondary summary, cross-checked against W3C
- [WCAG.com — 2.5.8 Target Size Minimum (Level AA)](https://www.wcag.com/developers/2-5-8-target-size-minimum-level-aa/) — MEDIUM confidence, cites Apple HIG 44×44pt / Material 48×48dp figures, cross-checked against general industry knowledge
- Apple HIG / Material Design touch-target conventions — MEDIUM confidence, widely-cited industry standards, not independently re-verified against current Apple/Google docs this session
- "Gloved/wet-hand" tolerance and "bar lighting focus visibility" — LOW confidence, no dedicated spec found; flagged explicitly above as inference, not fact

---
*Feature research for: UI standardization milestone (v2.2), bar/restaurant POS touchscreen app*
*Researched: 2026-07-10*
