# Phase 36: Migrate development environment from Windows to Ubuntu - Pattern Map

**Mapped:** 2026-07-25
**Files analyzed:** 5
**Analogs found:** 2 exact/role-match / 5 (this phase is mostly config/docs, not app code — no in-repo analog exists for 3 of 5)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `scripts/setup-ubuntu.sh` | utility (setup script) | batch (idempotent shell install) | none in-repo (only `.ts`/`.mjs` scripts exist under `scripts/`) | no analog — use RESEARCH.md's verified snippet |
| `.gitattributes` | config | transform (line-ending normalization) | none in-repo (file doesn't exist yet) | no analog — standard boilerplate, no project-specific pattern needed |
| `.github/workflows/ci.yml` (edit — add `tauri-build` job) | config (CI) | batch (checkout → setup → build) | same file, existing `quality` job | exact — same file, sibling job |
| `CLAUDE.md` (edit — overview line) | config/docs | transform (text edit) | same file, existing "Project Overview" section | exact |
| `.planning/codebase/STACK.md` (edit — Platform Requirements) | config/docs | transform (text edit) | same file, existing §Platform Requirements | exact |

## Pattern Assignments

### `scripts/setup-ubuntu.sh` (utility, batch)

**No in-repo shell-script analog exists.** `bar-pos/scripts/` only contains `.ts` (run via `tsx`/`node`) and `.mjs` files (e.g. `write-env-local-from-cloud-secret.mjs`, `test-payment-auth.mjs`) — no `.sh` files to copy conventions from. `.husky/pre-commit` is the only other shell script in the repo, and it's a 2-line hook, not a setup script.

**What to copy from instead:** RESEARCH.md's `## D-09` section contains a fully-formed, already-verified script (OS guard via `/etc/os-release`, `apt-get install` idempotency, `command -v cargo` guard around rustup, `npx @tauri-apps/cli info` sanity check). Use that verbatim as the base — it was written and validated against this exact machine in the research pass, not a generic template.

**Existing shell convention to match (from `.husky/pre-commit`, 1 line):**
```sh
#!/bin/sh
npx tsc --noEmit
npx lint-staged
```
Take from this: plain POSIX shebang, no bashisms unless needed (RESEARCH.md's script needs `set -euo pipefail` and arrays-free syntax, so `#!/usr/bin/env bash` is correct and already what RESEARCH.md specifies — do not downgrade to `#!/bin/sh` since `set -o pipefail` is a bash-ism the script relies on).

**Existing shell-invocation convention (from `.cursor/environment.json`):**
```json
"install": "cd bar-pos && HUSKY=0 npm ci && node scripts/write-env-local-from-cloud-secret.mjs",
```
Shows the project's convention of `cd bar-pos && <cmd> && <cmd>` chains — keep `setup-ubuntu.sh` runnable from repo root (script itself should `cd` or the docs should tell the user to run it from `bar-pos/`), consistent with this pattern.

---

### `.gitattributes` (config, transform)

**No analog** — file doesn't exist anywhere in the repo (verified via `find`). This is a first-of-its-kind file for this project. Use RESEARCH.md's exact content, no local convention to reconcile:
```
* text=auto eol=lf
.husky/* text eol=lf
*.sh text eol=lf
```

---

### `.github/workflows/ci.yml` — add `tauri-build` job (config, batch)

**Analog:** same file, existing `quality` job (lines 9-41 of current file).

**Structure to copy (lines 9-28):**
```yaml
jobs:
  quality:
    name: Typecheck / Lint / Test / Audit
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: bar-pos
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node 22
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: bar-pos/package-lock.json

      - name: Install dependencies
        run: npm ci
```

**What the new job must copy exactly:** `runs-on: ubuntu-latest`, the `defaults.run.working-directory: bar-pos` block, the `actions/checkout@v4` + `actions/setup-node@v4` (node-version `22`, npm cache with the same `cache-dependency-path`) steps, and `npm ci`. Then append the native-build-specific steps (apt install of Tauri Linux deps, `dtolnay/rust-toolchain@stable`, `Swatinem/rust-cache@v2`, `npm run tauri build -- --ci`) per RESEARCH.md's `## D-11` section — do not re-derive these from scratch, they're already fully specified there.

**Job-naming convention to match:** existing job key is `quality` with a human-readable `name:` field (`Typecheck / Lint / Test / Audit`) — new job should follow the same `key: tauri-build` / `name: "Tauri Native Build (Linux)"` shape (already used in RESEARCH.md's example, keep it as-is).

**Trigger block (lines 1-7) — do not duplicate, it's shared:**
```yaml
on:
  pull_request:
    branches: [main, master]
  push:
    branches: [main, master]
```
The new job goes under the same top-level `jobs:` key, inheriting this trigger — no new workflow file needed (matches CONTEXT.md's discretion note: "follow whichever fits the existing file's structure more cleanly" → same file wins since there's only one job today and no reason to split triggers).

---

### `CLAUDE.md` — Project Overview line (docs, transform)

**Analog:** same file, current line reading (per canonical_refs in CONTEXT.md):
> "A bar/restaurant POS system built as a Tauri 2 desktop app (Windows, WebView2)."

**Pattern:** minimal in-place text edit — add Ubuntu as a supported *dev* OS without changing the shipping-target framing (D-01). Suggested phrasing direction (planner/implementer to finalize wording): keep "(Windows, WebView2)" as the shipping target, add a clause noting Ubuntu is an officially supported dev OS with `npm run tauri dev` via webkit2gtk (see `scripts/setup-ubuntu.sh`). Do not touch the "Commands" section's actual command list — commands are already OS-agnostic (`npm run dev`, `npm run tauri dev`, etc.); only add a callout/note if anything OS-specific needs surfacing (e.g. reference `scripts/setup-ubuntu.sh` for first-time Ubuntu setup).

---

### `.planning/codebase/STACK.md` — §Platform Requirements (docs, transform)

**Analog:** same file, current section (lines 78-86, read directly):
```markdown
## Platform Requirements

**Development:**
- Windows (primary target per `CLAUDE.md`), macOS/Linux plausible for Vite/web dev
- Rust toolchain via rustup for `cargo` / `tauri` native builds
- Node + npm for frontend tooling

**Production:**
- Tauri desktop installers/bundles (`bar-pos/src-tauri/tauri.conf.json` `bundle.targets`: `all`)
```

**Pattern:** edit the `**Development:**` bullet list only — change "macOS/Linux plausible" (speculative/unverified language) to a concrete statement that Ubuntu is a verified, officially supported dev OS (per D-10), referencing `scripts/setup-ubuntu.sh` as the setup path and noting the confirmed native deps (`libwebkit2gtk-4.1-dev`, rustup, etc. — full list in RESEARCH.md `## D-07`). Leave `**Production:**` untouched — shipping target is unchanged per D-01/D-04.

Also check line 20-21 (Runtime Environments section) which separately states "WebView2 (Windows) — Tauri 2 desktop host" — this is a different section than Platform Requirements; CONTEXT.md's D-10 only calls out "Platform Requirements section" specifically, so leave the Runtime Environments WebView2 line as-is unless the planner decides symmetry is warranted (out of this phase's explicit decision scope; flag but don't over-edit).

## Shared Patterns

### Idempotent apt install (no custom check-then-install logic)
**Source:** RESEARCH.md `## D-09`, `## Don't Hand-Roll` table
**Apply to:** `scripts/setup-ubuntu.sh` only
```bash
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev pkg-config
```
`apt-get install` is already idempotent — no `dpkg -s` pre-check loop needed. Only rustup needs a `command -v cargo` guard (its installer is not safely re-runnable).

### OS guard before privileged operations
**Source:** RESEARCH.md `### Pattern: OS guard before privileged operations`
**Apply to:** `scripts/setup-ubuntu.sh` (top of file, before any `apt`/`sudo` call)
```bash
if ! grep -qE '^ID(_LIKE)?=.*(ubuntu|debian)' /etc/os-release 2>/dev/null; then
  echo "setup-ubuntu.sh targets Ubuntu/Debian only. Aborting." >&2
  exit 1
fi
```

### CI job skeleton (checkout → setup-node → npm ci)
**Source:** `.github/workflows/ci.yml` lines 9-28 (existing `quality` job)
**Apply to:** new `tauri-build` job in the same file
Reuse `runs-on: ubuntu-latest`, `defaults.run.working-directory: bar-pos`, `actions/checkout@v4`, `actions/setup-node@v4` (node 22, npm cache keyed on `bar-pos/package-lock.json`), then diverge for Rust/apt/native-build steps.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `scripts/setup-ubuntu.sh` | utility | batch | No shell setup-script exists in this repo (`scripts/` is all `.ts`/`.mjs`); use RESEARCH.md's verified script as the base instead of an in-repo analog |
| `.gitattributes` | config | transform | File doesn't exist anywhere in the repo yet; use RESEARCH.md's exact 3-line content, no local convention to reconcile |

## Metadata

**Analog search scope:** `bar-pos/scripts/`, `bar-pos/.husky/`, `bar-pos/.cursor/environment.json`, `bar-pos/.github/workflows/ci.yml`, `bar-pos/CLAUDE.md`, `.planning/codebase/STACK.md`
**Files scanned:** ~10 (repo root config/docs + all files under `scripts/`)
**Pattern extraction date:** 2026-07-25
