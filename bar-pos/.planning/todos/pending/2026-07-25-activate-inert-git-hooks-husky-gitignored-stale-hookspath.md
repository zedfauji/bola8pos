---
created: 2026-07-25T20:46:23.076Z
title: Activate inert git hooks (husky gitignored, stale hooksPath)
area: tooling
severity: minor
files:
  - .husky/pre-commit
  - .husky/pre-push
  - .gitignore
---

## Problem

Git hooks are currently inert: `.husky/` is gitignored, so hooks are absent on a fresh clone; `core.hooksPath` holds a stale absolute Windows path; husky v9 cannot self-install from the `bar-pos/` subdirectory (repo root is `bola8pos-kiro/`, one level up). This is pre-existing and OS-independent — Phase 36 plan 36-02 fixed the CRLF/working-directory bugs in the hook *scripts themselves* (D-12) but explicitly left activation out of scope.

Found and dispositioned during Phase 36 (migrate-development-environment-from-windows-to-ubuntu), plan 36-04, Task 2 checkpoint decision (option-b: backlog todos).

## Solution

**Depends on the "fix 2 pre-existing tsc errors" todo being resolved first** — activating hooks while `tsc` is red would make every commit fail immediately. Once that's fixed: un-gitignore `.husky/`, set `core.hooksPath` to a relative/repo-root-correct path that works from the `bola8pos-kiro/` git root (not the `bar-pos/` subdirectory), and get husky v9 installing correctly from a nested project directory (may need a root-level `prepare` script or manual `core.hooksPath` pointing into `bar-pos/.husky`).
