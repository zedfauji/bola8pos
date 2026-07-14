---
phase: 34-visual-regression-baseline
verified: 2026-07-14T22:40:00Z
status: human_needed
score: 8/8 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Confirm the residual loading-race flakiness in `waitForPageReady()` is an acceptable known risk, or file a follow-up to harden it (e.g. require a stable non-skeleton DOM signal, not just stable `innerText` length) before relying on this suite to gate future drift."
    expected: "Either (a) explicit acceptance that a cold Vite dev-server start can occasionally produce a false-positive screenshot diff on `/pos` (and potentially other TanStack-Query-driven routes), to be re-run rather than trusted on first failure, or (b) a follow-up ticket to fix `waitForPageReady` so it also verifies the route's real content (not a loading-skeleton placeholder) has rendered before every `toHaveScreenshot()` call."
    why_human: "This is a judgment call about acceptable residual risk for a manual/local-only suite (D-02, no CI gate), not a binary pass/fail the codebase can settle on its own. Directly reproduced during this verification (see below) — not a hypothetical."
---

# Phase 34: Visual Regression Baseline Verification Report

**Phase Goal:** Stand up a Playwright visual-regression suite, isolated from the functional E2E config, and capture screenshot baselines for all 17 routes only now that the audit/shell/token/component/touch/focus fixes (Phases 29-33) are complete — a pre-fix baseline would have frozen the current inconsistencies.
**Verified:** 2026-07-14T22:40:00Z
**Status:** human_needed
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
| 8 | Two consecutive local `npm run test:e2e:visual` runs (no `--update-snapshots`) both exit 0 with zero diffs | ✓ VERIFIED (with new finding — see below) | Independently re-ran the suite three times against the existing (already-committed-locally) baseline, NOT trusting REVIEW-FIX's prose. Run 1: **FAILED** — `admin-pos.png` diff (expected 1280×832 from baseline, received 1280×800; 43,718 px / 5% different) because the freshly-captured `/pos` screenshot showed the product-grid still in loading-skeleton state (gray placeholder blocks, not real product cards) — `waitForPageReady()`'s `innerText`-length-stability heuristic can pass on a stabilized *skeleton* frame, not just a stabilized *real-content* frame. Because the spec runs `test.describe.serial`, this failure skipped the bartender/manager tests ("2 did not run"). Runs 2 and 3 (immediately after, same warm dev server): both **passed cleanly, 5/5, zero diffs** — satisfying the literal roadmap success criterion ("two consecutive local runs... produce zero unintended diffs") on the second attempt. Root cause is very likely dev-server cold-start (my run 1 was the first request to a freshly-spawned `npm run dev` via the config's `webServer` block) exceeding the 15s `waitForPageReady` stabilization budget for `/pos`'s TanStack-Query product-catalog fetch — the same general bug class Plan 02's own deviation #3 investigated and partially fixed, but not fully closed. |

**Score:** 8/8 truths verified. One truth required a new finding to be surfaced to a human (see `human_verification`) rather than being silently accepted as unconditionally stable.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `playwright.visual.config.ts` | isolated visual config | ✓ VERIFIED | Diverges on every D-01 field; no import of `playwright.config.ts` |
| `playwright.config.ts` (testIgnore) | excludes `e2e/visual/` | ✓ VERIFIED | Line 18 |
| `package.json` (`test:e2e:visual`) | npm script | ✓ VERIFIED | Line 30 |
| `.gitignore` (snapshot patterns) | keeps PNGs local-only | ✓ VERIFIED | Lines 38, 42 |
| `src/shared/ui/LiveTimeDisplay.tsx` (`data-testid="live-time-display"`) | mask hook | ✓ VERIFIED | Line 37, attribute-only |
| `src/widgets/KdsBoard/index.tsx` (`data-testid="kds-board"`) | mask hook | ✓ VERIFIED | Line 238, attribute-only |
| `e2e/visual/45-visual-baseline.spec.ts` | baseline capture spec | ✓ VERIFIED | 363 lines, matches PLAN's task description exactly, including the post-review CR-01 fix |
| `e2e/visual/45-visual-baseline.spec.ts-snapshots/*.png` | 43 baseline PNGs | ✓ VERIFIED | All 43 present, gitignored, not stale (see Data-Flow / freshness check below) |

### Baseline Freshness Check (specific focus area per task)

Per-file `mtime` inspection (not trusting REVIEW-FIX prose):
- 30 of 43 PNGs date `Jul 14 15:07–15:09` (the original Task 2 seed).
- 13 PNGs (`{admin,bartender,manager}-pool-tables`, `{admin,bartender,manager}-rappi`, `{admin,bartender,manager}-pool-table-status`, `{admin,bartender,manager}-kds-bar`, `admin-kds`) carry later timestamps `Jul 14 16:12–16:23`, consistent with REVIEW-FIX's documented post-CR-01-fix re-seed (deleted-and-regenerated after the `--update-snapshots` silent-no-rewrite bug). This is newer evidence than the original flawed seed, confirming the re-seed genuinely happened on disk, not just in prose.
- Rendered and visually inspected `admin-pool-tables-chromium-win32.png`, `admin-rappi-chromium-win32.png`, and `admin-pool-table-status-chromium-win32.png` directly: all three show a **magenta mask box** over the `LiveTimeDisplay` clock region (top-right), not live time text — CR-01 is genuinely fixed on disk, not just in the spec source. `admin-pool-table-status` shows the correct active-session detail view (elapsed-minutes masked, dollar total, items list) — not the Supabase-error state REVIEW-FIX describes as the earlier bug.
- Rendered `admin-kds-chromium-win32.png`: confirms WR-02 (deferred, non-blocking) — the entire `kds-board` region is a single magenta block, providing zero layout coverage for that region, exactly as the code review documented and the fix report explicitly deferred as out-of-scope.
- Rendered `bartender-audit-denied-chromium-win32.png`: shows the sonner "This page is restricted to managers and admins" toast over the `/home` dashboard grid, matching D-15's intent.

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
| Two-run zero-diff gate | `npm run test:e2e:visual` × 3 (live re-run, this verification) | Run 1: 1 failed / 2 did not run (soft screenshot diff on `admin-pos.png`, loading-skeleton race). Runs 2 & 3: 5/5 passed, zero diffs each. | ⚠️ FLAKY — see Truth #8 and `human_verification` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| VISUAL-01 | 34-01-PLAN.md | Isolated visual-regression config | ✓ SATISFIED | Config divergence + testIgnore verified directly |
| VISUAL-02 | 34-02-PLAN.md | Baselines for all 17 routes, post-fix | ✓ SATISFIED | 43 PNGs present, human-approved (Task 3 checkpoint), spot-checked correct rendering |
| VISUAL-03 | 34-01/34-02-PLAN.md | Dynamic regions masked, flaky-avoidance | ✓ SATISFIED (with caveat) | Masks present and correct including CR-01 fix; residual loading-race flakiness found and surfaced to human, not silently dropped |

No orphaned requirements — `.planning/REQUIREMENTS.md` maps only VISUAL-01/02/03 to Phase 34, and both plans' frontmatter jointly declare all three.

### Anti-Patterns Found

None. Scanned all 7 phase-touched files (`playwright.visual.config.ts`, `playwright.config.ts`, `package.json` diff, `.gitignore` diff, `e2e/visual/45-visual-baseline.spec.ts`, `src/shared/ui/LiveTimeDisplay.tsx`, `src/widgets/KdsBoard/index.tsx`) for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` — zero matches. WR-02 (KDS board over-masking) is a documented, explicitly-deferred quality tradeoff from the code review, not an anti-pattern introduced silently.

### Security

`34-SECURITY.md` claims `threats_open: 0`, 4/4 threats closed. Independently re-verified the two load-bearing claims:
- T-34-01 (baseline PNGs must never be committed): confirmed via `git ls-files`/`git check-ignore` above — holds.
- T-34-02 (config isolation): confirmed via direct config read — holds.
No new threats introduced by this phase beyond what's already registered.

### Human Verification Required

1. **Residual loading-race flakiness in `waitForPageReady()`**
   **Test:** Stop any running dev server, then run `npm run test:e2e:visual` as the very first command (cold `npm run dev` spin-up via the config's `webServer` block), and observe whether `/pos` (or other TanStack-Query-heavy routes) intermittently fails on the first invocation.
   **Expected:** Either the team accepts this as a known re-run-on-first-failure risk for a manual/local-only suite (D-02 — no CI gate), or a follow-up hardens `waitForPageReady()` to detect skeleton-loading placeholders specifically (e.g. wait for absence of a loading-skeleton class/testid, not just `innerText` length stability).
   **Why human:** Judgment call on acceptable residual risk vs. required follow-up; not a binary pass/fail. This was directly reproduced during this verification pass (not hypothetical) — see Truth #8 above for the exact failure evidence (`admin-pos.png`, 1280×800 vs baseline 1280×832, 5% pixel diff).

### Gaps Summary

No blocking gaps. All 8 must-have truths and all 3 requirement IDs (VISUAL-01/02/03) are verified against the actual codebase, not SUMMARY.md prose — including direct re-execution of the two-run zero-diff gate (not just trusting REVIEW-FIX's account), direct visual inspection of 5 baseline PNGs to confirm CR-01's fix and WR-02's deferred tradeoff are genuinely reflected on disk, and independent RBAC/router tracing to confirm the route×role matrix is code-correct.

One new finding (not present in SUMMARY.md/REVIEW.md/REVIEW-FIX.md) surfaces here: the suite is not fully deterministic on a cold dev-server start — a genuine, reproducible (1-in-3 in this verification pass) screenshot diff from a loading-skeleton frame slipping past `waitForPageReady()`. This does not block the phase (the roadmap's literal "two consecutive runs, zero diffs" criterion was independently reproduced as achievable), but is real information the previous artifacts did not capture and a human should weigh before treating this suite as a fully reliable drift-detector.

---

_Verified: 2026-07-14T22:40:00Z_
_Verifier: Claude (gsd-verifier)_
