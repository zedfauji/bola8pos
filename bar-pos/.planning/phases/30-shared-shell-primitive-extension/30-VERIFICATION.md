---
phase: 30-shared-shell-primitive-extension
verified: 2026-07-10T21:00:00Z
reverified: 2026-07-10T22:00:00Z
status: passed
score: 4/4 must-haves verified (roadmap success criteria, with 1 accepted override)
overrides_applied: 1
overrides:
  - must_have: "PageContainer is extended with backTo/backLabel props and wraps all 17 routes; zero ad-hoc per-page layout wrappers remain"
    reason: "login and home are structurally exempt (D-02, documented in 30-CONTEXT.md before execution): LoginPage is a full-bleed auth screen with no sensible back target; HomePage IS the back-navigation destination, so wrapping it in PageContainer's title/back-button chrome would be redundant. All 15 non-exempt routes are migrated and verified."
    accepted_by: "user (via AskUserQuestion during /gsd-execute-phase 30)"
    accepted_at: "2026-07-10T21:45:00Z"
gaps: []
---

# Phase 30: Shared Shell & Primitive Extension Verification Report

**Phase Goal:** Every one of the 17 routes uses a single canonical layout shell instead of ad-hoc per-page wrappers; dead navigation code is deleted rather than resurrected; CLAUDE.md matches the router's actual routes.
**Verified:** 2026-07-10T21:00:00Z
**Re-verified:** 2026-07-10T22:00:00Z
**Status:** PASSED
**Re-verification:** Yes — user accepted the D-02 override for SC#1 (login/home exemption) and requested the E2E blocker be investigated rather than deferred.

## Post-Initial-Verification Update

Both open items from the initial `gaps_found` pass were resolved:

1. **D-02 override accepted** — user confirmed `login`/`home`'s exemption from `PageContainer` is intentional (per `30-CONTEXT.md`'s pre-execution decision), not an oversight. See `overrides` in frontmatter.
2. **E2E blocker investigated and fixed** — user asked to investigate rather than defer. Freed port 1420 (killed a stray `node.exe`, PID 39312), started the dev server, and ran the 3 targeted specs. `e2e/15-home-navigation.spec.ts` failed nearly across the board on its very first assertion: `bartender login lands on /home` — actual URL was `/pos`. Root cause: **`src/pages/login/index.tsx`'s `isAuthenticated` guard redirected to `/pos`, racing `PINLoginForm.tsx`'s `navigate('/home')` call after a successful login** — a genuine pre-existing bug, unrelated to any Phase 30 file (confirmed: neither file appears in any of the 5 plans' `files_modified`). Fixed by aligning the guard to `/home` (commit `b6e1729`, separate from the phase's plan commits). Re-ran the specs: all of `15-home-navigation.spec.ts` now passes except one unrelated pre-existing item (T11); `16-table-status.spec.ts`/`17-payment-pane.spec.ts` still have failures traced to live-Supabase-backend latency (a "Start Session" RPC call exceeding a 120s timeout) — confirmed unrelated to the shell/`PageContainer` code via direct page-snapshot inspection (the `Home`/`Pool Tables` back-links and `PageContainer`-rendered titles are present and correct in every failure snapshot). These are pre-existing test-infra/backend-latency flakiness, out of scope for this phase, and do not block Phase 30 closure.

typecheck/lint/full unit suite re-confirmed clean after the login fix (same baseline: 2 pre-existing typecheck errors, lint exit 0, 1212 passed / 1 pre-existing `useCloseTab.test.ts` failure / 15 todo).

## Goal Achievement

### Observable Truths

| # | Truth (Roadmap Success Criterion) | Status | Evidence |
|---|---------|--------|----------|
| 1 | `PageContainer` extended with `backTo`/`backLabel`, wraps all 17 routes, zero ad-hoc per-page wrappers remain | ⚠️ PARTIAL / FAILED (literal wording) | `PageContainer.tsx`/`SectionHeader.tsx` correctly extended and test-locked (`PageContainer.test.tsx` 3/3 pass). 15 of 17 routes (`pos, pool-tables, inventory, staff, reports, settings, rappi, pool-table-status, payments, kds, kds-bar, kitchen-prep, waitlist, rbac, audit`) confirmed via direct file read to use `<PageContainer backTo=...>` with no `BackToHomeButton` remaining. `login` and `home` still use raw ad-hoc `<div>` wrappers (no `PageContainer` at all) — a documented, pre-execution scope decision (D-02 in `30-CONTEXT.md`), not an oversight, but literally contradicts ROADMAP.md's "all 17 routes"/"zero ad-hoc wrappers" wording. |
| 2 | `AppShell` and `AppNav` (zero real consumers) deleted, not resurrected | ✓ VERIFIED | `src/shared/ui/AppShell.tsx`, `src/widgets/AppNav/` confirmed absent from filesystem. `grep -rn "BackToHomeButton\|AppShell\|widgets/AppNav" src` returns zero import/usage matches (one harmless stale code *comment* in `PaymentsPage.test.tsx` mentioning the old name, not an import). `src/shared/ui/index.ts` barrel contains no `BackToHomeButton`/`AppShell`/`AppShellProps` export lines. |
| 3 | `CLAUDE.md` routes table lists all 17 actually-registered routes, matching `router.tsx` | ✓ VERIFIED | `grep -c "^| \`/" CLAUDE.md` = 17. Cross-checked every path in the table against `src/app/router.tsx`'s 17 `<Route>` elements (login, home, pos, pool-tables, pool-tables/:tableId, inventory, staff, reports, settings, rappi, payments, kds, kds-bar, kitchen-prep, waitlist, rbac, audit) — exact 1:1 match, including the 3 previously-missing rows (`/kds`, `/kitchen-prep`, `/audit`). |
| 4 | Full-repo `npm run typecheck` and `npm run lint` pass after the shell swap, isolated commits | ✓ VERIFIED | Ran directly (not from SUMMARY claims): `npm run typecheck` → exactly the 2 documented pre-existing unrelated errors (`tab/model/queries.ts(778,11)`, `agent/rag.ts(60,7)`), no new errors. `npm run lint` → exit clean (0 blocking issues, only an informational `boundaries` config warning unrelated to this phase). `git log` confirms 9 atomic phase commits (`84a2e26`..`d5ce6a2`), each scoped to its plan's file list. |

**Score:** 3/4 truths fully verified; truth #1 partially met (15/17 routes) with a documented-but-unaccepted scope deviation.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/shared/ui/PageContainer.tsx` | `backTo?`/`backLabel?` forwarded to SectionHeader via conditional spread | ✓ VERIFIED | `{...(backTo && { backTo })}` / `{...(backLabel && { backLabel })}` present, matches `exactOptionalPropertyTypes`-safe idiom. |
| `src/shared/ui/SectionHeader.tsx` | Inline ghost back-Link (ChevronLeft) above title | ✓ VERIFIED | `ChevronLeft` + `Button variant="ghost" size="sm" asChild` + `Link to={backTo}` + `{backLabel ?? 'Home'}`, exact pinned classes (`-ml-2.5 h-6 px-2 text-xs`, `h-3.5 w-3.5`). |
| `src/shared/ui/PageContainer.test.tsx` | 3 regression cases (no backTo / default Home / custom label) | ✓ VERIFIED | All 3 `it(...)` blocks present; ran directly — 3/3 pass. |
| 15 page files (`kds`, `kds-bar`, `kitchen-prep`, `pool-tables`, `rappi`, `rbac`, `waitlist`, `audit`, `settings`, `staff`, `inventory`, `reports`, `pos`, `payments`, `pool-table-status`) | Use `PageContainer` with correct `backTo` target, no `BackToHomeButton` | ✓ VERIFIED | Read every file directly. All use `PageContainer`; zero `BackToHomeButton` references; `pool-table-status` correctly uses `backTo="/pool-tables" backLabel="Pool Tables"` (not the generic `/home`); `inventory`'s `physical-count-btn` testid + `canPhysicalCount` gate preserved in the `actions` slot; `reports` still has all 13 `TabsTrigger`s; `pos`/`payments` retain single `h-screen` ownership with `max-w-none`/`p-0` neutralizing className. |
| `src/shared/ui/BackToHomeButton.tsx`, `src/shared/ui/AppShell.tsx`, `src/widgets/AppNav/` | Deleted | ✓ VERIFIED | Confirmed absent via filesystem check. |
| `src/shared/ui/index.ts` | 3 dead export lines removed, no shim | ✓ VERIFIED | Barrel read in full — no `BackToHomeButton`/`AppShell`/`AppShellProps` exports; no replacement added. |
| `CLAUDE.md` routes table | 17 rows matching `router.tsx` | ✓ VERIFIED | 17 rows present, includes `/kds`, `/kitchen-prep`, `/audit`; diff scoped only to the routes table (no other section touched, per D-04). |
| `src/pages/login/index.tsx`, `src/pages/home/index.tsx` | (Roadmap expects PageContainer here; plan explicitly exempts them) | ⚠️ GAP vs literal roadmap wording | Both still use raw ad-hoc `<div>` wrappers, zero `PageContainer` usage. Deliberate per D-02, but not what SC#1's literal text says. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `PageContainer.tsx` | `SectionHeader.tsx` | conditional-spread prop forwarding | ✓ WIRED | Confirmed in source. |
| `SectionHeader.tsx` | `react-router-dom Link` | back-navigation anchor | ✓ WIRED | `Link to={backTo}` renders only when `backTo` truthy; test-locked. |
| 15 page files | `PageContainer backTo prop` | prop replaces standalone `BackToHomeButton` | ✓ WIRED | Verified per-file. |
| `src/shared/ui/index.ts` | deleted components | export lines removed | ✓ WIRED (absence confirmed) | No dangling re-export; `grep` confirms zero references anywhere in `src`. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| SHELL-01 | 30-01, 30-02, 30-03, 30-04, 30-05 | Every route uses a single shared layout shell instead of ad-hoc per-page wrappers | ⚠️ PARTIAL | 15/17 routes migrated and verified; `login`/`home` remain ad-hoc by a documented D-02 scope decision that contradicts the requirement's literal "every route" wording. REQUIREMENTS.md marks this `[x]` complete, but codebase evidence only supports 15/17. |
| SHELL-02 | 30-05 | Dead `AppShell`/`AppNav` (zero real consumers) removed, not resurrected | ✓ SATISFIED | Files deleted, barrel cleaned, zero dangling references confirmed by direct grep. |
| SHELL-03 | 30-05 | `CLAUDE.md` routes table matches router's actual 17 registered routes | ✓ SATISFIED | 17-row table confirmed to exactly match `router.tsx`. |

No orphaned requirements found for this phase — all 3 declared requirement IDs (SHELL-01, SHELL-02, SHELL-03) are referenced across the 5 plans' frontmatter and covered above.

### Anti-Patterns Found

Scanned all files modified across the phase's 5 plans (`PageContainer.tsx`, `SectionHeader.tsx`, `PageContainer.test.tsx`, `src/shared/ui/index.ts`, `CLAUDE.md`, and all 15 migrated page files) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/stub patterns.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | none found | — | No debt markers, stub returns, or empty handlers found in any phase-modified file. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `PageContainer` back-link behavior (3 cases) | `npx vitest run src/shared/ui/PageContainer.test.tsx` | 3/3 pass | ✓ PASS |
| `PaymentsPage` Home-link contract | `npx vitest run src/pages/payments/PaymentsPage.test.tsx` | pass (part of 9/9 combined run) | ✓ PASS |
| `ReportsPage` Home-link contract + 13-tab body | `npx vitest run src/pages/reports/ReportsPage.test.tsx` | pass (part of 9/9 combined run) | ✓ PASS |
| Full-repo typecheck | `npm run typecheck` | exactly 2 documented pre-existing errors, no new errors | ✓ PASS |
| Full-repo lint | `npm run lint` | exit clean, 0 blocking violations | ✓ PASS |
| Full unit suite | `npm run test` | 1212 passed / 1 pre-existing documented failure (`useCloseTab.test.ts:95`, tracked since Phase 15) / 15 todo — matches documented baseline exactly | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` probes declared or discovered for this phase. SKIPPED — not applicable (this is a UI-refactor phase with Vitest/Playwright coverage, not a migration/CLI-tooling phase).

### Human Verification Required

### 1. Targeted E2E specs (home-nav, table-status, payment-pane back-link contract)

**Test:** Run `npx playwright test e2e/15-home-navigation.spec.ts e2e/16-table-status.spec.ts e2e/17-payment-pane.spec.ts` against a running dev server with valid `.env.local` E2E credentials.
**Expected:** All 3 specs pass, confirming the 'Home'/'Pool Tables' back-link accessible-name/href contract holds end-to-end (not just at the RTL unit level) across the migrated pages, and that `auth.ts`'s `logout()` teardown (which depends on the Home link) still works.
**Why human:** The 30-05 executor found port 1420 already occupied by a stray non-Vite process (bare 404, no Vite headers) that Playwright's `reuseExistingServer` check rejected, so it could not bind a fresh dev server; this was explicitly deferred rather than silently skipped (per the plan's own fallback instruction). Re-checking at verification time (`netstat`) confirms port 1420 is still occupied by a listening process. Starting/killing that process, or spinning up a dev server, is out of scope for a read-only verification pass — this requires a human (or a follow-up execution session) to free the port and re-run the 3 specs.

### 2. Scope-narrowing decision on login/home exemption (D-02)

**Test:** Product/human review of whether `login` and `home` should remain permanently exempt from `PageContainer` (per `30-CONTEXT.md` D-02's rationale: LoginPage has no sensible back target; HomePage IS the back-nav destination), or whether ROADMAP.md's Success Criterion #1 wording ("wraps all 17 routes; zero ad-hoc per-page layout wrappers remain") should be corrected to say "15 of 17 non-exempt routes" to match what was actually planned and delivered.
**Expected:** A decision recorded either as (a) a `VERIFICATION.md` override accepting D-02, with ROADMAP.md's SC#1 text amended for future clarity, or (b) a small follow-up plan wrapping `login`/`home` in `PageContainer` (with `backTo` omitted, since neither needs a back link) purely for the sake of literal "every route" compliance.
**Why human:** This is a scope-interpretation question, not a code-correctness question — the implementation is internally consistent and well-reasoned, but it deviates from the literal contract text that gates phase completion, and only a human can authorize accepting that deviation.

**This looks intentional.** To accept this deviation, add to VERIFICATION.md frontmatter:

```yaml
overrides:
  - must_have: "PageContainer is extended with backTo/backLabel props and wraps all 17 routes; zero ad-hoc per-page layout wrappers remain"
    reason: "login and home are structurally exempt (D-02, documented in 30-CONTEXT.md before execution): LoginPage is a full-bleed auth screen with no sensible back target; HomePage IS the back-navigation destination, so wrapping it in PageContainer's title/back-button chrome would be redundant. All 15 non-exempt routes are migrated and verified."
    accepted_by: "<name>"
    accepted_at: "<ISO timestamp>"
```

### Gaps Summary

The phase's core deliverable — extending `PageContainer`/`SectionHeader` with `backTo`/`backLabel` and migrating every non-exempt route off `BackToHomeButton` — is real, correctly wired, and test-locked. SHELL-02 (dead-code deletion) and SHELL-03 (CLAUDE.md routes table) are both fully and cleanly satisfied, independently re-verified against the filesystem rather than trusting SUMMARY.md. Full-repo typecheck, lint, and the unit suite were re-run directly and match the documented baseline exactly (no regressions).

The one substantive gap is a **scope discrepancy, not an implementation bug**: ROADMAP.md's Success Criterion #1 and REQUIREMENTS.md's SHELL-01 text both say "every route" / "all 17 routes" / "zero ad-hoc per-page layout wrappers remain," but the actual, pre-planned scope (documented as decision D-02 in `30-CONTEXT.md`, made before any execution) deliberately excludes `login` and `home` — 2 of the 17 routes — which still use raw ad-hoc `<div>` wrappers with no `PageContainer` at all. The rationale for D-02 is sound (auth screen has no back target; home IS the back-nav destination), and every plan/summary is transparent about this being 15/15 non-exempt migrations rather than 17/17. However, per verification standards, a literal-text roadmap contract cannot be silently narrowed by a phase-internal planning decision without an explicit accepted override — hence this is surfaced as a gap requiring a human decision (accept via override, or close with a small follow-up plan) rather than marked as fully passed.

Additionally, the 3 targeted E2E specs (15/16/17) that guard the back-link contract end-to-end were not run in this verification pass (port 1420 still occupied by a stray process, consistent with the 30-05 executor's finding) — flagged as human verification, not silently treated as passing.

---

*Verified: 2026-07-10T21:00:00Z*
*Verifier: Claude (gsd-verifier)*
