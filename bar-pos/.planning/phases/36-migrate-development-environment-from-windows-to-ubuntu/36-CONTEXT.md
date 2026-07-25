# Phase 36: Migrate development environment from Windows to Ubuntu - Context

**Gathered:** 2026-07-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Get the local development workflow — build, test, lint, git hooks, and the native Tauri desktop shell — working reliably on Ubuntu for this Tauri 2 + React 19 + Supabase app. The shipped product continues to target Windows/WebView2 for bar/restaurant end users; this phase does **not** change the shipping/bundle target. Ubuntu becomes an officially supported dev OS (docs written for any future contributor, not just personal notes), backed by a setup script and a Linux CI job mirroring the existing Windows job for dev-loop regression testing. Release builds and code-signing stay on a Windows machine/VM.

</domain>

<decisions>
## Implementation Decisions

### Scope
- **D-01:** Dev-only migration — the app keeps shipping Windows-only via WebView2; this phase does not add Linux as a bundle/shipping target. — **Reversibility:** reversible — a future phase can still add Linux packaging later; nothing here forecloses it.
- **D-02:** Hardware/peripheral integration (receipt printer, cash drawer, `/settings` hardware config) is out of scope — it's a production/runtime concern, not a dev-tooling concern.
- **D-03:** The native Tauri desktop shell must actually run locally on Ubuntu (`npm run tauri dev` producing a working window via webkit2gtk) — browser-only (`npm run dev`) is not sufficient for this phase's goal.
- **D-04:** Windows release builds and code-signing stay on a Windows machine/VM — the new Linux CI job is for dev-loop testing only, not release production. — **Reversibility:** reversible — moving release builds to CI later is a separate, independent decision.
- **D-05:** Ubuntu becomes an officially supported dev OS — onboarding docs (CLAUDE.md, STACK.md) get updated as if any future contributor might develop on Ubuntu, not just as personal setup notes.

### Ubuntu target & prerequisites
- **D-06:** Do not hardcode a specific Ubuntu version in docs or scripts — detect dynamically / aim for compatibility across recent Ubuntu releases (the dev machine's actual version is unconfirmed at discussion time).
- **D-07:** Native Tauri Linux prerequisites (webkit2gtk-4.1, libayatana-appindicator3, librsvg2-dev, build-essential, and related packages) are **not yet confirmed installed/working** on the dev machine — research must nail down the exact required package list for Tauri 2, and the phase must actually verify/install them, not just document an assumed-working setup.
- **D-08:** The Rust toolchain (rustup/cargo) is **not yet confirmed working** on the dev machine — setting it up is an explicit task in this phase, not just a documentation note.

### Migration artifacts
- **D-09:** Produce `scripts/setup-ubuntu.sh` — a script that installs/verifies native deps and the Rust toolchain — rather than a manual-only doc checklist. Repeatable and testable, doubles as documentation-by-code.
- **D-10:** Update both `CLAUDE.md` (project overview line currently reads "Tauri 2 desktop app (Windows, WebView2)") and `.planning/codebase/STACK.md` (Platform Requirements section) to document Ubuntu as a supported dev platform.
- **D-11:** Add a Linux CI job to GitHub Actions on `ubuntu-latest`, mirroring the existing Windows job's full step set (lint, typecheck, unit tests, native Tauri build) — not a narrower subset. Read `.github/workflows/ci.yml` to replicate structure.

### Known pain points to investigate
- **D-12:** Husky + lint-staged git hooks (`bar-pos/package.json` `prepare` script) are flagged as a suspected Linux pain point, though the user couldn't name specifics — research must investigate concretely (likely candidates: executable-bit loss, CRLF line endings carried over from a Windows checkout, shebang/shell assumptions in hook scripts) rather than just assuming they work as-is.
- **D-13:** No other specific Windows→Ubuntu breakage has been hit yet — research should do a systematic audit (`.cursor/environment.json`, npm scripts, Playwright browser install, editor config) rather than rely on recalled ad-hoc issues.

### Claude's Discretion
- Exact structure/contents of `scripts/setup-ubuntu.sh` (idempotency checks, package manager detection, error handling) — implement using standard patterns for this kind of setup script.
- Whether the Linux CI job runs as a new job in the existing `ci.yml` or a separate workflow file — follow whichever fits the existing file's structure more cleanly.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Current dev-environment framing (to be updated)
- `CLAUDE.md` — project overview describes "Tauri 2 desktop app (Windows, WebView2)"; this line and its "Commands" section need Ubuntu-aware updates per D-10.
- `.planning/codebase/STACK.md` §Platform Requirements — currently states "Windows (primary target per CLAUDE.md), macOS/Linux plausible for Vite/web dev"; needs updating per D-10. Also notes `src-tauri/tauri.conf.json` `bundle.targets: "all"` is already not Windows-locked at the bundler-config level (useful, but shipping target still stays Windows-only per D-01).

### CI to mirror
- `.github/workflows/ci.yml` — existing Windows CI job; the new Linux job (D-11) must mirror its lint/typecheck/test/build steps on `ubuntu-latest`.
- `.github/workflows/release.yml` — existing Windows release/signing pipeline; stays unchanged (D-04, out of scope).

No other external specs/ADRs apply — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.github/workflows/ci.yml` — template structure to clone/extend for the new Linux job (D-11).
- `bar-pos/package.json` `prepare` script (husky) — existing git-hooks wiring to verify/fix on Linux (D-12).

### Established Patterns
- Most tooling (Vite, Vitest, ESLint, Prettier, Storybook, TypeScript) is standard Node.js tooling and expected to be OS-agnostic already.
- The OS-sensitive surface is narrow: the Rust/Cargo toolchain and the native Tauri webview binding (WebView2 on Windows vs. webkit2gtk on Linux) via `src-tauri/`.

### Integration Points
- `bar-pos/src-tauri/tauri.conf.json` — `bundle.targets` already set to `"all"`; native build/dev commands (`npm run tauri dev`, `npm run build`) are the integration point between Node tooling and the Rust/webkit2gtk native shell.
- `bar-pos/package.json` `prepare`/husky hooks — integration point for D-12 investigation.

</code_context>

<specifics>
## Specific Ideas

No specific "I want it like X" references beyond the decisions captured above — open to standard approaches for the setup script and CI job structure.

</specifics>

<deferred>
## Deferred Ideas

- **Linux as a shipping target** — explicitly declined for this phase (D-01). If ever revisited, it would need its own phase covering packaging (`.deb`/`.AppImage`), hardware/peripheral driver parity (D-02), and QA — not a small add-on to this one.
- **Hardware/peripheral integration on Linux** (receipt printer, cash drawer) — out of scope per D-02; only relevant if Linux shipping is ever pursued.
- **Moving Windows release builds/signing to CI** — declined per D-04; would be an independent follow-up decision, not part of this migration.

### Reviewed Todos (not folded)
None — no matching todos existed for this phase (`todo.match-phase` returned 0 matches).

</deferred>

---

*Phase: 36-migrate-development-environment-from-windows-to-ubuntu*
*Context gathered: 2026-07-25*
