---
created: 2026-07-25T20:46:23.076Z
title: Relocate misplaced GitHub workflows directory to git root
area: tooling
severity: major
files:
  - .github/workflows/ci.yml
  - .github/workflows/release.yml
---

## Problem

`.github/workflows/` currently lives at `bar-pos/.github/workflows/`, one level below the actual git root (`bola8pos-kiro/`). GitHub Actions only reads `.github/workflows/` at the repository root, so neither `ci.yml` nor `release.yml` has ever executed. This is pre-existing and OS-independent — it predates and is unrelated to the Ubuntu dev-environment migration (Phase 36); it was only discovered because that migration exercised CI-adjacent paths nobody had touched in a while.

Found and dispositioned during Phase 36 (migrate-development-environment-from-windows-to-ubuntu), plan 36-04, Task 2 checkpoint decision (option-b: backlog todos).

## Solution

Move `bar-pos/.github/workflows/` to `<git-root>/.github/workflows/` (i.e. `bola8pos-kiro/.github/workflows/`).

**IMPORTANT — do not do this casually.** Relocating the directory activates `release.yml`'s Windows code-signing job for the very first time. That conflicts with Phase 36's D-04 decision, which explicitly kept the release pipeline untouched during the Ubuntu migration. D-04's override was deliberately deferred, not decided — before making this move, get explicit human confirmation that firing the release/code-signing workflow for the first time is intended, since a release pipeline firing is not undoable after the fact (see 36-04-PLAN.md's `<reversibility rating="one-way">` on this exact question). Consider running this as (or folding into) its own phase via `/gsd-phase` rather than a quick fix, since it also depends on the tsc-errors todo being resolved first (see companion todo) for `ci.yml`'s `quality`/`tauri-build` jobs to go green once activated.
