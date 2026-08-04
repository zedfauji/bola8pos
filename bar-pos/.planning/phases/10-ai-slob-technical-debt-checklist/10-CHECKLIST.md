# Phase 10 — AI Slob Technical Debt Checklist

**Audit date:** 2026-08-03
**Tool versions:** `knip ^6.31.0`, `jscpd ^5.0.14`, `madge ^8.0.0` (from `package.json`)
**Audit scope:** Full whole-codebase re-audit (D-01) — not a delta since any prior phase. Source: `.audit-tmp/digests/*.txt` (11 digest files, produced by `scripts/run-tech-debt-audit.sh` per Plan 10-01/10-02). No `src/` file was opened while writing this document (D-03).
**Superseding note:** This run regenerated `.audit-tmp/` fresh in the main checkout after the first dispatch of this plan halted at a checkpoint (missing `.audit-tmp/`, gitignored by design, produced in a since-deleted worktree). Numbers here differ slightly from `10-02-SUMMARY.md`'s table — see "Cross-check against existing trackers" for the reconciliation of that difference; this file is the authoritative source.

## Per-tier count summary

| Tier | Total findings | Breakdown |
|---|---:|---|
| Blocking | 181 | e2e (147: 94 failed + 53 skipped) + knip unlisted (34) + lint/typecheck/unit-test (0/0/0, all clean) |
| High | 4694 | knip (1917: 848 default + 1069 production) + as-any unjustified (119) + jscpd (2657, triage-flagged) + madge (1, promoted) |
| Medium | 37 | knip shared-ui/stories exception (4 default + 33 production) |
| Low | 60 | todo-fixme (9) + oversized files >400 lines (51) |
| **Grand total (tiered)** | **4972** | |
| Raw digest grand total | 5019 | See "Stated exclusions" below |

**Stated exclusions (raw total 5019 → tiered total 4972, diff 47, fully accounted for):**
- **25** `as-any` occurrences are comment-line mentions of the `supabase as any` pattern (JSDoc/line-comments documenting *why* the cast exists below), not the cast itself — excluded from the High-tier unjustified-cast count. See "structural" under High for the split and the full list.
- **22** file-size probe findings are in the 300–400-line "headroom" band (over the probe's 300-line scan threshold but under the checklist's 400-line Low-tier threshold) — informational only, not counted as Low-tier findings. See the file-size note under Low → structural.

## Blocking

### unit test
0 failing (1391 passed / 1406 total). Clean. 15 `test.todo()` placeholders exist (`vitest-digest.txt`) — intentional, non-actionable, not counted as findings.

### e2e
147 findings (94 failed, 53 skipped) out of 373 total across 59 spec files (226 passed, 1 flaky — not findings). Playwright's own header states "Total tests: 373" while `226+94+53+1=374`; this off-by-one is noted under "Cross-check" Pass 2 as an unresolved digest-internal inconsistency, not a checklist error.

Full list (`spec-file:line [status] title`), verbatim from `playwright-digest.txt`:

```
e2e/01-ci.spec.ts:13 [failed] npm run typecheck exits 0
e2e/01-ci.spec.ts:17 [failed] npm run lint exits 0
e2e/01-ci.spec.ts:21 [failed] npm run test exits 0 (unit project)
e2e/02-caja.spec.ts:61 [failed] Manager closes caja
e2e/03-tab-order.spec.ts:14 [failed] Bartender creates a tab
e2e/03-tab-order.spec.ts:138 [skipped] T7: open tab with notes — notes visible in tab detail
e2e/03-tab-order.spec.ts:163 [skipped] T8: per-item notes saved with order
e2e/04-pool-timer.spec.ts:38 [failed] Start session on available table
e2e/04-pool-timer.spec.ts:50 [failed] Timer ticks
e2e/04-pool-timer.spec.ts:65 [failed] 15-minute minimum charge on stop
e2e/04-pool-timer.spec.ts:81 [failed] Start session auto-creates a New Tab
e2e/04-pool-timer.spec.ts:97 [failed] Charge recorded for linked tab after stop
e2e/04-pool-timer.spec.ts:117 [skipped] T8: maintenance table — Start Session button absent or disabled
e2e/04-pool-timer.spec.ts:160 [skipped] T9: reserved table — card shows Reserved badge or label
e2e/04-pool-timer.spec.ts:189 [failed] T10: Start Session dialog shows rate as dollar amount pattern
e2e/04-pool-timer.spec.ts:205 [skipped] T11: carom table billed at its own rate (not global default)
e2e/04-pool-timer.spec.ts:309 [skipped] T12: firstHourMode=full charges full hour for sub-60-min session
e2e/06-transfer.spec.ts:60 [failed] Transfer pool session preserves started_at
e2e/06-transfer.spec.ts:155 [failed] T5: transfer tab with pool session — pool charge preserved
e2e/07-reports.spec.ts:247 [failed] Cash reconciliation variance displayed
e2e/07-reports.spec.ts:320 [failed] Product Sales: date range filter to far past shows empty state
e2e/07-reports.spec.ts:621 [failed] Sprint 10: Staff Performance tab shows column headers or empty state
e2e/07-reports.spec.ts:647 [failed] Sprint 10: Staff Performance tab shows empty state for year 2020 date range
e2e/07-reports.spec.ts:729 [failed] Sprint 10: Tip Distribution tab shows column headers or empty state
e2e/07-reports.spec.ts:752 [failed] Sprint 10: Tip Distribution tab shows empty state for year 2020 date range
e2e/07-reports.spec.ts:774 [failed] Sprint 10: Export button appears in Staff Performance tab when data rows exist
e2e/07-reports.spec.ts:878 [failed] Phase 24: bartender-initiated reason-required removal succeeds (no AUTH_FORBIDDEN) and appears in Eliminaciones
e2e/09-rbac.spec.ts:75 [skipped] Bartender B does not see Bartender A's tab in drawer
e2e/09-rbac.spec.ts:91 [skipped] T7: admin deletes a tab — tab deleted toast, tab no longer in list
e2e/09-rbac.spec.ts:152 [skipped] T9: manager can void an order — success
e2e/09-rbac.spec.ts:250 [failed] T-RP-01: Admin sees permission matrix on /rbac page
e2e/10-inventory.spec.ts:16 [failed] Inventory decrements after order
e2e/10-inventory.spec.ts:36 [failed] Low stock alert visible to manager
e2e/10-inventory.spec.ts:52 [failed] T4: manager adjusts inventory UP by 5 (delivery reason)
e2e/10-inventory.spec.ts:94 [failed] T5: manager adjusts inventory DOWN by 2 (waste reason)
e2e/10-inventory.spec.ts:131 [failed] T6: bartender navigates to /inventory — redirected or read-only view
e2e/11-offline.spec.ts:65 [skipped] T4: offline pool session start — syncs after reconnect
e2e/11-offline.spec.ts:69 [failed] T5: three offline actions — no error toasts, sync on reconnect
e2e/13-tauri-build.spec.ts:14 [skipped] npm run tauri build exits 0 and MSI exists (Windows)
e2e/14-manual-stubs.spec.ts:4 [skipped] Day 1 — Tauri window + physical PIN + Supabase console
e2e/14-manual-stubs.spec.ts:11 [skipped] Day 2 — Storybook at localhost:6006 without console errors
e2e/14-manual-stubs.spec.ts:18 [skipped] Day 2 — Zustand store spot-check beyond automated unit run
e2e/14-manual-stubs.spec.ts:25 [skipped] Day 7 — Tauri production build (duplicate of automated opt-in)
e2e/15-home-navigation.spec.ts:104 [failed] T11: bartender navigates to /settings directly — redirected or access dialog shown
e2e/16-table-status.spec.ts:192 [failed] T1: navigate from pool grid to status page via View Status button
e2e/16-table-status.spec.ts:227 [failed] T2: "Moved from" badge visible when session has previous_table_id
e2e/16-table-status.spec.ts:283 [skipped] T3: Happy Hour badge visible when current time is within happy hour window
e2e/16-table-status.spec.ts:289 [failed] T4: Stop Timer opens confirmation dialog, confirm redirects to /pool-tables
e2e/16-table-status.spec.ts:318 [failed] T5: Stop & Move to Table stops session and moves tab to new table number
e2e/16-table-status.spec.ts:348 [failed] T6: Print Pre-cheque button triggers print flow without error dialog
e2e/16-table-status.spec.ts:376 [failed] T7: Bartender removing an item requires manager PIN (wrong PIN → error, correct PIN → confirm)
e2e/16-table-status.spec.ts:459 [failed] T8: Admin removing an item also requires manager PIN
e2e/16-table-status.spec.ts:527 [failed] T9: Removing the last item in an order removes the entire order section
e2e/16-table-status.spec.ts:592 [failed] T10: "Add More Items" navigates to /pos with the tab active
e2e/16-table-status.spec.ts:615 [failed] T11: "Close & Pay" shows confirmation then navigates to /pos
e2e/16-table-status.spec.ts:638 [skipped] T12: Navigating to status page of available table shows "No active session"
e2e/16-table-status.spec.ts:674 [skipped] T13: Real-time — session stopped externally updates the UI
e2e/16-table-status.spec.ts:683 [skipped] T14: Offline resilience — mutations are blocked when device is offline
e2e/16-table-status.spec.ts:692 [failed] T16: Edit Start Time requires manager PIN and rebills on save
e2e/16-table-status.spec.ts:757 [failed] T15: Back button navigates to /pool-tables
e2e/18-modifier-notes-kds.spec.ts:400 [skipped] T3: KDS card shows modifier name and note for a seeded food order
e2e/18-modifier-notes-kds.spec.ts:416 [skipped] T4: pre-cheque text includes modifier and note (skipped — Tauri IPC not available)
e2e/18-updater.spec.ts:23 [failed] app boots without console errors when updater plugin is registered
e2e/18-void-order.spec.ts:93 [failed] V1: VoidOrderDialog appears when void button clicked
e2e/18-void-order.spec.ts:124 [skipped] V2: submit void with reason — success toast and order shows voided state
e2e/18-void-order.spec.ts:176 [failed] V3: bartender — void button absent or shows manager PIN dialog
e2e/18-void-order.spec.ts:212 [failed] V4: void product with inventory — qty restores by 1
e2e/18-void-order.spec.ts:237 [failed] V5: submit void with empty reason — form error shown, order not voided
e2e/18-void-order.spec.ts:279 [skipped] V6: after void, tab subtotal decreases
e2e/18-void-order.spec.ts:283 [failed] V7: void an already-voided order — button disabled or error shown
e2e/19-caja-entries.spec.ts:162 [failed] CE6: submit with amount 0 — form error shown
e2e/19-caja-entries.spec.ts:186 [skipped] CE7: seeded entries appear in /reports caja entries section
e2e/20-error-scenarios.spec.ts:32 [failed] ER1: paying tab with active pool session shows error
e2e/20-error-scenarios.spec.ts:85 [failed] ER2: close caja with open tabs — error toast shown
e2e/20-error-scenarios.spec.ts:119 [failed] ER4: adding item to a paid tab shows error
e2e/20-error-scenarios.spec.ts:175 [failed] ER7: session cleared — /pos redirects to /login
e2e/20-error-scenarios.spec.ts:188 [skipped] ER8: RLS enforced at DB level
e2e/21-prep.spec.ts:95 [skipped] T3: selling menu item depletes prep ingredient qty
e2e/21-product-management.spec.ts:59 [skipped] PM2: create new category "TestCat-E2E"
e2e/21-product-management.spec.ts:96 [skipped] PM3: create product "TestProduct-E2E" at $9.99
e2e/21-product-management.spec.ts:170 [skipped] PM5: edit TestProduct-E2E price to $12.99
e2e/21-product-management.spec.ts:202 [skipped] PM6: set happy hour price $7.99 on TestProduct-E2E
e2e/21-product-management.spec.ts:264 [failed] PM8: bartender navigating to product management — button absent or PIN gate shown
e2e/22-sprint3-billing.spec.ts:71 [skipped] pool table session stop dialog shows charge based on table rate
e2e/22-sprint3-billing.spec.ts:115 [skipped] billing mode full charges minimum 1 hour for short sessions
e2e/22-staff-management.spec.ts:28 [failed] SM1: /staff page shows staff list with at least one member
e2e/22-staff-management.spec.ts:47 [skipped] SM2: admin adds E2E-TestStaff via UI or seed
e2e/22-staff-management.spec.ts:79 [failed] SM3: login as E2E-TestStaff succeeds
e2e/22-staff-management.spec.ts:91 [skipped] SM4: admin clock-in for a staff member — shift started
e2e/22-staff-management.spec.ts:117 [skipped] SM5: clock-out — duration or summary shown
e2e/22-staff-management.spec.ts:143 [skipped] SM6: admin sees all shifts; bartender sees only own
e2e/23-payment-edge-cases.spec.ts:174 [skipped] PE3: tip field — enter $2 tip, receipt shows tip line
e2e/23-payment-edge-cases.spec.ts:203 [skipped] PE4: discount field — apply 10% discount
e2e/23-payment-edge-cases.spec.ts:230 [skipped] PE5: Rappi payment method — no open_cash_drawer in logs
e2e/23-payment-edge-cases.spec.ts:263 [failed] PE6: tab with only pool charge (no order items) can be paid
e2e/23-payment-edge-cases.spec.ts:304 [failed] PE7: paying tab with running pool session — error shown
e2e/24-pool-advanced.spec.ts:53 [skipped] PA1: edit start time 30 min ago — stop shows higher charge
e2e/24-pool-advanced.spec.ts:57 [failed] PA2: start session with New Tab, then assign to existing tab
e2e/24-pool-advanced.spec.ts:99 [skipped] PA3: start sessions on Table 1 and Table 2 — both show timers
e2e/24-pool-advanced.spec.ts:128 [skipped] PA4: stop Table 1 — Table 1 available, Table 2 still running
e2e/24-pool-advanced.spec.ts:166 [failed] PA5: after stopping session, /payments shows pool charge line item
e2e/24-pool-advanced.spec.ts:203 [failed] PA6: rate displayed in start session dialog matches a dollar pattern
e2e/24-pool-advanced.spec.ts:219 [skipped] PA7: session started 16 min ago — charge is proportional, not flat minimum
e2e/24-sprint5-pool-accuracy.spec.ts:193 [failed] T1: Edit start time button visible on occupied table status page
e2e/24-sprint5-pool-accuracy.spec.ts:211 [failed] T2: Bartender can see Edit Start Time button (no role gate on the button itself)
e2e/24-sprint5-pool-accuracy.spec.ts:227 [failed] T3: Edit start time requires manager PIN
e2e/24-sprint5-pool-accuracy.spec.ts:253 [failed] T4: Manager edits start time back 30 min and elapsed timer reflects the change
e2e/24-sprint5-pool-accuracy.spec.ts:306 [failed] T5: Future datetime is rejected with inline validation error
e2e/24-sprint5-pool-accuracy.spec.ts:367 [failed] T7: Session starts successfully when print_on_start is enabled
e2e/24-sprint5-pool-accuracy.spec.ts:413 [failed] T8: Session starts successfully when print_on_start is disabled (default)
e2e/24-waitlist.spec.ts:21 [failed] T1: Add a party to the waitlist
e2e/24-waitlist.spec.ts:38 [failed] T2: Notify a waiting party
e2e/24-waitlist.spec.ts:75 [failed] T4: Mark a party as no-show
e2e/24-waitlist.spec.ts:97 [failed] T5: WaitlistRealtimeListener — queue updates in real time
e2e/24-waitlist.spec.ts:248 [failed] T7: The new-temporary-table action is absent while a table is available
e2e/25-rappi-orders.spec.ts:36 [skipped] RO2: seeded rappi order visible with customer name
e2e/25-rappi-orders.spec.ts:51 [skipped] RO3: accept a pending rappi order — status changes to accepted/preparing
e2e/25-rappi-orders.spec.ts:80 [skipped] RO4: reject a pending rappi order — order removed from pending list
e2e/25-rappi-orders.spec.ts:117 [failed] RO5: accepted rappi order linked tab appears in /payments
e2e/26-field-validation.spec.ts:71 [failed] FV3: tab name of 101 chars — form error or input capped at 100
e2e/26-field-validation.spec.ts:121 [skipped] FV5: order notes 501 chars — error or input capped at 500
e2e/26-field-validation.spec.ts:154 [skipped] FV6: open caja with negative opening cash — form error shown
e2e/26-field-validation.spec.ts:165 [skipped] FV7: product form with empty name — error shown, not saved
e2e/26-field-validation.spec.ts:205 [failed] FV8: 5-digit PIN on login page — error shown
e2e/26-field-validation.spec.ts:231 [failed] FV9: caja entry form — amount 0 shows error
e2e/27-inventory-intelligence.spec.ts:32 [failed] T1: low-stock badge is visible for manager when stock is below threshold
e2e/27-inventory-intelligence.spec.ts:151 [failed] T5: physical count submit adjusts stock and writes stock_movements
e2e/27-inventory-intelligence.spec.ts:236 [skipped] T6: variance report highlights negative rows with destructive styling
e2e/30-help-manual.spec.ts:15 [failed] F1 opens route-specific help on POS
e2e/31-categories.spec.ts:169 [failed] T2: admin creates root category "Beers" — visible in tree
e2e/31-categories.spec.ts:193 [failed] T3: admin creates child "Regular" under Beers
e2e/31-categories.spec.ts:222 [failed] T4: admin creates grandchild "Corona" under Regular
e2e/31-categories.spec.ts:262 [failed] T5: 4th-level creation blocked in UI — no "Add subcategory" button on grandchild
e2e/31-categories.spec.ts:318 [failed] T6: combo_eligible flag — DB column writable and readable (service-role)
e2e/31-categories.spec.ts:363 [skipped] T7: bartender cannot write to modifier_groups (RLS)
e2e/31-categories.spec.ts:385 [failed] T8: bartender cannot access Settings — redirected to /home
e2e/36-recipes.spec.ts:21 [failed] can open Recipe tab in product edit dialog
e2e/36-recipes.spec.ts:43 [failed] can add ingredients to recipe and save
e2e/36-recipes.spec.ts:82 [failed] INVENTORY_NEGATIVE shows toast and allows override with manager PIN
e2e/36-recipes.spec.ts:144 [skipped] full depletion E2E: sell Alitas → verify stock ledger → void → verify reversal
e2e/37-analytics-reports.spec.ts:82 [failed] T2: RecipeVarianceReport tab renders without crash
e2e/38-audit-logs.spec.ts:170 [failed] bartender should be redirected away from /audit
e2e/38-audit-logs.spec.ts:184 [skipped] should open diff sheet on row click
e2e/43-promotions.spec.ts:39 [failed] T1: admin creates, edits (disables), and deletes a promotion via Settings -> Promotions
e2e/43-promotions.spec.ts:96 [failed] T2: an active item-target promotion auto-applies at order time with no confirmation step (D-02)
e2e/44-focus-tab-order.spec.ts:81 [failed] A: ManagerPinDialog Tab order follows the visual keypad layout (1-9, 0, Backspace, Cancel)
e2e/44-focus-tab-order.spec.ts:144 [failed] B: inventory category filter Tabs into the sortable column headers in visual order
```

### knip
**Blocking = unresolved (0, both modes) + unlisted (34, default mode only — knip production mode does not report an `unlisted` section).**

Unlisted `unlisted` findings — all 34 are `@testing-library/user-event` imported in test files without a corresponding `package.json` entry (transitively available via `@testing-library/react`, but not declared directly):

```
src/widgets/OpenUnitsTab.test.tsx:2
src/pages/reports/ReportsPage.test.tsx:9
src/features/add-combo-to-tab/ComboBuilderSheet.test.tsx:14
src/shared/ui/ProtectedAction.test.tsx:2
src/shared/ui/UpdateAvailableDialog.test.tsx:11
src/widgets/AuditLogTable/AuditLogTable.test.tsx:2
src/widgets/PINLoginForm/PINLoginForm.test.tsx:3
src/widgets/PaymentModal/PaymentModal.test.tsx:2
src/widgets/TabDrawer/TabDrawer.test.tsx:10
src/entities/product/ui/CategoryTabs.test.tsx:2
src/entities/product/ui/ProductCard.test.tsx:2
src/entities/tab/ui/TabDetail.test.tsx:15
src/shared/ui/CategoryTreePicker/CategoryTreePicker.test.tsx:2
src/features/clock-in-staff/ui/ClockInModal.test.tsx:2
src/features/clock-out-staff/ui/ClockOutDialog.test.tsx:3
src/features/correct-open-unit/ui/CorrectOpenUnitDialog.test.tsx:2
src/features/edit-staff-locale/ui/EditLocaleDialog.test.tsx:2
src/features/export-report/ui/ExportButtons.test.tsx:9
src/features/force-pin-change/ui/ForcePinChangeDialog.test.tsx:2
src/features/manage-promotions/ui/ManagePromotionsTab.test.tsx:9
src/features/manage-promotions/ui/PromotionBuilderForm.test.tsx:10
src/features/manager-pin-gate/ui/ManagerPinDialog.test.tsx:2
src/features/process-payment/ui/EmailReceiptDialog.test.tsx:2
src/features/process-payment/ui/ReceiptPreview.test.tsx:2
src/features/remove-tab-item/ui/RemoveTabItemDialog.test.tsx:3
src/features/start-pool-timer/ui/StartSessionSheet.test.tsx:9
src/features/stop-pool-timer/ui/StopSessionConfirm.test.tsx:9
src/features/void-order/ui/VoidOrderDialog.test.tsx:2
src/widgets/HomeDashboard/ui/HomeDashboard.test.tsx:2
src/widgets/PaymentModal/ui/PaymentForm.test.tsx:9
src/widgets/PaymentPane/ui/PaymentPane.test.tsx:2
src/widgets/SettingsTabsPanel/tabs/BillingSettingsTab.test.tsx:2
src/widgets/SettingsTabsPanel/tabs/LanguageSettingsTab.test.tsx:2
src/widgets/SettingsTabsPanel/tabs/TipDistributionSettingsTab.test.tsx:2
```

## High

### knip
1917 findings (848 default-mode + 1069 production-mode), covering unused files, exports, types, dependencies, and duplicate exports located outside `src/shared/ui/**` and outside `*.stories.tsx` (per the High-tier rule). Medium-tier shared-ui/stories exceptions are listed separately below.

**Data-completeness caveat:** `knip-digest.txt` and `knip-production-digest.txt` themselves truncate the `exports` and `types` sections to the first 100 entries each (e.g. `"... (418 more, total 518)"`), consistent with the digests being deliberately compact per 10-02-SUMMARY.md. The `files`, `dependencies`, `devDependencies`, `unlisted`, and `duplicates` sections are NOT truncated — those lists below are complete. For `exports`/`types`, the entries below are the full *visible* sample; the remaining un-enumerated findings (counted in the totals, not individually citable from this digest) are placed here in High per the plan's severity-fallback rule ("place it in the more severe of the two candidate tiers and annotate as needing triage") rather than guessed at — resolving their exact `file:line` and shared-ui/other split requires re-running `knip` to regenerate an untruncated report, not re-reading `src/`.

**Default mode — unused files (42 of 43; 1 is Medium, see below), whole-file findings (no single line to cite):**
```
scripts/audit-ui-drift.ts
scripts/seed-combos.ts
scripts/seed-ingredients.ts
scripts/seed-prep.ts
scripts/seed-recipes.ts
scripts/seed-reports.ts
scripts/test-payment-auth.mjs
scripts/write-env-local-from-cloud-secret.mjs
src/app/kitchen-prep-route.tsx
src/entities/combo/model/index.ts
src/entities/promotion/model/index.ts
src/features/add-item-to-tab/model/index.ts
src/features/add-item-to-tab/ui/index.ts
src/features/open-tab/index.ts
src/features/open-tab/ui/index.ts
src/features/print-precheque/index.ts
src/features/remove-item-from-tab/index.ts
src/features/remove-tab-item/index.ts
src/features/stop-and-move-table/index.ts
src/shared/lib/agent/index-status.ts
src/shared/lib/index.ts
src/shared/lib/supabase-realtime.ts
src/widgets/OrderPanel/CartSummary.tsx
src/widgets/OrderPanel/OrderItemCard.tsx
src/widgets/RappiOrderBadge/index.ts
src/widgets/RappiOrderBadge/RappiOrderBadge.tsx
src/widgets/SettingsCatalogPanel.tsx
src/widgets/SettingsPagePanel.tsx
supabase/functions/create-staff/index.ts
supabase/functions/get-server-time/index.ts
supabase/functions/process-payment/index.ts
supabase/functions/process-split-payment/index.ts
supabase/functions/rappi-sync-menu/index.ts
supabase/functions/rappi-webhook/index.ts
supabase/functions/send-receipt-email/index.ts
supabase/functions/send-waitlist-notification/index.ts
supabase/functions/settings-backup/index.ts
supabase/functions/settings-email-status/index.ts
supabase/functions/settings-restore/index.ts
supabase/functions/settings-test-email/index.ts
supabase/functions/_shared/audit.ts
supabase/functions/void-order/index.ts
```
(NOTE: many `supabase/functions/*/index.ts` entries here are Deno edge-function entry points invoked over HTTP, not imported by any TS module graph — knip's default mode flags them as "unused files" because it cannot see the runtime invocation. Likely false positives; flag for human triage rather than deletion.)

**Default mode — unused exports (518 total, 100 visible, grouped by file, `file: line1,line2,...`):**
```
e2e/helpers/supabase.ts: 694,702
src/entities/tab/model/store.ts: 260
src/shared/lib/domain-helpers.ts: 197
src/shared/lib/domain.ts: 20,24,25,26,91,110,147,230,232,367,394,401,468,480,499,508,583,585,599,608,653,658,668,692,697,718,723,733,781,803,808,824,839,865,887,943,965,984,1001,1034,1047,1060,1068,1076,1124,1135,1148,1160,1276,1286,1304,1619,1634,1635,1650,1669,1678,1687,1701,1705,1709,1740,1750,1758,1768,1778,1821,1827,1833,1847,1899,1913,1930,1957,1968,1978,1987,1999,2012,2055,2114,2136
src/shared/lib/test-utils.tsx: 79,80,81,82,83,84,85,86,87,88,89,90,91,95
```
(+418 more, digest-truncated — not individually citable, see caveat above)

**Default mode — unused types (270 of 273 High; 3 are Medium, see below; 100 visible sample, grouped):**
```
src/entities/category/index.ts: 22,22,22
src/entities/ingredient/index.ts: 20,22,23
src/entities/ingredient/model/types.ts: 8,10,11
src/entities/inventory/model/store.ts: 12
src/entities/inventory/model/types.ts: 4,4
src/entities/open-unit/index.ts: 2,2
src/entities/payment/model/types.ts: 40
src/entities/product/index.ts: 28,29,30,31
src/entities/product/model/types.ts: 9
src/entities/promotion/index.ts: 21,22,23,25,26
src/entities/settings/index.ts: 12,16,17,18,20,22,23
src/entities/tab/model/store.ts: 24
src/entities/waitlist/model/types.ts: 11
src/features/correct-open-unit/index.ts: 3
src/features/open-open-unit/index.ts: 3
src/features/void-open-unit/index.ts: 3
src/shared/lib/domain.ts: 377,410,493,588,589,613,614,661,662,677,702,703,726,727,734,787,812,826,827,841,842,966,995,1093,1094,1095,1096,1133,1153,1154,1170,1297,1620,1638,1639,1656,1675,1702,1706,1744,1781,1849,1850,1851,1852,2013,2122,2142,2164
src/shared/lib/edge-function-contracts.ts: 80,129,201,414,553,564,648,660,856,938,1358
```
(+173 more, digest-truncated — not individually citable)

**Default mode — unused dependencies (10, all `package.json`):**
```
package.json:43 @radix-ui/react-slot
package.json:44 @radix-ui/react-tabs
package.json:54 @tauri-apps/plugin-opener
package.json:56 @tauri-apps/plugin-shell
package.json:57 @tauri-apps/plugin-sql
package.json:62 date-fns
package.json:63 drizzle-orm
package.json:66 input-otp
package.json:72 react-error-boundary
package.json:78 shadcn
```

**Default mode — unused devDependencies (5, all `package.json`):**
```
package.json:101 @typescript-eslint/eslint-plugin
package.json:102 @typescript-eslint/parser
package.json:110 eslint-config-prettier
package.json:125 jscpd
package.json:129 madge
```
(NOTE: `jscpd` and `madge` themselves being flagged unused is expected — they're invoked via `npx`/npm scripts, not imported. Likely false positive.)

**Default mode — duplicate exports (3, no line number captured by the probe — digest limitation, see raw `knip-report.json` to resolve exact line):**
```
src/shared/lib/domain.ts (duplicate export pair 1)
src/shared/lib/domain.ts (duplicate export pair 2)
src/entities/inventory/model/store.ts (duplicate export pair)
```

**Production mode — unused files (61 of 63; 2 are Medium, see below), whole-file findings:**
```
e2e/fixtures.ts
e2e/helpers/auth.ts
e2e/helpers/requireEnv.ts
e2e/helpers/supabase.ts
eslint-rules/no-raw-money-format.js
eslint-rules/no-ui-drift.js
scripts/audit-ui-drift.ts
scripts/generate-design-tokens.ts
scripts/indexCodebase.ts
scripts/seed-combos.ts
scripts/seed-ingredients.ts
scripts/seed-prep.ts
scripts/seed-recipes.ts
scripts/seed-reports.ts
scripts/test-payment-auth.mjs
scripts/write-env-local-from-cloud-secret.mjs
src/app/kitchen-prep-route.tsx
src/entities/combo/model/index.ts
src/entities/promotion/model/index.ts
src/entities/tab/ui/PoolChargeItem.tsx
src/entities/tab/ui/TabDetail.tsx
src/features/add-item-to-tab/model/index.ts
src/features/add-item-to-tab/ui/index.ts
src/features/close-tab/index.ts
src/features/open-tab/index.ts
src/features/open-tab/ui/index.ts
src/features/print-precheque/index.ts
src/features/remove-item-from-tab/index.ts
src/features/remove-tab-item/index.ts
src/features/stop-and-move-table/index.ts
src/shared/lib/agent/index-status.ts
src/shared/lib/index.ts
src/shared/lib/mocks.ts
src/shared/lib/promotion-pricing.ts
src/shared/lib/rappi-webhook-payload.ts
src/shared/lib/supabase-realtime.ts
src/shared/lib/supabase-test-client.ts
src/shared/lib/test-setup.ts
src/shared/lib/test-utils.tsx
src/shared/lib/uom.ts
src/test/global-setup.ts
src/widgets/OrderPanel/CartSummary.tsx
src/widgets/OrderPanel/OrderItemCard.tsx
src/widgets/RappiOrderBadge/index.ts
src/widgets/RappiOrderBadge/RappiOrderBadge.tsx
src/widgets/SettingsCatalogPanel.tsx
src/widgets/SettingsPagePanel.tsx
supabase/functions/create-staff/index.ts
supabase/functions/get-server-time/index.ts
supabase/functions/process-payment/index.ts
supabase/functions/process-split-payment/index.ts
supabase/functions/rappi-sync-menu/index.ts
supabase/functions/rappi-webhook/index.ts
supabase/functions/send-receipt-email/index.ts
supabase/functions/send-waitlist-notification/index.ts
supabase/functions/settings-backup/index.ts
supabase/functions/settings-email-status/index.ts
supabase/functions/settings-restore/index.ts
supabase/functions/settings-test-email/index.ts
supabase/functions/_shared/audit.ts
supabase/functions/void-order/index.ts
```

**Production mode — unused exports (685 total, 100 visible, grouped — entirely `src/shared/lib/domain.ts`):**
```
src/shared/lib/domain.ts: 20,24,25,26,75,84,91,100,102,110,116,134,147,230,232,359,367,394,401,416,468,480,499,508,583,585,599,608,620,653,658,668,692,697,718,723,733,765,781,803,808,818,824,833,839,865,887,943,965,984,1001,1034,1047,1060,1068,1076,1124,1135,1148,1160,1276,1286,1288,1304,1619,1634,1635,1650,1669,1678,1687,1701,1705,1709,1740,1750,1758,1768,1778,1821,1827,1833,1847,1899,1913,1930,1957,1968,1978,1987,1999,2012,2030,2055,2072,2075,2106,2114,2136,2147
```
(+585 more, digest-truncated — not individually citable)

**Production mode — unused types (309 of 340 High; 31 are Medium, see below; 100 visible, grouped):**
```
src/entities/caja/index.ts: 17,18
src/entities/inventory/index.ts: 18,18,21
src/entities/tab/model/store.ts: 24
src/entities/tab/model/types.ts: 13,17,18,19
src/features/physical-count/index.ts: 5,6,7
src/shared/lib/domain.ts: 377,410,493,588,589,613,614,660,661,662,677,702,703,726,727,734,787,812,826,827,841,842,966,995,1093,1094,1095,1096,1133,1153,1154,1170,1297,1298,1620,1638,1639,1656,1675,1702,1706,1744,1781,1849,1850,1851,1852,2013,2122,2142,2164
src/shared/lib/edge-function-contracts.ts: 80,129
src/shared/lib/logger.ts: 39,47,78
```
(+240 more, digest-truncated — not individually citable)

**Production mode — unused dependencies (11, all `package.json`):**
```
package.json:43 @radix-ui/react-slot
package.json:44 @radix-ui/react-tabs
package.json:54 @tauri-apps/plugin-opener
package.json:56 @tauri-apps/plugin-shell
package.json:57 @tauri-apps/plugin-sql
package.json:62 date-fns
package.json:63 drizzle-orm
package.json:66 input-otp
package.json:72 react-error-boundary
package.json:78 shadcn
package.json:80 supabase
```

**Production mode — duplicate exports (3, same underlying files as default mode, no line number captured):**
```
src/shared/lib/domain.ts (duplicate export pair 1)
src/shared/lib/domain.ts (duplicate export pair 2)
src/entities/inventory/model/store.ts (duplicate export pair)
```

### jscpd
2657 total clones (41376 duplicated lines, 10.22% of 2181 scanned sources). **Entire category triage-flagged, not individually tiered per-clone.**

Reason: `jscpd-digest.txt` itself is truncated to the first ~101 of 2657 clone entries. Of those 101 visible, **0 touch `src/` application code** — every one is `.agents/skills/**` vendored license/skill text, `.github/workflows/*.yml`, or `.planning/**` markdown documentation duplication. This is the known, already-flagged `.jscpd.json` scope gap (`.agents/skills/` not yet excluded — 10-01-SUMMARY.md). Per RESEARCH.md's guidance and this task's own hard constraint, an ambiguous finding whose true FSD-slice classification cannot be determined from the digest is placed in the more severe of its two candidate tiers (High vs Medium) rather than guessed — so all 2657 are provisionally High pending a `.jscpd.json` fix + re-run.

**Recommendation for the remediation phase:** fix `.jscpd.json`'s ignore list to exclude `.agents/skills/`, `.github/`, and `.planning/`, then re-run `npm run audit:tech-debt` to get a clean, `src/`-only jscpd report before triaging any individual clone as real app-code duplication.

Representative sample (first 20 of the visible 101, illustrating the noise composition):
```
.agents/skills/frontend-design/LICENSE.txt:2-177 <-> .agents/skills/mcp-builder/mcp-builder/LICENSE.txt:2-177 (176 lines, 1654 tokens)
.agents/skills/mcp-builder/mcp-builder/LICENSE.txt:172-202 <-> .agents/skills/webapp-testing/LICENSE.txt:172-202 (31 lines, 243 tokens)
.agents/skills/mcp-builder/mcp-builder/scripts/evaluation.py:96-105 <-> .agents/skills/mcp-builder/mcp-builder/scripts/evaluation.py:137-145 (10 lines, 50 tokens)
.github/workflows/ci.yml:9-28 <-> .planning/phases/36-migrate-development-environment-from-windows-to-ubuntu/36-PATTERNS.md:yaml:58-77 (20 lines, 93 tokens)
.github/workflows/ci.yml:12-27 <-> .github/workflows/ci.yml:45-60 (16 lines, 75 tokens)
.github/workflows/ci.yml:18-30 <-> .planning/phases/36-migrate-development-environment-from-windows-to-ubuntu/36-PATTERNS.md:yaml:67-86 (13 lines, 54 tokens)
.github/workflows/ci.yml:54-63 <-> .planning/phases/36-migrate-development-environment-from-windows-to-ubuntu/36-RESEARCH.md:yaml:189-196 (10 lines, 51 tokens)
.github/workflows/release.yml:13-27 <-> .planning/phases/09-auto-updater/09-01-PLAN.md:yaml:201-215 (15 lines, 68 tokens)
.github/workflows/release.yml:38-49 <-> .planning/phases/09-auto-updater/09-01-PLAN.md:yaml:227-238 (12 lines, 54 tokens)
.planning/ROADMAP.md:markdown:1-8 <-> .planning/milestones/v2.2-ROADMAP.md:markdown:1-8 (8 lines, 91 tokens)
.planning/ROADMAP.md:markdown:12-43 <-> .planning/milestones/v2.2-ROADMAP.md:markdown:8-39 (32 lines, 846 tokens)
.planning/ROADMAP.md:markdown:50-61 <-> .planning/milestones/v2.2-ROADMAP.md:markdown:46-57 (12 lines, 188 tokens)
.planning/ROADMAP.md:markdown:61-319 <-> .planning/milestones/v2.2-ROADMAP.md:markdown:74-332 (259 lines, 5004 tokens)
.planning/ROADMAP.md:markdown:341-630 <-> .planning/milestones/v2.2-ROADMAP.md:markdown:345-634 (290 lines, 5424 tokens)
.planning/ROADMAP.md:markdown:664-678 <-> .planning/milestones/v2.2-ROADMAP.md:markdown:636-650 (15 lines, 179 tokens)
.planning/ROADMAP.md:markdown:695-709 <-> .planning/milestones/v2.2-ROADMAP.md:markdown:652-666 (15 lines, 196 tokens)
.planning/ROADMAP.md:markdown:733-745 <-> .planning/milestones/v2.2-ROADMAP.md:markdown:668-680 (13 lines, 166 tokens)
.planning/ROADMAP.md:markdown:778-789 <-> .planning/milestones/v2.2-ROADMAP.md:markdown:684-695 (12 lines, 99 tokens)
.planning/codebase/TESTING.md:markdown:63-79 <-> .planning/codebase/TESTING.md:markdown:87-104 (17 lines, 345 tokens)
.planning/feature-expansion-2026q2/sprints/S1-foundation.md:markdown:11-17 <-> .planning/feature-expansion-2026q2/sprints/S3a-ingredients.md:markdown:11-17 (7 lines, 186 tokens)
```
(+2637 more, digest-truncated — not individually citable; see recommendation above)

### madge
1 finding — the sole detected cycle, **promoted from a Medium candidate to High per RESEARCH.md Assumption A2's spot-check instruction.**

```
entities/inventory/model/queries.ts <-> entities/inventory/model/store.ts
```
Both files are `src/entities/inventory/model/*.ts` — same FSD slice (`entities/inventory`), which would normally qualify for the Medium "barrel-file indirection" bucket per D-06's rule. **A2 spot-check result:** the cycle is a *direct* two-file circular import (`queries.ts` imports from `store.ts` and vice versa) with no `index.ts`/barrel module anywhere in the cycle chain. Per RESEARCH.md A2's explicit instruction ("If a same-slice cycle does NOT involve a barrel, promote it to High and say why"), this is promoted to High — it is a real logic-level circular dependency between the query layer and the Zustand store, not a false-positive from re-export indirection.

### structural
119 unjustified `as any` casts (of 144 total occurrences captured by the probe; the other 25 are comment-line mentions of the pattern, not casts — see "Stated exclusions" above and the full list under "Cross-check"/header). CLAUDE.md's rule requires the justification comment on the *same line* as the cast; none of these 119 code lines carry one (some are preceded by a doc-block a few lines above, which does not satisfy the same-line rule as written).

Grouped by file (`file: line1,line2,...`):
```
src/entities/audit-log/model/queries.ts: 16
src/entities/audit-log/model/rls-denial.integration.test.ts: 29,30
src/entities/caja/model/queries.ts: 39
src/entities/caja/model/tip-distribution-rpc.integration.test.ts: 331,356,389,420,452,467,478,491,499,523,535
src/entities/combo/model/queries.ts: 24,187
src/entities/ingredient/model/queries.ts: 20
src/entities/inventory/model/queries.ts: 24
src/entities/kds/model/bump.ts: 14
src/entities/kds/model/queries.ts: 24,65
src/entities/modifier-inventory-rule/model/queries.ts: 22
src/entities/open-unit/model/consume-open-unit.integration.test.ts: 48,52
src/entities/open-unit/model/open-unit-lifecycle.integration.test.ts: 42,47,51
src/entities/open-unit/model/queries.ts: 15
src/entities/payment/model/queries.ts: 19
src/entities/prep/model/queries.ts: 16
src/entities/promotion/model/applied-promotions-rls.integration.test.ts: 37,38,39
src/entities/promotion/model/evaluate-promotions-rpc.integration.test.ts: 41,42
src/entities/promotion/model/pool-promotions-rpc.integration.test.ts: 43,44
src/entities/promotion/model/promotions-schema.integration.test.ts: 34,35
src/entities/promotion/model/queries.ts: 18,282
src/entities/rbac/model/queries.ts: 12
src/entities/recipe/model/queries.ts: 18
src/entities/refund/model/queries.ts: 17
src/entities/resource/model/deactivate-floating-resource.integration.test.ts: 40,41
src/entities/staff/model/queries.ts: 597
src/entities/tab/model/category-revenue-report.integration.test.ts: 53
src/entities/tab/model/depletion.integration.test.ts: 26,28
src/entities/tab/model/queries-reports.ts: 61
src/entities/waitlist/model/queries.ts: 30
src/features/add-combo-to-tab/model/useAddComboToTab.ts: 22
src/features/adjust-stock-movement/ui/AdjustStockMovementDialog.tsx: 65
src/features/edit-paid-tab/model/edit-paid-tab-rpc.integration.test.ts: 36
src/features/export-report/ui/ExportButtons.test.tsx: 293
src/features/force-pin-change/model/useForcePinChange.ts: 17
src/features/import-ingredients-csv/ui/CsvImportSheet.tsx: 37
src/features/lookup-product-by-barcode/model/useLookupProductByBarcode.ts: 31,33
src/features/manage-combos/ui/ComboAvailabilityEditor.tsx: 22
src/features/manage-combos/ui/ComboBuilderForm.tsx: 25
src/features/manage-combos/ui/ManageCombosTab.tsx: 30
src/features/manage-ingredients/ui/IngredientForm.tsx: 94
src/features/manage-modifier-groups/ui/ModifierGroupEditor.tsx: 33
src/features/manage-promotions/ui/PromotionAvailabilityEditor.tsx: 24
src/features/manage-promotions/ui/PromotionBuilderForm.tsx: 32
src/features/mark-waitlist-entry-cancelled/model/useMarkCancelled.ts: 12
src/features/mark-waitlist-no-show/model/useMarkNoShow.ts: 12
src/features/notify-waitlist/model/useNotifyWaitlist.ts: 19
src/features/open-tab/model/useOpenTab.test.tsx: 82,115,143
src/features/override-negative-stock/model/useOverrideNegativeStock.ts: 19
src/features/physical-count/model/usePhysicalCount.ts: 13
src/features/process-refund/model/useProcessRefund.ts: 18
src/features/process-refund/process-refund-rpc.integration.test.ts: 337,384,394,414,437
src/features/produce-prep-batch/model/produce-prep-batch.integration.test.ts: 14,15,149,150,151,446,447
src/features/reopen-tab/model/reopen-tab-rpc.integration.test.ts: 44
src/features/seat-waitlist-party/model/useSeatWaitlistParty.ts: 31
src/features/seat-waitlist-party/ui/SeatPartySheet.tsx: 44
src/features/split-tab/model/useSplitTab.ts: 17
src/features/toggle-permission/useMutationTogglePermission.ts: 13
src/features/transfer-tab/useTransferTab.ts: 10
src/features/void-order/model/useVoidOrder.ts: 81
src/shared/lib/agent/tools/posTools.ts: 197
src/shared/lib/exporters/pdf.tsx: 239
src/shared/lib/version-error.test.ts: 46,72
src/shared/lib/version-error.ts: 50
src/widgets/ManageIngredientsTab/index.tsx: 36
src/widgets/PINLoginForm/PINLoginForm.tsx: 44,132
src/widgets/PoolTableOccupancyPanel/ui/PoolTableOccupancyPanel.tsx: 14
src/widgets/TabDrawer/TabDrawer.test.tsx: 73,94,113,136,161,186,210,240,286,317,347,370,392
src/widgets/WaitlistQueue/ui/WaitlistQueue.tsx: 25
```

**Excluded as documentation, not a cast (25 — the "Uses `supabase as any` pre-regen cast" comment blocks; listed here for completeness, not counted as High findings):**
```
src/features/manage-promotions/ui/PromotionAvailabilityEditor.tsx:9
src/features/manage-combos/ui/ComboAvailabilityEditor.tsx:6
src/features/force-pin-change/model/useForcePinChange.ts:6
src/features/add-combo-to-tab/model/useAddComboToTab.ts:6
src/features/process-refund/model/useProcessRefund.ts:6
src/features/manage-combos/ui/ManageCombosTab.tsx:8
src/features/manage-promotions/ui/PromotionBuilderForm.tsx:11
src/features/split-tab/model/useSplitTab.ts:5
src/features/manage-modifier-groups/ui/ModifierGroupEditor.tsx:8
src/features/manage-combos/ui/ComboBuilderForm.tsx:6
src/entities/ingredient/model/queries.ts:9
src/features/adjust-stock-movement/ui/AdjustStockMovementDialog.tsx:7
src/entities/waitlist/model/queries.ts:7
src/entities/recipe/model/queries.ts:6
src/entities/promotion/model/evaluate-promotions-rpc.integration.test.ts:29
src/entities/promotion/model/pool-promotions-rpc.integration.test.ts:23
src/entities/refund/model/queries.ts:9
src/entities/promotion/model/queries.ts:6
src/entities/promotion/model/promotions-schema.integration.test.ts:20
src/entities/staff/model/queries.ts:594
src/entities/combo/model/queries.ts:9
src/entities/modifier-inventory-rule/model/queries.ts:9
src/entities/promotion/model/applied-promotions-rls.integration.test.ts:17
src/entities/payment/model/queries.ts:10
src/widgets/ManageIngredientsTab/index.tsx:12
```

## Medium

### knip
37 findings (4 default-mode + 33 production-mode) — knip's known false-positive surface for a component library per RESEARCH.md Pitfall 1: unused-file/unused-type findings confined to `src/shared/ui/**`. Listed for human triage, not treated as confirmed debt.

**Default mode — unused files in `shared/ui` (1):**
```
src/shared/ui/input-otp.tsx
```

**Default mode — unused types in `shared/ui` (3):**
```
src/shared/ui/index.ts: 14,16,18
```
(`MoneyDisplayProps`, `TimerDisplayProps`, `LiveTimeDisplayProps`)

**Production mode — unused files in `shared/ui` (2):**
```
src/shared/ui/VersionConflictToast.tsx
src/shared/ui/input-otp.tsx
```

**Production mode — unused types in `shared/ui` (31):**
```
src/shared/ui/badge.tsx: 33
src/shared/ui/index.ts: 14,16,18,21,22,23,26,29,31,44,46,48,50,52,54,56,58,61,65,69,71,73,77,79,83,85,87,163
src/shared/ui/LoadingSkeletons.tsx: 86
src/shared/ui/SplitLayout.tsx: 15
```

### jscpd
0 confirmed. All 2657 jscpd findings are provisionally placed in High pending a `.jscpd.json` ignore-list fix and re-run (see High → jscpd above) — none could be confidently confirmed as same-FSD-slice duplication from the visible digest sample, since the visible sample contains no `src/` entries at all.

### madge
0. The sole detected cycle was promoted to High per the RESEARCH.md A2 spot-check (see High → madge above) — it does not qualify for this tier.

## Low

### structural
**todo-fixme (9, complete list):**
```
src/shared/lib/edge-function-contracts.test.ts:198 // TODO: Move callProcessPayment invocation tests to e2e/05-payments.spec.ts
src/shared/lib/edge-function-contracts.test.ts:241 // TODO: Move callSendReceiptEmail invocation tests to e2e/08-settings-receipt.spec.ts
src/entities/open-unit/model/queries.ts:2 // TODO(27-05): Remove this eslint-disable and the `db` cast below once
src/features/physical-count/model/usePhysicalCount.ts:2 // TODO(S1-06): Remove this eslint-disable and the `db` cast below once
src/entities/inventory/model/queries.ts:2 // TODO(S1-06): Remove this eslint-disable and the `db` cast below once
e2e/16-table-status.spec.ts:675 // TODO: Skipped because it requires two simultaneous browser contexts updating the same
e2e/16-table-status.spec.ts:684 // TODO: Skipped because Playwright's page.context().setOffline(true) stalls fetch()
e2e/18-modifier-notes-kds.spec.ts:403 'TODO: order_item_modifiers table does not exist in remote DB — '
e2e/18-modifier-notes-kds.spec.ts:419 'TODO: Tauri IPC (print_precheque command) is unavailable in Playwright browser mode. '
```

**Oversized files, >400 lines (51, complete list, `file:line-count`):**
```
src/shared/lib/domain.ts:2164
src/shared/lib/edge-function-contracts.ts:1358
src/entities/tab/model/queries.ts:1139
src/widgets/PaymentModal/ui/PaymentForm.tsx:1077
src/features/split-tab/ui/SplitTabSheet.tsx:840
src/shared/lib/domain.test.ts:772
src/entities/staff/model/queries.ts:755
src/shared/lib/agent/tools/posTools.ts:748
src/entities/resource/model/queries.ts:741
src/entities/open-unit/model/consume-open-unit.integration.test.ts:731
src/entities/tab/model/queries-reports.ts:725
src/features/reopen-tab/model/reopen-tab-rpc.integration.test.ts:724
src/widgets/PaymentModal/PaymentModal.test.tsx:683
src/features/export-report/model/useExportReport.ts:670
src/shared/lib/mocks.ts:651
src/entities/product/model/queries.ts:648
src/shared/lib/supabase-contracts.ts:635
src/features/manage-combos/ui/ComboBuilderForm.tsx:632
src/entities/tab/ui/TabDetail.stories.tsx:631
src/shared/lib/exporters/pdf.tsx:620
src/features/manage-modifier-groups/ui/ModifierGroupEditor.tsx:619
src/shared/lib/domain-helpers.test.ts:607
src/entities/caja/model/queries.ts:593
src/widgets/PaymentModal/ui/PaymentForm.test.tsx:572
src/features/edit-paid-tab/model/edit-paid-tab-rpc.integration.test.ts:572
src/shared/lib/result.ts:570
src/entities/tab/model/queries-reports.test.ts:554
src/entities/caja/model/tip-distribution-rpc.integration.test.ts:543
src/shared/lib/result.test.ts:532
src/features/process-refund/process-refund-rpc.integration.test.ts:523
src/entities/inventory/model/queries.ts:523
src/features/manage-categories/ui/CategoryTreeEditor.tsx:503
src/widgets/CajaDashboard/CajaDashboard.tsx:501
src/widgets/TableStatusPanel/index.tsx:493
src/entities/tab/ui/TabDetail.test.tsx:491
src/entities/tab/model/depletion.integration.test.ts:480
src/entities/staff/model/queries.staff-report.test.ts:478
src/entities/open-unit/model/open-unit-lifecycle.integration.test.ts:472
src/features/physical-count/model/usePhysicalCount.test.ts:466
src/features/edit-paid-tab/ui/EditPaidTabDialog.tsx:461
src/features/produce-prep-batch/model/produce-prep-batch.integration.test.ts:459
src/features/split-tab/split-tab-rpc.integration.test.ts:446
src/features/manage-products/ui/CatalogProductsTab.tsx:443
src/shared/lib/logger.ts:423
src/shared/lib/category-tree.test.ts:420
src/widgets/InventoryPagePanel.tsx:419
src/shared/lib/receipt-format.test.ts:414
src/features/manage-products/ui/ProductForm.tsx:405
src/entities/tab/ui/TabDetail.tsx:404
src/entities/tab/model/hourly-breakdown.integration.test.ts:403
src/widgets/TabDrawer/TabDrawer.test.tsx:402
```

**RESEARCH.md Assumption A4 — is 400 lines a meaningful cut in this codebase?** The oversized-file probe scanned 741 files with a 300-line floor (headroom above the 400-line Low-tier threshold). Actual distribution: **median file size (of the 74 files ≥300 lines the probe captured) = 475 lines**; **top-10 largest**: `domain.ts` (2164), `edge-function-contracts.ts` (1358), `entities/tab/model/queries.ts` (1139), `PaymentForm.tsx` (1077), `SplitTabSheet.tsx` (840), `domain.test.ts` (772), `entities/staff/model/queries.ts` (755), `agent/tools/posTools.ts` (748), `entities/resource/model/queries.ts` (741), `consume-open-unit.integration.test.ts` (731). Since the median of the captured tail (475) already sits above the 400-line cutoff, and the top of the distribution is dominated by two categories — (1) `domain.ts`/`edge-function-contracts.ts`, single-file Zod-schema/contract registries that are intentionally centralized per CLAUDE.md's "single source of truth" convention, and (2) `*.integration.test.ts`/`*.test.tsx` files, which grow with fixture/assertion volume rather than complexity — **400 lines reads as a real, non-arbitrary signal for the non-test, non-registry files in the list** (e.g. `PaymentForm.tsx` at 1077, `SplitTabSheet.tsx` at 840, `ComboBuilderForm.tsx` at 632, `ModifierGroupEditor.tsx` at 619 — all UI components mixing form state + validation + submission, plausible split candidates) but is a **weak signal for the registry and test files**, which should probably be evaluated on a different axis (schema count / assertion count) in a future pass rather than raw line count.

23 additional files fall in the 300–400-line "headroom" band the probe captured but which do not cross the checklist's 400-line Low-tier threshold — informational only, not listed as findings (see "Stated exclusions" in the header).

## Cross-check against existing trackers

*(Populated by Task 2.)*
