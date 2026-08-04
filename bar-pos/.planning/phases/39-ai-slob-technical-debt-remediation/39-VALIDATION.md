---
phase: 39
slug: ai-slob-technical-debt-remediation
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-03
---

# Phase 39 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.4 (unit) + Playwright 1.59.1 (E2E) [VERIFIED: package.json:90,140] |
| **Config file** | `vitest.config.ts` (unit, `--project unit`), `playwright.config.ts` (E2E) |
| **Quick run command** | `npm run typecheck && npm run test` |
| **Full suite command** | `npm run test:e2e` (59 specs, 373 tests — requires a real display session per CLAUDE.md) |
| **Estimated runtime** | ~60s (unit) / several minutes (E2E full suite) |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck && npm run test` (fast, catches a dead-code deletion that was actually live)
- **After every plan wave:** Run `npx knip --reporter json` + `npx knip --production --reporter json` re-check against 39-RESEARCH.md's verified 982-finding baseline; for E2E waves, run the touched specs individually (`npx playwright test e2e/<spec>.spec.ts`)
- **Before `/gsd-verify-work`:** `npm run test:e2e` full suite must be green — run locally, not assumed green from CI (E2E is not CI-gated per CLAUDE.md)
- **Max feedback latency:** ~60s (unit/typecheck loop)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 39-01-01 | 01 | 1 | D-04/D-05/D-06 (E2E triage) | — / — | N/A | E2E | `npx playwright test e2e/<spec>.spec.ts` | ✅ | ⬜ pending |
| 39-0N-01 | 0N | N | D-01 (unlisted deps) | — / — | N/A | static | `npx knip --reporter json \| jq '.issues[].unlisted'` empty | ✅ | ⬜ pending |
| 39-0N-01 | 0N | N | D-01/D-07 (knip High-tier removal) | — / — | N/A | static | `npx knip --reporter json` / `npx knip --production --reporter json`, diff vs 982-finding baseline | ✅ | ⬜ pending |
| (all) | — | — | No regression in 1391 passing unit tests | — | N/A | unit | `npm run test` | ✅ | ⬜ pending |
| (all) | — | — | No new typecheck/lint errors from deletions | — | N/A | static | `npm run typecheck && npm run lint` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Exact Task IDs are assigned by the planner; this table is seeded from 39-RESEARCH.md's Phase Requirements → Test Map and CONTEXT.md decision IDs D-01–D-09 (no formal REQ-IDs exist — Requirements: TBD in ROADMAP.md/CONTEXT.md).*

---

## Wave 0 Requirements

*None: existing test infrastructure (Vitest + Playwright + the Phase 10 audit pipeline: `scripts/run-tech-debt-audit.sh`, `knip.json`, `.jscpd.json`) fully covers this phase's verification needs. No new test framework or fixtures required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full E2E suite green | D-04/D-05/D-06 | E2E is not CI-gated (CLAUDE.md) and needs a real Ubuntu display session + `google-chrome-stable` | Run `npm run test:e2e` locally on an Ubuntu dev machine with a desktop session before phase sign-off |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
