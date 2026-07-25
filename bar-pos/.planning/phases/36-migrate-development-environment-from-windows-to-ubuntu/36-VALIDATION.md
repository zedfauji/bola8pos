---
phase: 36
slug: migrate-development-environment-from-windows-to-ubuntu
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-25
---

# Phase 36 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest v4 (unit), Playwright v1.59 (E2E) — both already configured, unchanged by this phase |
| **Config file** | `bar-pos/vitest.config.ts`, `bar-pos/playwright.config.ts` |
| **Quick run command** | `npm run typecheck && npm run lint && npm run test` |
| **Full suite command** | `npm run test:e2e` (requires a working `npm run tauri dev`/`npm run dev` first — this is the actual acceptance test for D-03) |
| **Estimated runtime** | Not measured — pre-existing suites, unchanged by this phase |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck && npm run lint`
- **After every plan wave:** Run `npm run test` + `npx @tauri-apps/cli info` + a manual `npm run tauri dev` smoke check
- **Before `/gsd-verify-work`:** Full suite green, plus a fresh-clone dry-run (or a second no-op run) of `scripts/setup-ubuntu.sh` to prove idempotency
- **Max feedback latency:** N/A — this phase has no REQ-IDs; verification is environment/tooling-shaped, not feature-behavior-shaped

---

## Per-Task Verification Map

No REQ-IDs are mapped to this phase (roadmap requirements: TBD). Rows below are keyed by CONTEXT.md decision ID instead of requirement ID; Task ID/Plan/Wave are assigned once `/gsd-plan-phase` produces PLAN.md files.

| Task ID | Plan | Wave | Decision | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|----------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | D-03 | — | N/A (dev-tooling, not app behavior) | manual/smoke | `npm run tauri dev` (visual confirmation — no automated "window opened" assertion) | N/A — manual by nature | ⬜ pending |
| TBD | TBD | TBD | D-07/D-08 | — | N/A | automated smoke | `npx @tauri-apps/cli info` (non-zero exit / error on any missing dep) | ✅ already exists (Tauri CLI) | ⬜ pending |
| TBD | TBD | TBD | D-09 | — | N/A | manual/smoke | Run `scripts/setup-ubuntu.sh` twice, confirm second run reports already-installed / exits 0 | ❌ Wave 0 — script is this phase's own deliverable | ⬜ pending |
| TBD | TBD | TBD | D-11 | — | N/A | automated | New GitHub Actions job passes on the PR that adds it | ❌ Wave 0 — job is this phase's own deliverable | ⬜ pending |
| TBD | TBD | TBD | D-12 | — | N/A | manual/smoke | Fresh `git clone` + `npm ci` + trivial commit, confirm `.husky/pre-commit` runs without shebang errors | ❌ Wave 0 — no existing automated hook-execution test | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/setup-ubuntu.sh` — does not exist yet; this phase's own primary deliverable
- [ ] `.gitattributes` — does not exist yet; needed for D-12's CRLF/exec-bit fix (RESEARCH.md confirmed `.husky/pre-push` already has live CRLF endings and no `.gitattributes` exists anywhere in the repo)

*No test-framework Wave 0 install needed — Vitest/Playwright are already configured and unchanged by this phase.*

---

## Manual-Only Verifications

| Behavior | Decision | Why Manual | Test Instructions |
|----------|----------|------------|-------------------|
| `npm run tauri dev` opens a working webkit2gtk window | D-03 | No automated assertion exists for "a native window opened and rendered" — this is the phase's core acceptance criterion and is inherently visual | Run `npm run tauri dev` on the Ubuntu dev machine; confirm the app window opens, renders the UI, and is interactive |
| `scripts/setup-ubuntu.sh` is idempotent | D-09 | Idempotency of a shell script across repeated runs isn't meaningfully unit-testable without disproportionate mocking machinery for a one-time environment script | Run the script twice in a row; confirm the second run reports "already installed" / no errors and exits 0 |
| Git hooks execute correctly on a fresh Ubuntu clone | D-12 | Hook execution depends on filesystem exec-bit + line-ending state at clone time, which unit tests don't exercise | Fresh `git clone` + `npm ci` + a trivial commit; confirm `.husky/pre-commit` runs without shebang/permission errors |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (`scripts/setup-ubuntu.sh`, `.gitattributes`)
- [ ] No watch-mode flags
- [ ] Feedback latency N/A (no REQ-IDs — environment/tooling phase)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
