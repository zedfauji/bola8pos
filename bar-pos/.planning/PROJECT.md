# Bar POS (bola8pos)

## What This Is

Bar/restaurant POS system built as a Tauri 2 desktop app (Windows, WebView2). Frontend React 19 + TypeScript + Vite, backend Supabase (PostgreSQL + Auth + Realtime + RLS). Covers tab-based order entry, pool-table timers/billing, inventory/ingredient depletion, kitchen prep, waitlist, RBAC, reporting, and auto-updates for on-premise bar/pool-hall operators.

## Core Value

Reliable, offline-tolerant order-to-payment flow for a single bar/pool-hall location — orders and pool-table billing must stay correct even under concurrent terminal edits and flaky connectivity.

## Current Milestone: v2.2 UI Standardization

**Goal:** App-wide UI consistency pass — enforce existing shadcn/Tailwind conventions across every page; no new design system.

**Target features:**
- Component consistency (replace one-off UI with `shared/ui` primitives)
- Design tokens/spacing/color discipline against the existing Tailwind theme
- Layout/navigation shell consistency across all 12 routes
- Accessibility + touch-target consistency (focus states, tap sizes, keyboard nav)
- ✓ Playwright screenshot-diff visual regression suite — Phase 34 (isolated `playwright.visual.config.ts`, 43 masked baselines across admin/bartender/manager, manual-only two-run zero-diff gate)

## Requirements

### Validated

- ✓ Unified stock ledger, category tree, modifier groups, combo flags — Phase 1
- ✓ Customer-visible combos (pool-time bundles, multi-slot pricing) — Phase 2
- ✓ Recipes + atomic ingredient depletion on sale — Phase 4
- ✓ FIFO waitlist + WhatsApp (WasenderAPI) notifications — Phase 7
- ✓ Lint/test/typecheck CI green baseline + CVE risk docs — Phase 11
- ✓ Dedicated `/rbac` admin-only management page — Phase 12
- ✓ DB-level RBAC (Supabase RLS aligned to frontend role hierarchy) — Phase 13
- ✓ Optimistic concurrency (`version` column + `STALE_VERSION` conflict handling) on tabs/pool_sessions/caja_sessions — Phase 15

### Active

- [ ] Ingredient entity + canonical `record_stock_movement` RPC — Phase 3
- [ ] Kitchen prep batches + Michelada cocktail extension — Phase 5
- [ ] Split bill (4 modes) + PIN-gated refunds — Phase 6
- [ ] Operator analytics reports + E2E flake cleanup — Phase 8
- [ ] Tauri auto-update service (GitHub Releases) — Phase 9
- [ ] AI slob technical debt audit — Phase 10
- [ ] Audit logs table (`audit_logs` + `record_audit` helper + `/audit` page) — Phase 14
- [ ] Kitchen/Bar split routing (`category.routing`, `/kds-bar`) — Phase 16
- [ ] Modifier → inventory depletion rules — Phase 17
- [ ] Multi-method split payment on close — Phase 18
- [ ] Tip distribution config — Phase 19
- [ ] Promotions engine — Phase 20
- [ ] i18n (es-MX/en-US) — Phase 21
- [ ] Edit paid ticket + history — Phase 22
- [ ] Reopen closed ticket — Phase 23
- [ ] Operational reports suite + CSV export — Phase 24
- [ ] Receipt item grouping (2-level) — Phase 25
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
- Phases 1–13, 15 are complete; Phase 14 (Audit Logs) is a hard dependency for several later phases (16, 17, 22, 23, 24, 27)
- Auto-updater (Phase 9) targets GitHub Releases; signing key pair already generated and wired into CI

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
| Phases 14–28 scoped from cross-pollination against `billar-pos` sibling repo | Avoid re-deriving requirements already solved elsewhere | — Pending (phases not yet executed) |

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
*Last updated: 2026-07-14 — Phase 34 complete: isolated Playwright visual-regression suite (`playwright.visual.config.ts`) with 43 masked local-only baselines across admin/bartender/manager roles (17/11/14 routes), two-consecutive-run zero-diff gate verified*
