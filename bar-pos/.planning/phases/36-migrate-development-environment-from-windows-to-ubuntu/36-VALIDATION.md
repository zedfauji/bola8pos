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

No REQ-IDs are mapped to this phase (roadmap requirements: TBD). Rows are keyed by CONTEXT.md decision ID instead of requirement ID. Task ID/Plan/Wave assigned 2026-07-25 by `/gsd-plan-phase`.

| Task ID | Plan | Wave | Decision | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|----------|------------|-----------------|-----------|-------------------|-------------|--------|
| T1 | 36-01 | 1 | D-03 (native build precondition), D-07, D-08 | T-36-01, T-36-02 | apt-signed rustup preferred over `curl \| sh`; `sudo` scoped to apt only | automated | `bash -n scripts/setup-ubuntu.sh && pkg-config --exists webkit2gtk-4.1 && cargo --version && cargo build --manifest-path src-tauri/Cargo.toml && file src-tauri/target/debug/bar-pos \| grep -q ELF` | ❌ Wave 0 — `scripts/setup-ubuntu.sh` is this plan's own deliverable | ⬜ pending |
| T2 | 36-01 | 1 | D-09 (idempotency), D-13 (Node parity) | T-36-SC | lockfile-pinned `npm ci` only; no new packages | automated | `bash scripts/setup-ubuntu.sh 2>&1 \| grep -q 'cargo already installed' && npx @tauri-apps/cli info && npm run lint && npm run test` | ✅ Tauri CLI + vitest already exist | ⬜ pending |
| T1 | 36-02 | 1 | D-12 (line endings) | T-36-04 | narrow `*.sh` scope avoids a 739-file unreviewable churn commit | automated | `test -f .gitattributes && git check-attr eol -- scripts/setup-ubuntu.sh \| grep -q 'eol: lf' && git check-attr eol -- src/main.tsx \| grep -qv 'eol: lf'` | ❌ Wave 0 — `.gitattributes` is this plan's own deliverable | ⬜ pending |
| T2 | 36-02 | 1 | D-12 (hook shell assumptions) | T-36-05, T-36-06 | `core.hooksPath` deliberately untouched — activation deferred to human decision | automated | `file .husky/pre-push \| grep -vq CRLF && file .husky/pre-commit \| grep -vq CRLF && (cd .. && sh bar-pos/.husky/pre-push 2>&1 \| grep -q 'src/')` | N/A — hooks are gitignored local state | ⬜ pending |
| T1 | 36-03 | 2 | D-11 | T-36-07, T-36-08, T-36-10 | `release.yml` untouched; diff-scope acceptance criterion enforces it | automated (structural) | `python3 -c "import yaml; d=yaml.safe_load(open('.github/workflows/ci.yml')); assert d['jobs']['tauri-build']['runs-on']=='ubuntu-latest'"` | ❌ Wave 0 — the job is this plan's own deliverable | ⬜ pending |
| T2 | 36-03 | 2 | D-05, D-10 | — | docs must not imply Linux is a shipping target (D-01) | automated | `grep -c 'setup-ubuntu.sh' CLAUDE.md && grep -A8 '^\*\*Development:\*\*' .planning/codebase/STACK.md \| grep -qi 'ubuntu'` | ✅ both docs exist | ⬜ pending |
| T1 | 36-04 | 3 | D-03 (the actual acceptance criterion), D-09, D-12 | T-36-12 | dev shell reuses existing `.env.local` credentials; no new credential path | manual/human-verify | none — `npm run tauri dev` window rendering is inherently visual; see Manual-Only Verifications below | N/A — manual by nature | ⬜ pending |
| T2 | 36-04 | 3 | — (routes pre-existing blockers found during D-11/D-12 work) | T-36-11 | workflow relocation would activate `release.yml` signing — gated `one-way` behind a blocking human decision | manual/decision | none — human selection | N/A | ⬜ pending |

**Note on D-11's original row:** the pre-planning draft expected "New GitHub Actions job passes on the PR that adds it". Planning found the workflow files live at `bar-pos/.github/workflows/` while the git root is one level up, so GitHub never reads them and no job can execute. D-11's verification is therefore structural/local, and the relocation question is routed to the human decision in 36-04 T2 rather than silently fixed (relocating would activate `release.yml`, conflicting with D-04).

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
