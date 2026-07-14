---
phase: 34-visual-regression-baseline
verified: 2026-07-14T22:40:00Z
status: passed
score: 8/8 must-haves verified
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "Two consecutive `npm run test:e2e:visual` runs both exit 0 with zero screenshot diffs"
    reason: "Verifier reproduced a cold-dev-server-start flake (waitForPageReady stabilized on a loading skeleton, not real content, on admin-pos.png — 1 of 3 live re-run attempts). Decision: treat as a re-run-once-and-check policy rather than a blocking defect, since retrying against the now-warm dev server passed cleanly twice, and this suite is manual/local-only with no CI gate (D-02). Documented as a known-flake comment in e2e/visual/45-visual-baseline.spec.ts's header; waitForPageReady() hardening explicitly deferred unless the retry itself starts failing."
    accepted_by: "user (via AskUserQuestion, 34-UAT.md Test 1 resolution)"
    accepted_at: "2026-07-14T23:05:00Z"
---

# Phase 34: Visual Regression Baseline Verification Report

**Phase Goal:** Stand up a Playwright visual-regression suite, isolated from the functional E2E config, and capture screenshot baselines for all 17 routes only now that the audit/shell/token/component/touch/focus fixes (Phases 29-33) are complete — a pre-fix baseline would have frozen the current inconsistencies.
**Verified:** 2026-07-14T22:40:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A second Playwright config exists, isolated from the functional config (headless, bundled Chromium, no `slowMo`, no `channel:'chrome'`, no `globalTeardown`) | ✓ VERIFIED | `playwright.visual.config.ts` read directly: `testDir: './e2e/visual'`, `headless: true`, `projects: [{ name: 'chromium', use: {} }]` (no `channel`), no `slowMo`, no `globalTeardown` key. Confirmed via direct file read, not grep-only. |
| 2 | Functional `playwright.config.ts` excludes `e2e/visual/` via `testIgnore`, so `npm run test:e2e` never picks up the visual spec | ✓ VERIFIED | `playwright.config.ts:18` — `testIgnore: /visual\//,` present, confirmed by direct read. |
| 3 | `test:e2e:visual` npm script and `.gitignore` snapshot-dir entries present | ✓ VERIFIED | `package.json:30` — `"test:e2e:visual": "playwright test --config=playwright.visual.config.ts"`. `.gitignore:38,42` — `e2e-results-visual/` and `e2e/visual/**/*-snapshots/`. |
| 4 | Two mask test-hooks (`live-time-display`, `kds-board`) exist, attribute-only | ✓ VERIFIED | `src/shared/ui/LiveTimeDisplay.tsx:37` and `src/widgets/KdsBoard/index.tsx:238` both carry the `data-testid`, className/children unchanged (confirmed by direct read). |
| 5 | Baseline PNGs exist for admin (17 routes), bartender (11 accessible + 1 denied-toast), manager (14 accessible) per the code-verified route×role matrix | ✓ VERIFIED | 43 PNGs on disk under `e2e/visual/45-visual-baseline.spec.ts-snapshots/` (16 `admin-*` + `login.png` = 17 admin routes; 12 `bartender-*` incl. `bartender-audit-denied.png`; 14 `manager-*`). Cross-checked the spec's `ADMIN_ROUTES`/`BARTENDER_ROUTES`/`MANAGER_ROUTES`/denied arrays against `src/app/router.tsx` route guards (`KdsRoute`→`view_kds`, `WaitlistRoute`→`manage_waitlist`, `RbacRoute`→`manage_staff`, `AuditRoute`→`view_audit_log`, `ReportsRoute`→`view_reports`) and `src/shared/lib/rbac.ts`'s `BARTENDER_ACTIONS`/`MANAGER_ACTIONS` sets — the matrix in the spec is correct (bartender lacks `view_kds`/`view_reports`/`manage_waitlist`/`manage_staff`/`view_audit_log`; manager additionally lacks only `view_kds`/`manage_staff`). |
| 6 | Dynamic regions masked: pool timers, KDS board + live clock, `/pos` promo banner, toast container, plus `/pool-tables` and `/rappi` live-clock (CR-01 fix) | ✓ VERIFIED | Read `masksFor()` in the spec directly — covers `/pos` (promo banner+toast), `/pool-tables`+`/rappi` (live clock+toast, the CR-01 fix), `/pool-tables/:id` (elapsed-minutes+toast), `/kds`+`/kds-bar` (kds-board+live clock+toast), `/staff` (Clock-in/Shift-duration columns + Opened: text + toast), all other routes (toast only). Spot-checked rendered PNGs (see below) — masks visually present as magenta boxes over exactly the intended regions. |
| 7 | Baseline PNGs are gitignored, not committed | ✓ VERIFIED | `git ls-files e2e/visual/` returns only `45-visual-baseline.spec.ts` (no `.png`). `git check-ignore -v e2e/visual/45-visual-baseline.spec.ts-snapshots` exits 0. `git status --porcelain e2e/` clean of `.png` entries. |
| 8 | Two consecutive local `npm run test:e2e:visual` runs (no `--update-snapshots`) both exit 0 with zero diffs | ✓ PASSED (override) | See `overrides` in frontmatter. Independently re-ran the suite three times against the existing baseline (not trusting REVIEW-FIX's prose). Run 1: **FAILED** — `admin-pos.png` diff (baseline 1280×832, captured 1280×800; 43,718 px / 5% different) because `/pos` was still on a loading-skeleton frame — `waitForPageReady()`'s `innerText`-length-stability heuristic stabilized on the skeleton, not real content, most likely because run 1 was the very first request to a cold-started `npm run dev` (via the config's `webServer` block) and the product-catalog fetch exceeded the 15s stabilization budget. Runs 2 and 3 (same now-warm server): both passed cleanly, 5/5, zero diffs — literally satisfying "two consecutive runs, zero diffs." Developer reviewed this finding and decided: re-run once on a first-invocation failure; only harden `waitForPageReady()` if a retry also fails. That policy is now documented as a comment in the spec's file header. No code logic changed (`retries: 0` in `playwright.visual.config.ts` deliberately stays — an automatic retry must never silently mask a real visual regression; only a human-directed manual re-run is appropriate here). |

**Score:** 8/8 truths verified (7 clean + 1 via developer-accepted override, documented above).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `playwright.visual.config.ts` | isolated visual config | ✓ VERIFIED | Diverges on every D-01 field; no import of `playwright.config.ts` |
| `playwright.config.ts` (testIgnore) | excludes `e2e/visual/` | ✓ VERIFIED | Line 18 |
| `package.json` (`test:e2e:visual`) | npm script | ✓ VERIFIED | Line 30 |
| `.gitignore` (snapshot patterns) | keeps PNGs local-only | ✓ VERIFIED | Lines 38, 42 |
| `src/shared/ui/LiveTimeDisplay.tsx` (`data-testid="live-time-display"`) | mask hook | ✓ VERIFIED | Line 37, attribute-only |
| `src/widgets/KdsBoard/index.tsx` (`data-testid="kds-board"`) | mask hook | ✓ VERIFIED | Line 238, attribute-only |
| `e2e/visual/45-visual-baseline.spec.ts` | baseline capture spec | ✓ VERIFIED | 372 lines (post-verification: added an 8-line known-flake/retry-policy comment to the file header per developer decision — zero test-logic change), matches PLAN's task description exactly, including the post-review CR-01 fix |
| `e2e/visual/45-visual-baseline.spec.ts-snapshots/*.png` | 43 baseline PNGs | ✓ VERIFIED | All 43 present, gitignored, not stale (see Data-Flow / freshness check below) |

### Baseline Freshness Check (specific focus area per task)

Per-file `mtime` inspection (not trusting REVIEW-FIX prose):
- 30 of 43 PNGs date `Jul 14 15:07–15:09` (the original Task 2 seed).
- 13 PNGs (`{admin,bartender,manager}-pool-tables`, `{admin,bartender,manager}-rappi`, `{admin,bartender,manager}-pool-table-status`, `{admin,bartender,manager}-kds-bar`, `admin-kds`) carry later timestamps `Jul 14 16:12–16:23`, consistent with REVIEW-FIX's documented post-CR-01-fix re-seed (deleted-and-regenerated after the `--update-snapshots` silent-no-rewrite bug). This is newer evidence than the original flawed seed, confirming the re-seed genuinely happened on disk, not just in prose.
- Rendered and visually inspected `admin-pool-tables-chromium-win32.png`, `admin-rappi-chromium-win32.png`, and `admin-pool-table-status-chromium-win32.png` directly: all three show a **magenta mask box** over the `LiveTimeDisplay` clock region (top-right), not live time text — CR-01 is genuinely fixed on disk, not just in the spec source. `admin-pool-table-status` shows the correct active-session detail view (elapsed-minutes masked, dollar total, items list) — not the Supabase-error state REVIEW-FIX describes as the earlier bug.
- Rendered `admin-kds-chromium-win32.png`: confirms WR-02 (deferred, non-blocking) — the entire `kds-board` region is a single magenta block, providing zero layout coverage for that region, exactly as the code review documented and the fix report explicitly deferred as out-of-scope.
- Rendered `bartender-audit-denied-chromium-win32.png`: shows the sonner "This page is restricted to managers and admins" toast over the `/home` dashboard grid, matching D-15's intent.
- None of the 43 baseline PNGs were rewritten by this verification's live re-runs (no `--update-snapshots` was used) — confirmed `admin-pos-chromium-win32.png`'s mtime is unchanged (`15:08`) after all 3 verification runs.

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `playwright.config.ts` `testIgnore` | `e2e/visual/` spec path | regex exclusion | ✓ WIRED | Confirmed via direct config read (not just grep) |
| `data-testid="live-time-display"`/`"kds-board"` | `e2e/visual/45-visual-baseline.spec.ts` `masksFor()` | `page.getByTestId(...)` | ✓ WIRED | Spec's `masksFor()` references both testids exactly |
| route×role matrix in spec | `src/app/router.tsx` + `src/shared/lib/rbac.ts` | route-guard components (`KdsRoute`, `WaitlistRoute`, `RbacRoute`, `AuditRoute`, `ReportsRoute`) → `canAccess()` | ✓ WIRED | Independently traced every guard component to its `can('...')` check and cross-referenced against `BARTENDER_ACTIONS`/`MANAGER_ACTIONS`/`ADMIN_ACTIONS` — spec's accessible/denied lists match exactly |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Config isolation smoke | `npx playwright test --list` (functional) never enumerates `e2e/visual/` | Not re-run live (static evidence sufficient: `testIgnore` regex is unambiguous and PLAN's own acceptance criterion already required this at execution time) | ✓ PASS (static) |
| Visual spec discoverable under isolated config | `npx playwright test --config=playwright.visual.config.ts --list` | Not re-run (spec content directly read and matches all PLAN 02 acceptance-criteria greps) | ✓ PASS (static) |
| Two-run zero-diff gate | `npm run test:e2e:visual` × 3 (live re-run, this verification) | Run 1: 1 failed / 2 did not run (soft screenshot diff on `admin-pos.png`, loading-skeleton race on cold dev-server start). Runs 2 & 3: 5/5 passed, zero diffs each. | ✓ PASS (override — see frontmatter) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| VISUAL-01 | 34-01-PLAN.md | Isolated visual-regression config | ✓ SATISFIED | Config divergence + testIgnore verified directly |
| VISUAL-02 | 34-02-PLAN.md | Baselines for all 17 routes, post-fix | ✓ SATISFIED | 43 PNGs present, human-approved (Task 3 checkpoint), spot-checked correct rendering |
| VISUAL-03 | 34-01/34-02-PLAN.md | Dynamic regions masked, flaky-avoidance | ✓ SATISFIED | Masks present and correct including CR-01 fix; residual cold-start loading-race flake found, disclosed, and resolved via developer-accepted retry-once policy (documented in spec header) rather than silently dropped |

No orphaned requirements — `.planning/REQUIREMENTS.md` maps only VISUAL-01/02/03 to Phase 34, and both plans' frontmatter jointly declare all three.

### Anti-Patterns Found

None. Scanned all 7 phase-touched files (`playwright.visual.config.ts`, `playwright.config.ts`, `package.json` diff, `.gitignore` diff, `e2e/visual/45-visual-baseline.spec.ts`, `src/shared/ui/LiveTimeDisplay.tsx`, `src/widgets/KdsBoard/index.tsx`) for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` — zero matches. WR-02 (KDS board over-masking) is a documented, explicitly-deferred quality tradeoff from the code review, not an anti-pattern introduced silently.

### Security

`34-SECURITY.md` claims `threats_open: 0`, 4/4 threats closed. Independently re-verified the two load-bearing claims:
- T-34-01 (baseline PNGs must never be committed): confirmed via `git ls-files`/`git check-ignore` above — holds.
- T-34-02 (config isolation): confirmed via direct config read — holds.
No new threats introduced by this phase beyond what's already registered.

### Human Verification Required

None outstanding. The one open item (residual `waitForPageReady()` loading-race flake on cold dev-server start) was resolved by the developer mid-verification: accepted as a re-run-once policy rather than requiring an immediate code fix, with the policy documented as a comment in `e2e/visual/45-visual-baseline.spec.ts`'s file header. Escalate again (and revisit hardening `waitForPageReady()` to check for absence of a skeleton/loading marker rather than just stable `innerText` length) only if a retry-after-failure itself starts failing.

### Gaps Summary

No gaps. All 8 must-have truths and all 3 requirement IDs (VISUAL-01/02/03) are verified against the actual codebase, not SUMMARY.md prose — including direct re-execution of the two-run zero-diff gate three times live (not just trusting REVIEW-FIX's account), direct visual inspection of 5 baseline PNGs to confirm CR-01's fix and WR-02's deferred tradeoff are genuinely reflected on disk, and independent RBAC/router tracing to confirm the route×role matrix is code-correct.

One new finding surfaced during this verification (not present in SUMMARY.md/REVIEW.md/REVIEW-FIX.md): the suite is not fully deterministic on a cold dev-server start — a genuine, reproducible (1-in-3 in this verification pass) screenshot diff from a loading-skeleton frame slipping past `waitForPageReady()`. Resolved via developer decision (retry-once policy, documented in-spec) rather than either silently ignored or treated as a hard blocker.

---

_Verified: 2026-07-14T22:40:00Z_
_Verifier: Claude (gsd-verifier)_
