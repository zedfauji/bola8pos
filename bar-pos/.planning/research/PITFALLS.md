# Pitfalls Research: UI Standardization on a Live Payment-Critical POS

**Domain:** Retrofitting UI consistency/design-system enforcement onto an existing, shipping Tauri+React+Supabase POS (22 E2E specs, 1100+ unit tests, RBAC-gated multi-role UI, offline queue, realtime subscriptions)
**Researched:** 2026-07-10
**Confidence:** HIGH (grounded directly in this repo's code, config, and CLAUDE.md; MEDIUM/LOW flagged individually where based on general Playwright/a11y practice rather than repo inspection)

This is not generic "how to build a design system" advice. Every pitfall below was checked against this repo's actual `src/shared/ui/`, `playwright.config.ts`, `.github/workflows/ci.yml`, and `tsconfig` settings.

## Critical Pitfalls

### Pitfall 1: "Standardize on Button" silently shrinks touch targets below the POS minimum

**What goes wrong:**
`src/shared/ui/button.tsx` (shadcn base) has `size: 'default'` at `h-8` (32px) and `sm` at `h-7` (28px) — both well under the 44px touch-target minimum. `src/shared/ui/POSButton.tsx` exists specifically to fix this: it wraps `Button` and adds `min-h-[44px]/[56px]/[72px]` via a `touchSize` prop, and is already used in 50 files. A "standardization" pass that sees two button components and — in the name of consistency — collapses `POSButton` usages back into plain `Button` (or removes `touchSize` because "the base Button should be enough") silently regresses every converted screen from a 44–72px tap target to 28–32px. This is not hypothetical — it is the single most likely "consistency win" someone proposes when they first grep for `POSButton` vs `Button` and conclude one is redundant.

**Why it happens:**
Standardization instinct treats "two components doing similar things" as automatically duplicative. But `POSButton` isn't visual duplication — its whole purpose is compensating for the shadcn base's non-POS-appropriate default sizing. Nobody who wasn't told this will know that from reading the component names alone.

**How to avoid:**
- Treat `POSButton` as the canonical interactive control for anything on a touchscreen order/payment/pool-table surface. `Button` (bare shadcn) is only for desktop-density surfaces (Settings, RBAC admin, Reports tables) where mouse/keyboard is the primary input.
- Any diff that removes a `touchSize` prop, or replaces `POSButton` with `Button`, must be treated as a behavior change requiring explicit sign-off — not a mechanical "consistency" edit.
- Add (or reuse) a lint/CI check: grep for `<Button` inside `pos/`, `pool-tables/`, `kds-bar/`, `kitchen-prep/`, `waitlist/`-scoped widgets/features and flag it for review, since those are the touchscreen-primary surfaces.

**Warning signs:**
- PR diff replaces `POSButton` with `Button` and the diff description says "consistency" with no mention of touch-target size.
- New Storybook snapshot for a button shrinks in pixel height between before/after.
- Visual regression baseline diff shows a button's bounding box getting smaller — this should fail review, not just visual review.

**Phase to address:** The phase that does component-swap/consistency sweeps on POS-primary surfaces (order entry, pool tables, payment, KDS). Should ship *after* the a11y/touch-target audit phase defines which surfaces are touch-primary, not before.

---

### Pitfall 2: Playwright visual regression baselines won't reproduce between the existing local config and CI

**What goes wrong:**
`playwright.config.ts` currently runs with `channel: 'chrome'` (the machine's real installed Chrome, not Playwright's bundled Chromium), `headless: false`, and `slowMo: 400` (`slowMo: 0` only under `FAST_E2E=1`). `.github/workflows/ci.yml` only runs `typecheck` / `lint` / `test` (Vitest) on `ubuntu-latest` — it does **not** run `npm run test:e2e` at all today; E2E is manual, per CLAUDE.md ("`npm run test:e2e` is run manually before releases"). If a new visual-regression suite is bolted onto this same Playwright project and someone later wires it into CI, screenshots captured locally (Windows, real Chrome, whatever version happens to be installed, real GPU/ClearType font rendering) will never byte-for-byte match screenshots captured in CI (Linux, no `channel: 'chrome'` available unless explicitly installed, different font substitution, different subpixel rendering). Every visual test will show 100% diff on first CI run, or CI won't be able to launch `channel: 'chrome'` at all if the runner doesn't have Chrome (only Playwright's bundled Chromium is guaranteed present).

**Why it happens:**
The existing Playwright config was tuned for interactive local debugging (`headless: false`, real Chrome for the actually-installed WebView2/Chrome parity, `slowMo` for human-watchable runs) — reasonable for functional E2E, disastrous for pixel-diff visual regression, which requires a hermetic, versioned, headless renderer.

**How to avoid:**
- Put visual-regression specs in their own Playwright *project* (not the existing `chromium`/`channel: 'chrome'` project) that pins Playwright's bundled Chromium (no `channel` override), forces `headless: true`, disables `slowMo`, and fixes viewport/DPR explicitly.
- Generate and commit baseline screenshots from the *same environment that will run diffs* — i.e., either always run visual regression in CI (Linux container) and never trust locally-generated baselines, or run visual regression in a pinned Docker image locally too (`mcr.microsoft.com/playwright:vX.Y.Z-noble`) so local and CI agree.
- Decide now: is visual regression a CI gate or a manual-before-release check (like the rest of E2E currently is)? Given CI today doesn't even run functional E2E, the pragmatic default is manual/local-triggered visual regression run against a pinned container, not a new CI gate — matches existing project posture and avoids a second flaky gate.
- Use `maxDiffPixelRatio`/threshold tolerances, not exact-match, and document the tolerance rationale per screenshot.

**Warning signs:**
- First CI run of the new suite shows every single screenshot failing (100% mismatch) — this is the tell that baselines were generated in an unpinned/local environment.
- `channel: 'chrome'` errors ("executable doesn't exist") on a fresh CI runner.

**Phase to address:** The phase that stands up the Playwright visual-regression suite — must decide project/browser isolation *before* generating any baseline, not retrofit it after baselines already exist (baselines generated wrong have to be entirely regenerated).

---

### Pitfall 3: Visual regression flakes on live/dynamic data this app intentionally has everywhere

**What goes wrong:**
This POS has multiple always-moving UI elements by design: `TimerDisplay`/`LiveTimeDisplay` (pool session timers), realtime Supabase subscriptions updating tabs/orders/inventory live, `OfflineBanner`/`ClockDriftBanner` that can appear/disappear based on connection state, toasts (`VersionConflictToast`), and seeded dev data that isn't guaranteed byte-identical run to run (timestamps, IDs, relative "time ago" displays). A visual-regression screenshot of `/pool-tables` or `/pos` taken against live/seeded data will differ every run purely from a ticking clock or a realtime push, producing "flaky" failures that have nothing to do with a real UI regression — the team will start ignoring red visual-diff results within a few weeks (alert fatigue), defeating the suite's purpose.

**Why it happens:**
Functional E2E specs already work around this somewhat (assertions on structure/text, not pixels), but visual-diff testing is pixel-literal — anything that moves, even a `TimerDisplay` ticking from `00:05:12` to `00:05:13` between snapshot-capture and comparison, is a diff.

**How to avoid:**
- Screenshot only deterministic, static views: empty states, component-level Storybook-driven snapshots (preferred), or full-page screenshots taken against a frozen/seeded fixture with realtime disabled and the system clock mocked (`page.clock` in Playwright, or freeze via test fixture).
- Mask dynamic regions explicitly with Playwright's `mask: [locator]` option (timers, live badges, toasts, "last updated" text) rather than trying to eliminate all dynamism.
- Prefer Storybook + `@storybook/test-runner` or Chromatic-style component-level screenshots for `shared/ui` primitives (stable, isolated, no realtime/timers involved) over full-page app screenshots for anything with a `TimerDisplay`/realtime feed. Reserve full-page Playwright visual diffs for layout/nav-shell consistency checks on pages without live timers (Settings, RBAC, Reports, Login) — exactly the pages this milestone is fixing for layout consistency anyway.
- Disable CSS animations/transitions globally for visual-test runs (`* { animation: none !important; transition: none !important; }` injected via `page.addStyleTag`) — the `POSButton` `active:scale-95 transition-transform` and various shadcn transition classes will otherwise cause timing-dependent capture differences.

**Warning signs:**
- Visual diff failures that pass on re-run with no code change (classic flake signature).
- Diffs concentrated around timer/clock/badge regions rather than the component actually being changed.

**Phase to address:** Same phase as Pitfall 2 (Playwright visual-regression suite setup) — masking/determinism strategy is a suite-design decision, not a per-test patch applied later.

---

### Pitfall 4: Snapshot maintenance burden turns the new suite into a rubber-stamp

**What goes wrong:**
Every legitimate UI change in this standardization milestone (and every future feature) requires regenerating and re-reviewing screenshot baselines. With 17 routes and component-level shots for `shared/ui` primitives, the visual suite can easily reach 50-150+ baseline images. If baseline updates are approved via `npx playwright test --update-snapshots` and committed without a human actually looking at the diff image, the suite becomes a no-op that "passes" regardless of what changed — worse than no suite, because it gives false confidence.

**Why it happens:**
Bulk `--update-snapshots` is the path of least resistance under deadline pressure, and reviewing dozens of PNG diffs in a PR is tedious compared to reading a text diff.

**How to avoid:**
- Keep the visual suite deliberately small and high-value: component-level snapshots for `shared/ui` primitives (the actual subject of this milestone) plus a handful of full-page "layout shell" snapshots per route family, not one screenshot per route per role per state.
- Require the PR description/checklist to name *which* baselines changed and why, whenever `--update-snapshots` is used — reuse the existing PR/commit convention (`test(...)`) to flag baseline-only commits distinctly from behavior commits.
- Store the visual report artifact (Playwright HTML report with diff images) as a CI/local artifact reviewers actually open, not just a pass/fail badge.

**Warning signs:**
- Baseline PNGs churn in nearly every PR with no reviewer comment on the actual image diff.
- `git log --stat` on the snapshot directory shows frequent updates with commit messages like "update snapshots" and nothing else.

**Phase to address:** Suite-design phase (same as Pitfall 2/3) should scope snapshot count deliberately; ongoing discipline enforced via PR review, not a later phase.

---

### Pitfall 5: Touch-target and focus-order changes break bartender muscle memory and PIN-pad keyboard flow

**What goes wrong:**
Two related but distinct risks:
1. **Muscle memory:** Bartenders operate this system fast, under pressure, often glancing at the screen only briefly. If an a11y/touch-target pass *moves* a button (not just resizes it) — e.g., reordering action buttons in `OrderPanel` or the `PINKeypad` to satisfy some abstract "consistency" ordering, or changing a button from `variant="destructive"` styling in one place but not a visually-identical action elsewhere — staff will mis-tap during a live shift. This is a real operational cost (wrong item voided, wrong payment method selected) that a generic web app would not have.
2. **Focus order / keyboard nav:** `PINKeypad` and `ManagerPinGate` almost certainly rely on a specific tab order or numeric-input flow for fast PIN entry. A change to DOM order, added wrapper `div`s, or new `tabIndex` values to "fix" a11y tree consistency elsewhere in a shared layout component can silently break the numeric keypad's expected focus sequence, or make Enter/Tab submit in a different order than staff expect.

**Why it happens:**
A11y and touch-target fixes are usually validated against WCAG success criteria (target size, focus visibility, contrast) in isolation, per component — not against the *learned sequence* of an experienced operator using the whole app blind-touch. Automated a11y tools (axe, Lighthouse) will happily pass a reordered layout that is technically compliant but operationally worse.

**How to avoid:**
- For touch-target fixes, prefer *growing hit area without moving visual position* (padding/`min-h`/`min-w` increases, invisible hit-slop) over repositioning or reordering interactive elements.
- Treat `PINKeypad`, `POSButton` order-entry grids, and pool-table action buttons as "layout-frozen" — a11y/touch fixes here should be sizing/contrast/label fixes only, not structural reflow, unless explicitly signed off with a note that operational muscle memory is being intentionally changed.
- Add/extend E2E coverage (or a lightweight interaction test) that asserts the *relative order* of primary action buttons (e.g., "Process Payment" is rightmost/primary position) survives the standardization pass, not just that the buttons still exist.
- For keyboard/focus-order changes, manually re-walk `PINKeypad`/login/manager-gate flows with Tab/Enter after any shared-layout wrapper change — automated a11y tools won't catch a functional focus-order regression, only a structural violation.

**Warning signs:**
- A PR touches `PINKeypad.tsx`, `manager-pin-gate/`, or the primary action row in `OrderPanel`/payment sheets "for consistency" with no operational sign-off.
- Diff reorders JSX children of an existing interactive row instead of only touching `className`.

**Phase to address:** The a11y/touch-target consistency phase — should explicitly scope itself to sizing/contrast/labeling and call out layout-frozen zones before starting, not discover this mid-phase.

---

### Pitfall 6: "Standardization" scope creep turns into silent behavior changes on payment-critical flows

**What goes wrong:**
The most dangerous failure mode for this milestone specifically: a developer opens `PaymentForm`, `SplitTabSheet`, or `RefundSheet` to swap a one-off `<input>` for the shared `MoneyInput`/`FormField` primitive "for consistency," and in doing so changes validation behavior, rounding, default values, or `disabled`/`required` semantics — because the shared primitive doesn't have identical edge-case behavior to the bespoke one it replaces. On a payment/split/refund/tip-distribution surface, a subtle validation or rounding change is a money-correctness bug, not a cosmetic one — and this codebase already has hard-won atomicity/optimistic-concurrency guarantees (`process_split_payment_atomic`, `close_caja_session` version bump, largest-remainder tip allocation) that a component swap could bypass if the swap also touches the surrounding handler logic "while I'm in there."

**Why it happens:**
UI consistency PRs get scoped as "just swap the component" but touching a form's JSX almost always means touching the props/handlers wired to it, and it's tempting to "clean up" adjacent logic in the same diff. Reviewers reviewing for "does it look right" don't re-derive the money math.

**How to avoid:**
- Hard rule for this milestone: any file under `features/process-payment/`, `features/split-tab/`, `features/split-payment/`, `features/process-refund/`, `features/tip-distribution-config/`, or anything touching `caja` close logic is **out of scope** for pure UI-consistency PRs unless the change is purely `className`/wrapper-level with zero prop/handler changes. If a shared-primitive swap requires a behavior-relevant prop change on these files, it becomes its own reviewed change, not a UI-consistency line item.
- Every PR in this milestone should be checkable by "does `npm run test` + the relevant payment/split/refund/tip E2E specs (`05-payments`, `41-split-payment`, `42-tip-distribution`, `06-transfer`) still pass with zero test changes required?" If a UI-consistency PR requires editing assertions in those specs (beyond selector updates), that's a signal behavior moved, not just markup.
- Keep component-swap PRs small and single-purpose (one primitive, one or a few pages) so a behavior change is easy to spot in review — large multi-page sweeping diffs hide this kind of regression.

**Warning signs:**
- A "UI consistency" PR diff includes changes to a mutation hook, a Zod schema in `domain.ts`, an RPC call, or a numeric/rounding calculation.
- Existing payment/split/refund/tip E2E specs need behavioral (not just selector) assertion changes to pass.

**Phase to address:** Should be an explicit constraint stated at the start of the component-consistency phase(s), not discovered via a failing E2E spec later. Payment/caja/split/refund/tip surfaces should either be the *last* surfaces touched (after the pattern is proven safe elsewhere) or excluded entirely from this milestone and handled as a separate, narrowly-scoped follow-up.

---

### Pitfall 7: `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess` turn "harmless" shared-prop refactors into a wide, noisy typecheck break

**What goes wrong:**
Consolidating prop shapes across many consumers of a `shared/ui` primitive (e.g., unifying `Button`/`POSButton`/one-off button-like components onto one prop contract, or normalizing `FormField`/`MoneyInput` props) is exactly the kind of refactor that trips this project's strict TS settings at scale:
- **`exactOptionalPropertyTypes`**: if the "standardized" prop type declares `label?: string` and a widget passes `label={someOptionalVar}` where `someOptionalVar: string | undefined`, TS will now error at every call site that does this (assigning `undefined` explicitly to an optional prop is a type error under this flag) — even though the code "worked" before under the old, looser prop type. With `POSButton` used in 50 files, a prop-contract change that isn't `prop: T | undefined` (per CLAUDE.md's documented gotcha) can produce dozens of call-site errors in one commit.
- **`noUncheckedIndexedAccess`**: if standardization introduces array-driven rendering (e.g., mapping a shared `variants`/`sizes` config array, or a new `items[]` prop for a generalized list/table primitive) without checking bounds, every `array[i]` access is typed `T | undefined` and will fail typecheck at every new indexed access, not just the primitive itself.

**Why it happens:**
It's easy to prototype a new/unified shared component signature against one or two call sites, get it compiling, and only discover the other 48 call sites break typecheck when running the full `npm run typecheck` — by which point the "quick consistency PR" has ballooned into a 50-file mechanical fix-up commit that's hard to review for actual regressions vs. mechanical noise.

**How to avoid:**
- When changing a shared prop's type, run `npm run typecheck` against the *whole repo* before considering the primitive's own change done — don't trust "it compiles in Storybook" for a primitive used in 50 files.
- Follow the CLAUDE.md convention exactly: new/changed optional props on shared components should be `prop: T | undefined` (not `prop?: T`) when the value is routinely passed through from a mutation input or another optional variable — this avoids the exactOptionalPropertyTypes trap at the boundary.
- When introducing any new indexed array access as part of a "generalize this component" refactor, default to `.at(i)` + explicit undefined-check or `array[i] ?? fallback`, per the existing `noUncheckedIndexedAccess` convention already used elsewhere in the codebase — don't assume array bounds are safe just because the data "always" has N items.
- Land prop-contract changes to widely-consumed primitives (`Button`, `POSButton`, `FormField`, `MoneyInput`, `DataTable`) as their own commit/PR with `npm run typecheck` green across the whole repo, separate from the call-site migration PRs that follow — makes the mechanical fix-up reviewable as "just call-site updates" rather than mixed with the contract change itself.

**Warning signs:**
- `npm run typecheck` goes from clean to 20+ errors after touching a single `shared/ui/*.tsx` file — a strong signal the prop contract, not just the implementation, changed.
- New optional props added to a shared component use `prop?: T` instead of `prop: T | undefined`.

**Phase to address:** Any phase that changes a `shared/ui` prop contract (not just internal styling) should budget for a full-repo typecheck pass and treat contract changes as a distinct, reviewed step before call-site rollout begins.

---

### Pitfall 8: Component swaps silently break existing E2E selectors and RBAC-gated rendering paths

**What goes wrong:**
The 22 existing Playwright specs (`e2e/01-ci.spec.ts` … `e2e/42-tip-distribution.spec.ts`) locate elements by role/text/test-id tied to the *current* markup. Swapping a bespoke element for a shared primitive can change the rendered DOM shape enough to break selectors even when the visual result looks identical — e.g., a shadcn `Button` renders `data-slot="button"` / `data-variant` / `data-size` attributes that a hand-rolled button didn't have, or a swap from a native `<button>` to `asChild`/`Slot`-wrapped composition changes the accessible role or nesting. Separately, several primitives are RBAC-conditional (`ProtectedAction.tsx` exists specifically to gate rendering by role) — a "standardize this button" pass that wraps an already-role-gated action in a new shared primitive can accidentally double-wrap or drop the RBAC gate if the swap isn't careful about where `ProtectedAction` sits in the tree.

**Why it happens:**
Visual/structural refactors are validated by "does it look the same," which doesn't catch a changed `role`, dropped `data-testid`, or an RBAC wrapper that got flattened out during the swap.

**How to avoid:**
- Run the full existing E2E suite locally (or at minimum the specs touching the changed page/route) before and after each component-swap PR — `npm run test:e2e` per CLAUDE.md, not just `npm run test` (Vitest unit tests won't catch selector/DOM-shape regressions in E2E specs).
- Preserve existing `data-testid`/`aria-label` values exactly when swapping a component's implementation; if a new attribute naming convention is introduced as part of standardization, update it in the same PR as the E2E selectors that depend on it (not as a follow-up "someone will fix the tests" task).
- When a swapped primitive sits inside or near `ProtectedAction`/RBAC-gated code, explicitly re-run `e2e/09-rbac.spec.ts` for the affected page/role combination, not just the page's own primary spec.

**Warning signs:**
- E2E spec failures after a purely-visual-looking PR, especially `TimeoutError` waiting for a selector that used to resolve instantly.
- A component swap PR doesn't mention running `npm run test:e2e` at all.

**Phase to address:** Every component-swap phase should include "run affected E2E specs" as an explicit exit criterion, not rely on CI (which, per `.github/workflows/ci.yml`, does not currently run E2E at all — this is a manual gate the team must enforce itself for this milestone).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Bulk `--update-snapshots` without per-image review | Fast, unblocks CI/PR quickly | Visual suite becomes a rubber stamp; real regressions ship silently | Never for full-page/layout screenshots; borderline-acceptable only for a component-level snapshot where the PR diff is a one-line `className` change reviewers already read |
| Swapping `POSButton` → `Button` "because it's simpler" | Fewer components to maintain | Regresses touch targets on live bartender-facing screens | Never on touchscreen-primary surfaces (pos/pool-tables/kds-bar/kitchen-prep/waitlist); acceptable on desktop-density admin surfaces (Settings/RBAC/Reports) where mouse is primary input |
| Widening a shared prop type to `any`/loose union to silence a mass typecheck break from a prop-contract change | Unblocks the refactor immediately | Reintroduces the exact class of bug `exactOptionalPropertyTypes`/`noUncheckedIndexedAccess` exist to prevent, defeats CLAUDE.md's stated conventions | Never — fix call sites individually, even if it's 50 files |
| Skipping `npm run test:e2e` for a "purely visual" component-swap PR | Faster PR turnaround (E2E is already manual/slow per project convention) | Selector/RBAC regressions land undetected until manual pre-release E2E run, or worse, production | Acceptable only for changes proven not to touch DOM structure/attributes (pure Tailwind class/token changes with no markup change) |
| Reordering/repositioning interactive elements while "fixing" touch target size | Looks cleaner, satisfies an abstract grid/spacing rule | Breaks bartender muscle memory mid-shift; real operational cost, not just UX polish | Never on `PINKeypad`, primary order-entry action rows, or pool-table action buttons without explicit operational sign-off |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| Existing Playwright config (`playwright.config.ts`) | Adding visual-regression specs to the same `chromium`/`channel: 'chrome'` project used for functional E2E | Isolate visual regression in its own Playwright project pinned to bundled Chromium, headless, no `slowMo`, fixed viewport/DPR |
| GitHub Actions CI (`ubuntu-latest`, no E2E today) | Assuming CI will catch visual/E2E regressions from this milestone automatically | CI currently only runs typecheck/lint/unit test; visual + E2E remain manual gates for this milestone unless the team explicitly adds a new CI job (and if so, budget for Linux-specific baseline generation, see Pitfall 2) |
| Realtime Supabase subscriptions (Zustand stores) | Screenshotting a live page (`/pos`, `/pool-tables`) whose data can change mid-capture via a realtime push from another simulated terminal/session | Freeze/mock realtime for visual-regression fixtures, or restrict full-page visual diffs to static/empty-state views |
| Storybook (v10, required for `shared/ui`) | Treating Storybook and the new Playwright visual suite as two separate, uncoordinated sources of truth for "what the component should look like" | Prefer Storybook-driven component screenshots as the primary visual-regression source for `shared/ui` primitives (stable, no app-level realtime/router/auth dependencies); reserve Playwright full-page shots for layout/nav-shell consistency only |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| One full-page Playwright screenshot per route × per role × per state | Visual suite runtime balloons, CI/local run time grows past what anyone will wait for | Scope to layout-shell-level shots (nav/header/spacing) per route family, not full cartesian product of route×role×state | Becomes painful past ~30-40 full-page screenshots given `headless:false`/`slowMo` heritage of this project's E2E culture |
| Re-running the full 22-spec E2E suite for every small component-swap PR | Local iteration slows to a crawl (suite already uses `workers: 1`, `retries: 1`, videos+traces always on) | Scope E2E re-runs to specs touching the changed route(s) during iteration; run the full suite once before merging the phase | Immediately, given `workers: 1` and video/trace recording always on in this config |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| "Standardizing" a `ManagerPinGate`/RBAC-gated component's markup in a way that changes when/whether the gate renders | A destructive or financial action (void, refund, tip config) becomes reachable without the PIN gate, or the gate renders but doesn't actually block the underlying handler | Treat any file importing `ProtectedAction` or `manager-pin-gate` as requiring explicit RBAC re-verification (`e2e/09-rbac.spec.ts`) after any structural change, even a "just markup" one |
| Committed visual-regression baseline screenshots capturing real seeded credentials/PII on screen (e.g., a staff name, phone number from waitlist WhatsApp integration) | Low-severity but real: baseline PNGs live in git history indefinitely | Use clearly-fake seeded fixture data (already likely the case via `npm run setup:dev`) for anything captured as a committed baseline image, never a snapshot against a real/staging dataset |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Uniform spacing/token pass that increases whitespace density on high-throughput screens (`/pos`, `/pool-tables`) to match a "clean" admin-page standard | Fewer items visible without scrolling during a rush, more taps/scrolls per order — a real throughput regression for bartenders | Let touchscreen-primary, high-density operational screens keep denser spacing intentionally; standardize *token values* used (so density is a deliberate, named scale step) rather than forcing identical spacing scale positions everywhere |
| Standardizing focus-visible/ring styling in a way that makes the *default* (non-focused) state visually noisier on touch-only screens where focus rings rarely matter | Visual clutter on primary bartender screens for a state (keyboard focus) that's mostly irrelevant on a touchscreen | Apply strong focus-visible treatment (needed for keyboard/a11y compliance) without changing the unfocused resting appearance of touch-primary controls |
| Retrofitting the same `AppShell`/nav shell onto every route in one big-bang change (currently only ~8 of 17 pages use `AppShell`/`SplitLayout`/`PageContainer` explicitly) | Every route's layout risk moves simultaneously; a shell bug affects the whole app at once, and rollback/bisection becomes hard | Roll shell adoption out incrementally, route family by route family, verifying each against its own E2E spec before moving to the next |

## "Looks Done But Isn't" Checklist

- [ ] **Component swap PR:** Often missing an E2E run — verify `npm run test:e2e` (or the affected specs) were actually run, not just `npm run test` (Vitest doesn't cover E2E selector/DOM-shape regressions).
- [ ] **Touch-target fix:** Often missing verification that the *effective* tap area (not just visual size) grew — verify computed `min-h`/`min-w`/hit-slop, not just that a class was added, and check it wasn't accidentally applied only to the desktop breakpoint.
- [ ] **Visual regression baseline:** Often generated on a local machine with `channel: 'chrome'`/real fonts — verify baselines were generated in the same pinned/headless environment that will do future comparisons.
- [ ] **Shared prop-contract change:** Often typechecks in isolation (Storybook/one file) but not repo-wide — verify a full `npm run typecheck` run, not just the touched file's IDE state.
- [ ] **RBAC-adjacent UI swap:** Often "looks the same" but silently changes gate placement — verify `e2e/09-rbac.spec.ts` (and the specific role/action combination) still passes.
- [ ] **Focus-order change in a shared layout wrapper:** Often passes automated a11y checks (axe/Lighthouse) but breaks the actual keyboard/PIN-entry sequence — verify by manually tabbing through `PINKeypad`/login/manager-gate flows, not just running an automated scanner.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|-----------------|
| Touch targets regressed after a component swap | LOW | Revert the swap or re-apply `touchSize`/`min-h` on the affected component; add the affected surface to the "layout-frozen" / touch-primary list to prevent recurrence |
| Visual regression baselines generated in the wrong environment | MEDIUM | Delete and regenerate all baselines from the pinned/hermetic environment in one dedicated commit; do not patch individual baselines incrementally |
| Full-repo typecheck breakage from a shared prop-contract change | MEDIUM | Fix call sites mechanically (per-file `prop: T | undefined` pattern), land as its own commit separate from any behavior change, so the diff is reviewable as pure mechanical fix-up |
| Payment/split/refund behavior silently changed during a "consistency" swap | HIGH | Revert to the pre-swap implementation immediately (money-correctness bug); re-derive the intended UI change as a two-step PR: (1) behavior-preserving swap with passing existing tests, (2) any real behavior change reviewed and tested on its own |
| RBAC gate dropped/moved during a component swap | HIGH | Treat as a security incident-lite: revert immediately, re-run full `e2e/09-rbac.spec.ts`, audit git blame for other swaps touching `ProtectedAction`/`manager-pin-gate` in the same phase for the same mistake |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| Touch-target regression via `POSButton`→`Button` swap | Component-consistency phase (scoped after a11y/touch-target audit defines touch-primary surfaces) | Storybook/visual diff shows no bounding-box shrink on flagged surfaces; manual grep for `<Button` inside touch-primary widget dirs |
| Playwright visual-regression environment mismatch | Visual-regression suite setup phase | First CI/pinned-environment run does not show 100% mismatch on all screenshots |
| Visual regression flakiness from live timers/realtime/animations | Visual-regression suite setup phase | Re-running the same unchanged commit's visual suite twice produces identical pass/fail results (no non-deterministic diffs) |
| Snapshot maintenance burden / rubber-stamp approvals | Visual-regression suite setup phase (scope discipline) + ongoing PR review | Snapshot count stays bounded (component-level + layout-shell only); PR review artifact (diff images) actually opened per baseline change |
| Bartender muscle-memory / focus-order breakage | A11y/touch-target consistency phase | Manual keyboard walkthrough of `PINKeypad`/login/manager-gate; primary-action position assertions in E2E unchanged |
| Scope creep into payment/refund/tip behavior changes | Explicit constraint at component-consistency phase kickoff | Payment/split/refund/tip E2E specs (`05-payments`, `41-split-payment`, `42-tip-distribution`, `06-transfer`) pass with zero assertion changes |
| `exactOptionalPropertyTypes`/`noUncheckedIndexedAccess` mass breakage on shared-prop changes | Any phase changing a `shared/ui` prop contract | Full-repo `npm run typecheck` green, contract change and call-site migration land as separate reviewed commits |
| E2E selector/RBAC breakage from DOM-shape changes | Every component-swap phase | Affected E2E specs (including `09-rbac.spec.ts` where relevant) run and pass before merge |

## Sources

- Direct repo inspection: `src/shared/ui/button.tsx`, `src/shared/ui/POSButton.tsx` (touch-size contract, 50 usages), `playwright.config.ts` (`channel: 'chrome'`, `headless: false`, `slowMo`), `.github/workflows/ci.yml` (CI does not run E2E today), `src/pages/*` (inconsistent `AppShell`/`SplitLayout`/`PageContainer` adoption across 17 routes)
- `CLAUDE.md` — documented `exactOptionalPropertyTypes`/`noUncheckedIndexedAccess` gotchas, E2E spec list, RBAC actions, offline queue architecture
- `.planning/PROJECT.md` — milestone scope (component consistency, tokens, layout/nav shell, a11y/touch-target, Playwright screenshot-diff suite)
- General Playwright visual-testing practice (screenshot masking, hermetic browser pinning, animation-disabling) — MEDIUM confidence, standard community/official Playwright guidance rather than repo-specific, applied here to this repo's concrete config gaps

---
*Pitfalls research for: UI Standardization milestone (v2.2) on Bar POS (bola8pos)*
*Researched: 2026-07-10*
