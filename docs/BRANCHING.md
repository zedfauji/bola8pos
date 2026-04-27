# Branching strategy (Bola8 POS)

This project uses **GitHub Flow** with a single long-lived integration branch. It keeps history linear, works well with Vite/Vitest/Supabase CI, and matches small-team velocity.

## Long-lived branches

| Branch | Purpose                                                                                                                                                                  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `main` | **Default branch.** Always deployable. Every merge is intended to pass CI (lint, typecheck, unit tests). Protected on GitHub: require PR + required checks before merge. |

We do **not** use a standing `develop` branch unless the team grows and needs a stabilization line; add it only if release trains get noisy.

## Short-lived branches

| Pattern           | When to use                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| `feature/<topic>` | New capability (e.g. `feature/pool-table-grid`).                                                       |
| `fix/<topic>`     | Bugfix against current `main` (e.g. `fix/tab-drawer-scroll`).                                          |
| `chore/<topic>`   | Tooling, deps, docs-only refactors that touch no product behavior.                                     |
| `hotfix/<topic>`  | Emergency production fix cut from the tag/commit that is live; merge back to `main` immediately after. |

Use lowercase, hyphens, no ticket IDs in the branch name unless your org requires them (then: `feature/JIRA-123-pool-tables`).

## Workflow

1. **Branch from `main`:** `git checkout main && git pull && git checkout -b feature/my-change`
2. **Small commits** with clear messages (imperative mood: `Add pool table grid widget`).
3. **Open a PR** into `main`. CI must be green.
4. **Squash merge** (preferred) or **merge commit** if you need to preserve fine-grained history for a large migration—pick one per repo and stay consistent.
5. **Delete the branch** after merge (GitHub setting: auto-delete head branches).

## Tags and releases

- Tag releases from `main` when you cut a build for stores or installers, e.g. `v1.4.0`.
- Hotfixes: branch from the release tag if you must patch an old line; otherwise always from `main`.

## Protected rules (recommended on GitHub)

- `main`: require pull request reviews (1 approver if team size allows), require status checks, no force-push, no deletions.
- Optional: **Require branches to be up to date** before merge to reduce “green PR, red main” drift.

## Commit messages

Use conventional prefixes when helpful for changelogs: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.

---

_Last updated: initial adoption for bola8pos._
