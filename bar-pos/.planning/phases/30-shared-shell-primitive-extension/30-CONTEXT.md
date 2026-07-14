# Phase 30: Shared Shell & Primitive Extension - Context

**Gathered:** 2026-07-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Every route uses a single shared layout shell (`PageContainer`, extended with `backTo`/`backLabel`) instead of ad-hoc per-page wrappers; dead `AppShell`/`AppNav` components (zero real consumers) are removed; `CLAUDE.md`'s routes table is corrected to match the router's actual 17 registered routes. This is the foundation phase for v2.2's UI standardization — Phases 31-33 build on the shell this phase establishes.

</domain>

<decisions>
## Implementation Decisions

### PageContainer back-nav design
- **D-01:** `PageContainer` gains `backTo`/`backLabel` props and renders the back button inline in its existing header area (next to/above the title via `SectionHeader`) — not as a separate top strip. This replaces `BackToHomeButton` entirely: the component is deleted, and all 14 current callers pass `backTo="/home"` (or a more accurate parent route where the current hardcoded `/home` target is wrong — e.g. `pool-table-status` should point at `/pool-tables`, not `/home`).
- **Operational requirement (explicit user constraint):** The back-to-home affordance must stay a fast, always-visible single-tap action — this is a bar POS used by cashiers/servers who need to jump back to the main nav quickly to attend a customer. Don't bury it in a menu or require multiple taps. The inline-header placement must preserve this — one visible button, no extra clicks.

### login/home page exemption
- **D-02:** `LoginPage` and `HomePage` are explicitly exempt from SHELL-01's "every route" — they are structurally special (LoginPage is a full-bleed centered auth screen with no sensible back target; HomePage IS the back-navigation destination, so wrapping it in PageContainer's title/back-button chrome would be redundant with its own existing custom header). This is a deliberate scope narrowing, not an oversight — noted here so downstream agents don't treat 15/17 as incomplete.

### AppShell/AppNav removal
- **D-03:** Delete `src/shared/ui/AppShell.tsx`, the `src/widgets/AppNav/` folder, and their exports from `src/shared/ui/index.ts` entirely (not just unexport). Confirmed zero real consumers: `AppShell` only appears in its own export line; `AppNav` only self-references inside its own widget folder. Matches SHELL-02's "removed, not resurrected" wording.

### CLAUDE.md routes table fix scope
- **D-04:** Scope is routes-table-only — add the 3 missing rows (`/kds`, `/kitchen-prep`, `/audit`) so the table's 17 rows match `router.tsx`'s 17 real routes exactly. No other CLAUDE.md section (Implemented Features, RBAC Actions, etc.) is touched in this phase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` §Shell — SHELL-01, SHELL-02, SHELL-03 full text
- `.planning/ROADMAP.md` — Phase 30 goal/success criteria; Phase 31-33 downstream consumers of this shell

### Phase 29 output (scoping data)
- `.planning/phases/29-ui-drift-audit/DRIFT-AUDIT.md` — route-count cross-check output (17 real routes vs 14 CLAUDE.md rows, missing `/kds`, `/kitchen-prep`, `/audit`) — this phase's SHELL-03 fix target
- `.planning/phases/29-ui-drift-audit/29-RESEARCH.md` — route-count reconciliation methodology (Pitfall 2/3: `<Route\s` anchor, not substring `<Route`; CLAUDE.md row count via `^\| \`/` regex)

### Code — components being extended/removed
- `src/shared/ui/PageContainer.tsx` — component being extended with `backTo`/`backLabel`
- `src/shared/ui/BackToHomeButton.tsx` — component being deleted; read its 14 current callers before removing
- `src/shared/ui/AppShell.tsx` — dead code to delete
- `src/widgets/AppNav/ui/AppNav.tsx` — dead code to delete
- `src/shared/ui/index.ts` — barrel exports to update (remove AppShell/AppNav/BackToHomeButton exports, keep PageContainer)

### Code — routes and pages
- `src/app/router.tsx` — source of truth for the 17 real routes
- `CLAUDE.md` §Routes — the stale table (14 rows) this phase corrects to 17
- `src/pages/login/index.tsx`, `src/pages/home/index.tsx` — exempt pages (D-02), do not touch their layout structure

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/shared/ui/PageContainer.tsx` — already used by 8/17 pages (`kds`, `kds-bar`, `kitchen-prep`, `pool-table-status`, `pool-tables`, `rappi`, `rbac`, `waitlist`); extend in place, don't replace
- `src/shared/ui/SectionHeader.tsx` — PageContainer's internal header renderer; back button should compose here, not as a new sibling element
- `src/shared/ui/BackToHomeButton.tsx` — current hardcoded-to-`/home` back button pattern (`Link` + `ChevronLeft` + ghost `Button`), used by 14 pages: `audit`, `inventory`, `kds`, `kds-bar`, `kitchen-prep`, `payments`, `pool-tables`, `pos`, `rappi`, `rbac`, `reports`, `settings`, `staff`, `waitlist`. This is the exact pattern `backTo`/`backLabel` generalizes — reuse its `ChevronLeft` + `Link`/`asChild Button` implementation inside PageContainer.

### Established Patterns
- 9 pages currently lack `PageContainer` entirely (ad-hoc per-page wrapper divs): `audit`, `home` (exempt), `inventory`, `login` (exempt), `payments`, `pos`, `reports`, `settings`, `staff` — 7 of these 9 need PageContainer adoption in this phase (home/login excluded per D-02)
- `pool-table-status`'s `TableStatusPanel` widget hand-rolls its own back button (`ArrowLeft` icon + `useNavigate` + manual click handler) instead of using `BackToHomeButton`/`PageContainer` — this is the COMPONENT-03 duplicate the requirements call out, but COMPONENT-03 is scoped to Phase 31, not this phase; leave it as-is unless it blocks SHELL-01's PageContainer rollout on that route.

### Integration Points
- All `backTo` values must resolve to a route that actually exists in `src/app/router.tsx` (no orphan targets) — cross-check against the corrected 17-route list from D-04.

</code_context>

<specifics>
## Specific Ideas

None beyond the decisions above — user framed the back-nav requirement operationally ("cashier/server needs a fast way back to home/main nav to attend a customer") rather than as a specific visual spec; D-01's inline-header, single-tap placement satisfies this.

</specifics>

<deferred>
## Deferred Ideas

- Replacing `pool-table-status`'s hand-rolled `ArrowLeft` back button with the new `PageContainer`/`backTo` pattern — belongs to Phase 31 (COMPONENT-03), not this phase. Noted so it isn't lost.
- Documenting the new `backTo`/`backLabel` convention in CLAUDE.md's Key Conventions — explicitly declined for this phase (D-04); revisit if a later phase's context needs it.

</deferred>

---

*Phase: 30-Shared Shell & Primitive Extension*
*Context gathered: 2026-07-10*
