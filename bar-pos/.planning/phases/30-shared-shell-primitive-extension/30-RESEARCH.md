# Phase 30: Shared Shell & Primitive Extension - Research

**Researched:** 2026-07-10
**Domain:** React/TypeScript layout-component refactor (no new libraries, no new visual design)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `PageContainer` gains `backTo`/`backLabel` props and renders the back button inline in its existing header area (next to/above the title via `SectionHeader`) — not as a separate top strip. This replaces `BackToHomeButton` entirely: the component is deleted, and all 14 current callers pass `backTo="/home"` (or a more accurate parent route where the current hardcoded `/home` target is wrong — e.g. `pool-table-status` should point at `/pool-tables`, not `/home`).
  - **Operational requirement (explicit user constraint):** The back-to-home affordance must stay a fast, always-visible single-tap action — this is a bar POS used by cashiers/servers who need to jump back to the main nav quickly to attend a customer. Don't bury it in a menu or require multiple taps. The inline-header placement must preserve this — one visible button, no extra clicks.
- **D-02:** `LoginPage` and `HomePage` are explicitly exempt from SHELL-01's "every route" — they are structurally special (LoginPage is a full-bleed centered auth screen with no sensible back target; HomePage IS the back-navigation destination, so wrapping it in PageContainer's title/back-button chrome would be redundant with its own existing custom header). This is a deliberate scope narrowing, not an oversight.
- **D-03:** Delete `src/shared/ui/AppShell.tsx`, the `src/widgets/AppNav/` folder, and their exports from `src/shared/ui/index.ts` entirely (not just unexport). Confirmed zero real consumers: `AppShell` only appears in its own export line; `AppNav` only self-references inside its own widget folder. Matches SHELL-02's "removed, not resurrected" wording.
- **D-04:** Scope is routes-table-only — add the 3 missing rows (`/kds`, `/kitchen-prep`, `/audit`) so the table's 17 rows match `router.tsx`'s 17 real routes exactly. No other CLAUDE.md section (Implemented Features, RBAC Actions, etc.) is touched in this phase.

### Claude's Discretion

None explicitly delegated beyond the decisions above — CONTEXT.md's `<specifics>` section states the user framed the back-nav requirement operationally rather than visually, and D-01's inline-header/single-tap placement was judged to satisfy it. The `30-UI-SPEC.md` has since pinned the exact markup/classes for this, closing off further discretion on visual placement.

### Deferred Ideas (OUT OF SCOPE)

- Replacing `pool-table-status`'s hand-rolled `ArrowLeft` back button (inside the `TableStatusPanel` widget) with the new `PageContainer`/`backTo` pattern — belongs to Phase 31 (COMPONENT-03), not this phase.
- Documenting the new `backTo`/`backLabel` convention in `CLAUDE.md`'s Key Conventions section — explicitly declined for this phase (D-04); revisit if a later phase's context needs it.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SHELL-01 | Every route uses a single shared layout shell (`PageContainer` extended with `backTo`/`backLabel`) instead of ad-hoc per-page wrappers | Verified exact current/target markup for `PageContainer`/`SectionHeader`/`BackToHomeButton` via direct source read; enumerated all 17 routes and their current wrapper state (8 already on `PageContainer`, 7 need first-time adoption, `pool-table-status` needs its inline back-link swapped, `home`/`login` exempt per D-02); identified the `pos`/`payments` full-bleed layout risk and its `className`-override resolution (Pattern 2, Pitfall 2) |
| SHELL-02 | Dead `AppShell`/`AppNav` components (zero real consumers) are removed, not resurrected | Confirmed via full-repo grep: `AppShell` appears only in its own file + its own `index.ts` export line; `AppNav` appears only inside its own single-file widget folder (no barrel, no other consumers) |
| SHELL-03 | `CLAUDE.md` routes table is corrected to match the router's actual 17 registered routes | Read `router.tsx` in full (17 real `<Route>` entries, confirmed) and `CLAUDE.md`'s current 14-row table (lines 105-124); confirmed the 3 missing rows are exactly `/kds`, `/kitchen-prep`, `/audit`; sourced their route-guard permission checks (`KdsRoute`/`AuditRoute`) for Notes-column content; found reusable route cross-check regex logic in `scripts/audit-ui-drift.ts` (Phase 29 artifact) for verification |

</phase_requirements>

## Summary

This phase is a mechanical prop-extension + call-site migration, not new engineering. `PageContainer` (`src/shared/ui/PageContainer.tsx`) already exists and is already consumed by 8/17 routes; it needs exactly two new optional props (`backTo`, `backLabel`) rendered inside `SectionHeader`. `BackToHomeButton` (14 callers, all verified live) is deleted and its markup is absorbed into `SectionHeader`. `AppShell`/`AppNav` are confirmed genuinely dead (zero real consumers — each only appears in its own file/export line) and can be deleted outright. `CLAUDE.md`'s routes table is missing exactly 3 rows (`/kds`, `/kitchen-prep`, `/audit`) confirmed against the live 17-route `router.tsx`.

The one real engineering risk in this phase — not called out in CONTEXT.md/UI-SPEC — is that **two of the 7 pages newly adopting `PageContainer` (`pos`, `payments`) are full-height/full-bleed split-view layouts that are structurally incompatible with `PageContainer`'s default `max-w-[1400px] p-6 space-y-6` wrapper.** This is solvable without new component work: `PageContainer`'s existing `className` prop is merged via `twMerge` (not naive string concat), so passing an overriding `className` (e.g. neutralizing `max-w`/`padding`/`space-y`) is a supported, zero-new-code escape hatch — verified in `src/shared/lib/utils.ts`.

The second finding worth flagging: the back-link's accessible name ("Home") is a **load-bearing test dependency**, not just a visual detail. It is asserted by 2 unit tests, 2+ E2E specs, and — critically — by `e2e/helpers/auth.ts`'s shared `logout()` helper, which every E2E spec's teardown calls. This elevates the "operational requirement" in CONTEXT.md D-01 from a UX nicety to a hard regression gate: `backLabel` must render literally as visible text "Home" by default, as a `<a>`/`<Link>` with `role=link`, `href="/home"`.

**Primary recommendation:** Extend `PageContainer`/`SectionHeader` exactly per `30-UI-SPEC.md`'s markup; migrate the 14 `BackToHomeButton` callers + `pool-table-status`'s inline back-link mechanically; for `pos`/`payments` specifically, use `PageContainer`'s `className` override to neutralize width/padding while keeping the header/back-button, leaving their existing full-height flex body untouched; delete `AppShell`+`AppNav`+`BackToHomeButton` and their barrel exports; add exactly 3 rows to `CLAUDE.md`'s routes table.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Page header (title/description/actions/back-nav) | Frontend (React component: `PageContainer`/`SectionHeader`) | — | Pure presentational composition, no server/business logic involved |
| Back-navigation routing | Browser/Client (`react-router-dom` `Link`) | — | Client-side route change only, no server round-trip |
| Route registration & guards | Frontend (`src/app/router.tsx` + `*-route.tsx` guard components) | — | `ProtectedRoute`/`KdsRoute`/`AuditRoute`/etc. gate access client-side using `usePermissions()` |
| Docs accuracy (`CLAUDE.md` routes table) | N/A (documentation, not runtime) | — | Static markdown, no code path touches it at runtime |
| Dead-code removal (`AppShell`/`AppNav`) | Browser/Client (component tree) | — | Removing unreferenced React components/exports; no data layer impact |

This phase touches exactly one tier (frontend React component tree + static docs). No API/backend/database work involved.

## Standard Stack

No new dependencies. All work uses libraries already installed and in use:

| Library | Version (confirmed in package.json) | Purpose | Why no alternative needed |
|---------|---------|---------|--------------|
| react-router-dom | (existing, already used by `BackToHomeButton.tsx`) | `Link` for back-nav | Already the project's only routing library |
| lucide-react | (existing) | `ChevronLeft` icon | Already used by the exact component being deleted/absorbed |
| class-variance-authority + tailwind-merge (`cn`) | (existing, `src/shared/lib/utils.ts`) | Merging override `className` onto `PageContainer`/`Button` | `cn()` = `twMerge(clsx(inputs))` — confirmed by reading the file; later classes win over earlier conflicting Tailwind utilities, not just concatenation |

No package installs, no `npx shadcn add` calls, no Package Legitimacy Audit required — this section is intentionally empty for that reason.

## Package Legitimacy Audit

Not applicable — this phase installs zero external packages. All components/utilities used already exist in the repo and were verified by direct file read (`PageContainer.tsx`, `SectionHeader.tsx`, `BackToHomeButton.tsx`, `button.tsx`, `utils.ts`).

## Architecture Patterns

### System Architecture Diagram

```
router.tsx (17 <Route> entries)
        │
        ▼
  Page component (src/pages/<route>/index.tsx)
        │
        ├─ [15 non-exempt pages] ──▶ <PageContainer title backTo backLabel>
        │                                   │
        │                                   ▼
        │                          <SectionHeader title backTo backLabel>
        │                                   │
        │                    ┌──────────────┴───────────────┐
        │                    ▼                               ▼
        │         (backTo present)                  (backTo absent)
        │         <Button ghost asChild>                no back button
        │           <Link to={backTo}>                  rendered (unchanged
        │             <ChevronLeft/>{backLabel}          from today)
        │           </Link>
        │         </Button>
        │                    │
        │                    ▼
        │           react-router-dom client-side
        │           navigation to backTo route
        │
        └─ [HomePage, LoginPage — exempt] ──▶ own custom header, untouched
```

### Recommended Project Structure

No new files/folders. Structure is unchanged — this phase edits in place:

```
src/shared/ui/
├── PageContainer.tsx      # extend: + backTo?, backLabel? props
├── SectionHeader.tsx      # extend: render back button in left column
├── BackToHomeButton.tsx   # DELETE
├── AppShell.tsx           # DELETE
├── index.ts               # remove BackToHomeButton/AppShell/AppNav exports
src/widgets/AppNav/        # DELETE (whole folder — single file, no barrel)
src/pages/<route>/index.tsx  # 14 callers: swap <BackToHomeButton/> for backTo prop
                              # 7 of these 14 also gain PageContainer for the first time
                              # pool-table-status: swap its inline Link block similarly
CLAUDE.md                  # + 3 routes-table rows (/kds, /kitchen-prep, /audit)
```

### Pattern 1: Optional prop with conditional spread (`exactOptionalPropertyTypes`-safe)
**What:** `PageContainer` already uses this pattern for `description`/`actions` — new `backTo`/`backLabel` must follow it exactly, not introduce a new idiom.
**When to use:** Any optional component prop being forwarded to a child component under `exactOptionalPropertyTypes: true`.
**Example (verified from live source, `src/shared/ui/PageContainer.tsx:56-60`):**
```tsx
<SectionHeader
  title={title}
  {...(description && { description })}
  {...(actions && { action: actions })}
/>
```
`backTo`/`backLabel` must be forwarded to `SectionHeader` the same way: `{...(backTo && { backTo })}`. Do NOT write `backTo={backTo}` directly — with `exactOptionalPropertyTypes` on, if `backTo` is `undefined` that assigns `undefined` explicitly rather than omitting the prop key, which the UI-SPEC and existing code both avoid.

### Pattern 2: `className` override via `twMerge`-backed `cn()` as an escape hatch
**What:** `PageContainer`'s outer div is `cn('mx-auto w-full max-w-[1400px] space-y-6 p-6', className)`. Because `cn` = `twMerge(clsx(...))` (confirmed, `src/shared/lib/utils.ts`), a caller-supplied `className` with conflicting utilities (e.g. `max-w-none`, `p-0`, `space-y-0`) will correctly win over the defaults — this is NOT naive string concatenation where both classes would apply and cause a CSS specificity fight.
**When to use:** For `pos` and `payments` (see Common Pitfalls below) — these two pages need `PageContainer`'s header/back-button but must neutralize its width/padding/spacing defaults to preserve their existing full-bleed, full-height flex layouts.
**Example:**
```tsx
<PageContainer
  title="POS"
  backTo="/home"
  className="mx-0 h-screen max-w-none space-y-0 p-0"
>
  {/* existing full-height flex-1 split-view content, unchanged */}
</PageContainer>
```
This is a plan-time decision per page, not a new component — `className` already exists on `PageContainerProps` today.

### Anti-Patterns to Avoid
- **Do not touch `pool-table-status`'s `TableStatusPanel` widget hand-rolled `ArrowLeft` button.** It is a separate component (`src/widgets/TableStatusPanel/index.tsx:1,392`) from the page-level back-link this phase touches. It is explicitly deferred to Phase 31 (COMPONENT-03) per `30-CONTEXT.md`.
- **Do not wrap `LoginPage`/`HomePage` in `PageContainer`.** D-02 exemption — confirmed both pages have zero current `PageContainer`/`BackToHomeButton` usage; adding it now is a scope violation, not an oversight.
- **Do not assume `PageContainer`'s outer div provides page-height/scroll behavior.** It does not — it is a plain `space-y-6 p-6` block. The `<div className="flex h-screen flex-col"><BackToHomeButton/><main className="flex-1 overflow-auto">` outer wrapper present in all 8 existing `PageContainer` adopters is a *separate, still-needed* layout concern that `PageContainer` does not replace. Only the `<BackToHomeButton/>` line (and, for the 7 new adopters, the missing `PageContainer` around content) is what SHELL-01 targets — not this outer scroll shell.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Back-navigation button markup | A new bespoke back-button component | The exact `ChevronLeft` + `Link`/`asChild Button` markup already in `BackToHomeButton.tsx`, moved into `SectionHeader` | It is the pattern already used 14 times and asserted by existing tests/E2E specs — reinventing it risks breaking the "Home" accessible-name contract (see Pitfalls) |
| Full-bleed layout override | A new "headless" `PageContainer` variant/prop for full-width pages | `className` override (already `twMerge`-merged) | `PageContainerProps.className` already exists; no new prop or component needed |

**Key insight:** Every piece of markup this phase needs already exists somewhere in the repo (`BackToHomeButton.tsx`, `PageContainer.tsx`, `SectionHeader.tsx`). This phase is entirely relocation + prop-threading, not new UI design.

## Common Pitfalls

### Pitfall 1: The "Home" back-link is a load-bearing E2E dependency, not just a UX nicety
**What goes wrong:** If the default `backLabel` text, element role, or `href` value changes even slightly during the `BackToHomeButton` → `PageContainer` migration, it silently breaks test infrastructure far outside this phase's obvious blast radius.
**Why it happens:** `e2e/helpers/auth.ts`'s shared `logout()` helper (used by the teardown of most/all of the 22 E2E specs) does:
```ts
// e2e/helpers/auth.ts:132-138
if (!page.url().includes('/home')) {
  const homeLink = page.getByRole('link', { name: 'Home' });
  const homeLinkVisible = await homeLink.isVisible().catch(() => false);
  if (homeLinkVisible) {
    await homeLink.click({ timeout: 5_000 }).catch(() => undefined);
  } else {
    await page.goto('/home', ...).catch(() => undefined);
  }
}
```
It falls back to `page.goto` on failure (so it won't hard-fail the suite), but a broken/absent "Home" link means every spec silently loses its fast in-app navigation path and falls back to a slower full reload — a regression that is easy to miss because tests still pass.
In addition, these tests **directly assert** the link:
- `src/pages/payments/PaymentsPage.test.tsx:47-51` — `getByRole('link', { name: /home/i })`, `toHaveAttribute('href', '/home')` (unit, currently passing — verified live)
- `e2e/15-home-navigation.spec.ts:39` — `getByRole('link', { name: /Home/i })` on the `/pool-tables` page
- `e2e/17-payment-pane.spec.ts:452-456` (T12) — same pattern on `/payments`
**How to avoid:** Ensure `backLabel` defaults to the literal string `'Home'` (not `'Back'`, not `'Back to Home'`) and renders as an actual anchor (`Link`/`asChild Button`, `role="link"` in the accessibility tree, not a `<button>`) with `href="/home"` resolved by react-router. Run `PaymentsPage.test.tsx` and `ReportsPage.test.tsx` (both currently pass — verified live, 6/6 tests) after migration as a fast regression check before running the full E2E suite.
**Warning signs:** Any E2E spec teardown taking noticeably longer (full-page `goto` fallback firing), or `PaymentsPage.test.tsx` failing on the `getByRole('link', {name: /home/i})` assertion.

### Pitfall 2: `pos` and `payments` are full-height/full-bleed layouts — `PageContainer`'s defaults will visually break them if applied naively
**What goes wrong:** `PageContainer`'s outer div is `max-w-[1400px] space-y-6 p-6` (block layout, not flex). `pos` (`src/pages/pos/index.tsx`) and `payments` (`src/pages/payments/index.tsx`) currently render full-height flex layouts (`flex h-screen flex-col`, `Tabs` with `flex-1 overflow-hidden` content) with no width cap, because they contain split-view UI (cart sidebar, tab drawer, payment/refund tabs) that must use full viewport width.
**Why it happens:** These are the only 2 of the "7 pages missing `PageContainer`" that are NOT simple content-in-a-card pages (`audit`, `inventory`, `reports`, `settings`, `staff` all use a `<main className="p-6 md:p-8"><div className="max-w-Nxl">...</div></main>` shape that maps cleanly onto `PageContainer`).
**How to avoid:** Use `PageContainer`'s existing `className` prop (verified `twMerge`-backed — see Pattern 2 above) to neutralize `max-w-[1400px]`/`p-6`/`space-y-6` for these two pages specifically, while keeping the title/back-button header. Verify against the existing E2E specs that already cover these pages' visual/functional behavior: `03-tab-order.spec.ts`, `17-payment-pane.spec.ts`, `41-split-payment.spec.ts`, `05-payments.spec.ts`.
**Warning signs:** Cart sidebar/tab drawer visually constrained to ~1400px centered instead of full-bleed; payment tabs losing vertical fill (`flex-1 overflow-hidden` collapsing because a `space-y-6` block ancestor was inserted).

### Pitfall 3: `pool-table-status`'s back-link target is currently *correct*, but easy to regress if copy-pasted from the other 14 pages
**What goes wrong:** All 14 `BackToHomeButton` migrations get `backTo="/home"`. If `pool-table-status` (`src/pages/pool-table-status/index.tsx:25-32`) is migrated by the same rote find/replace without checking its existing target, its already-correct `to="/pool-tables"` / `"Pool Tables"` label could get silently overwritten with the generic `/home`/`"Home"` default.
**Why it happens:** `pool-table-status` doesn't use `BackToHomeButton` — it hand-rolls the identical markup inline, already pointed at the correct `/pool-tables` target (verified live source — this is NOT the bug D-01/UI-SPEC describe; that bug is in `TableStatusPanel`'s separate `ArrowLeft` button, out of scope for this phase per Pitfall/Anti-Pattern above).
**How to avoid:** When migrating `pool-table-status`, set `backTo="/pool-tables"` and `backLabel="Pool Tables"` explicitly — do not default it. Confirmed by `e2e/16-table-status.spec.ts:813-822` (T15) which already asserts `getByRole('link', { name: /pool tables/i })` navigates back to `/pool-tables` — this test must keep passing unchanged.

### Pitfall 4: Repo-wide `npm run typecheck` baseline is NOT currently 100% clean
**What goes wrong:** Success criterion 4 says "Full-repo `npm run typecheck` ... pass after the shell swap." Taken literally, this is impossible without fixing 2 pre-existing, unrelated errors.
**Why it happens:** Verified live by running `npm run typecheck` before starting any phase-30 work — 2 pre-existing errors exist, both unrelated to this phase's scope:
```
src/entities/tab/model/queries.ts(778,11): error TS2322: Type 'number | null' is not assignable to type 'number | undefined'.
src/shared/lib/agent/rag.ts(60,7): error TS2322: Type 'number[]' is not assignable to type 'string'.
```
These are the same 2 errors documented in `STATE.md`'s Phase 29 session log ("typecheck limited to the 2 pre-existing unrelated errors") — confirmed still present, not introduced by this phase.
**How to avoid:** Interpret SC-4 as "no NEW typecheck/lint errors introduced by this phase" — verify by diffing the typecheck output before/after (both should show exactly these same 2 errors, same line numbers, same files). Do not attempt to fix `tab/model/queries.ts` or `agent/rag.ts` as part of this phase — out of scope.
**Warning signs:** Planner/executor treating "typecheck must pass" as "zero errors" and scope-creeping into unrelated files.

### Pitfall 5: Lint is currently clean — don't let it regress
**What goes wrong:** Unlike typecheck, `npm run lint` currently exits 0 (verified live — only a non-blocking `eslint-plugin-boundaries` config-style warning about "legacy selector syntax", not a code error). Any new lint error introduced by this phase (e.g. `import/order` violations from adding `Link`/`ChevronLeft`/`Button` imports to `SectionHeader.tsx`) is a genuine regression, not something to write off as "pre-existing."
**How to avoid:** Run `npm run lint` after every file edit batch, not just at the end.

## Code Examples

### Current `BackToHomeButton` (to be deleted, markup absorbed into `SectionHeader`)
```tsx
// Source: src/shared/ui/BackToHomeButton.tsx (live repo, verified)
import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from './button';

export function BackToHomeButton() {
  return (
    <div className="px-4 pt-4">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/home">
          <ChevronLeft className="mr-1 h-4 w-4" />
          Home
        </Link>
      </Button>
    </div>
  );
}
```

### Current `PageContainer` (extend in place — verified live source)
```tsx
// Source: src/shared/ui/PageContainer.tsx
export function PageContainer({ children, title, description, actions, className }: PageContainerProps) {
  return (
    <div className={cn('mx-auto w-full max-w-[1400px] space-y-6 p-6', className)}>
      <SectionHeader
        title={title}
        {...(description && { description })}
        {...(actions && { action: actions })}
      />
      {children}
    </div>
  );
}
```

### Current `SectionHeader` (target of the markup change — verified live source)
```tsx
// Source: src/shared/ui/SectionHeader.tsx
export function SectionHeader({ title, description, action, badge, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b pb-4', className)}>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          {badge !== undefined && <Badge variant="secondary" aria-label={`Count: ${String(badge)}`}>{badge}</Badge>}
        </div>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
```
The full exact target markup (with `backTo`/`backLabel` inserted) is already fully specified in `30-UI-SPEC.md` — no further design decisions needed here.

### Confirmed live `cn()` implementation (why `className` override is safe)
```ts
// Source: src/shared/lib/utils.ts (verified live)
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `<BackToHomeButton/>` as a standalone sibling above `PageContainer`/ad-hoc div | `backTo`/`backLabel` prop on `PageContainer`, rendered inline in `SectionHeader` | This phase | 14 call sites simplified from 2-line-wrapper + import to 1 prop pair; single canonical shell |
| 9 pages with ad-hoc `<div className="flex h-screen flex-col">` + manual `<h1>`/`max-w-Nxl` wrapper, no `PageContainer` | All 15 non-exempt routes use `PageContainer` for their header | This phase | Consistent header markup/spacing across the app; `CLAUDE.md`/future phases can rely on 1 shell abstraction |

**Deprecated/outdated:**
- `AppShell`/`AppNav` (sidebar-based app shell) — superseded by the current big-box `HomeDashboard` + per-page `BackToHomeButton`/`PageContainer` navigation model already in production; these two components were never wired into `router.tsx` or `providers.tsx` (confirmed zero real consumers via full-repo grep) and represent an earlier, abandoned navigation design.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The 3 missing `CLAUDE.md` routes-table `Notes` column entries should be sourced from each route guard's permission check (e.g. `can('view_kds')`, `can('view_audit_log')`) rather than invented prose, per UI-SPEC's copywriting contract ("do not invent descriptive copy not already implied by the route") | Code Examples / SHELL-03 scope | Low — worst case is a slightly generic Notes cell; does not block typecheck/lint/functionality |

All other claims in this research were verified directly against live repository source (file reads, grep, `npm run typecheck`/`lint`, `npx vitest run`) — none are training-data guesses.

## Open Questions

1. **Should `pos`/`payments`'s `PageContainer` `className` override be a single shared convention or per-page bespoke? (RESOLVED — treat as per-task judgment)**
   - What we know: Both pages need width/padding/spacing neutralized; the exact classes needed differ slightly per page's existing layout (verified: `pos` uses `bg-background` on its own outer div, `payments` uses `bg-background` too but with a `Tabs`-based flex-1 body).
   - What's unclear: Whether the planner wants one named convention (e.g. a documented `className="mx-0 h-screen max-w-none space-y-0 p-0"` snippet reused verbatim) or lets each task pick minimal overrides based on visual diffing.
   - Recommendation: Treat as a per-task judgment call, verified by each page's existing E2E coverage (`17-payment-pane`, `41-split-payment`, `05-payments`, `03-tab-order`) — not a blocking decision for planning, since either approach satisfies SHELL-01's letter and intent.

## Environment Availability

Skipped — this phase has no external tool/service/runtime dependencies beyond the project's existing npm toolchain (already verified working: `npm run typecheck`, `npm run lint`, `npx vitest run` all ran successfully during this research session).

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json` — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest v4 + React Testing Library v16 (unit); Playwright v1.59 (E2E) |
| Config file | `bar-pos/vitest.config.ts`; `bar-pos/playwright.config.ts` |
| Quick run command | `npx vitest run src/pages/payments/PaymentsPage.test.tsx src/pages/reports/ReportsPage.test.tsx` (both currently pass, 6/6 — verified live) |
| Full suite command | `npm run test` (unit); `npm run test:e2e` (E2E, requires dev server + `.env.local` creds) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHELL-01 | `PageContainer` extended w/ `backTo`/`backLabel`, wraps all 17 routes | unit | `npx vitest run src/shared/ui/PageContainer.test.tsx` | ❌ Wave 0 — no test file exists for `PageContainer`/`SectionHeader` today (confirmed via glob — only `ClockDriftBanner`, `ProtectedAction`, `CategoryTreePicker`, `IngredientAutocomplete`, `UpdateAvailableDialog` have `.test.tsx` in `shared/ui/`) |
| SHELL-01 | Back-link accessible name/href preserved end-to-end | unit + e2e | `npx vitest run src/pages/payments/PaymentsPage.test.tsx`; `npx playwright test e2e/15-home-navigation.spec.ts e2e/16-table-status.spec.ts e2e/17-payment-pane.spec.ts` | ✅ all 3 files exist and currently pass |
| SHELL-02 | `AppShell`/`AppNav` deleted, no dangling imports | build/typecheck | `npm run typecheck && npm run lint` | ✅ (no dedicated test needed — a stray import of a deleted file fails compilation) |
| SHELL-03 | `CLAUDE.md` routes table matches `router.tsx`'s 17 routes | manual/scripted diff | Reuse the route-count logic from `scripts/audit-ui-drift.ts`'s `crossCheckRoutes()` (regex `/<Route\s+path="([^"]+)"/g` vs CLAUDE.md `^\| \`/` rows) — **do not run the script directly**, since it overwrites Phase 29's `DRIFT-AUDIT.md`; instead replicate the same regex manually or in a scratch script | ❌ Wave 0 — no standalone SHELL-03-scoped check exists; the logic exists but is embedded in a Phase-29-owned script that writes to a Phase-29 artifact |

### Sampling Rate
- **Per task commit:** `npm run typecheck && npm run lint` (fast, catches dangling imports/prop-type errors immediately)
- **Per wave merge:** `npx vitest run src/pages/payments/PaymentsPage.test.tsx src/pages/reports/ReportsPage.test.tsx` + full `npm run test`
- **Phase gate:** Full unit suite green; `npx playwright test e2e/15-home-navigation.spec.ts e2e/16-table-status.spec.ts e2e/17-payment-pane.spec.ts` (targeted, fast) before a full `npm run test:e2e` pass ahead of `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/shared/ui/PageContainer.test.tsx` — new file; cover: (a) no `backTo` → no back-link rendered (regression guard for future non-migrated pages), (b) `backTo` present + no `backLabel` → renders link text "Home", href matches `backTo`, (c) `backTo` + custom `backLabel` (e.g. "Pool Tables") → renders that exact text
- [ ] No dedicated SHELL-03 check script — Wave 0 may add a small one-off verification (not necessarily a permanent test file) replicating `crossCheckRoutes()`'s regex against the corrected `CLAUDE.md`, OR simply eyeball-diff route lists manually since this is a one-time doc fix, not a regression-prone runtime behavior

## Security Domain

`security_enforcement` is absent from `.planning/config.json` → treated as enabled, but this phase has no meaningful security surface.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Unchanged — `ProtectedRoute`/`*-route.tsx` guards are not modified by this phase |
| V3 Session Management | No | Not touched |
| V4 Access Control | No | Route guards (`KdsRoute`, `AuditRoute`, `RbacRoute`, `WaitlistRoute`, `ReportsRoute`) are read for context (to source `CLAUDE.md` Notes text) but not modified |
| V5 Input Validation | No | No new user input introduced — `backTo` values are hardcoded route-string literals authored by the developer, not user-controlled data |
| V6 Cryptography | No | Not applicable |

### Known Threat Patterns for this stack
None applicable — this phase changes only static navigation chrome (a `Link to={hardcodedString}`) and deletes unreferenced components. No new attack surface is introduced.

## Sources

### Primary (HIGH confidence — direct repo inspection this session)
- `src/shared/ui/PageContainer.tsx` — full source read
- `src/shared/ui/SectionHeader.tsx` — full source read
- `src/shared/ui/BackToHomeButton.tsx` — full source read
- `src/shared/ui/AppShell.tsx` — full source read
- `src/widgets/AppNav/ui/AppNav.tsx` — full source read
- `src/shared/ui/index.ts` — full source read (barrel exports)
- `src/shared/ui/button.tsx` — full source read (`buttonVariants` size/variant scale)
- `src/shared/lib/utils.ts` — full source read (`cn()` = `twMerge(clsx(...))`)
- `src/app/router.tsx` — full source read (17 real routes enumerated)
- `src/app/kds-route.tsx`, `src/app/audit-route.tsx` — read for `CLAUDE.md` Notes-column sourcing
- `CLAUDE.md` lines 105-124 — current 14-row routes table read directly
- `src/pages/{audit,inventory,payments,pos,reports,settings,staff}/index.tsx` — all 7 "missing PageContainer" pages read in full
- `src/pages/{kds,kds-bar,pool-tables,rappi,waitlist,rbac,kitchen-prep,pool-table-status}/index.tsx` — all 8 existing `PageContainer` adopters read in full
- `src/widgets/TableStatusPanel/index.tsx` — grep-confirmed separate `ArrowLeft`/`useNavigate` hand-rolled button (COMPONENT-03, out of scope)
- `src/pages/payments/PaymentsPage.test.tsx`, `src/pages/reports/ReportsPage.test.tsx` — read + executed live (`npx vitest run`, 6/6 pass)
- `e2e/helpers/auth.ts`, `e2e/15-home-navigation.spec.ts`, `e2e/16-table-status.spec.ts`, `e2e/17-payment-pane.spec.ts` — grepped/read for back-link accessible-name dependencies
- `scripts/audit-ui-drift.ts` — read for existing `crossCheckRoutes()` logic reusable for SHELL-03 verification
- Live command output: `npm run typecheck` (2 pre-existing errors, unrelated), `npm run lint` (exit 0, clean), `npx vitest run` (target files pass)

### Secondary / Tertiary
None used — no WebSearch/Context7 lookups were needed since this phase is entirely internal-repo refactoring with zero new third-party libraries or APIs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new stack, all existing/verified libraries
- Architecture: HIGH — every component/page/route read directly from live source, not inferred
- Pitfalls: HIGH — each pitfall backed by a specific grepped/read file and, where applicable, a live command run (typecheck/lint/vitest)

**Research date:** 2026-07-10
**Valid until:** Effectively indefinite for a refactor phase with no external dependencies — re-verify only if `router.tsx`, `PageContainer.tsx`, or `BackToHomeButton.tsx` change before this phase executes (30 days is a reasonable outer bound given active development on this repo)
