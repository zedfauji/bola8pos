---
title: Cross-Phase TODOs and Gaps Audit
generated: 2026-08-07
scope: all phases (1-39), including archived v2.2 milestone (29-35, 33.1)
sources:
  - .planning/phases/*/VERIFICATION.md
  - .planning/phases/*/UAT.md
  - .planning/phases/*/deferred-items.md
  - .planning/todos/pending/*.md
  - .planning/ROADMAP.md
  - .planning/milestones/v2.2-ROADMAP.md
---

# Cross-Phase TODOs and Gaps Audit

Full sweep of every phase's verification status, carry-forward gaps, and filed
TODOs across the entire project — not just the active v2.1 milestone. GSD's
`roadmap.analyze` only returns the "current" milestone (v2.1, phases 1-28) by
default; this document also covers the archived v2.2 milestone (phases 29-35,
33.1) and the later, unversioned continuation (phases 36-39), read directly
from `.planning/phases/` and `.planning/milestones/v2.2-ROADMAP.md`.

**This is a point-in-time snapshot.** Re-run the sweep described in
"How to regenerate" below before trusting it for anything more than a day or
two old — phases keep moving.

## Top-priority findings

Three features are silently broken in production despite passing (or never
receiving) GSD verification:

1. **CRITICAL — Promotions are completely unusable.** Every "+ Add promotion"
   click fails a DB check constraint (`promotions_item_target_check`).
   Phase 20 has verification status `passed`.
   Todo: `2026-08-04-promotion-creation-fails-db-check-constraint.md`
2. **CRITICAL — Recipe save always fails silently.** A later migration
   dropped the UNIQUE constraint the upsert's `ON CONFLICT` depends on.
   Phase 4 has no verification artifact at all.
   Todo: `2026-08-04-recipe-save-fails-on-conflict-constraint-mismatch.md`
3. **CRITICAL — Void order / close shift / generate report all 404.** They
   fetch a relative URL instead of the edge function endpoint — void-order
   has never actually voided anything through this path. Found during
   Phase 39's E2E triage, filed as a todo, never routed back to fix the
   actual feature.
   Todo: `2026-08-05-void-order-close-shift-generate-report-use-relative-fetch-url-always-404.md`

## Cross-cutting debt (not one phase's fault)

The same 2 pre-existing typecheck errors —
`src/entities/tab/model/queries.ts` (`number | null` not assignable to
`number | undefined`, line shifts as the file grows) and
`src/shared/lib/agent/rag.ts:60` (`number[]` not assignable to `string`) —
have been independently rediscovered and logged as out-of-scope in at least
**8 separate phases'** `deferred-items.md`: 11, 14, 17, 20, 25, 32, 33, 35.
Nobody has fixed them since Phase 11 first found them; every phase since just
re-confirms it's not its fault and moves on.

Two additional gaps were found during this sweep but were **never filed as
todos** — they exist only as a line in a later phase's `deferred-items.md`:

- **Tip Distribution "Save" button stays disabled** even when Floor/Bar/Kitchen
  percentages correctly sum to 100 (bug lives in
  `TipDistributionSettingsTab.tsx`, Phase 19's own file; found and logged by
  Phase 33, never promoted to a todo).
- **`e2e/09-rbac.spec.ts` — 5 of 23 tests fail even in isolation** (permission
  matrix count drifted 88→96, plus a locator ambiguity between
  `view_kds`/`view_kds_bar`). Logged by Phase 33; Phase 33.1 fixed 3 *other*
  drift bugs from the same investigation but not these 5.

## Full table: Phase, Description, Status, TODOs, Gaps

| Phase | Description | Status | TODOs | Gaps |
|---|---|---|---|---|
| 1 | Foundation — stock ledger, categories, modifiers, combo flags | complete, human_needed | none | Migrations never pushed to staging; E2E fails T2–T8; Tauri smoke never run |
| 2 | Combos | complete, passed | none | none |
| 3 | Ingredient Foundation | complete, **gaps_found** | none | `record_stock_movement` RPC crashes on NOT NULL `product_id` — manual inventory adjustment broken |
| 4 | Recipes & Sale Depletion | complete, no verification | **CRITICAL: recipe save fails silently** (ON CONFLICT mismatch after later migration) | pre-existing unrelated lint errors |
| 5 | Kitchen Prep + Cocktails | complete, no verification | none | none |
| 6 | Split Bill + Refund | complete, human_needed | none | 8 E2E tests never run against real app |
| 7 | Waitlist + WhatsApp | complete, **gaps_found** | **MAJOR: Notify fails** — `net` schema/pg_net not enabled, DB write rejected | `/waitlist` route missing from router (blank page); queries select non-existent `pool_tables.name` |
| 8 | Polish + Reports + E2E Hardening | complete, no verification | (adjacent infra todo: print-popup hangs under Playwright) | none |
| 9 | Auto-Update Service | complete, human_needed | none | Tauri smoke, Storybook states, signing secret, full release pipeline — none confirmed |
| 10 | AI Slob Tech Debt Checklist | complete, passed | none | none (docs-only) |
| 11 | AI Slob Tech Debt Remediation | complete (count anomaly), no verification | none | first phase to log the recurring typecheck-error pair |
| 12 | Full RBAC Management Page | complete, human_needed | none | 5 manual UI checks never performed |
| 13 | Full RBAC From Scratch | complete, **no verification (the actual RLS/enforcement layer)** | **MAJOR: `/inventory` has zero role gate** — bartender gets full page, no redirect/PIN. Minor: `view_all_shifts` never enforced anywhere; inventory quantity controls not RBAC-disabled | none beyond the todos |
| 14 | Audit Logs Table | complete, no verification | none | pre-existing unrelated lint errors |
| 15 | Tabs Version (Optimistic Concurrency) | complete, **PASS-WITH-CARRYFORWARD** | **MAJOR: offline queue drops the second order on reconnect** — traced to STALE_VERSION discard interacting with `expectedVersion` capture | 5 hooks don't call `handleVersionError` (no retry toast); edge-function envelope doesn't pass `expectedVersion` |
| 16 | Kitchen/Bar Split Routing | complete, no verification | none | E2E spec still references a column this phase's own migration dropped |
| 17 | Modifier → Inventory Rules | complete, passed | none | recurring typecheck-error pair logged again |
| 18 | Split Payment (Multi-Method) | complete, no verification | none | pre-existing unrelated failures confirmed not caused by this phase |
| 19 | Tip Distribution Config | complete, no verification | **unfiled gap, not even a todo** — see "Cross-cutting debt" above | none |
| 20 | Promotions Engine | complete, passed | **CRITICAL: every promotion creation fails** a DB check constraint | recurring typecheck-error pair |
| 21 | i18n Multi-Language | complete, passed | **MAJOR: `/inventory` column headers render raw i18n keys** instead of translated text | 2 cosmetic/tooling footnotes (non-blocking) |
| 22 | Edit Paid Ticket + History | complete, passed | none | 3 items explicitly accepted as non-exploitable deferred hardening |
| 23 | Reopen Closed Ticket | complete, passed | none | 1 deliberately-skipped duplicate-schema cleanup item |
| 24 | Operational Reports Suite + CSV | complete, passed | **MAJOR: Caja Report PDF export silently fails outside the Tauri shell** | 3 chart widgets only unit-tested, not browser-verified |
| 25 | Receipt Item Grouping | complete, passed | **MAJOR: payment total omits tax shown in the pre-payment preview** | recurring typecheck-error pair; 1 pre-existing revenue-calc gap |
| 26 | Floating Tables (`is_temp`) | complete, human_needed | none | E2E reset helper silently no-ops (queries a dropped table) |
| 27 | One-Shot Inventory | complete, passed | none | none |
| 28 | Money Formatter Utility | **partial** (8/9 plans) | none | `28-09` human sign-off (visual money rendering, both locales) still unexecuted |
| 29 | UI Drift Audit (v2.2, shipped) | complete, passed | none | none |
| 30 | Shared Shell & Primitive Extension (v2.2) | complete, passed | none | none |
| 31 | Component, Token & Spacing Consistency Sweep (v2.2) | complete, passed | none | none |
| 32 | Touch Target & Focus-Visible Sweep (v2.2) | complete, passed | none | recurring typecheck-error pair |
| 33 | Payment-Critical Page Sweep (v2.2) | complete, human_needed | none | Modal/focus visual parity never spot-checked; 5/23 `09-rbac.spec.ts` tests fail in isolation (see "Cross-cutting debt") |
| 33.1 | E2E/RBAC Drift Fixes (v2.2, inserted) | complete, passed | none | fixed 3 of Phase 33's drift bugs; did not fix the 5 `09-rbac` failures |
| 34 | Visual Regression Baseline (v2.2) | complete, passed | none | baseline never opens modals (see Phase 33); doesn't mask `/audit` before snapshotting (see Phase 21) |
| 35 | Guardrails — Tokens Doc & Drift Lint (v2.2) | complete, passed | none | recurring typecheck-error pair; `IngredientForm.tsx` has the same dead-CSS bug this phase's new lint rule should catch but doesn't (class lives in a bare string, not JSX) |
| 36 | Migrate Dev Env Windows→Ubuntu | complete, passed | Minor: inert git hooks — **partially resolved 2026-08-06** (stale `core.hooksPath` unset). Major: `.github/workflows/` sits one level below git root — `ci.yml`/`release.yml` have never run | none |
| 37 | Windows VM for WebView2 Testing | **not started** | none | Blocked on an unresolved open question: does a physical Windows machine still exist for release builds? |
| 38 | E2E Test Infra & Seed Data Reliability | **not started** | none | Real backlog (not yet broken into plans): shared-DB pollution, missing pool-table seed data (all 5 `04-pool-timer` tests fail), missing reports seed data — 11 E2E findings routed here from Phase 39 |
| 39 | AI Slob Tech Debt Remediation | **partial** (11/12 plans; ledger content exists on unmerged branch `worktree-merge-phase39-ledger`, `39-12-SUMMARY.md` still missing) | **CRITICAL: void-order/close-shift/generate-report all use a relative fetch URL → always 404.** Plus 5 minor todos (flaky property test, MoneyInput a11y labels, seed-password mismatch, 100-char tab-name cap unenforced, void button not disabled post-void) | 1 flaky unit test, confirmed order-dependent, not a regression |

## Todos with no clear phase attribution

- `2026-07-27-print-popup-fallback-hangs-under-playwright-automation.md`
  (major, testing area) — general E2E infra, not tied to one feature phase.

## Totals (as of 2026-08-07)

- **19 pending todos** in `.planning/todos/pending/`: 3 critical, 7 major, 9 minor
- **2 confirmed-but-unfiled gaps** that should be todos and aren't (Tip
  Distribution save-button bug, the 5 failing `09-rbac` tests)
- **16 of 28** v2.1-milestone phases still carry open verification debt
  (`gaps_found` / `human_needed` / `missing`)
- **2 phases genuinely not started**: 37, 38
- **1 phase with no verification artifact despite being 11/12 plans deep**: 39
- The recurring typecheck-error pair appears in **8+ separate phases'**
  deferred-items logs without ever being fixed

## How to regenerate

This document was built by reading, per phase: `VERIFICATION.md` (verdict +
carry-forward/deferred bullets), `UAT.md` (status field + gap/pending items),
`deferred-items.md` (executor-filed scope-boundary entries), and
`.planning/todos/pending/*.md` (cross-referenced to the phase they describe).
For phases 29-35+33.1, the goal/status detail lives in the archived
`.planning/milestones/v2.2-ROADMAP.md` rather than the live `ROADMAP.md`.

To refresh: re-run the same sweep, or ask GSD to "find all TODOs and gaps
across all phases again" and diff against this file's date.
