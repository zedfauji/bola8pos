---
phase: 36-migrate-development-environment-from-windows-to-ubuntu
plan: 03
subsystem: infra
tags: [ci, github-actions, tauri, rust-cache, docs, ubuntu, dev-environment]

# Dependency graph
requires:
  - phase: 36-migrate-development-environment-from-windows-to-ubuntu
    provides: "36-01's scripts/setup-ubuntu.sh — the exact 10-package apt list this plan mirrors into ci.yml"
provides:
  - "bar-pos/.github/workflows/ci.yml — tauri-build job (ubuntu-latest, Rust toolchain + cache, 10 apt packages, npm run tauri build --ci --no-bundle)"
  - "bar-pos/CLAUDE.md — Ubuntu-aware Project Overview, setup-ubuntu.sh in Commands, Ubuntu dev notes subsection"
  - "bar-pos/.planning/codebase/STACK.md — Platform Requirements Development bullets state Ubuntu support as verified fact"
affects: [36-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "New CI job added to the existing jobs: mapping in ci.yml rather than a separate workflow file, sharing the existing pull_request/push trigger"
    - "dtolnay/rust-toolchain@stable + Swatinem/rust-cache@v2 as the CI-side Rust toolchain/cache pair, mirroring setup-ubuntu.sh's local install without duplicating its curl-fallback logic (CI always has an apt rustup path via the action)"

key-files:
  created: []
  modified:
    - bar-pos/.github/workflows/ci.yml
    - bar-pos/CLAUDE.md
    - bar-pos/.planning/codebase/STACK.md

key-decisions:
  - "Confirmed at plan-authoring time (not re-litigated here): there is no existing Windows CI job to mirror — ci.yml's only job (quality) already runs on ubuntu-latest; the genuinely missing piece was a native Tauri build on Linux, which this plan adds as a second job, tauri-build."
  - "The new job cannot execute successfully on GitHub yet: these workflow files live at bar-pos/.github/workflows/, which GitHub Actions does not read (only root-level .github/workflows/ triggers). Relocating them is explicitly out of scope for this plan (it would also activate release.yml's dormant Windows signing pipeline, per D-04) and is routed to the user as a decision in 36-04."
  - "Even after relocation, the job would stay red today: npm run tauri build invokes beforeBuildCommand (npm run build -> tsc), and typecheck currently fails on 2 pre-existing, OS-independent errors (src/entities/tab/model/queries.ts:791, src/shared/lib/agent/rag.ts:60). Recorded, not fixed — out of this plan's scope."

patterns-established:
  - "CLAUDE.md's 'Ubuntu dev notes' subsection is now the canonical place for future Ubuntu-specific gotchas (git hooks, node_modules platform binaries, Playwright display requirements) rather than scattering them across STACK.md or README-style docs."

requirements-completed: []

coverage:
  - id: D1
    description: "ci.yml parses as valid YAML with both jobs.quality (byte-identical pre-change) and jobs.tauri-build (ubuntu-latest, working-directory bar-pos, Rust toolchain + cache actions, the 10 apt packages, npm ci, npm run tauri build)"
    verification:
      - kind: other
        ref: "python3 -c \"import yaml,sys; d=yaml.safe_load(open('.github/workflows/ci.yml')); j=d['jobs']['tauri-build']; assert j['runs-on']=='ubuntu-latest'; assert j['defaults']['run']['working-directory']=='bar-pos'; ...\" printed 'ci.yml OK'; lines 1-41 (the quality job + on: block) confirmed textually identical to the pre-edit file"
        status: pass
    human_judgment: false
  - id: D2
    description: "release.yml and the quality job are untouched; git diff for this plan touches exactly the 3 files named in the plan frontmatter"
    verification:
      - kind: other
        ref: "git diff --name-only HEAD~2 HEAD -- bar-pos/.github/workflows/ci.yml bar-pos/CLAUDE.md bar-pos/.planning/codebase/STACK.md listed exactly those 3 paths"
        status: pass
    human_judgment: false
  - id: D3
    description: "CLAUDE.md and STACK.md both name scripts/setup-ubuntu.sh and describe Ubuntu as a supported dev OS, without changing the Windows/WebView2 shipping-target framing or STACK.md's Production/Runtime sections"
    verification:
      - kind: other
        ref: "grep -c 'setup-ubuntu.sh' CLAUDE.md => 3; grep -c 'setup-ubuntu.sh' STACK.md => 1; grep -A8 '**Development:**' STACK.md matched 'ubuntu'; grep -A4 '**Production:**' STACK.md still matched 'bundle.targets'; combined verify command printed 'docs-OK'; manual diff of STACK.md's Production/Runtime sections and CLAUDE.md's Commands list showed no removed/altered existing lines"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-07-25
status: complete
---

# Phase 36 Plan 03: CI Tauri-Build Job + Ubuntu Dev-OS Docs Summary

**Added a `tauri-build` job to `ci.yml` that mirrors the `quality` job's checkout/setup-node steps and installs the exact 10-package apt list `scripts/setup-ubuntu.sh` uses locally, then made `CLAUDE.md` and `STACK.md` state Ubuntu dev support as verified fact instead of speculative wording — while recording that the job cannot run on GitHub yet because these workflow files live outside the path GitHub Actions reads.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-07-25T20:22:00Z (approx.)
- **Completed:** 2026-07-25T20:31:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added `jobs.tauri-build` to `bar-pos/.github/workflows/ci.yml`: `runs-on: ubuntu-latest`, same `defaults.run.working-directory: bar-pos` as `quality`, `actions/checkout@v4` + `actions/setup-node@v4` (node 22, npm cache keyed on `bar-pos/package-lock.json`) matching `quality` exactly, `dtolnay/rust-toolchain@stable`, `Swatinem/rust-cache@v2` scoped to `bar-pos/src-tauri`, an apt install step with the same 10 packages `scripts/setup-ubuntu.sh` installs (`libwebkit2gtk-4.1-dev`, `build-essential`, `curl`, `wget`, `file`, `libxdo-dev`, `libssl-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, `pkg-config`), `npm ci`, and `npm run tauri build -- --ci --no-bundle`
- Verified via `python3 -c "import yaml..."` that the file parses, both jobs exist, and the new job's steps/apt list/commands match the plan's assertions; confirmed the `quality` job's first 41 lines are byte-identical to the pre-edit file
- Rewrote `CLAUDE.md`'s `## Project Overview` opening to distinguish the Windows/WebView2 shipping target from Ubuntu as an officially supported dev OS (webkit2gtk-based), added a `bash scripts/setup-ubuntu.sh` first-time-setup line to `## Commands`, and added a 6-bullet `### Ubuntu dev notes` subsection covering `node_modules` platform-specificity, `@tauri-apps/cli info` as the sanity check, inert git hooks (`.husky/` gitignored), Playwright's `headless: false` + `channel: 'chrome'` display requirement, `test:storybook`'s separate Playwright-bundled-Chromium path, and Windows-only release/signing
- Rewrote `STACK.md`'s `## Platform Requirements` → `**Development:**` bullets to state Ubuntu 22.04–26.04 support as verified fact (no version pinning), name `scripts/setup-ubuntu.sh` and `libwebkit2gtk-4.1-dev`, and point to RESEARCH.md `## D-07` for the full package list instead of duplicating it; left `**Production:**` and the separate `## Runtime` section's WebView2 line untouched

## Task Commits

1. **Task 1: Add the tauri-build job to ci.yml** - `6eec3cb` (feat)
2. **Task 2: Document Ubuntu as a supported dev OS in CLAUDE.md and STACK.md** - `4e5a7b0` (docs)

**Plan metadata:** pending (this SUMMARY's commit)

## Files Created/Modified

- `bar-pos/.github/workflows/ci.yml` - new `tauri-build` job; `quality` job and `on:` trigger block unchanged
- `bar-pos/CLAUDE.md` - Ubuntu-aware Project Overview sentence, `setup-ubuntu.sh` Commands entry, new `### Ubuntu dev notes` subsection
- `bar-pos/.planning/codebase/STACK.md` - `**Development:**` bullets rewritten; `**Production:**` and `## Runtime` unchanged

## Decisions Made

- No new decisions beyond what the plan's frontmatter and "Discovered during planning" section already fixed: this plan verifies structurally/locally (YAML parses, job/steps exist, docs name the right script) rather than claiming "the CI job passes on GitHub," since the job cannot execute until the 36-04 workflow-relocation question is resolved.
- Kept `npm run tauri build -- --ci --no-bundle` exactly as specified in the plan action (not the RESEARCH.md draft's plain `--ci`) — `--no-bundle` avoids producing `.deb`/`.AppImage` artifacts nothing downstream consumes, per D-01.

## Deviations from Plan

None — plan executed exactly as written. Both tasks matched their `<action>` and `<verify>` blocks precisely.

## Issues Encountered

- **Pre-existing, out-of-scope whole-repo line-ending drift.** Before this plan started, `git status` already showed ~770 modified files repo-wide (including all three files this plan edits) as a pure CRLF↔LF flip with no content change — confirmed via `git diff --stat` showing equal insertions/deletions on unmodified lines. This is the exact condition 36-02's SUMMARY documented and deliberately did not fix (a blanket `text=auto` renormalize was explicitly rejected there to avoid unrelated 739-file churn; only `*.sh text eol=lf` was added). Because the 3 files this plan touches were already in that pre-existing dirty state, this plan's two commits necessarily also carry the line-ending normalization for those 3 files alongside the intended content changes — unavoidable given the file was already modified on disk before this plan's edits landed, and consistent with 36-02's documented, accepted state. No action taken beyond the plan's own scope; this is not a plan-36-03 regression.
- `npm run tauri build`/CI cannot be run end-to-end in this sandboxed session to prove the job actually executes — verification was structural (YAML parse + step/content assertions) per the plan's own acceptance criteria, which explicitly do not claim a passing GitHub Actions run.

## User Setup Required

None. The relocation decision that would let this CI job actually run on GitHub (moving `.github/workflows/` to the repo root) is routed to the user in plan 36-04, along with the interaction with `release.yml`'s dormant Windows signing pipeline (D-04) and the 2 pre-existing `tsc` errors that would keep the job red even after relocation.

## Next Phase Readiness

- CI now has a structurally correct `tauri-build` job ready to activate the moment the workflow-directory question is resolved in 36-04.
- `CLAUDE.md` and `STACK.md` both correctly describe Ubuntu as a supported dev OS with `scripts/setup-ubuntu.sh` as the entry point, giving 36-04 (and any future contributor) accurate onboarding docs to build on.
- Two known blockers for the job actually going green on GitHub are recorded here and in `36-01-SUMMARY.md` / this plan's own text: (1) workflow files not at the repo-root path GitHub reads, (2) 2 pre-existing `tsc` errors surfaced via `npm run build`'s `beforeBuildCommand`. Neither was introduced by this plan.

## Self-Check: PASSED

- FOUND: `bar-pos/.github/workflows/ci.yml` (tauri-build job present, YAML valid)
- FOUND: `bar-pos/CLAUDE.md` (Ubuntu dev notes subsection present)
- FOUND: `bar-pos/.planning/codebase/STACK.md` (Development bullets rewritten)
- FOUND: commit `6eec3cb`
- FOUND: commit `4e5a7b0`

---
*Phase: 36-migrate-development-environment-from-windows-to-ubuntu*
*Completed: 2026-07-25*
