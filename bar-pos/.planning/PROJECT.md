# Bar POS (bola8pos)

## What This Is

Bar/restaurant POS system built as a Tauri 2 desktop app (Windows, WebView2). Frontend React 19 + TypeScript + Vite, backend Supabase (PostgreSQL + Auth + Realtime + RLS). Covers tab-based order entry, pool-table timers/billing, inventory/ingredient depletion, kitchen prep, waitlist, RBAC, reporting, and auto-updates for on-premise bar/pool-hall operators.

## Core Value

Reliable, offline-tolerant order-to-payment flow for a single bar/pool-hall location — orders and pool-table billing must stay correct even under concurrent terminal edits and flaky connectivity.

## Testing Policy (LOCKED, 2026-08-07)

All testing, verification, and UAT must be automated Playwright E2E, headless by default. No phase may carry `human_needed` verification or a manual UAT scenario as an accepted end state — see `.planning/decisions/2026-08-07-mandatory-automated-testing-no-manual-verification.md` and `bar-pos/CLAUDE.md`'s "Testing & Verification Policy" section.

## Current State

**Shipped:** v2.2 — UI Standardization (2026-07-17). Full archive: `.planning/milestones/v2.2-ROADMAP.md`, `.planning/milestones/v2.2-REQUIREMENTS.md`, `.planning/milestones/v2.2-MILESTONE-AUDIT.md`.

App-wide UI consistency pass across all 17 routes: single `PageContainer` shell (Phase 30), `shared/ui` primitives + Tailwind tokens replacing raw markup on non-payment pages (Phase 31), 44/56/72px touch targets + visible focus-ring states on operational pages (Phase 32) and payment-critical pages (Phase 33/33.1), a masked-region Playwright visual-regression baseline for all 17 routes (Phase 34), and a `DESIGN-TOKENS.md` reference doc + error-severity drift lint preventing regression (Phase 35). 22/22 requirements satisfied; one accepted tech-debt item — Phase 33's human visual/focus-ring parity spot-check on 7 payment-critical surfaces was deferred by user request (automated E2E gate already green; tracked in `.planning/phases/33-payment-critical-page-sweep-isolated/33-UAT.md`).

**Known gap (not part of v2.2, surfaced during its close):** This was the project's first-ever formal milestone close. Several earlier phases (01, 03, 06, 07, 09, 12) carry unresolved `human_needed`/`gaps_found` verification status or partial UAT scenarios that predate v2.2 and were never gated on a milestone close before now — acknowledged and logged in `.planning/STATE.md` under Deferred Items rather than blocking this close.

**Phase 36 complete (2026-07-25):** Development environment migrated from Windows to Ubuntu — native Tauri shell builds, links, and runs on Ubuntu (human-verified), repeatable `scripts/setup-ubuntu.sh` bootstrap, D-12 CRLF/husky root cause fixed (`.gitattributes`, hook cwd guard), toolchain mirrored into a new `tauri-build` CI job, Ubuntu documented as a supported dev OS. 3 pre-existing, OS-independent issues surfaced during the migration (misplaced `.github/workflows/` directory, 2 pre-existing `tsc` errors, inert git hooks) were deliberately left unfixed as out of this phase's scope and captured as backlog todos in `.planning/todos/pending/`. Phase 37 (Windows VM for native WebView2 testing/release builds) depends on this phase and is next in the roadmap, though `/gsd-progress` may route to earlier incomplete phases first per its resume-invariant check.

**Phase 25 complete (2026-07-28):** Receipt item grouping — one shared `groupOrderItemsForReceipt.ts` utility (Category → Item → Modifiers, D-01) now backs the thermal receipt, pre-cheque, KDS card, and Caja Report PDF top-products table. `process-payment` edge function extended to supply category/modifier identity; `get_caja_report` migration adds the category dimension and fixes a pre-existing snake_case/camelCase mismatch that had been silently breaking every Caja Report load. Verification: 7/7 must-haves passed, full regression suite green (1325/1340), Task 4's cross-surface human-verify checkpoint approved from documented walkthrough evidence (screenshots not retained on this machine). Surfaced 3 out-of-scope todos during that walkthrough (payment-preview tax-line mismatch, print-popup fallback blocked by Chromium transient-activation rules, in-app PDF export requiring the Tauri runtime) — tracked separately in `.planning/todos/pending/`, not phase-25 gaps. Code review found 4 non-blocking warnings (control-byte sanitizer coverage, locale-unaware category sort, KDS React key stability); fix pass in progress.

**Phase 10 complete (2026-08-03):** AI Slob Technical Debt Checklist — audit/documentation only, no remediation. `npm run audit:tech-debt` wired knip, jscpd, and madge (new devDependencies) alongside the four pre-existing quality gates plus 3 grep/wc probes (unjustified `as any`, TODO/FIXME, oversized files), covering all six D-02 structural-smell categories. One full whole-codebase audit run reduced to 11 compact digests; `10-CHECKLIST.md` (737 lines) synthesizes them severity-first (Blocking 181 / High 4694 / Medium 37 / Low 60 findings), every entry cited `file:line`, cross-checked against the 5 pending todos and Phase 38 without merging (D-05), all category counts reconciled against raw reports. Verification: 12/12 must-haves passed. Execution hit real friction worth knowing about before Phase 11 (remediation) starts: the E2E leg of the audit pipeline OOM-killed repeatedly under host desktop memory pressure — resolved by splitting the 374-test suite into 59 per-spec-file headless runs rather than one monolithic invocation; and `.audit-tmp/`'s raw reports/digests are gitignored by design and do not survive across worktree-isolated plan waves, requiring the orchestrator to regenerate them directly in the main checkout for the final synthesis plan — a real cross-wave artifact-handoff gap worth designing around if this audit is re-run. Code review of the audit tooling itself found 5 non-blocking warnings (madge exclude-regex anchoring bug, `as any` probe missing bare `: any` annotations, cwd-fragility, stale `$OUT` reuse, `.gitignore` gap for `graphify-out/`) — tracked in `10-REVIEW.md`, not fixed as part of this audit-only phase.

## Next Milestone Goals

No milestone is currently active. Candidates carried over from the pre-v2.2 backlog (unstarted, ROADMAP.md Phases 3, 6, 8, 9, 10, 21-28) — scope a new milestone with `/gsd-new-milestone` rather than resuming these as loose phases, since several (21 i18n, 28 money-formatter) have inter-dependencies worth re-validating before replanning.

## Requirements

### Validated

- ✓ Unified stock ledger, category tree, modifier groups, combo flags — Phase 1
- ✓ Customer-visible combos (pool-time bundles, multi-slot pricing) — Phase 2
- ✓ Recipes + atomic ingredient depletion on sale — Phase 4
- ✓ Kitchen prep batches + Michelada cocktail extension — Phase 5
- ✓ FIFO waitlist + WhatsApp (WasenderAPI) notifications — Phase 7
- ✓ Lint/test/typecheck CI green baseline + CVE risk docs — Phase 11
- ✓ Dedicated `/rbac` admin-only management page — Phase 12
- ✓ DB-level RBAC (Supabase RLS aligned to frontend role hierarchy) — Phase 13
- ✓ Audit logs table (`audit_logs` + `record_audit` helper + `/audit` page) — Phase 14
- ✓ Optimistic concurrency (`version` column + `STALE_VERSION` conflict handling) on tabs/pool_sessions/caja_sessions — Phase 15
- ✓ Kitchen/Bar split routing (`category.routing`, `/kds-bar`) — Phase 16
- ✓ Modifier → inventory depletion rules — Phase 17
- ✓ Multi-method split payment on close — Phase 18
- ✓ Tip distribution config — Phase 19
- ✓ Promotions engine — Phase 20
- ✓ App-wide UI consistency: shared shell, `shared/ui` primitives, design tokens, touch/focus targets, visual-regression baseline, drift lint — v2.2 (Phases 29-35, +33.1)
- ✓ i18n multi-language: `react-i18next` + es-MX/en-US catalogs, `profiles.locale` preference, no-grandfather ESLint gate banning hardcoded UI strings — Phase 21
- ✓ Edit paid ticket + history: whitelisted-field `edit_paid_tab` RPC (manager PIN + reason + inventory-correct), `EditPaidTabDialog`, `/edit-history` audit view — Phase 22
- ✓ Reopen closed ticket: manager-only `reopen_tab` RPC (`reopened_void` payment status, offsetting caja entry, 24h/2x-reopen cap, `tab.reopen` audit action), `ReopenTabDialog` + PaymentPane wiring — Phase 23
- ✓ Receipt item grouping (2-level, actually 3: Category → Item → Modifiers): shared `groupOrderItemsForReceipt.ts` utility consumed by thermal receipt, pre-cheque, KDS card, and Caja Report PDF top-products table; `process-payment` edge function extended with category/modifier data — Phase 25

### Active

(None — no milestone currently in progress. See Next Milestone Goals.)

### Backlog (unstarted, not yet scoped into a milestone)

- [ ] Ingredient entity + canonical `record_stock_movement` RPC — Phase 3
- [ ] Split bill (4 modes) + PIN-gated refunds — Phase 6
- [ ] Operator analytics reports + E2E flake cleanup — Phase 8
- [ ] Tauri auto-update service (GitHub Releases) — Phase 9
- [ ] AI slob technical debt audit — Phase 10
- [ ] Operational reports suite + CSV export — Phase 24
- [ ] Floating tables (`is_temp` resources) — Phase 26
- [ ] One-shot inventory (cigarette-box pattern) — Phase 27
- [ ] Money formatter utility — Phase 28

### Out of Scope

- Multi-location/franchise support — not requested; single-location on-prem deployment assumed
- Electron packaging — Tauri 2 chosen for smaller footprint/native WebView2; do not reintroduce Electron IPC patterns
- Automated DOWN-migration backfill for pre-Phase-8 migrations (52 of 76 lack DOWN scripts) — Supabase Cloud has no automated rollback mechanism, retroactive addition out of scope

## Context

- Feature-Sliced Design (FSD) architecture, enforced via `eslint-plugin-boundaries`
- Cross-pollination phases 14–28 were derived from comparing this codebase against a sibling project `billar-pos` (`.planning/comparison/POS-COMPARISON.md`)
- Phases 1, 2, 4, 5, 7, 11-23, 29-35 (+33.1) are complete (29/36 total phase directories); Phases 3, 6, 8, 9, 10, 24-28 remain unstarted backlog
- Auto-updater (Phase 9) targets GitHub Releases; signing key pair already generated and wired into CI, frontend hook + dialog not yet built
- 27-file drift-lint (`eslint-rules/no-ui-drift.js`) now guards `src/pages|widgets|features` against raw `<button>`/`<input>`, hardcoded hex/rgb, and arbitrary-value Tailwind spacing — any future phase touching these layers must stay conformant or add a documented exemption comment

## Constraints

- **Tech stack**: Tauri 2 + React 19 + TypeScript strict + Supabase — locked, do not introduce Electron or alternate backends
- **TypeScript**: `exactOptionalPropertyTypes: true` and `noUncheckedIndexedAccess: true` enforced — see CLAUDE.md gotchas
- **Testing**: `npm run test` (Vitest) must pass before any PR; `npm run test:e2e` (Playwright, 17+ specs) run manually before releases
- **Migrations**: Supabase Cloud has no automated rollback — DOWN scripts required only from Phase 8 (S6) onward

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Phase numbering is GSD-native; `Source` field preserves original S1–S6 sprint IDs | Roadmap merges an 8-phase PRD sprint plan with later ad-hoc phases (9–28) | ✓ Good |
| xlsx CVEs (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9) risk-accepted, not patched | Outbound write-only usage, no untrusted `XLSX.read()`; no upstream fix available | ✓ Good — documented in `.planning/decisions/xlsx-cve-risk-accept.md` |
| `role_permissions` table + RLS replaces static RBAC checks | Frontend `rbac.ts` role map needed DB-level enforcement parity | ✓ Good |
| Optimistic concurrency via `version` column + custom SQLSTATE (`P0V01`/`P0V02`) rather than row locking | Multi-terminal concurrent edits need conflict detection without blocking | ✓ Good |
| Phases 14–28 scoped from cross-pollination against `billar-pos` sibling repo | Avoid re-deriving requirements already solved elsewhere | ✓ Good — Phases 14-20 shipped; 21-28 remain in backlog |
| v2.2 UI Standardization risk-tiered rollout (audit → shell → non-payment sweep → touch/focus → payment-critical sweep → visual baseline → guardrails) | Payment-critical surfaces are highest blast-radius; prove the fix pattern on low-risk pages first | ✓ Good — zero regressions across all 5 required + 3 secondary E2E gate specs |
| Phase 33's human visual/focus-ring parity spot-check deferred at milestone close rather than blocking | User explicitly chose to verify later; automated E2E gate for the same surfaces already passes | ⚠️ Revisit — run the spot-check manually, then update `33-UAT.md`/`33-VERIFICATION.md` |
| Milestone-close artifact audit surfaced 6 pre-v2.2 phases (01, 03, 06, 07, 09, 12) with unresolved verification/UAT gaps | This was the project's first formal milestone close — nothing had gated on these before | ⚠️ Revisit — resolve or formally accept before the next milestone close, tracked in `.planning/STATE.md` Deferred Items |
| Phase 23 CR-01 (reopen_tab double-counted its offsetting caja expense on a tab's 2nd reopen) fixed via a new migration (`CREATE OR REPLACE FUNCTION`), not an edit to the already-pushed original migration | The buggy migration was already live on remote Supabase before code review caught it — editing it in place would drift migration history from remote state | ✓ Good — same pattern as Phase 22's post-review CR-01 fix; regression test added and passing |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-03 after Phase 10 (AI Slob Technical Debt Checklist) — audit-only, 3/3 plans, 12/12 verification criteria passed, 10-CHECKLIST.md delivered*
