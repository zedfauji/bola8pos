---
created: 2026-08-07T12:35:00.000Z
title: Update CLAUDE.md's "Missing generated types workaround" to document the scoped single-line as-any pattern
area: docs
severity: minor
files:
  - CLAUDE.md
  - src/entities/resource/model/queries.ts (07-10-PLAN.md Task 2 — the plan that motivated this)
---

## Problem

CLAUDE.md's "Missing generated types workaround" section documents only the
file-level pattern: `const db = supabase as any` at the top of the file plus
a file-level `/* eslint-disable */` comment.

Plan `07-10-PLAN.md` (Task 2, phase 07 scope addition) deliberately deviates
from this for `src/entities/resource/model/queries.ts` — a large, mostly-typed
~700-line file — using a narrower scope instead: a single local
`const db = supabase as any` plus a targeted `eslint-disable-next-line`,
rather than a file-level disable. Flagged by `gsd-plan-checker` on
2026-08-07 as a reasonable, well-justified engineering call that's clearly
better practice for large files, but one that silently narrows a documented
team convention without updating the source of truth.

## Solution

Once 07-10 executes, update CLAUDE.md's "Missing generated types workaround"
section to describe both variants:
- File-level `as any` + file-level `eslint-disable` — small/mostly-untyped
  files where the whole file is affected.
- Scoped local `as any` + `eslint-disable-next-line` — large, mostly-typed
  files where only a few call sites need the workaround (preferred default
  going forward to avoid needlessly broad disables).

This prevents future plans from reverting to the broader file-level pattern
by rote when the scoped variant is now the better-practice default.
