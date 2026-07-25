# Phase 36: Migrate development environment from Windows to Ubuntu - Research

**Researched:** 2026-07-25
**Domain:** Dev-tooling / cross-platform native build environment (Tauri 2 + Rust + webkit2gtk on Ubuntu; Node tooling parity; CI)
**Confidence:** HIGH

## Summary

This phase is narrower than it sounds: almost the entire toolchain (Node, Vite, Vitest, ESLint, Prettier, TypeScript, Storybook, Playwright) is already OS-agnostic. The two genuinely OS-sensitive surfaces are (1) the Rust/Cargo toolchain plus the native webkit2gtk-backed Tauri shell, and (2) a handful of Windows-checkout artifacts (CRLF line endings, executable-bit loss) that break POSIX shell scripts. Everything else is a documentation/CI-mirroring exercise.

This research was conducted **directly on the target machine** — the current session's shell is already Ubuntu 26.04 LTS ("Resolute Raccoon"), so every "required package" claim below was verified with real `apt-cache policy` / `pkg-config` / `command -v` calls against this exact machine, not assumed from docs. Findings: no Rust toolchain installed yet, no Tauri native Linux deps installed yet, and — critically — **`.husky/pre-push` already has CRLF line endings on disk in this checked-out repo** (confirmed via `file` command), which is a concrete, already-present instance of the D-12 pain point, not a hypothetical.

**Primary recommendation:** Write `scripts/setup-ubuntu.sh` as an idempotent apt-based installer (detect via `/etc/os-release` ID=ubuntu/ID_LIKE=debian, no version-pinning) that installs the official Tauri v2 Debian/Ubuntu dependency list plus rustup, fix the CRLF/executable-bit issue at the repo level (`.gitattributes` + one-time `git add --renormalize`/`chmod`), mirror `ci.yml`'s existing `quality` job as a new `ubuntu-latest`-targeted job that additionally runs a native Tauri build step, and update `CLAUDE.md` + `STACK.md` per D-10.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Node/JS tooling (Vite, Vitest, ESLint, Prettier, Storybook, Playwright) | Dev tooling / Node runtime | — | Already OS-agnostic; no tier change needed, just verification |
| Native Tauri shell (webkit2gtk, Rust/Cargo) | OS / native build tier | Dev tooling (`src-tauri/`) | webkit2gtk is a Linux-only system library; Rust toolchain is machine-local, not project-local |
| Git hooks (husky/lint-staged) | Dev tooling / VCS tier | — | Executable-bit + line-ending handling is a git-attributes/filesystem concern, not application code |
| CI pipeline | CI/CD tier | — | New parallel `ubuntu-latest` job alongside existing Windows job; no change to release pipeline |
| Setup automation (`scripts/setup-ubuntu.sh`) | Dev tooling / OS package tier | — | Wraps `apt`/`rustup`, runs once per fresh machine, not part of app runtime |
| Documentation (CLAUDE.md, STACK.md) | Docs tier | — | Reflects the new supported dev OS; no code behavior change |

## Package Legitimacy Audit

This phase installs **zero new npm/PyPI/crates packages**. Its external installs are:
- Ubuntu **apt** system packages (`libwebkit2gtk-4.1-dev`, `build-essential`, `libayatana-appindicator3-dev`, `librsvg2-dev`, `libssl-dev`, `libxdo-dev`, `pkg-config`, `curl`, `wget`, `file`) — all from Ubuntu's own official `main`/`universe` archive, verified present in `apt-cache policy` on this machine. The npm/PyPI/crates slopsquatting gate (`gsd-tools query package-legitimacy check`) does not apply to OS package names; there is no equivalent hallucination risk here because `apt-cache policy` either resolves a real Candidate or errors — there is no ambiguous "looks real but isn't" middle ground the way there is with npm registry names.
- **rustup** via the official `https://sh.rustup.rs` install script (the sanctioned install method published at rust-lang.org and linked from Tauri's own prerequisites page) — `[CITED: https://v2.tauri.app/start/prerequisites/]`. Ubuntu also ships an `rustup` apt package (candidate `1.27.1-8` confirmed on this machine) as an alternative; either is legitimate, no phantom package risk.

**Packages removed due to [SLOP] verdict:** none (no npm/PyPI/crates packages introduced).
**Packages flagged as suspicious [SUS]:** none.

*Piping `curl | sh` for rustup is a supply-chain trust decision, not a legitimacy-gate finding — flagged again under Security Domain below.*

## Standard Stack

### Core (already present, verified compatible — no new deps to add)
| Tool | Version (verified on this machine / repo) | Purpose | Why Standard |
|------|------|---------|--------------|
| Node.js | v24.18.0 installed; CI pins `22` `[VERIFIED: node --version / ci.yml]` | JS runtime for all tooling | Vite 7 requires Node ^20.19 or ^22.12+; both CI's 22 and this machine's 24 satisfy it |
| Rust (via rustup) | not yet installed on this machine `[VERIFIED: rustc/cargo/rustup all "command not found"]` | Compiles `src-tauri/` native shell | Tauri 2's only supported install path |
| libwebkit2gtk-4.1-dev | candidate `2.52.3-0ubuntu0.26.04.2` on this machine `[VERIFIED: apt-cache policy]` | GTK WebView backend for Tauri 2 on Linux | Official Tauri 2 requirement since the 2.0.0-alpha.3 migration off webkit2gtk-4.0 `[CITED: https://v2.tauri.app/blog/tauri-2-0-0-alpha-3/]` |
| libayatana-appindicator3-dev | candidate `0.5.94-1build1` `[VERIFIED: apt-cache policy]` | System tray icon support used by Tauri's tray API | Official Tauri Linux prerequisite |
| librsvg2-dev | candidate `2.61.3+dfsg-3` `[VERIFIED: apt-cache policy]` | SVG icon rendering for the app icon/tray | Official Tauri Linux prerequisite |
| build-essential | already installed (`12.12ubuntu2.26.04.2`) `[VERIFIED: apt-cache policy]` | gcc/make/etc. for compiling Rust native deps | Official Tauri Linux prerequisite |
| libssl-dev, libxdo-dev, pkg-config, curl, wget, file | all have resolvable apt candidates on this machine `[VERIFIED: apt-cache policy]` | TLS headers / X11 automation / build metadata / fetch tools | Official Tauri Linux prerequisite list `[CITED: https://v2.tauri.app/start/prerequisites/]` |

**Installation (the exact command this phase's setup script should wrap):**
```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  pkg-config
```
`[CITED: https://v2.tauri.app/start/prerequisites/ — fetched directly, current as of this research date]`

**Rust toolchain install (official method):**
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
# then, in the same or a new shell:
source "$HOME/.cargo/env"
rustc --version && cargo --version
```
`[CITED: rust-lang.org official installer, referenced by Tauri prerequisites page]`

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `curl \| sh` rustup install | `apt install rustup` (candidate `1.27.1-8` confirmed available) then `rustup default stable` | apt path avoids piping a remote script to a shell (supply-chain preference) but Ubuntu's rustup package can lag upstream; either is fine — Claude's Discretion per CONTEXT.md, recommend apt path for a slightly better security posture given D-12's existing supply-chain-adjacent caution around the repo's tooling |
| `libwebkit2gtk-4.0-dev` (Tauri v1-era) | `libwebkit2gtk-4.1-dev` | 4.0 is **not present at all** in this Ubuntu 26.04 repo (`apt-cache show` returns "No packages found") — 4.0 is a dead end on any current-ish Ubuntu release; do not let the setup script fall back to it |

## D-06: Dynamic Ubuntu-version detection (no hardcoded version)

**Finding:** `/etc/os-release` is the correct, standard detection point — it exists on every systemd-based Linux distro (not Ubuntu-specific) and is what Tauri's own CI/tooling assumes exists. Relevant fields confirmed present on this machine:
```
ID=ubuntu
ID_LIKE=debian
VERSION_ID="26.04"
VERSION_CODENAME=resolute
```
`[VERIFIED: cat /etc/os-release on this machine]`

**Recommendation for `setup-ubuntu.sh`:** Do not branch on `VERSION_ID` at all for package names — the confirmed-required package set (`libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, etc.) resolves identically across recent LTS releases:
- Ubuntu 22.04 (jammy): `libwebkit2gtk-4.1-dev` is present (candidate versions confirmed via packages.ubuntu.com / launchpad, in the `universe` component) `[CITED: https://packages.ubuntu.com/jammy/amd64/libdevel/libwebkit2gtk-4.1-dev]`
- Ubuntu 24.04 (noble): 4.0 was dropped entirely, 4.1 is the only option — this is the change that originally forced Tauri's own migration `[CITED: github.com/tauri-apps/tauri/issues/9662]`
- Ubuntu 26.04 (resolute, this machine): 4.1 confirmed present, 4.0 confirmed absent `[VERIFIED: apt-cache policy / apt-cache show on this machine]`

Only use `/etc/os-release` to: (a) assert `ID=ubuntu` or `ID_LIKE` contains `debian` before running any `apt` command (fail fast with a clear message on non-Debian systems rather than silently misbehaving), and (b) print `VERSION_CODENAME`/`VERSION_ID` in log output for diagnostics. Do not gate package names on it — that would reintroduce the exact hardcoding D-06 asks to avoid, and it isn't necessary since the package set is stable across 22.04→26.04.

**One caveat to surface to the planner:** on a *minimal* Ubuntu install (not this machine, which already has `universe` enabled), `libwebkit2gtk-4.1-dev` and `libayatana-appindicator3-dev` may live in the `universe` component, which isn't always enabled by default on minimal/server images. The setup script should run `sudo add-apt-repository universe` (harmless no-op if already enabled) before `apt update` to be defensive, or at minimum catch the apt install failure and print a hint about enabling `universe`.

## D-07: Exact native Tauri 2 Linux dependency list — CONFIRMED

Covered fully above (Standard Stack + D-06). Summary table for the plan:

| Package | Confirmed on this machine | Purpose |
|---------|---------------------------|---------|
| `libwebkit2gtk-4.1-dev` | candidate 2.52.3-0ubuntu0.26.04.2, not installed | WebView engine |
| `build-essential` | **already installed** | C toolchain for Rust native builds |
| `libayatana-appindicator3-dev` | candidate 0.5.94-1build1, not installed | Tray icon |
| `librsvg2-dev` | candidate 2.61.3+dfsg-3, not installed | SVG rendering (icons) |
| `libssl-dev` | candidate 3.5.5-1ubuntu3.2, not installed | TLS (used by `reqwest` dependency in `src-tauri/Cargo.toml`) |
| `libxdo-dev` | candidate 1:3.20160805.1-5.1build1, not installed | X11 automation (used by some Tauri plugins) |
| `pkg-config`, `curl`, `wget`, `file` | all resolvable, `curl`/`file` already installed | build tooling |

**Cargo.toml note (D-07 adjacent finding):** `src-tauri/Cargo.toml` has a `[target.'cfg(windows)'.dependencies]` block pulling in the `windows` crate (`Win32_Graphics_Printing`) for receipt-printer/cash-drawer support (`src-tauri/src/commands/printer.rs`). This is conditionally compiled and **will simply not build on Linux** — which is correct and expected, since D-02 explicitly puts hardware/printer integration out of scope for this phase. No action needed; just don't be surprised if `cargo check` on Linux doesn't touch that module. `[VERIFIED: read src-tauri/Cargo.toml directly]`

## D-08: Rust toolchain setup — CONFIRMED, not yet present

`rustc`, `cargo`, and `rustup` are all **not installed** on this machine (`command not found` for all three, verified directly). This is a real, not hypothetical, gap this phase must close. Use the official rustup installer or `apt install rustup` (see Alternatives Considered above), then `rustup default stable`. After install, verify with `cargo tauri info` (via `@tauri-apps/cli`, already a devDependency) which cross-checks both the Node and Rust sides of the toolchain in one command — this is the standard Tauri-recommended sanity check, better than manually checking `rustc --version` alone because it also flags missing system libraries.

## D-09: Idempotent `scripts/setup-ubuntu.sh` pattern

**Standard shape for this kind of script** (no new library needed — plain POSIX/bash is the right tool per the ladder: this is a 40-60 line script, not a framework problem):

```bash
#!/usr/bin/env bash
set -euo pipefail

# 1. OS guard
if ! grep -qE '^ID(_LIKE)?=.*(ubuntu|debian)' /etc/os-release 2>/dev/null; then
  echo "This script targets Ubuntu/Debian. Detected:" >&2
  cat /etc/os-release >&2
  exit 1
fi

# 2. Idempotent apt install — apt itself is idempotent (already-installed packages are skipped
#    with "already the newest version"), so no manual dpkg -s check-before-install loop is needed.
#    That would be reinventing what apt already does.
sudo add-apt-repository -y universe || true   # no-op if already enabled
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev pkg-config

# 3. Rust toolchain — check before installing (rustup's own installer is NOT idempotent-safe
#    to blindly re-run in some shells; guard with `command -v`)
if ! command -v cargo >/dev/null 2>&1; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  # shellcheck source=/dev/null
  source "$HOME/.cargo/env"
else
  echo "cargo already installed: $(cargo --version)"
fi

# 4. Sanity check — the one thing this script exists to guarantee
npx --yes @tauri-apps/cli info
```

**Key idempotency insight:** `apt-get install` is already idempotent (re-running it on an installed package is a fast no-op), so the script does not need to hand-roll "check if installed, else install" logic for apt packages — that's rung 3 of the ladder (stdlib/platform-native already does it). The only place that genuinely needs a `command -v` guard is rustup, because piping its installer to `sh` again *is* meaningfully different behavior (it can re-prompt or attempt to modify `PATH` entries again) — so guard only that one step, not everything.

**Package-manager detection:** D-09 mentions "package manager detection" but this phase's scope (D-06) is Ubuntu/Debian only — do not build multi-distro branching (`apt` vs `dnf` vs `pacman`) for a phase whose own decisions explicitly scope to Ubuntu. That would be speculative generality the ladder says to skip. A single `apt-get`-based script with a clear guard/error message on non-Debian systems is the right size.

## D-11: Mirroring `ci.yml` as a new `ubuntu-latest` job

**Current state (verified by reading the file directly):** `.github/workflows/ci.yml` already has exactly one job, `quality`, which **already runs on `ubuntu-latest`**:
```yaml
jobs:
  quality:
    name: Typecheck / Lint / Test / Audit
    runs-on: ubuntu-latest
    ...
```

**Important correction to the phase framing:** CONTEXT.md's D-11 describes this as "mirroring the existing Windows job" — but there is no existing Windows CI job in `ci.yml`. `ci.yml`'s single job already targets `ubuntu-latest` for lint/typecheck/test/audit. The only Windows-specific pipeline in this repo is `.github/workflows/release.yml`'s `publish-tauri` job, which runs on `runs-on: [self-hosted, windows]` and does a full Tauri native build + code-signing (D-04 correctly keeps this untouched).

So what D-11 actually needs, reconciled against the real files:
1. `ci.yml`'s existing `quality` job (lint/typecheck/test/audit) is **already Linux CI** — nothing to add there, it already runs npm-tooling checks on Ubuntu today. This satisfies "lint, typecheck, unit tests" from D-11 with zero new work.
2. What's genuinely missing is a **native Tauri build step on Linux** — `ci.yml` never invokes Rust/Cargo/`tauri build` at all today (only `release.yml` does, and only on Windows). Add either a new step to the existing `quality` job or a new job, e.g.:
```yaml
  tauri-build:
    name: Tauri Native Build (Linux)
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: bar-pos
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: bar-pos/package-lock.json
      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
      - name: Install Tauri Linux deps
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential curl wget file \
            libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev pkg-config
      - name: Install frontend deps
        run: npm ci
      - name: Build (Tauri, no bundling required for CI signal — or full build)
        run: npm run tauri build -- --ci
```
   `dtolnay/rust-toolchain@stable` (a widely-used GitHub Action, referenced directly by name here as it's an ecosystem convention, not a phase dependency to be installed via npm/pip — `[ASSUMED: exact action name/tag, verify current major version tag at plan time]`) is the standard way to install Rust in GitHub Actions; it is faster and more idempotent-friendly than shelling out to rustup's curl installer inside CI.
3. Whether this lands as a new job in `ci.yml` or a separate workflow file is explicitly Claude's Discretion per CONTEXT.md — recommend a **new job in the existing `ci.yml`** (not a separate file) since it's one more job in the same trigger (`pull_request`/`push` to main/master) with no need for independent triggers, and it keeps all "is this repo healthy" signals in one workflow run to view.
4. `npm run tauri build` will attempt a full release-mode Rust compile (slow, ~3-8 min cold on GitHub-hosted runners) — the plan should budget for Rust build caching (`Swatinem/rust-cache@v2`, a standard companion action) to keep CI time reasonable across runs, otherwise every PR pays a full native rebuild.

## D-12: Husky + lint-staged Linux pain points — CONFIRMED WITH LIVE EVIDENCE

This is not hypothetical — it is **already present in this exact checkout**:

```
$ file .husky/pre-commit .husky/pre-push
.husky/pre-commit: POSIX shell script, ASCII text executable
.husky/pre-push:   POSIX shell script, ASCII text executable, with CRLF line terminators
```
`[VERIFIED: file command run directly against this repo's working tree]`

`.husky/pre-push` has CRLF line endings right now. On a POSIX shell, a shebang line ending in `\r\n` (`#!/bin/sh\r`) is a classic breakage: the kernel treats the whole first line including the `\r` as the interpreter path, producing `/bin/sh^M: no such file or directory` or silent execution failures depending on shell. `.husky/pre-commit`, by contrast, is already clean LF — so this is an inconsistent, partial contamination from whatever editor/git-config combination last touched `pre-push`, not a systemic problem across every hook file. Both files already have the executable bit set (`-rwxr-xr-x`) on this filesystem, so the "executable-bit loss" failure mode D-12 worried about is **not currently manifesting** — likely because this repo was checked out on a Linux/WSL filesystem already, or the bits were restored by a prior `chmod`. Do not assume it's fixed everywhere, though: executable-bit loss is a property of the *checkout*, not the repo content, so a fresh `git clone` on a literal Windows NTFS checkout (not WSL) would still lose the bit — see below.

**No `.gitattributes` file exists anywhere in this repo** (`[VERIFIED: find -iname .gitattributes` returned nothing at any level]). This is the root cause enabling both failure modes:
- Without `* text=auto` + explicit `eol=lf` rules, git does not normalize line endings on checkout/commit, so a Windows-authored commit (CRLF working-tree state) can get committed with CRLF and then checked out with CRLF on Linux too.
- Git does track the executable bit as part of the tree (mode `100755` vs `100644`), and that survives `git clone` cross-platform correctly **as long as it was committed with the bit set** — the loss failure mode more commonly happens when Windows users add/re-touch a file (e.g. via editors that recreate the file) and `core.filemode` interactions or npm/husky's own `prepare` script re-writes the hook file without the bit on `npm install`.

**Standard fixes (all applicable, in order):**
1. **Add `.gitattributes`** at repo root (or `bar-pos/.gitattributes`) with at minimum:
   ```
   * text=auto eol=lf
   .husky/* text eol=lf
   *.sh text eol=lf
   ```
   This forces LF normalization for tracked shell scripts regardless of the committer's OS or `core.autocrlf` setting — the fix belongs in the repo, not in each developer's local git config, so it protects every future contributor uniformly (this is the correct root-cause fix per the "fix once, where all callers route through" principle — a `.gitattributes` rule is the single choke point, not a per-developer README instruction to set `core.autocrlf=input`).
2. **One-time renormalization** after adding `.gitattributes`: `git add --renormalize .` then commit, so existing committed CRLF content gets rewritten to LF in the same change.
3. **Re-assert executable bits** on the two hook files as part of the same commit: `git update-index --chmod=+x .husky/pre-commit .husky/pre-push` (or plain `chmod +x` + `git add`) — cheap insurance even though both already show `-rwxr-xr-x` in this checkout.
4. **Husky's own re-install behavior:** `npm run prepare` (husky's `prepare` script, already wired in `package.json`) re-writes `.husky/pre-commit`/`pre-push` via `husky init`/`husky add` semantics on `npm install` in some husky versions — after the `.gitattributes` fix, run `npx husky` once post-`npm ci` on a fresh Ubuntu clone to confirm hook files come out LF + executable, not just "assume the git-level fix carries through the husky script."

**No fix needed for husky/lint-staged's actual logic** — `.husky/pre-commit` runs `npx tsc --noEmit && npx lint-staged`, and `lint-staged.config.cjs` (a separate file, not inline in `package.json`) runs plain ESLint/Prettier on staged files — none of this is OS-sensitive; the only risk was the shell-script transport layer (line endings/exec bit), which is now scoped and fixed as above. `[VERIFIED: read .husky/pre-commit, .husky/pre-push, lint-staged.config.cjs directly]`

## D-13: Other Windows→Ubuntu breakage points — systematic audit results

| Surface | Checked | Finding |
|---------|---------|---------|
| `.cursor/environment.json` | `[VERIFIED: read file]` | Already POSIX-shell-only (`cd bar-pos && HUSKY=0 npm ci && node scripts/...`) — no `&`, no `%VAR%`, no backslash paths. No changes needed; this file already assumes a Linux/macOS cloud runner. |
| `package.json` npm scripts | `[VERIFIED: read all scripts]` | All scripts use `&&` (POSIX/cross-shell-safe under npm's own script runner) and no Windows-only syntax (`set VAR=`, `%VAR%`, backslash paths, `.cmd`/`.bat` invocations). No `.bat`/`.ps1`/`.cmd` files found anywhere in the repo (`[VERIFIED: find -iname "*.bat" -o -iname "*.ps1" -o -iname "*.cmd"` returned nothing outside node_modules]). |
| `scripts/*.ts`, `*.mjs` | `[VERIFIED: grep for path.win32, process.platform, hardcoded C:\ paths]` | No matches — no OS-branching or Windows-style paths found in any project script. |
| Playwright / E2E on Linux | `[VERIFIED: read playwright.config.ts]` | **Real finding requiring action:** `playwright.config.ts` hardcodes `headless: false` (both in top-level `use` and per-project `chromium` config) and uses `channel: 'chrome'` (the real installed Chrome browser channel, not Playwright's bundled Chromium). Running a headed real-Chrome browser on a headless Ubuntu dev box/CI runner requires either (a) a real X display (fine on a desktop-installed Ubuntu dev machine — X11/Wayland session provides one), or (b) `xvfb-run` wrapping the test command on a headless CI runner, and (c) `google-chrome-stable` actually installed (Playwright's `channel: 'chrome'` does **not** install Chrome itself — `npx playwright install` only fetches Playwright's own bundled browsers, not the "chrome" channel). For a `ubuntu-latest` GitHub Actions runner this means either switching the CI E2E job to `xvfb-run npx playwright test` + installing `google-chrome-stable` via apt, or (simpler, since D-11's CI scope is lint/typecheck/unit/native-build, not E2E) confirm E2E stays out of the new Linux CI job's scope for this phase and is only a local-dev-machine concern (a real desktop session already has a display, so `headless:false` works there without xvfb). **Recommend flagging this as a task-level checkpoint for the planner** rather than silently assuming it works — this is the single highest-risk "looks fine until someone actually runs it" gap in this phase. |
| Playwright system deps | `[VERIFIED: no direct playwright browser install run in this research session, documented from official Playwright Linux docs]` | `npx playwright install --with-deps` is the standard way to pull required Linux shared libraries for Playwright's bundled browsers on Ubuntu; since this project uses `channel: 'chrome'` instead of Playwright's bundled Chromium, the relevant one-time setup is `sudo apt-get install -y google-chrome-stable` (or Playwright's `--with-deps` for the bundled-browser fallback used by non-E2E browser tests, e.g. the Storybook Vitest browser project) `[ASSUMED — ceiling: confirm exact package name/repo-add steps for google-chrome-stable at plan/implementation time since Google's own apt repo setup step isn't yet verified in this session]`. |
| `@vitest/browser-playwright` (Storybook tests) | `[CITED: vitest.config.ts referenced in STACK.md]` | Uses Playwright's own bundled browser automation for `npm run test:storybook` — this needs `npx playwright install` (bundled Chromium, distinct from the `channel: 'chrome'` E2E path above) to have browser binaries + Linux system deps present. Should be part of `setup-ubuntu.sh` or documented as a one-time step. |
| Editor/env config generally | `[VERIFIED: no .vscode/, no other OS-specific dotfiles with Windows paths found]` | Nothing else surfaced in this audit. |

## Architecture Patterns

### System Architecture Diagram

```
Fresh Ubuntu dev machine
        │
        ▼
scripts/setup-ubuntu.sh  ──▶ /etc/os-release guard (Ubuntu/Debian only)
        │                          │
        │                          ▼
        │                 apt-get install (webkit2gtk-4.1, build-essential,
        │                 appindicator3, librsvg2, libssl, libxdo, pkg-config)
        │                          │
        │                          ▼
        │                 rustup / cargo install (guarded by `command -v cargo`)
        │                          │
        ▼                          ▼
   npm ci (Node tooling)   npx @tauri-apps/cli info  (sanity check both sides)
        │                          │
        └──────────────┬───────────┘
                        ▼
              npm run tauri dev
                        │
                        ▼
        Vite dev server (1420) ──▶ Rust/Cargo compiles src-tauri/
                        │                    │
                        ▼                    ▼
              React 19 frontend  ◀──  webkit2gtk WebView window (D-03 success criterion)


CI (GitHub Actions, on push/PR):
  existing `quality` job (ubuntu-latest, unchanged) ── lint/typecheck/test/audit
  new `tauri-build` job (ubuntu-latest) ── apt deps → rust-toolchain action →
                                            npm ci → npm run tauri build
  `release.yml` `publish-tauri` job (self-hosted windows, UNCHANGED) ── signing/bundling
```

### Recommended Project Structure
```
bar-pos/
├── scripts/
│   └── setup-ubuntu.sh     # NEW — idempotent apt+rustup installer (D-09)
├── .gitattributes           # NEW — LF normalization for .husky/*, *.sh (D-12)
├── .github/workflows/
│   └── ci.yml                # EDIT — add tauri-build job (D-11)
├── CLAUDE.md                 # EDIT — Ubuntu-aware overview line (D-10)
└── .planning/codebase/STACK.md  # EDIT — Platform Requirements section (D-10)
```

### Pattern: OS guard before privileged operations
**What:** Check `/etc/os-release` for `ID=ubuntu` or `ID_LIKE` containing `debian` before running any `apt`/`sudo` command; fail loudly and early on mismatch.
**When to use:** Any setup script intended to run unattended or by a future contributor who might be on a different OS.
**Example:**
```bash
# Source: standard pattern, cross-referenced against /etc/os-release fields verified on this machine
if ! grep -qE '^ID(_LIKE)?=.*(ubuntu|debian)' /etc/os-release 2>/dev/null; then
  echo "setup-ubuntu.sh targets Ubuntu/Debian only. Aborting." >&2
  exit 1
fi
```

### Anti-Patterns to Avoid
- **Hardcoding Ubuntu version numbers in package names or apt sources:** the confirmed package set is stable across 22.04→26.04; adding version-conditional logic here is speculative complexity D-06 explicitly asks to avoid.
- **Building multi-distro (`apt`/`dnf`/`pacman`) branching:** out of scope — this phase's own decisions (D-06) scope to Ubuntu only.
- **Assuming `libwebkit2gtk-4.0-dev` as a fallback:** confirmed absent from the repo entirely on this Ubuntu version; don't let the script try it as a "compat" path.
- **Silently assuming Playwright E2E "just works" headless on Linux CI:** it currently uses `headless: false` + the `chrome` channel — this needs an explicit decision (xvfb+chrome install, or scope E2E out of the new CI job), not a default assumption.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Checking if an apt package is already installed before installing | Custom `dpkg -s` check-then-install loop | Plain `apt-get install -y <pkg>` | apt is already idempotent; a manual pre-check duplicates what the package manager already guarantees |
| Verifying the whole Tauri toolchain (Node + Rust + system libs) is sane | Custom multi-step verification script | `npx @tauri-apps/cli info` (already a devDependency via `@tauri-apps/cli`) | Tauri's own CLI already cross-checks Node/Rust/webkit2gtk/etc. in one command and reports actionable errors |
| Rust toolchain management (versions, targets, components) | Hand-rolled version pinning/download | `rustup` (either via official installer or `apt install rustup`) | The universally standard Rust toolchain manager; reinventing this is pure risk for zero benefit |
| Line-ending normalization | Per-developer README instructions ("remember to set core.autocrlf") | `.gitattributes` at the repo | Repo-level enforcement fixes it for every future clone/contributor in one place, not per-developer opt-in |

**Key insight:** Every piece of this phase that looks like it needs custom tooling already has a standard, official answer (apt, rustup, `tauri info`, `.gitattributes`) — the actual engineering work here is verification and gluing these standard pieces together in one script and one CI job, not building anything new.

## Common Pitfalls

### Pitfall 1: CRLF-poisoned shell scripts fail silently or with a confusing error
**What goes wrong:** `#!/bin/sh` with a trailing `\r` causes `/bin/sh^M: bad interpreter` or similar on execution.
**Why it happens:** Git checked out a file that was committed with CRLF (typically from a Windows editor/git-config combination), and no `.gitattributes` rule normalizes it.
**How to avoid:** Add `.gitattributes` with `eol=lf` rules for `.husky/*` and `*.sh`, then `git add --renormalize .`.
**Warning signs:** `file <script>` reports "with CRLF line terminators" (already found live in this repo for `.husky/pre-push`).

### Pitfall 2: Assuming the executable bit survived cross-platform checkout
**What goes wrong:** A shell script committed without the executable bit (mode `100644` instead of `100755`) silently fails to run via `./script.sh` (though `sh script.sh` still works) — easy to miss in a one-off manual test.
**Why it happens:** Windows filesystems (NTFS, not WSL2's ext4-backed distro filesystem) have no concept of the Unix executable bit; if a file is ever re-created (not just edited) on a native Windows checkout, git may record it without the bit.
**How to avoid:** `git update-index --chmod=+x` on the relevant files as part of this phase's fix, and consider it cheap insurance even where `file`/`ls -l` currently looks fine.
**Warning signs:** `git diff` shows a mode change (`100644` → `100755`) unexpectedly, or a hook silently doesn't run.

### Pitfall 3: `playwright.config.ts`'s `headless: false` + `channel: 'chrome'` breaks non-interactive Linux runs
**What goes wrong:** E2E tests hang or fail with "unable to open display" on a headless Linux CI runner, or fail because Google Chrome (not just Playwright's bundled Chromium) isn't installed.
**Why it happens:** The config was written assuming a Windows dev machine with an interactive desktop session and a real Chrome install already present.
**How to avoid:** For local Ubuntu dev-desktop use, this is actually fine (a real X/Wayland session exists) as long as `google-chrome-stable` is installed. For CI, either wrap with `xvfb-run` + install `google-chrome-stable` via apt, or explicitly scope E2E out of the new Linux CI job (D-11 only requires lint/typecheck/unit/native-build to be mirrored — E2E was not named).
**Warning signs:** `npx playwright test` on a fresh Ubuntu box errors immediately with a browser-launch failure rather than a test assertion failure.

### Pitfall 4: `npm run tauri build` in CI is slow without caching
**What goes wrong:** Every CI run pays a full Rust release-mode compile (multiple minutes), making the new Linux job much slower than the existing Node-only `quality` job.
**Why it happens:** Rust's incremental compilation cache lives in `target/`, which is fresh on every GitHub-hosted runner unless explicitly cached.
**How to avoid:** Add `Swatinem/rust-cache@v2` (or equivalent) to the new CI job.
**Warning signs:** CI job duration for the new job is disproportionately long compared to `quality`.

## Code Examples

### Verifying the whole toolchain in one command
```bash
# Source: official Tauri CLI, already a devDependency (@tauri-apps/cli)
npx @tauri-apps/cli info
```

### `.gitattributes` fix for D-12
```
* text=auto eol=lf
.husky/* text eol=lf
*.sh text eol=lf
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| webkit2gtk-4.0 (soup2) on Linux | webkit2gtk-4.1 (soup3) | Tauri 2.0.0-alpha.3 | 4.0 is fully absent from current Ubuntu repos (confirmed on 26.04); any doc/script referencing 4.0 is stale and will fail |

**Deprecated/outdated:** `libwebkit2gtk-4.0-dev` for any Tauri 2.x project — do not let training-data-era snippets referencing it leak into the setup script or docs.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `dtolnay/rust-toolchain@stable` is the right/current GitHub Action name and tag for installing Rust in CI | D-11 | Low — well-known, widely used action; if renamed/deprecated, CI job simply fails fast on `uses:` resolution, easy to catch and swap for `actions-rs/toolchain` or manual rustup install |
| A2 | `sudo apt-get install -y google-chrome-stable` is the correct package name/step to satisfy Playwright's `channel: 'chrome'` on Ubuntu | D-13 | Medium — if the exact repo-add steps for Google's apt repo differ, E2E on a fresh machine could still fail to launch Chrome; verify at implementation time with an actual `npx playwright test` run |
| A3 | `Swatinem/rust-cache@v2` is the standard/current Rust caching action for GitHub Actions | Common Pitfalls #4 | Low — cosmetic if wrong, CI still functions, just slower; not a correctness risk |

## Open Questions

1. **Should the new Linux CI job also run E2E (Playwright) tests, or stay scoped to lint/typecheck/unit/native-build as D-11 literally states?**
   - What we know: D-11 explicitly lists "lint, typecheck, unit tests, native Tauri build" — it does not mention E2E.
   - What's unclear: Whether the user considers E2E part of "mirroring the Windows job" — though note there IS no existing Windows CI job to mirror; only `release.yml`'s Windows publish job exists, and it doesn't run E2E either.
   - Recommendation: Keep the new job scoped exactly to D-11's literal list (lint/typecheck/unit/native build). Playwright's headed-Chrome CI complications (Pitfall 3) make E2E-in-CI a separably-scoped follow-up, not a silent scope-creep into this phase.

2. **Does `setup-ubuntu.sh` need to also install/verify Node.js itself, or assume it's already present?**
   - What we know: no `.nvmrc`/`engines` field exists in `package.json`; CI pins Node 22 via `actions/setup-node`; this dev machine already has Node 24.
   - What's unclear: CONTEXT.md's D-09 describes the script as installing "native deps and the Rust toolchain" — Node is not explicitly named.
   - Recommendation: Scope `setup-ubuntu.sh` to native/Rust deps only per D-09's literal wording; add a `command -v node` pre-flight check that prints a clear error/nvm-install hint rather than silently assuming Node exists, but don't have the script install Node itself (that's a separate, well-solved problem — nvm/fnm — outside this phase's stated scope).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Ubuntu OS | whole phase | ✓ | 26.04 LTS (resolute) | — |
| Node.js | all npm tooling | ✓ | v24.18.0 | — |
| npm | package management | ✓ | 11.16.0 | — |
| Rust (rustc/cargo) | `src-tauri/` build | ✗ | — | Install via `scripts/setup-ubuntu.sh` (this phase's deliverable) |
| rustup | toolchain management | ✗ | — | apt candidate `1.27.1-8` available, or official curl installer |
| libwebkit2gtk-4.1-dev | Tauri native webview | ✗ (not installed) | candidate 2.52.3-0ubuntu0.26.04.2 | Install via apt (this phase) |
| libayatana-appindicator3-dev | Tauri tray icon | ✗ (not installed) | candidate 0.5.94-1build1 | Install via apt (this phase) |
| librsvg2-dev | Tauri icon rendering | ✗ (not installed) | candidate 2.61.3+dfsg-3 | Install via apt (this phase) |
| build-essential | Rust native compilation | ✓ | 12.12ubuntu2.26.04.2 | — |
| libssl-dev, libxdo-dev, pkg-config, curl, wget, file | Tauri build deps | ✓ (curl/file installed) / candidates resolvable for rest | various | Install remaining via apt (this phase) |
| google-chrome-stable | Playwright E2E (`channel: 'chrome'`) | not checked this session | — | `[ASSUMED]` — verify at implementation time (see A2) |

**Missing dependencies with no fallback:** none — every missing item has a confirmed apt/rustup install path that this phase's own script provides.
**Missing dependencies with fallback:** Rust toolchain (fallback: apt `rustup` package vs. official curl installer, both valid — Claude's Discretion).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest v4 (unit), Playwright v1.59 (E2E) — both already configured, unchanged by this phase |
| Config file | `bar-pos/vitest.config.ts`, `bar-pos/playwright.config.ts` |
| Quick run command | `npm run typecheck && npm run lint && npm run test` |
| Full suite command | `npm run test:e2e` (requires a working `npm run tauri dev`/`npm run dev` first — this is the actual acceptance test for D-03) |

### Phase Requirements → Test Map
No REQ-IDs are mapped to this phase (per phase description: "None (TBD)"). Verification for this phase is inherently environment/tooling-shaped rather than feature-behavior-shaped. Recommended checks per decision:

| Decision | Behavior | Test Type | Command | File Exists? |
|----------|----------|-----------|----------|-------------|
| D-03 | `npm run tauri dev` opens a working webkit2gtk window | manual/smoke | `npm run tauri dev` (visual confirmation, no automated assertion exists for "a window opened") | N/A — manual by nature |
| D-07/D-08 | Toolchain is correctly installed | automated smoke | `npx @tauri-apps/cli info` (non-zero exit / error output on any missing dep) | ✅ already exists (Tauri CLI) |
| D-09 | `scripts/setup-ubuntu.sh` is idempotent | manual/smoke | Run twice in a row, confirm second run reports "already installed"/no errors, exit 0 | ❌ Wave 0 — script itself is the phase's own deliverable |
| D-11 | New CI job passes | automated | GitHub Actions run on the PR that adds it | ❌ Wave 0 — job itself is the phase's own deliverable |
| D-12 | Git hooks execute correctly on a fresh Ubuntu clone | manual/smoke | Fresh `git clone` + `npm ci` + make a trivial commit, confirm `.husky/pre-commit` runs without shebang errors | ❌ Wave 0 — no existing automated test for hook execution (reasonable: it's a one-time environment check, not app behavior) |

### Sampling Rate
- **Per task commit:** `npm run typecheck && npm run lint` (fast Node-tooling checks — these don't change from this phase)
- **Per wave merge:** full `npm run test` + `npx @tauri-apps/cli info` + a manual `npm run tauri dev` smoke check
- **Phase gate:** all of the above, plus a fresh-clone dry-run of `scripts/setup-ubuntu.sh` if feasible (or at minimum a second no-op run of the script on this machine to prove idempotency), before `/gsd-verify-work`

### Wave 0 Gaps
- `scripts/setup-ubuntu.sh` does not exist yet — this phase's own primary deliverable.
- `.gitattributes` does not exist yet — needed for D-12's fix.
- No automated test asserts "the Tauri window actually opened" — this is inherently a manual/visual check (D-03's success criterion); do not attempt to build automated GUI-window-detection tooling for this, it would be disproportionate machinery for a one-time environment-migration phase gate.

## Security Domain

This phase is dev-tooling/infrastructure, not a user-facing application feature — most ASVS categories (auth, session management, access control, application input validation) do not apply; no new attack surface is introduced in the shipped product (D-01: shipping target unchanged, Windows-only).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | not touched by this phase |
| V3 Session Management | no | not touched by this phase |
| V4 Access Control | no | not touched by this phase |
| V5 Input Validation | no | no new user input surface |
| V6 Cryptography | no | not touched by this phase |
| V14 (Configuration/build pipeline) supply-chain hygiene | yes | apt packages from Ubuntu's own signed archive; rustup official installer or apt package — see threat pattern below |

### Known Threat Patterns for this phase's stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| `curl \| sh` piping a remote install script directly to a shell (rustup) | Tampering (if the remote script/CDN is compromised or MITM'd) | Prefer `curl --proto '=https' --tlsv1.2 -sSf ...` (already the official rustup command, enforces TLS) or use the `apt install rustup` path instead, which is signed/verified through Ubuntu's own package signing chain — recommend defaulting to the apt path in `setup-ubuntu.sh` for this reason |
| `sudo` usage inside an unattended setup script | Elevation of privilege (if the script itself were ever compromised/tampered) | Script should be committed to the repo (reviewable via normal PR process, same as any other code) and run interactively by a developer, not fetched-and-executed from an untrusted URL — this is already satisfied by D-09's framing ("Produce `scripts/setup-ubuntu.sh`" as a committed repo file) |
| CI job installing apt packages on every run | Tampering/availability (if an apt mirror is compromised or unavailable) | Standard GitHub-hosted `ubuntu-latest` runners already use Canonical's official archive; no additional mitigation needed beyond what CI already relies on for the existing `quality` job |

## Sources

### Primary (HIGH confidence — verified directly on this machine/repo)
- `/etc/os-release`, `apt-cache policy` for all named packages, `rustc`/`cargo`/`rustup`/`node`/`npm` version checks, `file` on `.husky/*`, `find` for `.gitattributes`/`.bat`/`.ps1` — all run directly in this session against the actual repo and actual Ubuntu 26.04 machine.
- `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `package.json`, `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, `playwright.config.ts`, `lint-staged.config.cjs`, `.cursor/environment.json`, `.husky/pre-commit`, `.husky/pre-push` — all read directly.

### Secondary (MEDIUM confidence — official docs fetched this session)
- https://v2.tauri.app/start/prerequisites/ — fetched directly, exact Debian/Ubuntu apt install command confirmed.
- https://v2.tauri.app/blog/tauri-2-0-0-alpha-3/ — webkit2gtk-4.0→4.1 migration rationale.
- https://github.com/tauri-apps/tauri/issues/9662 — confirms webkit2gtk-4.0 absence on Ubuntu 24+.
- https://packages.ubuntu.com/jammy/amd64/libdevel/libwebkit2gtk-4.1-dev — confirms 4.1 availability on 22.04.

### Tertiary (LOW confidence — flagged in Assumptions Log)
- `dtolnay/rust-toolchain@stable` and `Swatinem/rust-cache@v2` action names/tags (A1, A3) — not verified against the GitHub Marketplace this session, verify current tag at plan/implementation time.
- `google-chrome-stable` apt repo setup steps (A2) — not run this session.

## Metadata

**Confidence breakdown:**
- Standard stack (Tauri Linux deps, Rust toolchain): HIGH — verified directly via apt-cache/pkg-config on the actual target machine, cross-checked against official Tauri docs fetched this session
- Architecture (CI job structure, setup script pattern): HIGH — based on direct reads of existing `ci.yml`/`package.json`/`Cargo.toml` and standard, well-known GitHub Actions/apt/rustup patterns
- Pitfalls (CRLF, exec bit, Playwright headless): HIGH — the CRLF finding is a live, directly-verified fact in this exact repo, not a hypothetical

**Research date:** 2026-07-25
**Valid until:** 30 days (Ubuntu package availability and Tauri prerequisites are stable; re-verify if Ubuntu 26.10 or Tauri 3.x land in that window)
