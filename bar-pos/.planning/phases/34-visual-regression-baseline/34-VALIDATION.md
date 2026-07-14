---
phase: 34
slug: visual-regression-baseline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-14
---

# Phase 34 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright `@playwright/test` v1.59.1, second config file |
| **Config file** | `playwright.visual.config.ts` (new — does not exist yet) |
| **Quick run command** | `npx playwright test --config=playwright.visual.config.ts e2e/visual/45-visual-baseline.spec.ts` (single spec, once baseline exists) |
| **Full suite command** | `npm run test:e2e:visual` → `playwright test --config=playwright.visual.config.ts` |
| **Estimated runtime** | ~2-4 minutes (17+ routes × up to 3 roles, single worker, headless) |

---

## Sampling Rate

- **Per task commit:** N/A for this phase — the visual assertions ARE the deliverable, not a gate on other production code (no other production code changes in this phase).
- **After suite exists:** `npm run test:e2e:visual` (first run with `--update-snapshots` to seed the local baseline, second run without to prove zero diffs) — this two-run sequence **is** success criterion 4 and is this phase's own verification step. Run locally only — never CI (D-02).
- **Before `/gsd-verify-work`:** Two consecutive local `npm run test:e2e:visual` runs (second run *without* `--update-snapshots`) must both exit 0 with zero failing screenshot assertions.
- **Max feedback latency:** ~4 minutes (one full suite run).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 34-01-01 | 01 | 0 | VISUAL-01 | — | N/A | config-check | `npx playwright test --config=playwright.visual.config.ts --list` | ❌ Wave 0 — config doesn't exist yet | ⬜ pending |
| 34-01-02 | 01 | 0 | VISUAL-01 | — | N/A | config-check | `grep -q "testIgnore" playwright.config.ts` (functional config must exclude `e2e/visual/`) | ❌ Wave 0 | ⬜ pending |
| 34-02-01 | 02 | 1 | VISUAL-02 | — | N/A | visual | `npm run test:e2e:visual -- --update-snapshots` (first run, seeds baseline) | ❌ Wave 0 — spec doesn't exist yet | ⬜ pending |
| 34-02-02 | 02 | 1 | VISUAL-03 | — | N/A | visual | `npm run test:e2e:visual` run twice back-to-back, both exit 0 | ❌ Wave 0 — spec doesn't exist yet | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `playwright.visual.config.ts` — does not exist yet, this phase's core deliverable
- [ ] `e2e/visual/45-visual-baseline.spec.ts` — does not exist yet, this phase's core deliverable
- [ ] `testIgnore: /visual\//` addition to `playwright.config.ts` — required so the functional suite doesn't pick up the new spec (config-collision bug identified in research)
- [ ] `.gitignore` entry for `e2e/visual/**/*-snapshots/` (or the exact `45-visual-baseline.spec.ts-snapshots/` path) — required per D-12 (local-only baselines)
- [ ] `data-testid="live-time-display"` on `src/shared/ui/LiveTimeDisplay.tsx` — needed to mask both KDS page headers
- [ ] `data-testid="kds-board"` on `src/widgets/KdsBoard/index.tsx`'s root element — needed since KDS queues are seeded non-empty per D-16
- [ ] `test:e2e:visual` npm script in `package.json` — does not exist yet (D-03)
- [ ] Seed helper for pool table id via `e2e/helpers/supabase.ts`'s `getServiceClient()` — `npm run setup:dev` is confirmed broken (D-14), do not depend on it

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual baseline "looks right" (no unintended layout shift vs. post-Phase-33.1 UI) | VISUAL-02 | First-run baseline has no prior baseline to diff against — a human must eyeball the initial seeded PNGs once, since `--update-snapshots` always "passes" by definition | After seeding baseline (`--update-snapshots`), open `e2e/visual/45-visual-baseline.spec.ts-snapshots/*.png` and visually confirm each of the ~20-25 screenshots (17 admin routes + bartender/manager subsets) matches expected UI, no broken layout/missing content |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 240s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
