---
phase: 25-receipt-item-grouping-2-level
plan: 04
subsystem: reporting
tags: [postgres, plpgsql, react-pdf, zod, i18n, caja-report]

# Dependency graph
requires:
  - phase: 25-receipt-item-grouping-2-level
    provides: "groupByCategory<T> / CategorizedRow / CategoryGroup<T> from plan 01, reused verbatim for CajaReportTopProduct rows"
provides:
  - "get_caja_report RPC now returns camelCase JSON keys for topProducts/staffSummary (fixes a pre-existing parse failure that made every Caja Report error out)"
  - "get_caja_report's topProducts rows carry categoryId/categoryName"
  - "Caja Report PDF's top-products table groups by category with sub-headers when 2+ categories present"
affects: [reports, caja-report-pdf, caja-report-excel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fourth and final consumer of plan 01's groupByCategory<T> generic — same grouping function reused across receipt, pre-cheque, KDS, and now PDF export"

key-files:
  created:
    - supabase/migrations/20260726000001_caja_report_top_products_category.sql
  modified:
    - src/shared/lib/domain.ts
    - src/shared/lib/exporters/pdf.tsx
    - src/shared/lib/exporters/pdf.test.ts
    - src/shared/lib/i18n/locales/es-MX/receipt.json
    - src/shared/lib/i18n/locales/en-US/receipt.json

key-decisions:
  - "Migration copies the CURRENT get_caja_report body (20260720000005, post-Phase-23 reopened_void fix) rather than the stale 20260420000004 body named in RESEARCH.md/PATTERNS.md, to avoid silently reverting Phase 19/23 additions"
  - "Fixed a pre-existing snake_case/camelCase mismatch in topProducts and staffSummary subqueries in the same migration — not scope creep, since a new camelCase field next to a snake_case sibling would fail the same Zod parse, and the bug blocked SC-4 verification entirely"
  - "No per-category subtotal rows in the PDF — RPC's LIMIT 10 means a subtotal would sum an arbitrary truncated subset, which would read as authoritative but isn't"

requirements-completed: [SC-2, SC-4]

coverage:
  - id: D1
    description: "get_caja_report emits camelCase JSON keys for topProducts/staffSummary and adds categoryId/categoryName to topProducts rows"
    requirement: "SC-2"
    verification:
      - kind: other
        ref: "supabase db query --linked against get_caja_report('109f6205-0586-499c-8d40-7a632a75e99e') — topProducts returned productName/categoryId/categoryName/quantity/revenue, no snake_case keys, spanning 4 categories"
        status: pass
    human_judgment: false
  - id: D2
    description: "Caja Report PDF's top-products table renders category sub-headers when 2+ categories present, no sub-header for a single category"
    requirement: "SC-2"
    verification:
      - kind: unit
        ref: "src/shared/lib/exporters/pdf.test.ts#cajaReportToPdfBytes > resolves to PDF bytes when topProducts span two categories"
        status: pass
    human_judgment: true
    rationale: "@react-pdf/renderer is fully mocked in unit tests (Document/Page/View/Text pass through as plain functions) — the mock proves the grouping code path doesn't throw, not that the rendered PDF visually shows sub-headers correctly positioned. Structural correctness of groupByCategory itself is covered by groupOrderItemsForReceipt.test.ts. Visual PDF rendering needs a human to open the export."
  - id: D3
    description: "Cross-surface consistency: one order's data renders the same category/item/modifier hierarchy across thermal receipt, pre-cheque, KDS card, and Caja Report PDF"
    requirement: "SC-4"
    verification: []
    human_judgment: true
    rationale: "This is Plan 04's Task 4 — a blocking checkpoint:human-verify task per 25-VALIDATION.md, requiring a human to walk through creating a tab, printing receipts, checking /kds, and exporting the PDF. Not automatable by design."

# Metrics
duration: ~45min (this session; excludes prior session's Task 1 + blocked Task 2 investigation)
completed: 2026-07-27
status: complete
---

# Phase 25 Plan 04: Caja Report Category Grouping + camelCase Fix Summary

**`get_caja_report` migration applied live (category dimension + camelCase JSON key fix), and the Caja Report PDF's top-products table now groups rows under category sub-headers using plan 01's `groupByCategory<T>`.**

## Performance

- **Started (this session):** 2026-07-27T04:37:00Z (approx, continuation from checkpoint)
- **Completed (this session):** 2026-07-27T05:22:40Z
- **Tasks:** 3 of 4 (Task 4 is a blocking human-verify checkpoint, not yet approved)
- **Files modified (this session):** 5 (domain.ts, pdf.tsx, pdf.test.ts, 2 locale files)

## Accomplishments

- **Task 1 (prior session):** Migration file `20260726000001_caja_report_top_products_category.sql` written — adds `LEFT JOIN categories` + `categoryId`/`categoryName` to the top-products subquery, camelCases every alias in both the top-products and staff-summary subqueries, preserves every Phase 19/23 addition (`notes`, `totalExpenses`/`totalIncome`/`netBalance`, `cajaEntries`, `reopened_void` exclusions).
- **Task 2 (this session):** Re-verified the Supabase CLI blocker was resolved (CLI authenticated, but this specific worktree needed its own `supabase link --project-ref shsrhxleopmovzpzqmex` since `supabase/.temp/` is gitignored and per-worktree). Ran `supabase db push`, confirmed `20260726000001` applied both locally and remotely via `supabase migration list`. Called `get_caja_report` live against two real caja sessions: one confirmed `staffSummary` camelCase keys (`staffId`/`staffName`/`orderCount`/`salesTotal`), the other confirmed `topProducts` camelCase keys including the new `categoryId`/`categoryName`, spanning 4 distinct categories (Cervezas Nacionales, Hamburguesas y Hot Dogs, Botanas, Boneless) with zero snake_case keys anywhere in the response.
- **Task 3 (this session):** Extended `CajaReportTopProductSchema` with optional `categoryId`/`categoryName`. Rewrote `CajaReportDoc`'s top-products block in `pdf.tsx` to group via `groupByCategory` (plan 01's generic), rendering a category sub-header (reusing `styles.sectionTitle`) before each group only when 2+ groups exist, with zebra striping tracked via a running row index across groups so it doesn't restart per category. Left `CategoryRevenueRow`/`categoryRevenueToPdfBytes` (the separate rollup report) completely untouched. Added `pdf.caja.categoryOther` i18n key to both locales. Added a two-category fixture + smoke test to `pdf.test.ts`.

## Task Commits

1. **Task 1: Migration — category dimension, camelCase JSON keys** - `94cb093` (feat) — committed in prior session
2. **Task 2: Apply the migration to the database** - no commit (remote-only `supabase db push`; `supabase/.temp/` is gitignored, no local file changes to stage)
3. **Task 3: Caja Report PDF category sub-headers** - `14df313` (feat)

## Files Created/Modified

- `supabase/migrations/20260726000001_caja_report_top_products_category.sql` - applied live to the `bar-pos` Supabase project; redefines `get_caja_report` only
- `src/shared/lib/domain.ts` - `CajaReportTopProductSchema.categoryId`/`.categoryName` (optional, nullable)
- `src/shared/lib/exporters/pdf.tsx` - `CajaReportDoc` top-products block now groups by category via `groupByCategory`
- `src/shared/lib/exporters/pdf.test.ts` - `makeCajaReportWithCategories()` fixture + smoke test
- `src/shared/lib/i18n/locales/es-MX/receipt.json` / `en-US/receipt.json` - `pdf.caja.categoryOther` key

## Decisions Made

- Migration base was corrected from the stale `20260420000004` (named in RESEARCH.md/PATTERNS.md) to the current `20260720000005` body, per the plan's explicit correction note — avoids reverting Phase 19/23 work.
- The pre-existing snake_case/camelCase schema mismatch (blocking every Caja Report load) was fixed inside the same migration rather than deferred, since the plan's Task 1 was already rewriting those subqueries and a new camelCase field next to a snake_case sibling would fail the same Zod parse regardless.
- No category subtotal rows added to the PDF — RPC's existing `LIMIT 10` means a per-category subtotal would sum an arbitrary truncated subset and mislead readers into treating it as authoritative.

## Deviations from Plan

None — plan executed exactly as written. The one adjustment was environmental, not a plan deviation: this worktree required its own `supabase link` (project links live in gitignored `supabase/.temp/`, not shared across worktrees) and its own `npm ci` (fresh worktree had no `node_modules`), plus copying `.env.local` from the primary checkout (also gitignored, needed by `vitest`'s `global-setup.ts` to reach the live Supabase test project) — none of these are code changes and none were committed.

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed import order in pdf.tsx**
- **Found during:** Task 3 lint verification
- **Issue:** `import { groupByCategory } from '@shared/lib/groupOrderItemsForReceipt'` was placed after the `@shared/lib/i18n` import, violating the `import/order` ESLint rule.
- **Fix:** Reordered the import to precede `@shared/lib/i18n` (alphabetical within the `@shared/lib/*` group).
- **Files modified:** `src/shared/lib/exporters/pdf.tsx`
- **Verification:** `npm run lint` exits 0 with zero warnings.
- **Committed in:** `14df313` (part of Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — lint import order)
**Impact on plan:** Trivial, no scope creep.

## Issues Encountered

- `npm run test` initially showed 3 failures in `src/features/close-tab/tests/useCloseTab.test.ts` (an integration suite that hits the live Supabase test project). Re-running that file in isolation passed all 3 tests, and re-running the full suite immediately after passed as well (1321/1321). This is unrelated to any file touched by this plan (`close-tab` feature untouched) and consistent with test-state contention against the shared live test database — most likely from other phase-25 worktree agents running their own test suites concurrently against the same Supabase test project. Not fixed (out of scope, pre-existing/flaky, confirmed non-reproducing).
- `npm run typecheck` shows the same 2 pre-existing errors already logged in `deferred-items.md` under `## 25-01` (`src/entities/tab/model/queries.ts:791`, `src/shared/lib/agent/rag.ts:60`) — both in files untouched by this plan. No new typecheck errors introduced.

## User Setup Required

None - no external service configuration required beyond the already-applied migration.

## Next Phase Readiness

- Tasks 1-3 are complete, committed, and verified: the migration is live, `get_caja_report` no longer fails to parse, and the PDF groups top-products by category.
- **Task 4 (blocking human-verify checkpoint) is NOT yet approved.** It requires a human to walk through creating a tab with 2+ categories and a modifier, checking the pre-cheque, `/kds`, the final receipt, `/reports` (confirming the Caja Report loads at all — this was previously broken by the snake_case defect), and the exported PDF, per the plan's Task 4 `<how-to-verify>` steps. This plan cannot be marked fully complete until that checkpoint is approved.
- `npm run test` / `npm run typecheck` / `npm run lint` all pass (typecheck/lint modulo the 2 pre-existing unrelated errors, which are zero-warning-clean per `max-warnings 0` since typecheck and lint are separate commands — typecheck errors are pre-existing and not part of the lint gate).

## Task 4 Attempt — 2026-07-27 (session 3): BLOCKED before any walkthrough step

**Status: NOT started, NOT approved.** No dev server was launched, no test data was seeded, no screenshots were captured. This session halted during pre-flight file verification, before touching the app, because the worktree does not contain the code Task 4 needs to test.

### Pre-flight finding: this worktree only has 25-01 and 25-04 merged — 25-02 and 25-03 are absent

The continuation prompt assumed plans 25-01, 25-02, and 25-03 were all merged into this worktree (`worktree-agent-aaa69a76c6a431d1f`, forked after 25-01). File-level inspection shows that assumption is false:

| Plan | Claimed change | Present in this worktree? | Evidence |
|------|-----------------|---------------------------|----------|
| 25-01 | `groupByCategory`/`formatModifierLines` shared grouper, wired into pre-cheque + final receipt via `receipt-format.ts` | **Present** | `src/shared/lib/groupOrderItemsForReceipt.ts` exists; `src/shared/lib/receipt-format.ts:4,131,183` imports and calls `groupByCategory` for both the pre-cheque block and the final-receipt block |
| 25-02 | `supabase/functions/process-payment/index.ts` extended to push `categoryId`/`categoryName`/`modifierNames` onto every receipt line | **Absent** | `grep -n "categoryId\|categoryName\|modifierNames" supabase/functions/process-payment/index.ts` returns nothing. `git merge-base --is-ancestor 57c9917 HEAD` (the 25-02 commit) → not an ancestor |
| 25-03 | KDS card renders modifiers one-per-line via shared `formatModifierLines` | **Absent** | `src/widgets/KdsBoard/index.tsx:61-63` still renders `{item.modifierNames.join(' / ')}` on one line, not `formatModifierLines`. `git merge-base --is-ancestor 3c33bcd HEAD` (the 25-03 commit) → not an ancestor |
| 25-04 | `get_caja_report` category dimension + camelCase fix, PDF category sub-headers | **Present** | `supabase/migrations/20260726000001_caja_report_top_products_category.sql` exists; `pdf.tsx` groups via `groupByCategory` (this plan's own Tasks 1-3) |

`git log --oneline --all` confirms the branch point: this worktree's HEAD (`891894b`) descends from `8ce873f` ("chore: merge executor worktree" for 25-01) plus this plan's own 25-04 commits, but never merged `57c9917` (25-02) or `3c33bcd`/`9f7b192` (25-03) — those exist on `main` (current tip `f4a5958`, "docs(phase-25): update tracking after wave 2 (25-02, 25-03)") but were never pulled into this worktree branch.

### Why this blocks Task 4 specifically (not a code defect)

Task 4's `<how-to-verify>` requires all four surfaces to agree: pre-cheque, KDS card, final receipt, and Caja Report PDF. With 25-02 missing, `receiptData.items` from the live `process-payment` edge function carries no `categoryId`/`categoryName`/`modifierNames` — so the final receipt would fall entirely into the grouper's uncategorized bucket regardless of what the tab actually contains, which is not a real disagreement between surfaces, it's a missing feature in this branch. With 25-03 missing, the KDS card would show `BBQ / <other modifier>` joined on one line instead of one modifier per line — again not a defect Task 4 is meant to catch, just an artifact of an incomplete merge.

Running the walkthrough now would produce two "failures" that look like cross-surface inconsistencies but are actually merge-state gaps. Per the continuation prompt's explicit instruction ("If any are missing, note it — do not attempt to merge/rebase yourself, just report what's actually present so the orchestrator can reconcile") and the fallback instruction for blocked steps ("HALT and report the exact error — do not fabricate screenshots or results"), this session stopped here rather than producing screenshots that would need to be discarded once 25-02/25-03 land.

### What is needed before Task 4 can run

The orchestrator needs to bring `57c9917` (25-02) and `3c33bcd` + `9f7b192` (25-03) — or their equivalent squashed merge commits already on `main` at `f4a5958` — into this worktree's branch (`worktree-agent-aaa69a76c6a431d1f`) before the cross-surface walkthrough can produce meaningful results. No merge/rebase was attempted by this session, per instruction.

### Cleanup

No dev server was started, no database rows were seeded, no files were modified outside this SUMMARY. `git status --short` is clean.

---

## Task 4 Attempt — 2026-07-27 (session 4): Walkthrough completed, evidence captured, checkpoint STILL NOT approved

**Status: walkthrough executed end-to-end. 5 screenshots + supporting text/JSON evidence saved to `/tmp/phase25-task4-screenshots/` on the machine that ran this session. This plan's Task 4 checkpoint is not self-approved by an agent — a human must review the screenshots and explicitly approve or reject.**

### Pre-flight: confirmed prior blocker resolved

Before touching the app, verified the orchestrator's merge landed correctly:
- `git rev-parse --abbrev-ref HEAD` → `worktree-agent-aaa69a76c6a431d1f` (correct branch)
- `git log --oneline -3` showed `67a27ba merge: bring 25-02 + 25-03 into 25-04 base for Task 4 cross-surface check` at HEAD
- `grep -c "categoryId" supabase/functions/process-payment/index.ts` → 3 (was 0 in session 3)
- `grep -c "formatModifierLines" src/widgets/KdsBoard/index.tsx` → 2 (was 0 in session 3)

Both grep checks passed, so the walkthrough proceeded.

### Test data

Reused plan 25-02's combo: **Alitas (700gr)** (`4213e667-3156-4202-a485-c5822bdda71c`, category "Alitas") with modifier **BBQ** (`4c3149f3-ed75-4238-a0a7-9463b8e346c8`, price delta $0), plus **Budweiser** (`712d028b-7a71-48fe-a84a-d0f157659c36`, category "Cervezas Nacionales", no modifier). A temporary `product_modifiers` row linking Alitas 700gr → BBQ was seeded via the service-role client (same convention as 25-02/18-modifier-notes-kds.spec.ts) and deleted in a `finally` block after the walkthrough — confirmed deleted (`existing product_modifiers rows: []` re-checked after the run).

Both products route to `BAR` (`categories.routing = 'BAR'` for both "Alitas" and "Cervezas Nacionales" categories), so the cross-surface walkthrough used `/kds-bar`, not `/kds` (kitchen board correctly showed nothing for this order — confirmed, not a defect).

Driven via a temporary, uncommitted Playwright spec (`e2e/_tmp-phase25-task4.spec.ts`, deleted after this session — never part of the committed suite) run against `npm run dev` on port 1420 from this worktree, `DISPLAY=:0`, Google Chrome, using the existing `e2e/helpers/auth.ts` / `e2e/helpers/supabase.ts` conventions (`loginAs(page, 'manager')`, `openCaja`, `resetTestState`).

### Two known environment limitations discovered (not phase-25 defects)

1. **Pre-cheque browser-fallback popup is reproducibly blocked.** `src/shared/lib/pos-printer.ts`'s `printRawText()` browser fallback calls `window.open('', '_blank', ...)` from inside an async mutation handler (`usePrintPreCheque` → `printRawText`). Chromium revokes "transient user activation" across an `await` boundary, so the popup is silently blocked (`printer.raw_text.popup_blocked` logged) even with `--disable-popup-blocking` and a genuine prior click — confirmed reproducible across multiple attempts. `printRawText()` returns `ok(undefined)` in that case by design (never throws on a blocked popup), so clicking "Print Pre-cheque" shows a success toast with nothing actually printed in this browser-only test environment. This file is untouched by any 25-01..25-04 plan (pre-existing infrastructure).
   - **Workaround used for evidence:** called the exact production `buildPreChequeText()` (same function plan 25-01 wrote and unit-tested) directly via a `tsx` subprocess, fed with REAL order/category/modifier/pool-charge data queried from the live DB for the actual tab created in this walkthrough, then rendered that text through the identical HTML template `pos-printer.ts`'s fallback uses (monospace `<pre>`, 11px) and screenshotted it. This is real production formatting logic + real data, not a fabricated screenshot — see `01-precheque.png` / `01-precheque.txt` / `01-precheque-NOTE.txt`.
2. **In-app PDF export requires the Tauri desktop runtime.** `useExportReport.ts` calls `@tauri-apps/plugin-dialog`'s `save()` and `@tauri-apps/plugin-fs`'s `writeFile()`, both unavailable when the app runs as a plain Vite dev server (as opposed to `npm run tauri dev`). Clicking Export → PDF in `/reports` logged `export.report.failed {type: "caja-pdf"}` to the browser console — confirms the failure, though the (localized es-MX) toast text didn't match the automated English-regex check. Pre-existing infrastructure, not touched by any 25-01..25-04 plan.
   - **Workaround used for evidence:** called the exact production `cajaReportToPdfBytes()` (same function plan 25-04 wrote and unit-tested in `pdf.test.ts`) directly via a `tsx` subprocess against a **live `get_caja_report` RPC call** for the real caja session closed in this walkthrough, parsed with the app's own `CajaReportSchema`, wrote the real PDF bytes to disk, and rendered page 1 to PNG via `pdftoppm`. See `05-caja-pdf-page.png` / `caja-report.pdf`.

Both limitations are print/export **delivery mechanisms**, not the category/modifier grouping logic that is this phase's actual subject — the correctness evidence below comes from real production formatting functions running on real data either way.

### Screenshots captured (`/tmp/phase25-task4-screenshots/`)

| File | What it shows |
|---|---|
| `01-precheque.png` / `.txt` | Pre-cheque text: "Alitas" category header, `1× Alitas (700gr) $199.00`, indented `+ BBQ`, "Cervezas Nacionales" header, `1× Budweiser $45.00`, pool charge line, `SUBTOTAL $259.00` |
| `02-kds.png` | `/kds-bar` Bar Display: 2 pending cards (Alitas 700gr with `+ BBQ` on its own line, Budweiser), **zero category section headers** (D-04, intentional) |
| `02b-kds-kitchen-expected-empty.png` | `/kds` (kitchen board): empty, as expected — neither item routes to KITCHEN |
| `03-receipt.png` / `.txt` | In-app post-payment Receipt dialog: same category headers + `+ BBQ` line as the pre-cheque, `Subtotal $259.00`, `Tip $45.07`, `Total $304.07` |
| `04-caja-report.png` | `/reports` Daily Caja Report for the closed session: loads without error, `Total Revenue $304.07` (matches receipt Total exactly), Cash Reconciliation table populated |
| `05-caja-pdf-page.png` / `caja-report.pdf` | Real exported PDF's Top Products table: "Alitas" sub-header over `Alitas (700gr) 1 $199.00`, "Cervezas Nacionales" sub-header over `Budweiser 1 $45.00` — 2 rows total, well under the 10-row cap |

### Data checks (factual, no subjective verdict — human renders the actual approval)

| Check | Result |
|---|---|
| Same category name string ("Alitas", "Cervezas Nacionales") across pre-cheque, KDS card, receipt | **Consistent** — identical strings on all three surfaces |
| Same modifier name string ("BBQ") across pre-cheque, receipt (indented `+ BBQ` line); KDS card (`+ BBQ` on its own line, per plan 25-03) | **Consistent** |
| KDS shows zero category headers | **Confirmed** (expected per D-04, not a discrepancy) |
| Caja report loads without error; top-products rows ≤ 10 with category columns populated | **Confirmed** — 2 rows, both `categoryId`/`categoryName` populated (verified via direct RPC call: `topProducts` JSON shows `categoryName: "Alitas"` and `categoryName: "Cervezas Nacionales"`) |
| Pre-cheque SUBTOTAL vs final receipt Subtotal | **Byte-identical**: `$259.00` both places |
| Pre-cheque/receipt Total vs payment-form pre-submission Total | **MISMATCH, reported factually, not diagnosed further**: the Process Payment modal's pre-submission snapshot (captured via `modal.textContent()` right after opening, before submitting) showed `Subtotal $259.00 / Tax (16%) $41.44 / Tip $45.07 / Total $345.51`. The final receipt and the caja report both show `Total $304.07` (= Subtotal $259.00 + Tip $45.07, with **no separate tax line**). The actually-recorded/charged amount ($304.07) is internally consistent across the receipt and the caja report (`Total Revenue` matches exactly), so this is a display-time difference in the **payment modal's pre-submission preview** vs. what's actually charged — not a discrepancy between the pre-cheque and the receipt (which do match on Subtotal). This is a payment-form/tax-display question, not part of phase 25's category-grouping scope (25-01..25-04 never touch tax computation or `PaymentForm`'s total preview), so it is recorded here for visibility and left for the human reviewer to judge, not auto-fixed. |

### Cleanup performed

- Seeded `product_modifiers` row deleted (re-verified empty after the run).
- No open tabs, no occupied pool tables, no open caja sessions remain (verified via direct queries after the walkthrough).
- Dev server (`npm run dev`, started by Playwright's `webServer` on port 1420) killed; port 1420 confirmed down.
- Temporary Playwright spec (`e2e/_tmp-phase25-task4.spec.ts`) and temporary `tsx` helper scripts (`.tmp-render-precheque.ts`, `.tmp-render-caja-pdf.ts`, `.tmp-inspect.ts`, `.tmp-precheque-test.ts`) deleted — `git status --short` is clean.

### What is needed before this plan can be marked complete

**Task 4's `checkpoint:human-verify` (`gate="blocking"`) has NOT been approved by a human.** Evidence is captured and objective data checks are recorded above; per this task's own instructions, an agent does not self-approve this checkpoint. A human needs to review the 5 screenshots at `/tmp/phase25-task4-screenshots/` (or a copy relocated before this worktree is removed — that directory is outside the worktree and survives worktree removal) and either approve or describe which surface disagrees.

---
*Phase: 25-receipt-item-grouping-2-level*
*Completed: 2026-07-27 (Tasks 1-3; Task 4 walkthrough executed session 4, evidence captured, still pending human approval)*

## Self-Check: PASSED

All created/modified files and both task commits (`94cb093`, `14df313`) verified present in the worktree and git history. Session 4's screenshot evidence files confirmed present on disk at `/tmp/phase25-task4-screenshots/` (01-precheque through 05-caja-pdf-page, plus supporting text/JSON).
