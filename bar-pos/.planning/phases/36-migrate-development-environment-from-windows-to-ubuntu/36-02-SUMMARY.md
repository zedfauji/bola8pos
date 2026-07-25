---
phase: 36-migrate-development-environment-from-windows-to-ubuntu
plan: 02
subsystem: infra
tags: [git, gitattributes, husky, line-endings, crlf, dev-environment]

# Dependency graph
requires:
  - phase: 36-migrate-development-environment-from-windows-to-ubuntu
    provides: "36-01's scripts/setup-ubuntu.sh — the file this plan's .gitattributes rule protects from a CRLF shebang"
provides:
  - "bar-pos/.gitattributes — *.sh text eol=lf, the only rule; no blanket text=auto (739 CRLF-tracked files stay untouched)"
  - "Repaired local .husky/pre-commit and .husky/pre-push (LF, cwd-guarded) — gitignored machine state, not committed"
  - "Written D-12 root-cause finding: git hooks are inert on this machine independent of CRLF, and activating them today would block every commit"
affects: [36-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - ".gitattributes scoped narrowly to the exact breakage (*.sh) rather than a blanket text=auto renormalize, to avoid unrelated multi-hundred-file churn"
    - "Hook scripts self-locate their working directory via cd \"$(dirname \"$0\")/..\" so they resolve correctly whether git invokes them from the repo root or from bar-pos/"

key-files:
  created: [bar-pos/.gitattributes]
  modified: [bar-pos/.husky/pre-commit, bar-pos/.husky/pre-push]

key-decisions:
  - "Did not add a .husky/* eol=lf rule — .husky/ is gitignored (bar-pos/.gitignore line 55), so a gitattributes rule targeting it would be a dead rule; git attributes only affect tracked content."
  - "Did not run git add --renormalize . or add a blanket * text=auto eol=lf rule — 739 of 1694 tracked files currently have CRLF endings; a blanket renormalize would produce a 739-file churn commit unrelated to this fix. Only *.sh shebangs actually break on Linux."
  - "Did not touch core.hooksPath — it currently holds a stale absolute Windows path, so hooks are already completely inert. Repairing it would immediately activate .husky/pre-commit's npx tsc --noEmit gate, which fails today on 2 pre-existing, unrelated typecheck errors and would block every subsequent commit in the repo, including this phase's own. The activation decision is explicitly routed to the user in plan 36-04."
  - "Left .agents/skills/electron-scaffold/scripts/scaffold.sh (the one pre-existing tracked CRLF shell script) untouched — vendored third-party skill content, unrelated to this phase; the new .gitattributes rule governs future commits, not a retroactive rewrite."

patterns-established:
  - "Any future *.sh file added to this repo is guaranteed LF on checkout via the committed .gitattributes rule, closing the CRLF-shebang failure mode for good."

requirements-completed: []

coverage:
  - id: D1
    description: "bar-pos/.gitattributes exists with exactly one rule (*.sh text eol=lf); scripts/setup-ubuntu.sh resolves eol:lf while unrelated file types (e.g. src/main.tsx) do not, and no blanket text=auto rule was introduced"
    verification:
      - kind: other
        ref: "git check-attr eol -- scripts/setup-ubuntu.sh => 'eol: lf'; git check-attr eol -- src/main.tsx => 'eol: unspecified'; grep -v '^#' .gitattributes | grep -c 'text=auto' => 0; git status --porcelain showed exactly 1 added file (bar-pos/.gitattributes) for this task"
        status: pass
    human_judgment: false
  - id: D2
    description: "Local .husky/pre-commit and .husky/pre-push are valid LF POSIX shell (no CRLF terminators) and both resolve bar-pos/ as their working directory via a $0-derived cd guard, regardless of which directory git invokes them from"
    verification:
      - kind: other
        ref: "file .husky/pre-commit .husky/pre-push => both 'POSIX shell script, ASCII text executable' (no CRLF report); cat -A .husky/pre-push | head -1 => '#!/bin/sh$' (no ^M); sh bar-pos/.husky/pre-push run from the git root (bola8pos-kiro/) produced tsc output referencing src/ paths, proving cwd resolved to bar-pos/; git config --get core.hooksPath unchanged before/after"
        status: pass
    human_judgment: false
  - id: D3
    description: "The real reason husky has never run in this repo (not just the CRLF symptom) is recorded in this SUMMARY: .husky/ is gitignored, core.hooksPath is a stale Windows path, husky v9 cannot self-install from bar-pos/, and activation is additionally blocked today by 2 pre-existing typecheck errors"
    verification:
      - kind: other
        ref: "See '## D-12 Finding: Why husky has never run' section below in this document"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-07-25
status: complete
---

# Phase 36 Plan 02: Git Line-Ending Normalization + Husky Root-Cause Finding Summary

**Added a scoped `bar-pos/.gitattributes` (`*.sh text eol=lf` only) that permanently prevents CRLF shell-script shebangs on Linux checkouts, repaired the two local (gitignored) husky hook scripts to be clean LF and cwd-safe, and documented that CRLF was never the real reason git hooks don't run here — a stale Windows `core.hooksPath` makes them completely inert regardless of line endings.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-25T20:20:00Z (approx.)
- **Completed:** 2026-07-25T20:32:00Z
- **Tasks:** 2
- **Files modified:** 3 (1 committed, 2 gitignored local state)

## Accomplishments
- Created `bar-pos/.gitattributes` with a single narrow rule (`*.sh text eol=lf`) — verified via `git check-attr` that it applies to `.sh` files and not to unrelated types like `.tsx`, and that no blanket `text=auto` rule was introduced
- Stripped CRLF from `bar-pos/.husky/pre-push` (the one file that actually had it — `pre-commit` was already clean LF)
- Added a `$0`-derived working-directory guard (`cd "$(dirname "$0")/.." || exit 1`) to both hook scripts so they resolve `bar-pos/` as cwd whether git invokes them from the repo root (`bola8pos-kiro/`) or from `bar-pos/` itself
- Verified the repaired `pre-push` hook end-to-end: running it from the git root produced `npm run typecheck` output referencing `src/` paths — proof the cwd guard works — with the 2 known pre-existing `tsc` errors as the only (expected) failure
- Confirmed `core.hooksPath` is untouched (still the stale Windows path) — deliberately not repaired, per plan scope
- Documented the full D-12 root cause below, correcting the original hypothesis that CRLF was the primary blocker

## Task Commits

1. **Task 1: Add .gitattributes enforcing LF for shell scripts** - `ae7b7a4` (feat)
2. **Task 2: Repair the local husky hook scripts and record the hooks finding** - no commit (`.husky/` is gitignored — `bar-pos/.gitignore` line 55 — so these edits are machine-local state, not committed content; this is expected per the plan's objective, not an omission)

**Plan metadata:** pending (this SUMMARY's commit)

_Note: Task 2's file changes are real and verified on disk (see verification commands above) but produce no git diff since `.husky/` is untracked._

## Files Created/Modified
- `bar-pos/.gitattributes` - new, single rule `*.sh text eol=lf`, committed
- `bar-pos/.husky/pre-push` - CRLF stripped, cwd guard added (gitignored, not committed)
- `bar-pos/.husky/pre-commit` - cwd guard added, content otherwise unchanged (gitignored, not committed)

## D-12 Finding: Why husky has never run

CRLF was a real, live defect (`.husky/pre-push` did carry a `#!/bin/sh\r` shebang, now fixed) but it was never the primary reason hooks don't run in this repo. Four independent facts, all verified directly on this machine:

1. **`.husky/` is gitignored** (`bar-pos/.gitignore` line 55; `git ls-files .husky` returns nothing). The hook scripts are untracked, so a fresh clone has none of them — this plan's fix is machine-local and does not propagate to other developers or CI by itself.
2. **`core.hooksPath` is a stale absolute Windows path** (`C:\Users\giris\...\bola8pos-kiro\.git\hooks`), confirmed unchanged before and after this plan. Git hooks are therefore completely inert on this machine, and would have been inert on Windows too, since that value points at git's own default hooks directory, not at husky's.
3. **Husky v9 cannot self-install from `bar-pos/`** — its installer returns `.git can't be found` and no-ops, because the git root (`bola8pos-kiro/`) is one level above the npm project root (`bar-pos/`).
4. **Repairing `core.hooksPath` today would be actively harmful.** `.husky/pre-commit` runs `npx tsc --noEmit`, which fails with 2 pre-existing errors (`src/entities/tab/model/queries.ts:791`, `src/shared/lib/agent/rag.ts:60`, both already documented in 36-01's SUMMARY as out of scope). Activating hooks now would block every commit in the repo, including this plan's own.

**Conclusion:** this plan deliberately stops short of activating hooks. Whether/how to activate them (fix `core.hooksPath`, and decide what to do about the 2 pre-existing typecheck errors first) is routed to the user as an explicit decision in plan 36-04.

## Decisions Made
- Scoped `.gitattributes` to `*.sh` only, not `.husky/*` or a blanket `text=auto` — see key-decisions in frontmatter for the full reasoning (dead rule for gitignored paths; 739-file churn risk for blanket renormalize).
- Left `core.hooksPath` untouched — activation is a user decision (plan 36-04), not something this plan should silently do given the 2 pre-existing typecheck failures it would immediately surface as commit blockers.
- Left the one pre-existing tracked CRLF shell script (`.agents/skills/electron-scaffold/scripts/scaffold.sh`) as-is — vendored third-party content, unrelated to this phase.

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched their `<action>` and `<verify>` blocks; Task 2 producing no commit is the explicitly documented expected outcome for gitignored files, not a deviation.

## Issues Encountered

None beyond what the plan's "Discovered during planning" section already anticipated. All three of those investigation results (`.husky/` gitignored, stale Windows `core.hooksPath`, husky-cannot-self-install) were reconfirmed live during this execution and are restated in the D-12 Finding section above.

## User Setup Required

None for this plan. Plan 36-04 will present the user with the hooks-activation decision described in the D-12 Finding above (whether to fix `core.hooksPath`, and how to handle the 2 pre-existing typecheck errors that currently block `pre-commit`).

## Next Phase Readiness
- `.gitattributes` is committed and protects every future `.sh` file (including 36-01's `scripts/setup-ubuntu.sh`) from a CRLF shebang on any Linux/macOS checkout.
- Local hook scripts on this machine are now valid, cwd-correct POSIX shell — ready to activate the moment the user decides to in 36-04.
- The real hooks-inertness root cause is documented and ready to inform 36-04's decision checkpoint; no further investigation needed there.

## Self-Check: PASSED

- FOUND: `bar-pos/.gitattributes`
- FOUND: commit `ae7b7a4`
- FOUND: `bar-pos/.husky/pre-commit` (LF, cwd guard, gitignored)
- FOUND: `bar-pos/.husky/pre-push` (LF, cwd guard, gitignored)

---
*Phase: 36-migrate-development-environment-from-windows-to-ubuntu*
*Completed: 2026-07-25*
