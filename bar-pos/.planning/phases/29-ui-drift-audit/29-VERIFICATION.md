---
phase: 29-ui-drift-audit
verified: 2026-07-10T00:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/5
  gaps_closed:
    - "Drift-audit script correctly scans and reports every raw <button>/<input> element, hardcoded hex/rgb color, and arbitrary-value Tailwind spacing class, file-attributed (AUDIT-01)"
    - "Audit output is a checklist/backlog usable to scope Phases 30-33 without further investigation (AUDIT-02)"
  gaps_remaining: []
  regressions: []
deferred: []
---

# Phase 29: UI Drift Audit Verification Report

**Phase Goal:** Produce a complete, file-mapped inventory of every design-system violation (raw `<button>`/`<input>` elements, hardcoded hex/rgb colors, arbitrary-value Tailwind spacing classes) across all 17 routes in `pages/`, `widgets/`, `features/`, so every subsequent fix phase has a concrete backlog to work from. Read-only — no application code is modified in this phase.

**Verified:** 2026-07-10
**Status:** passed
**Re-verification:** Yes — after gap closure (commit `ce8c38c fix(29-01): scan whole-file content instead of per-line for drift regex`)

## Goal Achievement

### Root Cause Fix Verification

The prior verification found `scripts/audit-ui-drift.ts`'s `scanCategory` used per-line `split('\n')` scanning with regexes requiring a trailing `[\s>]` character after `<button`/`<input` on the *same line* — which silently failed to match when Prettier wrapped a JSX tag's attributes to a new line on an LF-only file (the tag became the last token on its line, nothing followed it). Read `scripts/audit-ui-drift.ts` directly (lines 76-98): `scanCategory` now reads full file content via `fs.readFileSync` and runs `content.matchAll(global)` against the *entire* file string (not `split('\n')` first), with a `lineNumberAt` helper walking the content to compute the line number for each match after the fact. Because `\s` in the regex now sees the raw `\n` character in the unsplit content, `<button\n  onClick=...` matches correctly. This is a genuine root-cause fix (change to the shared scan function used by all four categories), not a symptom patch.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Drift-audit script scans `pages/`, `widgets/`, `features/` and reports every raw `<button>`/`<input>` element, hardcoded hex/rgb color, and arbitrary-value Tailwind class, file-attributed (AUDIT-01, ROADMAP SC1) | VERIFIED | Ran `npx tsx scripts/audit-ui-drift.ts` directly from `bar-pos/` against the current committed script. Printed output: `Raw <button> elements: 20 files`, `Raw <input> elements: 8 files`, `Hardcoded hex/rgb colors: 3 files`, `Arbitrary-value Tailwind spacing classes: 0 files` — exactly matches 29-RESEARCH.md's independently-verified baseline (20/8/3/0). |
| 2 | Audit output is a checklist/backlog usable to scope Phases 30-33 without further investigation (AUDIT-02, ROADMAP SC2) | VERIFIED | Re-read the regenerated `DRIFT-AUDIT.md`. All previously-missing files from the prior verification's gap report now appear: button section includes `src/features/agent-chat/ui/AgentButton.tsx`, `CommandChips.tsx`, `FileDropZone.tsx`, and — the specifically-flagged, payment-adjacent — `src/pages/pos/index.tsx` (line 54); input section includes `manage-combos/ui/ComboAvailabilityEditor.tsx`, `manage-modifier-groups/ui/ModifierGroupEditor.tsx`, `manage-products/ui/CategoryForm.tsx`, `upload-logo/ui/LogoUploader.tsx`, `widgets/InventoryPagePanel.tsx`. Format unchanged (Markdown, grouped by file, checkbox list, line numbers, forward-slash paths). |
| 3 | The audit's route count (17) is cross-checked against CLAUDE.md's routes table, confirming staleness that SHELL-03 fixes in Phase 30 (ROADMAP SC3) | VERIFIED | Re-run confirms: `Route cross-check: 17 real routes vs 14 CLAUDE.md rows`, `Routes missing from CLAUDE.md: /kds, /kitchen-prep, /audit` — unchanged from the passing prior verification (this logic was never part of the bug). |
| 4 | No application code under `src/` is modified — audit is read-only tooling only (ROADMAP SC4) | VERIFIED | `git diff --stat 6227dbb^..ce8c38c` (full phase-29 commit range, including the fix commit) touches only `bar-pos/scripts/audit-ui-drift.ts`, `bar-pos/.planning/phases/29-ui-drift-audit/DRIFT-AUDIT.md`, `bar-pos/.planning/phases/29-ui-drift-audit/29-01-SUMMARY.md`, `bar-pos/.planning/ROADMAP.md`, `bar-pos/.planning/STATE.md`. Zero files under `src/` in the diff. |
| 5 | `npm run typecheck` passes / script compiles clean under strict TS | VERIFIED | Ran `npm run typecheck`: exactly 2 pre-existing, unrelated errors (`src/entities/tab/model/queries.ts:778`, `src/shared/lib/agent/rag.ts:60`). `scripts/audit-ui-drift.ts` itself produces zero typecheck errors. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/audit-ui-drift.ts` | Standalone scanner implementing 4 category scans + route cross-check + Markdown writer, no new deps | VERIFIED | 245 lines, compiles clean. `scanCategory` (lines 76-98) fixed to scan whole-file content via `matchAll` instead of per-line `split`, with `lineNumberAt` (lines 68-74) recovering line numbers for reporting. Route cross-check and hex/spacing scans unchanged (were already correct). No new dependencies. |
| `.planning/phases/29-ui-drift-audit/DRIFT-AUDIT.md` | File-mapped violation backlog, committed | VERIFIED | Regenerated by re-running the script; `git status --porcelain` shows zero diff after regeneration — the committed file is byte-for-byte the script's genuine current output. Counts (20/8/3/0, 17 vs 14) match RESEARCH.md's independently-verified baseline exactly. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `scripts/audit-ui-drift.ts` | `src/pages`, `src/widgets`, `src/features` | `fs.readdirSync` recursive filtered walk | WIRED, VERIFIED (235 files collected; scan surface correct) |
| `scripts/audit-ui-drift.ts` (`scanCategory`) | file content | `fs.readFileSync` + `content.matchAll(global)` over unsplit string | WIRED, VERIFIED — root-cause fix confirmed by re-run matching the independently-verified baseline (20/8/3/0) |
| `scripts/audit-ui-drift.ts` | `src/app/router.tsx` + `CLAUDE.md` | `readFileSync` + regex route/row counts | WIRED, VERIFIED (17 vs 14, reproducible, unchanged) |
| `scripts/audit-ui-drift.ts` | `.planning/phases/29-ui-drift-audit/DRIFT-AUDIT.md` | `fs.writeFileSync` | WIRED, VERIFIED — regenerated output is git-clean against the committed file |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| Drift-audit script self-verification | `npx tsx scripts/audit-ui-drift.ts` (run from `bar-pos/`, this verification's own execution) | `Raw <button> elements: 20 files`, `Raw <input> elements: 8 files`, `Hardcoded hex/rgb colors: 3 files`, `Arbitrary-value Tailwind spacing classes: 0 files`, `Route cross-check: 17 real routes vs 14 CLAUDE.md rows`, missing `/kds, /kitchen-prep, /audit` | **PASS** — matches committed DRIFT-AUDIT.md and 29-RESEARCH.md baseline exactly |
| Regeneration idempotency | `git status --porcelain` after script run | No output (clean) | **PASS** — DRIFT-AUDIT.md is reproducible, genuine script output |
| `src/pages/pos/index.tsx` presence check | `grep -n "src/pages/pos/index.tsx" DRIFT-AUDIT.md` | `56:### src/pages/pos/index.tsx` under `## Raw <button> elements` | **PASS** — previously-missing file now correctly detected |
| Typecheck gate | `npm run typecheck` | 2 pre-existing unrelated errors only (`tab/model/queries.ts:778`, `agent/rag.ts:60`); script itself clean | **PASS** |
| No-`src/`-modified gate | `git diff --stat 6227dbb^..ce8c38c` (full phase-29 range incl. fix commit) | Only `scripts/audit-ui-drift.ts` + `.planning/**` in diff | **PASS** |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| AUDIT-01 | 29-01-PLAN.md | Drift audit identifies every raw button/input/hex/arbitrary-spacing violation, file-attributed | SATISFIED | Regex fix verified against independently-derived baseline (20/8/3/0); see Truth 1 |
| AUDIT-02 | 29-01-PLAN.md | Audit output is a checklist/backlog usable to scope subsequent fix phases | SATISFIED | Backlog now complete, including previously-missing files; see Truth 2 |

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers in `scripts/audit-ui-drift.ts`. The previously-flagged blocker (per-line regex undercount) is resolved.

### Human Verification Required

None — all checks are deterministically reproducible via `npx tsx scripts/audit-ui-drift.ts` and `git status --porcelain`.

### Gaps Summary

Both gaps from the prior verification are closed by a single root-cause fix: `scanCategory` in `scripts/audit-ui-drift.ts` now scans whole-file content via `content.matchAll(...)` instead of scanning `split('\n')` lines individually, so `\s` in the button/input/color/spacing regex patterns correctly matches the `\n` character itself, catching multi-line Prettier-wrapped JSX tags regardless of line-ending style. Re-running the script reproduces exactly the independently-verified baseline (20 button / 8 input / 3 hex / 0 spacing files, 17 routes vs 14 CLAUDE.md rows) from 29-RESEARCH.md, `src/pages/pos/index.tsx` and all other previously-missing files now appear in the regenerated `DRIFT-AUDIT.md`, the regenerated file is byte-identical to the committed one (clean `git status --porcelain`), typecheck shows only the 2 pre-existing unrelated errors, and the full phase-29 commit range (including this fix) touches zero files under `src/`. Phase goal fully achieved — AUDIT-01 and AUDIT-02 are both satisfied, and the backlog is now safe for Phase 30-33 to consume without further investigation.

---

*Verified: 2026-07-10*
*Verifier: Claude (gsd-verifier)*
