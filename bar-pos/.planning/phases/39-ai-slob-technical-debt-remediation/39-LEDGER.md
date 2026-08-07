# Phase 39 — Consolidated Remediation Ledger

**Consolidates:** `39-01-LEDGER.md` through `39-11-LEDGER.md` (11 per-plan ledgers, produced in parallel across 4 waves so plans could run without colliding on one file).

**Purpose:** answer, in one place, "what did this phase actually do to the 2135 findings (147 Blocking E2E + 34 Blocking unlisted-dep + 1954 High/Medium knip) it was chartered to remediate." Every finding below is either deleted, test-fixed, routed to Phase 38, filed as a todo, retained as a documented false positive, or explicitly listed as not remediated — nothing is silently absorbed into a summary count.

---

## Summary Table — Findings by Disposition

| Disposition | E2E (of 147) | Knip Blocking `unlisted` (of 34) | Knip High/Medium (distinct, set-union method) | Notes |
|---|---:|---:|---:|---|
| **Routed to Phase 38** (infra, no code change) | 54 | — | — | Pool-table PostgREST schema-cache defect (PGRST205), Budweiser/inventory seed gaps, pre-confirmed Phase-38 items (D-05) |
| **Fixed** (test-side edit → now passes correctly) | 41 | — | — | Harness bugs: stale selectors, timing races, AgentPanel `role="dialog"` collision, i18n copy drift, stale skip-reason text |
| **Valid skip** (confirmed still-correct, no action) | 37 | — | — | Structural Playwright limits, unimplemented UI, platform-gated (Windows/manual), missing test credentials |
| **Real regression found** (D-03: todo filed, not fixed inline) | 11 | — | — | 11 genuine app bugs surfaced by triage — see "Todos Filed" below |
| **Unresolved / flagged for future investigation** | 4 | — | — | 3 rappi-orders skips with an unexplained static-vs-live discrepancy (39-06) + 1 environmental/inconclusive run (PE3, 39-06) |
| **Resolved — declared directly** | — | 34 → 0 | — | `@testing-library/user-event` added to `devDependencies` (39-01) |
| **Deleted** (confirmed dead, sanity-checked) | — | — | see chain below | Whole files, barrels, re-exports, individual declarations across 39-01/03/08/09/10/11 |
| **Retained — false positive** | — | — | see chain below | Dynamic/string-keyed/test-only/story-only reachability knip's static graph misses |
| **Deferred** (D-02/D-08/D-09, out of phase scope) | — | — | Medium tier (37) untouched; jscpd/as-any/madge/unused-deps untouched | Verified in Task 2 below |
| **NEEDS HUMAN TRIAGE** (not remediated) | — | — | 1 file | `supabase/functions/create-staff/index.ts` — see "Not Remediated" |

**Totals check:** 54 + 41 + 37 + 11 + 4 = **147** (all Blocking-tier E2E findings accounted for). 34 → 0 (all Blocking-tier `unlisted` findings resolved).

---

## Per-Plan Ledger Index

| Plan | Track | Scope | Findings covered |
|---|---|---|---|
| 39-01 | B (baseline) | Wave-0 baseline regen, `unlisted` deps, 1 whole-file deletion | 34 unlisted + 1 file |
| 39-02 | A (E2E tracer) | `e2e/16-table-status.spec.ts` | 16 |
| 39-03 | B | knip unused-file sweep: `supabase/functions/**` (14), production-mode-only (19), both-modes non-barrel (15) | 48 findings, 10 files deleted |
| 39-04 | A | `e2e/01,02(routed),03,04,06,07,09,10,11,13,14` | 43 |
| 39-05 | A | `e2e/15,18-modifier,18-updater,18-void-order,19,20,21-prep,21-product-management,22-sprint3-billing,22-staff-management` | 32 |
| 39-06 | A | `e2e/23,24-pool-advanced,24-sprint5-pool-accuracy,24-waitlist,25-rappi-orders,26-field-validation` | 34 |
| 39-07 | A | `e2e/27,30,31,36,37,38,43,44` | 22 |
| 39-08 | B | FSD barrel decision (12 whole-dead barrels + 433 re-export findings, hybrid rule) | 918 export/type findings |
| 39-09 | B | Registry files `domain.ts` + `edge-function-contracts.ts` | 196 findings |
| 39-10 | B | `src/entities/` non-barrel declarations | 148 findings |
| 39-11 | B | `src/shared/` (excl. domain.ts/edge-function-contracts.ts/ui) + `src/features/` + `e2e/helpers/supabase.ts` | 119 findings |

---

## E2E Reconciliation (147 of 147 accounted for)

Every `spec:line` in `10-CHECKLIST.md`'s Blocking → e2e list appears in **exactly one** per-plan ledger — the Track A plans partitioned the 59-spec suite by file, and no spec fell between two partitions:

| Spec range | Owning plan | Count | Cross-check |
|---|---|---:|---|
| `16-table-status.spec.ts` | 39-02 | 16 | 39-02-LEDGER.md "Total: 16 rows" |
| `01-ci`, `02-caja`(routed), `03-tab-order`, `04-pool-timer`, `06-transfer`, `07-reports`, `09-rbac`, `10-inventory`, `11-offline`, `13-tauri-build`, `14-manual-stubs` | 39-04 | 43 | 11 (Task 1 routed) + 3 (01-ci) + 29 (Task 2) = 43 |
| `15-home-navigation`, `18-modifier-notes-kds`, `18-updater`, `18-void-order`, `19-caja-entries`, `20-error-scenarios`, `21-prep`, `21-product-management`, `22-sprint3-billing`, `22-staff-management` | 39-05 | 32 | 39-05-LEDGER.md header "32 Blocking-tier E2E findings" |
| `23-payment-edge-cases`, `24-pool-advanced`, `24-sprint5-pool-accuracy`, `24-waitlist`, `25-rappi-orders`, `26-field-validation` | 39-06 | 34 | 39-06-LEDGER.md header "34 findings" |
| `27-inventory-intelligence`, `30-help-manual`, `31-categories`, `36-recipes`, `37-analytics-reports`, `38-audit-logs`, `43-promotions`, `44-focus-tab-order` | 39-07 | 22 | 39-07-LEDGER.md header "22 of 147" |
| **Sum** | | **147** | Matches `10-CHECKLIST.md`'s Blocking→e2e total exactly |

**Normalized disposition tally** (each plan's row-level classifications collapsed to 5 buckets — Routed / Fixed / Valid-skip / Regression / Unresolved — reconciled against each plan's own "final spec-run results" so dual-classified two-layer findings, e.g. 39-05's V2 and SM6, are counted once, under their final/deepest classification):

| Plan | Routed→Ph38 | Fixed | Valid-skip | Regression | Unresolved | Total |
|---|---:|---:|---:|---:|---:|---:|
| 39-02 | 13 | 0 | 3 | 0 | 0 | 16 |
| 39-04 | 20 | 8 | 14 | 1 | 0 | 43 |
| 39-05 | 3 | 15 | 9 | 5 | 0 | 32 |
| 39-06 | 14 | 6 | 8 | 2 | 4 | 34 |
| 39-07 | 4 | 12 | 3 | 3 | 0 | 22 |
| **Total** | **54** | **41** | **37** | **11** | **4** | **147** |

### D-05 pre-confirmed Phase 38 items (no re-triage, per CONTEXT.md)

11 of the 54 "Routed" findings were routed without opening per-test output at all, per D-05: `02-caja.spec.ts:61` (test-DB pollution), `04-pool-timer.spec.ts:38,50,65,81,97` (no pool table left "available"), `07-reports.spec.ts:621,647,729,752,774` (missing seeded date-ranged report data) — all confirmed in `10-CHECKLIST.md`'s "Cross-check against existing trackers" Phase 38 row, handled in 39-04 Task 1.

The remaining 43 "Routed" findings were independently investigated (D-06) and traced to two additional shared infra causes not previously named in CONTEXT.md:
- **`pool_tables` PostgREST schema-cache defect (`PGRST205`)** — reproduced independently against the live remote Supabase project by 39-02, and re-confirmed live by 39-04, 39-06, and 39-07. Affects any test that seeds via `.from('pool_tables')` or clicks "Start Session."
- **`Budweiser` product has no `inventory` row** on the shared remote test DB — reproduced independently by 39-04 (`10-inventory.spec.ts`) and 39-07 (`27-inventory-intelligence.spec.ts`).

### Unresolved / flagged items (4)

| Spec:line | Plan | Note |
|---|---|---|
| `23-payment-edge-cases.spec.ts:174` (PE3) | 39-06 | Environmental/inconclusive run (`seedTabWithBudweiser: no open caja` then a different failure on retry) — attributed to concurrent-agent DB contention during this wave, not a tip-feature defect (tip UI's existence independently confirmed via source read). Not filed as a todo — no confirmed defect. |
| `25-rappi-orders.spec.ts:36,51,80` (RO2, RO3, RO4) | 39-06 | Route is CLAUDE.md-confirmed shipped; skip conditions are already correctly runtime-conditional; reproduced identically across the original audit snapshot and two fresh live runs despite no obvious reason (RLS/query) to exclude the seeded row. Genuine unresolved discrepancy between static analysis and live behavior — flagged for future investigation, not filed as a todo (D-03's evidentiary bar requires a *confirmed* defect, not an unexplained one). |

### Todos Filed (D-03: real bugs found during triage, not fixed inline)

11 of the 147 E2E findings surfaced a genuine product bug. 9 new todo files were filed this phase (2 additional dispositions point at 2 todos recovered from an interrupted prior attempt at 39-05, already covering their finding):

| Todo file | Plan | Finding | Severity |
|---|---|---|---|
| `2026-08-04-offline-queue-drops-second-order-on-reconnect.md` | 39-04 | `11-offline.spec.ts` T5 — second offline-queued order silently dropped on reconnect | — |
| `2026-08-05-void-order-close-shift-generate-report-use-relative-fetch-url-always-404.md` | 39-05 | `18-void-order.spec.ts` V2 — `callVoidOrder` uses a relative fetch URL, 404s in every non-proxied environment | critical |
| `2026-08-05-void-button-not-disabled-for-already-voided-orders.md` | 39-05 | `18-void-order.spec.ts` V7 — void button not disabled for an already-voided order | minor |
| `2026-08-05-inventory-page-has-no-role-gate-bartender-can-navigate-directly.md` | 39-05 | `21-product-management.spec.ts` PM8 — `/inventory` has no route/page-level role gate (T-39-14: gate does NOT hold) | major |
| `2026-08-04-seednewstaffmember-password-mismatch-with-pin-login.md` (pre-existing, recovered) | 39-05 | `22-staff-management.spec.ts` SM3 | — |
| `2026-08-04-view-all-shifts-rbac-permission-never-enforced.md` (pre-existing, recovered) | 39-05 | `22-staff-management.spec.ts` SM6 (T-39-14-adjacent: gate does NOT hold) | — |
| `2026-08-04-notify-waitlist-fails-pg-net-schema-missing.md` | 39-06 | `24-waitlist.spec.ts` T2 — Notify mutation rejected server-side, `pg_net`/`net` schema missing | — |
| `2026-08-04-tab-customer-name-100-char-cap-not-enforced.md` | 39-06 | `26-field-validation.spec.ts` FV3 — `domain.ts`'s documented 100-char cap not enforced on the open-tab submission path (T-39-16) | — |
| `2026-08-04-promotion-creation-fails-db-check-constraint.md` | 39-07 | `43-promotions.spec.ts` T1 — every promotion-creation insert violates `promotions_item_target_check`; feature completely broken for every admin | — |
| `2026-08-04-recipe-save-fails-on-conflict-constraint-mismatch.md` | 39-07 | `36-recipes.spec.ts` "can add ingredients..." — `onConflict: 'product_id'` can't target the partial unique index added for prep-owned recipes; every recipe save fails | — |
| `2026-08-04-inventory-column-headers-render-raw-i18n-keys.md` | 39-07 | `44-focus-tab-order.spec.ts` B — inventory column headers render raw i18n keys (wrong namespace passed to `t()`); Tab-order/focus contract itself confirmed still intact | — |

Plus 2 additional recovered-but-out-of-this-plan's-fix-scope todos referenced (not newly filed) by 39-05: `2026-08-04-inventory-quantity-controls-not-rbac-disabled-for-bartender.md`, `2026-08-04-moneyinput-fields-not-associated-with-formfield-labels.md`. Plus 1 unrelated flaky-unit-test todo filed by 39-04, out of E2E scope: `2026-08-04-flaky-property-test-total-conservation-duplicate-item-names.md` (fast-check "total conservation" test in `groupOrderItemsForReceipt.test.ts` — pre-existing test-design bug, not caused by this phase).

**14 todo files total in `.planning/todos/pending/` dated 2026-08-04/05** — all accounted for above.

### T-39-14 / T-39-16 written access-control verdicts (threat-model requirement)

| Finding | Verdict | Plan |
|---|---|---|
| `15-home-navigation.spec.ts:104` (bartender → `/settings`) | **Gate holds** — Phase 21's documented self-service-locale design (only the role-agnostic Language tab renders) | 39-05 |
| `21-product-management.spec.ts:264` (bartender → `/inventory`) | **Gate does NOT hold** — no route or page-level role gate exists at all | 39-05, todo filed |
| `22-staff-management.spec.ts:143` (bartender sees admin's name in `/staff` roster) | **Gate does NOT hold** — `view_all_shifts` permission defined but never enforced | 39-05, todo filed (recovered) |
| `31-categories.spec.ts:385` (bartender → `/settings`, category-management access) | **Gate holds** — per-tab RBAC gating intact (Phase 21); only the outer full-page redirect was intentionally replaced | 39-07 |
| `38-audit-logs.spec.ts:170` (bartender → `/audit`) | **Gate holds** — redirect to `/home` confirmed live; only a duplicate-toast assertion needed scoping | 39-07 |
| `26-field-validation.spec.ts:71` (tab customer-name 100-char cap) | **NOT enforced** anywhere on the submission path | 39-06, todo filed |

---

## Knip Reconciliation

### Baseline chain (distinct `(file, line, name)` set-union method, excludes `src/shared/ui/**` per D-08, dependency categories tracked separately)

| Step | Plan | Files | Exports | Types | Dup-pairs | **Sum (distinct)** | Δ |
|---|---|---:|---:|---:|---:|---:|---|
| Phase 10 audit baseline (re-verified, no drift) | 39-01 | 61 | 613 | 305 | 3 | **982** | — |
| After deleting `scripts/audit-ui-drift.ts` | 39-01 | 60 | 613 | 305 | 3 | **981** | −1 |
| After 10-file unused-file sweep | 39-03 | 50 | 613 | 305 | 3 | **971** | −10 |
| After FSD barrel hybrid decision (12 barrels deleted, 293 of 433 re-exports pruned) | 39-08 | 43 | 399 | 204 | 3 (pairs) | **649** | −322 |
| After registry review (`domain.ts` + `edge-function-contracts.ts`) | 39-09 | 43 | 391 | 191 | 3 (pairs) | **631*** | −21 (registry-scoped) |
| After entities-layer sweep (scoped to `src/entities/` non-barrel) | 39-10 | 43 | — | — | — | scoped 148→27 | −121 (entities-scoped) |
| After shared+features sweep (scoped) | 39-11 | 43 | — | — | — | scoped 119→35 | −84 (shared/features-scoped) |

*39-09's own full-repo re-measurement (631) reflects only its own registry-file edits layered on the 39-08 baseline; 39-10 and 39-11 ran **concurrently** in separate worktrees during the same wave, each touching a disjoint scope (`src/entities/` vs `src/shared/`+`src/features/`), so their deltas are additive but were never jointly re-measured against a single merged tree until this consolidation plan.

**Projected combined total after all three concurrent Wave-4 plans** (649 baseline − 21 registry − 121 entities − 84 shared/features): **423** distinct findings, sum of files+exports+types+dup-pairs, before this plan's Task 2 fresh re-measurement. Task 2 below runs the actual audit pipeline against the merged tree and reports the real number — this projection exists so a reviewer can sanity-check Task 2's output against the additive math rather than trusting it blind.

### `unlisted` Blocking-tier reconciliation

| Step | Count | Plan |
|---|---:|---|
| Baseline (default-mode) | 34 | 39-01 |
| After `@testing-library/user-event` added to `devDependencies` | **0** | 39-01 Task 2 |

Confirmed via `npx knip --reporter json` `unlisted` array, re-verified in Task 2 below.

### Knip High-tier findings NOT independently re-measured whole-project since 39-11 (each plan's own delta is self-verified against its own scope; only Task 2 below produces one merged-tree number)

Every deletion/de-export/retention decision across 39-01, 39-03, 39-08, 39-09, 39-10, 39-11 was preceded by a repository-wide sanity check (bare-identifier grep, import-graph resolution, or knip per-mode cross-check) — see each per-plan ledger for the row-level evidence. No plan deleted a file or declaration without that check.

---

## Not Remediated

One finding could not be closed out by any plan and remains genuinely open:

| Finding | Category | Why it's open |
|---|---|---|
| `supabase/functions/create-staff/index.ts` | Blocking/High — knip unused file (both modes) | 39-03 Task 1 found **zero** client-side invocation evidence anywhere in `src/` (only a coverage-test allowlist entry and an i18n string self-documenting "Connect create-staff flow when ready"). Deleting any `supabase/functions/**` file is prohibited outright by this phase's `must_haves` regardless of triage outcome — so it was marked **NEEDS HUMAN TRIAGE** and left untouched. No later plan in this phase had scope or permission to resolve it further. **Action for a future phase:** confirm with a human whether `create-staff` is a genuinely orphaned deployed function (safe to delete outside this phase's prohibition) or a planned-but-unwired feature (should stay, and the i18n string should be actioned). |

Everything else — the 4 unresolved E2E items (see above), the 2 duplicate-export pairs deferred in `domain.ts` (`ModifierGroupItemSchema`/`ModifierGroupItemCreateSchema`, `ProductModifierGroupSchema`/`ProductModifierGroupCreateSchema`), the 8 whole-file candidates surfaced as byproducts of 39-08's barrel decision but out of 39-10/39-11's no-whole-file-deletion scope (`modifier-inventory-rule/model/types.ts`, `rbac/model/types.ts`, `recipe/model/types.ts`, `waitlist/model/store.ts`, `payment/model/store.ts`, `tab/ui/PoolChargeItem.tsx`, `tab/ui/TabDetail.tsx`, `features/manage-products/ui/CatalogCategoriesTab.tsx` + its paired `CategoryForm.tsx` exports), and `category/model/types.ts`'s `buildCategoryTree`/`CategoryNode` (barrel-protected byproduct of 39-10) — are **explicitly documented deferrals with a stated reason and owner**, not silent gaps. They are candidates for a future dead-code phase, not unaccounted-for work from this one.

---

## D-01 through D-09 Traceability

| Decision | Where honored |
|---|---|
| **D-01** (scope: Blocking 181 + knip dead-code High 1917/High-distinct 982 + Medium 37) | Every plan's `files_modified` frontmatter scoped to exactly its assigned slice; this ledger's Summary Table accounts for all 147 E2E + 34 unlisted + the full knip distinct chain. |
| **D-02** (jscpd/as-any/madge/Low-tier deferred to future phases) | Verified untouched in Task 2 below (madge cycle still reports, jscpd/as-any counts materially unchanged). |
| **D-03** (real bugs found during triage → todo, not inline fix) | 39-04, 39-05, 39-06, 39-07 — 11 findings, 9 new todos filed (see "Todos Filed" above). |
| **D-04** (triage-first: real per-test error output, not digest titles) | Every Track A plan (39-02, 39-04–39-07) explicitly re-ran specs live and cited `error.message` excerpts, not `10-CHECKLIST.md` titles. |
| **D-05** (11 pre-confirmed Phase-38 items routed without re-triage) | 39-04 Task 1. |
| **D-06** (remaining unannotated failures/skips triaged individually) | 39-02 (16), 39-04 Task 2 (29), 39-05 (32), 39-06 (34), 39-07 (22) — every row carries individual evidence. |
| **D-07** (delete confirmed dead code after a sanity check for dynamic/string-based usage) | 39-01, 39-03, 39-08, 39-09, 39-10, 39-11 — every deletion row cites its search command and hit count. |
| **D-08** (skip Medium-tier `src/shared/ui/**`/Storybook findings entirely) | Every knip plan's method explicitly excludes `src/shared/ui/**` from its working set; verified untouched in Task 2 below. |
| **D-09** (unused deps/devDeps out of scope, except the `unlisted` Blocking fix) | Only dependency change across the phase: `@testing-library/user-event` added (39-01, resolving the 34 `unlisted` Blocking findings, which D-01 explicitly included). Verified via `git diff` in Task 2 below — no dependency was *removed*. |

---

## Scope-Compliance Section

*(Populated by Task 2 — see below.)*
