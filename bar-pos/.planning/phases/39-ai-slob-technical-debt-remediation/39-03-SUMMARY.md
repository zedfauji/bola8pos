---
phase: 39-ai-slob-technical-debt-remediation
plan: 03
subsystem: technical-debt-remediation
tags: [knip, dead-code, deletion-sweep, edge-functions, testing-infra]
dependency_graph:
  requires: ["39-01"]
  provides: ["39-03-LEDGER.md disposition rows for 48 of the 61 knip unused-file findings"]
  affects: ["scripts/", "src/app/", "src/shared/lib/agent/", "src/shared/lib/supabase-realtime.ts", "src/widgets/OrderPanel/", "src/widgets/SettingsCatalogPanel.tsx", "src/widgets/SettingsPagePanel.tsx"]
tech_stack:
  added: []
  patterns:
    - "Repository-wide basename grep before any whole-file deletion, not knip alone (39-PATTERNS.md mechanical deletion pattern)"
    - "supabase/functions/** are Deno HTTP entry points invoked by URL — deletion prohibited outright regardless of triage outcome"
    - "Production-mode-only knip findings are presumptively false-positive (test/lint/story infra); prove liveness, don't assume deadness"
key_files:
  created: []
  modified:
    - ".planning/phases/39-ai-slob-technical-debt-remediation/39-03-LEDGER.md"
  deleted:
    - "scripts/seed-ingredients.ts"
    - "scripts/seed-recipes.ts"
    - "scripts/test-payment-auth.mjs"
    - "src/app/kitchen-prep-route.tsx"
    - "src/shared/lib/agent/index-status.ts"
    - "src/shared/lib/supabase-realtime.ts"
    - "src/widgets/OrderPanel/CartSummary.tsx"
    - "src/widgets/OrderPanel/OrderItemCard.tsx"
    - "src/widgets/SettingsCatalogPanel.tsx"
    - "src/widgets/SettingsPagePanel.tsx"
decisions:
  - "create-staff edge function marked NEEDS HUMAN TRIAGE, not FALSE POSITIVE — zero client invocation evidence anywhere in the repo, and the app's own i18n string ('Connect create-staff flow when ready.') documents it as an unwired flow. Not deleted regardless (supabase/functions/** deletion is prohibited outright), but flagged distinctly from the 13 confirmed-live functions since a deployed-but-unreferenced function is a deployment question the executor can't resolve alone."
  - "3 seed scripts (seed-combos.ts, seed-prep.ts, seed-reports.ts) and 1 .mjs script (write-env-local-from-cloud-secret.mjs) were on the plan's candidate-deletion list but the repository-wide sanity check found real dependents the plan text didn't anticipate — E2E specs documenting them as manual seed preconditions, and a Cursor cloud-agent environment bootstrap step. Spared per the plan's own rule that a nonzero external hit count blocks deletion."
  - "RappiOrderBadge.tsx deferred to plan 39-08 rather than deleted, per the plan's explicit barrel-pair handling instruction — its sibling index.ts still re-exports it."
metrics:
  duration: "~45 minutes"
  completed: "2026-08-04"
status: complete
actuals:
  tokens: 11881
  tasks: 3
  commits: 3
---

# Phase 39 Plan 03: Knip Unused-File Sweep (supabase/functions + production-only + both-modes candidates) Summary

Swept all 48 knip "unused file" findings assigned to this plan to a written disposition in `39-03-LEDGER.md`: 14 `supabase/functions/**` Deno entry points (13 confirmed false positives with per-function invocation evidence, 1 flagged for human triage), 19 production-mode-only findings (all confirmed live via config wiring or test/story importer counts), and 15 both-modes non-barrel candidates (10 deleted after a clean repository-wide sanity check, 4 spared after that same check surfaced real dependents, 1 deferred to plan 39-08 for its barrel dependency).

## What Was Built

**Task 1 — `supabase/functions/**` adjudication (14 findings, zero deletions).** Cross-checked every flagged edge function against `src/shared/lib/edge-function-contracts.ts`'s `functions.invoke`/`fetch` call sites. 13 of 14 have direct, named invocation evidence in the registry. `create-staff` has none — no `functions.invoke('create-staff', ...)` or `fetch(.../create-staff)` call exists anywhere in `src/`, and the app's own i18n copy ("Connect create-staff flow when ready.") self-documents the gap. Recorded as `NEEDS HUMAN TRIAGE` per the plan's instruction rather than assuming either false-positive or dead — deleting any `supabase/functions/**` file is prohibited outright regardless, so this is a flag for a human, not a blocked action. `_shared/audit.ts` confirmed live via 3 sibling functions' relative Deno imports of `recordAudit`.

**Task 2 — Production-mode-only adjudication (19 findings, zero deletions).** All 19 confirmed live: `vitest.config.ts`'s `globalSetup`/`setupFiles` wire `src/test/global-setup.ts` and `src/shared/lib/test-setup.ts` directly by path; `eslint.config.js` imports both `eslint-rules/*.js` modules directly; `package.json` scripts invoke `scripts/generate-design-tokens.ts` and `scripts/indexCodebase.ts` by path; the 4 `e2e/` helpers are imported by up to 56 spec files; the remaining test/story-only files (`mocks.ts`, `promotion-pricing.ts`, `rappi-webhook-payload.ts`, `supabase-test-client.ts`, `test-utils.tsx`, `uom.ts`, `PoolChargeItem.tsx`, `TabDetail.tsx`, `close-tab/index.ts`) all have confirmed test-suite importers, exactly matching the "reachable from tests, invisible to production bundle" signature that makes a production-only finding structurally distinct from a both-modes finding. This is the expected outcome the plan predicted — 19 false positives, 0 deletions.

**Task 3 — Both-modes candidate sweep (15 findings, 10 deleted).** Ran the repository-wide basename search on all 15 candidates before touching any of them. 10 had zero external hits and were deleted: `scripts/seed-ingredients.ts`, `scripts/seed-recipes.ts`, `scripts/test-payment-auth.mjs`, `src/app/kitchen-prep-route.tsx` (an orphaned route-permission guard — `router.tsx`'s `/kitchen-prep` route wraps only the generic `<ProtectedRoute>`, never this file's `<KitchenPrepRoute>`, unlike sibling gated routes `KdsBarRoute`/`WaitlistRoute` which are wired at their declarations), `src/shared/lib/agent/index-status.ts`, `src/shared/lib/supabase-realtime.ts`, `src/widgets/OrderPanel/CartSummary.tsx`, `src/widgets/OrderPanel/OrderItemCard.tsx`, `src/widgets/SettingsCatalogPanel.tsx`, `src/widgets/SettingsPagePanel.tsx`.

4 candidates the plan listed turned out to have real dependents on the sanity check: `scripts/seed-combos.ts` (referenced by `e2e/32-combos.spec.ts` as a required manual seed step in 3 places), `scripts/seed-prep.ts` (referenced by `e2e/21-prep.spec.ts` as a required/reset seed step, and by `e2e/helpers/supabase.ts:779` for its baseline stock values), `scripts/seed-reports.ts` (referenced by `e2e/37-analytics-reports.spec.ts` as an optional seed step), and `scripts/write-env-local-from-cloud-secret.mjs` (wired into `.cursor/environment.json`'s `install` step for Cursor's cloud-agent environment bootstrap). Per the plan's own rule, a nonzero external hit blocks deletion — all 4 spared and recorded as false positives with the reference that saved each one.

`src/widgets/RappiOrderBadge/RappiOrderBadge.tsx` was deferred to plan 39-08 rather than deleted or spared outright — its sibling `index.ts` barrel still re-exports it, and this plan explicitly excludes `index.ts` barrel deletions (that's plan 39-08's FSD public-API scope).

After the sweep: `npm run typecheck`, `npm run lint`, and `npm run test` all pass (1391 passed, 15 todo — exact match to the pre-existing baseline, zero regression). `e2e/*.spec.ts` still resolves to 59 files. A fresh `npx knip` run (both modes) confirms none of the 10 deleted files reappear, and the distinct unused-file baseline (default ∪ production, excluding `src/shared/ui/**`, same methodology as 39-01-LEDGER.md) dropped from 60 to 50 — a reduction of exactly 10, matching the deletion count with zero new findings appearing in their place.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — plan's file list was incomplete] 4 of 15 "both-modes" candidates had real dependents the plan didn't list**
- **Found during:** Task 3
- **Issue:** The plan's `<action>` text asserted a mechanical zero-hit search would clear all 15 both-modes candidates for deletion, but the sanity check itself — which the plan mandates — surfaced 3 seed scripts referenced as documented manual preconditions inside E2E spec files, and one `.mjs` script wired into `.cursor/environment.json`'s cloud-agent bootstrap.
- **Fix:** Followed the plan's own stated rule ("a nonzero external hit count blocks the deletion") rather than the plan's optimistic file list — spared all 4, recorded each with the exact reference that saved it.
- **Files affected:** `scripts/seed-combos.ts`, `scripts/seed-prep.ts`, `scripts/seed-reports.ts`, `scripts/write-env-local-from-cloud-secret.mjs` (none modified — correctly left untouched)
- **Commit:** `a0fc1ee`

No other deviations — the remaining 44 of 48 findings were adjudicated exactly per the plan's prescribed patterns (Task 1's edge-function contract cross-check, Task 2's config-wiring/importer-count proof, Task 3's mechanical zero-hit deletion and the barrel-pair deferral).

### Environment Setup (not a deviation, recorded for reproducibility)

This worktree was spawned without `node_modules` or `.env.local` (git worktrees don't carry gitignored/untracked directories from the main checkout — same gap 39-01-LEDGER.md documented). Ran `npm ci` (1365 packages) and copied `.env.local` from the sibling main checkout (`/mnt/ai/bola8pos-kiro/bar-pos/.env.local`, same machine/user/project credentials) before any verification command could run. Both stay gitignored and were never staged/committed.

## Known Stubs

None. This plan is purely subtractive (deletions) plus a documentation artifact (the ledger) — no new UI, no new data flow, nothing that could stub out.

## Threat Flags

None. All deletions were files with zero external references after a repository-wide sanity check; no new network endpoints, auth paths, file access patterns, or schema changes were introduced. The `create-staff` edge function's `NEEDS HUMAN TRIAGE` disposition is a documentation flag, not new surface — the function was already deployed before this plan ran.

## Self-Check

- FOUND: `.planning/phases/39-ai-slob-technical-debt-remediation/39-03-LEDGER.md`
- FOUND: 10 deletions confirmed absent from working tree (`scripts/seed-ingredients.ts`, `scripts/seed-recipes.ts`, `scripts/test-payment-auth.mjs`, `src/app/kitchen-prep-route.tsx`, `src/shared/lib/agent/index-status.ts`, `src/shared/lib/supabase-realtime.ts`, `src/widgets/OrderPanel/CartSummary.tsx`, `src/widgets/OrderPanel/OrderItemCard.tsx`, `src/widgets/SettingsCatalogPanel.tsx`, `src/widgets/SettingsPagePanel.tsx`)
- FOUND: commit `9ce7c06` (Task 1)
- FOUND: commit `e1e2827` (Task 2)
- FOUND: commit `a0fc1ee` (Task 3)

## Self-Check: PASSED
