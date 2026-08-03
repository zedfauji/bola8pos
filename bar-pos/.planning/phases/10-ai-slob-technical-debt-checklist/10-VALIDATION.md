---
phase: 10
slug: ai-slob-technical-debt-checklist
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-03
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest v4 (unit), Playwright v1.59 (E2E) — both pre-existing, unchanged by this phase |
| **Config file** | `bar-pos/vitest.config.ts`, `bar-pos/playwright.config.ts` |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test && npm run test:e2e` |
| **Estimated runtime** | ~seconds (unit) / several minutes (E2E, requires display + Chrome) |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck` (adding devDependencies + config files must not break typecheck)
- **Sampling continuity:** all 7 tasks across the 3 plans carry an `<automated>` verify — no gap of 3 consecutive tasks without one
- **After every plan wave:** Run the full 7-check audit script once (lint/typecheck/test/e2e + knip/jscpd/madge), before writing CHECKLIST.md
- **Before `/gsd-verify-work`:** Full suite must be green; CHECKLIST.md's stated finding counts must reconcile against the raw tool JSON reports
- **Max feedback latency:** N/A — this is a one-off audit/documentation phase, not an iterative feature-behavior loop

---

## Per-Task Verification Map

This phase has no `REQUIREMENTS.md` entries (`phase_req_ids` is null — `.planning/REQUIREMENTS.md` does not exist in this project). There is no feature behavior to unit-test; the phase's "correctness" is that `CHECKLIST.md` accurately reflects the 7 tools' actual output.

Baselines were measured live on 2026-08-03 immediately before planning: `npm run typecheck` exit 0, `npm run lint` exit 0, `npm run test` 151 files / 1391 tests passed, exit 0. All three are therefore real regression gates in the table below, not aspirational ones. `npm run test:e2e` was deliberately NOT gated — it is an audit *input* expected to surface findings (STATE.md records pre-existing strict-mode-locator failures).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | N/A (no REQUIREMENTS.md) | T-10-SC | Registry age + empty-postinstall asserted for knip/jscpd/madge before install; devDeps only | smoke | `npm run audit:tech-debt && jq -e . .audit-tmp/knip-report.json && jq -e . .audit-tmp/knip-production.json && npm run typecheck && npm run lint && npm run test` | ✅ | ⬜ pending |
| 10-01-02 | 01 | 1 | N/A (no REQUIREMENTS.md) | T-10-03 | Report existence asserted rather than trusting the script's swallowed exit code | smoke | `npm run audit:tech-debt && jq -e . .audit-tmp/jscpd-out/jscpd-report.json && jq -e . .audit-tmp/madge-circular.json` | ✅ | ⬜ pending |
| 10-01-03 | 01 | 1 | N/A (no REQUIREMENTS.md) | — | N/A | structural | `bash -n scripts/run-tech-debt-audit.sh && test "$(grep -v '^[[:space:]]*#' scripts/run-tech-debt-audit.sh \| grep -cE 'npx (eslint\|tsc\|vitest\|playwright)')" = "4" && npm run lint && npm run typecheck && npm run test` | ✅ | ⬜ pending |
| 10-02-01 | 02 | 2 | N/A (no REQUIREMENTS.md) | — | N/A | structural | `bash -n scripts/run-tech-debt-audit.sh && test "$(grep -v '^[[:space:]]*#' scripts/run-tech-debt-audit.sh \| grep -cE 'as-any\.txt\|todo-fixme\.txt\|file-sizes\.txt')" = "3"` | ✅ | ⬜ pending |
| 10-02-02 | 02 | 2 | N/A (no REQUIREMENTS.md) | T-10-01, T-10-03 | All 11 reports asserted present + parseable; jscpd digest carries metadata only, no source bodies | smoke | Per-report `jq -e .` loop over the 7 JSON reports + `test -f` over the 4 text reports + `test "$(ls .audit-tmp/digests \| wc -l)" -ge 10` | N/A — one-off audit-completion check | ⬜ pending |
| 10-03-01 | 03 | 3 | N/A (no REQUIREMENTS.md) | T-10-01 | Checklist cites `file:line` only; no duplicated source bodies committed | structural | `test -f .../10-CHECKLIST.md && test "$(grep -cE '^## (Blocking\|High\|Medium\|Low)$' .../10-CHECKLIST.md)" = "4"` + `file.ts:NNN` citation grep + `git check-ignore` must not match | ✅ | ⬜ pending |
| 10-03-02 | 03 | 3 | N/A (no REQUIREMENTS.md) | T-10-05 | Every stated category count reconciled against its raw report, or its exclusion stated | smoke (reconciliation) | Cross-check section present exactly once + all 5 pending-todo filenames referenced + `grep -cE '^- \[.\] 10-0[123]-PLAN\.md' .planning/ROADMAP.md` = 3 | N/A — one-off audit-completion check | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*None: existing test infrastructure (Vitest + Playwright) fully covers this phase's minimal test-adjacent needs (baseline-preservation smoke checks only). No new test files are needed since this phase produces no new application code — only devDependencies, tool config files, and CHECKLIST.md.*

---

## Manual-Only Verifications

*None: all phase behaviors have automated verification (baseline-preservation smoke checks + finding-count reconciliation, both scriptable).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (N/A — none)
- [ ] No watch-mode flags
- [ ] Feedback latency < N/A (one-off audit checks, not an iterative loop)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
