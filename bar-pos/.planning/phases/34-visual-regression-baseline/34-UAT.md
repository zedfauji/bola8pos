---
status: resolved
phase: 34-visual-regression-baseline
source: [34-VERIFICATION.md]
started: 2026-07-14T22:45:00Z
updated: 2026-07-14T23:05:00Z
---

## Current Test

number: 1
name: Residual loading-race flakiness in waitForPageReady() on cold dev-server start
expected: |
  Stop any running dev server, then run `npm run test:e2e:visual` as the very first command
  (cold `npm run dev` spin-up via the config's `webServer` block). Observe whether `/pos`
  (or other TanStack-Query-heavy routes) intermittently fails on the first invocation because
  a loading-skeleton frame slips past `waitForPageReady()`'s innerText-length-stability check.

  This was directly reproduced during phase verification: run 1 (cold server) failed on
  `admin-pos.png` (baseline 1280×832 vs. captured 1280×800, 5% pixel diff — product grid still
  showing skeleton placeholders). Runs 2 and 3 (same warm server, immediately after) passed
  cleanly, 5/5, zero diffs — satisfying the roadmap's literal "two consecutive runs, zero diffs"
  criterion on the second attempt.

  Decide: accept this as a known re-run-on-first-failure risk for a manual/local-only suite
  (D-02 — no CI gate, so this only affects a human running it locally), or file a follow-up to
  harden `waitForPageReady()` to detect skeleton-loading placeholders specifically instead of
  relying on innerText length stability alone.
awaiting: none — resolved

## Tests

### 1. Residual loading-race flakiness in waitForPageReady() on cold dev-server start
expected: See above — judgment call on acceptable residual risk vs. required follow-up.
result: PASS — user selected "Accept as known re-run-once risk" via AskUserQuestion. No CI gate exists (D-02, manual/local-only), so this only affects a human re-running once locally. `waitForPageReady()` hardening explicitly deferred unless the retry itself starts failing. Documented as a known-flake comment in `e2e/visual/45-visual-baseline.spec.ts`'s header.

## Summary

total: 1
passed: 1
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
