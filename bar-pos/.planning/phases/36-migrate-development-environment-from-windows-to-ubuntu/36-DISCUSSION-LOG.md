# Phase 36: Migrate development environment from Windows to Ubuntu - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-25
**Phase:** 36-migrate-development-environment-from-windows-to-ubuntu
**Areas discussed:** Scope: dev-only vs. shipping target, Ubuntu target & native prerequisites, Migration artifacts to produce, Windows-specific pain points hit so far

---

## Scope: dev-only vs. shipping target

| Option | Description | Selected |
|--------|-------------|----------|
| Dev-only (Recommended) | Keep shipping target Windows/WebView2 only; get YOUR build/test/lint loop working on Ubuntu | ✓ |
| Also add Linux as a shipping target | First step toward a Linux desktop build too | |

**User's choice:** Dev-only
**Notes:** App keeps shipping Windows-only via WebView2.

| Option | Description | Selected |
|--------|-------------|----------|
| Out of scope (Recommended) | Hardware integration is a runtime/production concern | ✓ |
| Note it as a known gap | Flag for later if Linux ever becomes a shipping target | |

**User's choice:** Out of scope
**Notes:** Receipt printer / cash drawer / hardware settings untouched.

| Option | Description | Selected |
|--------|-------------|----------|
| Add a Linux CI job (Recommended) | Prevents future dev-environment drift | ✓ |
| Skip CI changes | Keep CI as-is | |

**User's choice:** Add a Linux CI job

| Option | Description | Selected |
|--------|-------------|----------|
| Both (Recommended) | Fix my machine now AND leave behind docs/scripts | ✓ |
| Just get my machine working | Quick fix, no polished docs | |

**User's choice:** Both

| Option | Description | Selected |
|--------|-------------|----------|
| Native Tauri shell too (Recommended) | Run the real desktop app locally via webkit2gtk | ✓ |
| Browser-only is fine | Vite dev server in browser covers day-to-day work | |

**User's choice:** Native Tauri shell too

| Option | Description | Selected |
|--------|-------------|----------|
| Move release builds to CI (Recommended) | GitHub Actions Windows runner produces the signed installer | |
| Keep a Windows machine/VM for releases | New Linux CI job is dev-loop testing only | ✓ |

**User's choice:** Keep a Windows machine/VM for releases
**Notes:** Diverged from the recommended option — release/signing pipeline stays manual on Windows.

| Option | Description | Selected |
|--------|-------------|----------|
| Just for me (Recommended) | Personal setup notes | |
| Official supported OS | Update CLAUDE.md/README as if any contributor might use Ubuntu | ✓ |

**User's choice:** Official supported OS
**Notes:** Diverged from the recommended option — docs get full treatment, not personal notes.

---

## Ubuntu target & native prerequisites

| Option | Description | Selected |
|--------|-------------|----------|
| 24.04 LTS (Recommended) | Current LTS, longest support window | |
| 22.04 LTS | Prior LTS | |
| Whatever I'm currently running — detect it | Don't hardcode a version | ✓ |

**User's choice:** Detect dynamically, don't hardcode

| Option | Description | Selected |
|--------|-------------|----------|
| Already installed, just document them (Recommended) | Working local setup, capture/verify the list | |
| Need to verify/discover the full list | Not fully confirmed yet | ✓ |

**User's choice:** Need to verify/discover the full list
**Notes:** Native deps not yet confirmed working on this machine.

| Option | Description | Selected |
|--------|-------------|----------|
| Already working (Recommended) | rustup/cargo already installed | |
| Needs to be set up as part of this phase | Not installed/working yet | ✓ |

**User's choice:** Needs to be set up as part of this phase

---

## Migration artifacts to produce

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, update both (Recommended) | CLAUDE.md + STACK.md both get a Linux dev-setup section | ✓ |
| Just CLAUDE.md | STACK.md is a generated/audit doc, leave it | |

**User's choice:** Yes, update both

| Option | Description | Selected |
|--------|-------------|----------|
| Setup script (Recommended) | Repeatable, testable, doubles as documentation-by-code | ✓ |
| Manual doc steps only | A markdown checklist is enough | |

**User's choice:** Setup script (`scripts/setup-ubuntu.sh`)

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror existing Windows job (Recommended) | Full parity: lint, typecheck, unit tests, native build | ✓ |
| Narrower: skip native Tauri build | Faster, less to maintain | |

**User's choice:** Mirror existing Windows job

---

## Windows-specific pain points hit so far

| Option | Description | Selected |
|--------|-------------|----------|
| Research should find them fresh (Recommended) | Nothing specific hit yet, or prefer a systematic audit | ✓ |
| I've hit specific issues — let me describe them | Concrete known breakage to report | |

**User's choice:** Research should find them fresh

| Option | Description | Selected |
|--------|-------------|----------|
| Just verify as-is (Recommended) | Husky/lint-staged are typically OS-agnostic | |
| Known to need changes | Something here is Windows-specific | ✓ |

**User's choice:** Known to need changes
**Notes:** Follow-up asked for specifics — user was not sure of the exact issue and asked to flag husky/.git/hooks for research investigation (likely candidates: executable bit, CRLF line endings, shebang assumptions).

---

## Claude's Discretion

- Exact structure/contents of `scripts/setup-ubuntu.sh` (idempotency, package-manager detection, error handling)
- Whether the Linux CI job is a new job inside `ci.yml` or a separate workflow file

## Deferred Ideas

- Linux as a shipping target (packaging, hardware/peripheral driver parity, QA) — its own future phase if ever pursued
- Hardware/peripheral integration on Linux — only relevant if Linux shipping is ever pursued
- Moving Windows release builds/signing to CI — independent future decision, not part of this migration
