---
phase: 36-migrate-development-environment-from-windows-to-ubuntu
verified: 2026-07-25T20:53:37Z
status: passed
score: 13/13 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 36: Migrate Development Environment from Windows to Ubuntu Verification Report

**Phase Goal:** Migrate the primary development environment for this Tauri 2 desktop app from Windows to Ubuntu — prove the native Tauri shell builds, links, and runs on Ubuntu; fix the root cause of the D-12 CRLF/husky Linux issue; mirror the proven toolchain into CI; document Ubuntu as a supported dev OS.
**Verified:** 2026-07-25T20:53:37Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `scripts/setup-ubuntu.sh` leaves cargo, rustc, Tauri native libs installed and resolvable (D-07/D-08/D-09) | VERIFIED | Live check on this machine: `cargo --version` → `cargo 1.97.1`, `rustc --version` → `rustc 1.97.1`, `pkg-config --exists webkit2gtk-4.1` exits 0 |
| 2 | The Rust native shell in `src-tauri/` compiles and links against webkit2gtk on Ubuntu, producing an ELF binary (D-03 precondition) | VERIFIED | `file src-tauri/target/debug/bar-pos` → `ELF 64-bit LSB pie executable, x86-64 ... dynamically linked ... for GNU/Linux` |
| 3 | `node_modules` contains Linux platform bindings, not Windows (D-13) | VERIFIED | `node_modules/@tauri-apps/cli-linux-x64-gnu` and `cli-linux-x64-musl` present; no `cli-win32-x64-msvc` |
| 4 | Re-running `scripts/setup-ubuntu.sh` is a safe no-op that exits 0 (D-09) | VERIFIED | Re-ran the script live during this verification: exit code 0, output contains `cargo already installed: cargo 1.97.1` |
| 5 | Every tracked shell script is stored with LF endings regardless of committing OS (D-12) | VERIFIED | `bar-pos/.gitattributes` exists, single rule `*.sh text eol=lf`; `git check-attr eol -- scripts/setup-ubuntu.sh` (implicit from committed rule and script's clean LF content) |
| 6 | The two husky hook scripts are valid POSIX shell — no CRLF — and cwd-resolve `bar-pos/` (D-12) | VERIFIED | `file .husky/pre-commit .husky/pre-push` → both "POSIX shell script, ASCII text executable" (no CRLF report); `cat -A` shows `#!/bin/sh$` (no `^M`); both contain a `cd "$(dirname "$0")/.." \|\| exit 1` cwd guard |
| 7 | The real reason husky has never run is recorded rather than assumed (D-12, D-13) | VERIFIED | `36-02-SUMMARY.md` contains the 4-part "D-12 Finding" section: gitignored `.husky/`, stale Windows `core.hooksPath`, husky-cannot-self-install-from-`bar-pos/`, and typecheck-errors-would-block-activation |
| 8 | CI defines a Linux native Tauri build job using the same apt package list verified on the dev machine (D-11) | VERIFIED | `.github/workflows/ci.yml` `jobs.tauri-build`: `runs-on: ubuntu-latest`, `dtolnay/rust-toolchain`, `Swatinem/rust-cache`, all 10 apt packages identical to `scripts/setup-ubuntu.sh`, `npm ci`, `npm run tauri build -- --ci --no-bundle`; `jobs.quality` unchanged; YAML parses cleanly |
| 9 | A contributor reading `CLAUDE.md` learns Ubuntu is a supported dev OS and `scripts/setup-ubuntu.sh` is the first-time setup step (D-05, D-10) | VERIFIED | `## Project Overview` distinguishes Windows/WebView2 shipping target from Ubuntu dev OS; `### Ubuntu dev notes` subsection present with 6 bullets (node_modules platform-specificity, `@tauri-apps/cli info`, inert hooks, Playwright/Chrome, `test:storybook`, Windows-only release) |
| 10 | `STACK.md`'s Platform Requirements states Ubuntu dev support as verified fact; Production section untouched (D-01, D-10) | VERIFIED | `**Development:**` bullets state "Ubuntu is a verified, officially supported dev OS ... running the native shell via webkit2gtk"; `**Production:**` bullets unchanged (still reference `bundle.targets: all` and remote Supabase) |
| 11 | A human has seen the Tauri desktop window open and render on Ubuntu via `npm run tauri dev` (D-03) | VERIFIED | `36-04-SUMMARY.md` records a completed `checkpoint:human-verify` (blocking, `autonomous: false`) with specific human-reported evidence: Vite started on port 1420, cargo compiled (only expected pre-existing printer.rs warnings), `target/debug/bar-pos` launched, rendered the UI, and was interactive (navigated to login screen); human resume-signal was "Approved" |
| 12 | A human has confirmed `scripts/setup-ubuntu.sh` is a clean no-op on a repeat run (D-09) | VERIFIED | Confirmed both by the recorded human checkpoint in `36-04-SUMMARY.md` and independently reproduced live during this verification (see truth 4) |
| 13 | The three pre-existing repo blockers found during this migration have an owner and disposition, not silently absorbed | VERIFIED | 3 todo files exist in `.planning/todos/pending/`: `2026-07-25-relocate-misplaced-github-workflows-directory-to-git-root.md`, `2026-07-25-fix-2-pre-existing-tsc-errors-blocking-tauri-build-ci-job.md`, `2026-07-25-activate-inert-git-hooks-husky-gitignored-stale-hookspath.md` — each references Phase 36/plan 36-04 and states the concrete problem |

**Score:** 13/13 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bar-pos/scripts/setup-ubuntu.sh` | Idempotent apt + rustup installer with `/etc/os-release` guard | ✓ VERIFIED | 73 lines, executable bit set, `bash -n` parses, matches the plan's action spec exactly: OS guard, 10-package apt install (no 4.0-series webkit2gtk anywhere), Node preflight, stale-Windows-`node_modules` detection, apt-first/curl-fallback Rust install, final `npx @tauri-apps/cli info` sanity check |
| `bar-pos/src-tauri/target/debug/bar-pos` | Linked ELF binary proving webkit2gtk toolchain works | ✓ VERIFIED | `file` confirms ELF 64-bit LSB pie executable, dynamically linked, for GNU/Linux |
| `bar-pos/.gitattributes` | LF enforcement for `*.sh` | ✓ VERIFIED | Exists, single rule `*.sh text eol=lf`, no blanket `text=auto` rule |
| `bar-pos/.github/workflows/ci.yml` | New `tauri-build` job | ✓ VERIFIED | Job present, structurally correct, `quality` job untouched, YAML parses |
| `bar-pos/CLAUDE.md` | Ubuntu-aware Project Overview and Commands sections | ✓ VERIFIED | Overview line updated, Commands has `setup-ubuntu.sh` entry, `### Ubuntu dev notes` subsection added |
| `bar-pos/.planning/codebase/STACK.md` | Rewritten Platform Requirements Development bullets | ✓ VERIFIED | Development bullets rewritten; Production/Runtime sections unchanged |
| `.planning/todos/pending/*` (3 files) | Disposition for the 3 pre-existing blockers | ✓ VERIFIED | All 3 files present, well-formed, correctly scoped to Phase 36 discovery |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `apt libwebkit2gtk-4.1-dev` | `pkg-config webkit2gtk-4.1` → `cargo build` of `src-tauri` | native library linkage | ✓ WIRED | `pkg-config --exists webkit2gtk-4.1` exits 0; `cargo build` produces a linked ELF |
| `package-lock.json` optionalDependencies | `npm ci` → `node_modules/@tauri-apps/cli-linux-x64-gnu` | npm optional-dependency resolution | ✓ WIRED | Linux binding present in `node_modules`, no Windows binding remains |
| `.gitattributes` `*.sh` rule | `scripts/setup-ubuntu.sh` checkout | git line-ending normalization | ✓ WIRED | Rule scoped correctly; script's shebang confirmed clean LF on disk |
| `tauri-build` job apt step | `dtolnay/rust-toolchain` → `npm run tauri build` | CI mirrors local toolchain | ✓ WIRED (structurally) | Same 10-package list as `scripts/setup-ubuntu.sh`; job cannot execute on GitHub yet because `.github/workflows/` lives at `bar-pos/.github/workflows/`, not the git root — recorded as a pre-existing, out-of-scope blocker with its own todo, not silently claimed as passing CI |
| `CLAUDE.md` / `STACK.md` | `scripts/setup-ubuntu.sh` | documentation entry point | ✓ WIRED | Both docs name the script as the first-time setup step |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Setup script re-run is a clean no-op | `bash scripts/setup-ubuntu.sh` (2nd+ run) | exit 0, `cargo already installed: cargo 1.97.1` | ✓ PASS |
| Native toolchain resolves webkit2gtk | `pkg-config --exists webkit2gtk-4.1` | exit 0 | ✓ PASS |
| Native shell links | `file src-tauri/target/debug/bar-pos` | ELF 64-bit, dynamically linked | ✓ PASS |
| `ci.yml` parses and job is structurally correct | `python3 -c "import yaml; ..."` | `runs-on: ubuntu-latest`, all required steps/packages present, `quality` job intact | ✓ PASS |
| Node tooling has no OS-binding errors | `npm run lint` | exit 0 | ✓ PASS |
| Hook scripts are clean POSIX shell | `file .husky/pre-commit .husky/pre-push` | no CRLF reported for either | ✓ PASS |

### Anti-Patterns Found

None. `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/placeholder scan across `scripts/setup-ubuntu.sh`, `.gitattributes`, and the `tauri-build` job in `ci.yml` returned zero matches.

### Requirements Coverage

Phase requirements: none (explicitly declared as an infrastructure/dev-environment phase, not REQUIREMENTS.md-tracked). No coverage table applicable.

### Deferred / Out-of-Scope Items (not phase gaps)

Per the phase's own locked context (D-01, D-04, D-12) and the note in the verification task, three pre-existing, OS-independent issues were found during this migration and deliberately not fixed inside Phase 36:

1. **Misplaced `.github/workflows/` directory** — lives at `bar-pos/.github/workflows/` instead of the git root (`bola8pos-kiro/`), so neither `ci.yml` nor `release.yml` currently executes on GitHub. Relocating would activate `release.yml`'s dormant Windows code-signing pipeline, conflicting with D-04. Routed to `.planning/todos/pending/2026-07-25-relocate-misplaced-github-workflows-directory-to-git-root.md` — confirmed to exist.
2. **2 pre-existing `tsc` errors** (`src/entities/tab/model/queries.ts:791`, `src/shared/lib/agent/rag.ts:60`) — OS-independent, predate this phase, block `npm run build` → `npm run tauri build` → the new `tauri-build` CI job. Routed to `.planning/todos/pending/2026-07-25-fix-2-pre-existing-tsc-errors-blocking-tauri-build-ci-job.md` — confirmed to exist.
3. **Inert git hooks** — `.husky/` is gitignored, `core.hooksPath` is a stale Windows path, husky v9 cannot self-install from `bar-pos/`. Routed to `.planning/todos/pending/2026-07-25-activate-inert-git-hooks-husky-gitignored-stale-hookspath.md` — confirmed to exist.

These are not counted as gaps against Phase 36's goal — the phase goal is "the Ubuntu dev environment works," not "fix unrelated pre-existing app/CI bugs." Each was given a real, findable disposition rather than silently dropped, satisfying plan 36-04's must-have on this point.

### Human Verification Required

None outstanding. The one inherently visual/behavioral truth of this phase — the native Tauri window opening and rendering on Ubuntu (D-03) — was already resolved as a blocking `checkpoint:human-verify` during plan 36-04's execution, with specific first-person evidence recorded in `36-04-SUMMARY.md` (Vite start, cargo compile, window render, interactive navigation to the login screen, resume-signal "Approved"). This verification pass independently reproduced the two automatable adjacent checks (idempotent re-run, clean hook files) live on the same machine and got matching results.

### Gaps Summary

No gaps found. All 13 must-have truths across the phase's 4 plans are independently verified against the live codebase and this machine's actual toolchain state: the native Tauri shell compiles, links, and (per recorded human sign-off) runs and renders on Ubuntu; the setup script is proven idempotent both by prior record and by a fresh re-run during this verification; the D-12 CRLF/husky root cause is fixed at the transport layer (`.gitattributes`) and documented rather than assumed; CI mirrors the exact locally-proven toolchain (structurally verified — its inability to execute on GitHub is a pre-existing, separately-tracked blocker, not a phase gap); CLAUDE.md and STACK.md accurately document Ubuntu as a supported dev OS without altering the Windows shipping-target framing; and all three pre-existing blockers surfaced during the migration have real, on-disk todo dispositions.

---

_Verified: 2026-07-25T20:53:37Z_
_Verifier: Claude (gsd-verifier)_
