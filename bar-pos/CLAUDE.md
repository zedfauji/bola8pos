# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A bar/restaurant POS system built as a Tauri 2 desktop app (Windows, WebView2). Frontend is React 19 + TypeScript + Vite. Backend is Supabase (PostgreSQL + Auth + Realtime + RLS).

All source code lives in `bar-pos/`. Run all commands from `bar-pos/`.

## Commands

```bash
# Development
npm run dev          # Vite dev server (port 1420, Tauri mode)
npm run tauri dev    # Full Tauri desktop app

# Build
npm run build        # TypeScript check + Vite production build

# Code quality (run before committing)
npm run typecheck    # Strict TS check (no emit)
npm run lint         # ESLint (max-warnings: 0)
npm run lint:fix     # Auto-fix lint issues
npm run format       # Prettier on src/

# Testing — unit
npm run test                           # Vitest unit tests (run once)
npm run test:watch                     # Vitest unit tests (watch mode)
npm run test:ui                        # Vitest with browser UI
npm run test:coverage                  # Coverage report
npx vitest run src/path/to.test.ts     # Single test file

# Testing — E2E (Playwright)
npm run test:e2e                       # Full Playwright suite (requires dev server)
npm run test:e2e:report                # Open HTML report after a run
npx playwright test e2e/02-caja.spec.ts   # Single spec file
npx playwright test --headed           # Non-headless (watch browser)
npx playwright show-report             # Open last HTML report

# Component development
npm run storybook    # Storybook on port 6006

# Setup
npm run setup:dev    # Create dev users + seed data
```

## Architecture: Feature-Sliced Design (FSD)

The codebase follows strict FSD with enforced import boundaries. ESLint (`eslint-plugin-boundaries`) will fail if you violate the layer hierarchy.

**Import direction — each layer may only import from layers below it:**

```
app → pages → widgets → features → entities → shared
```

**Layer responsibilities:**

- `app/` — Providers, router, Tauri initialization, global CSS
- `pages/` — Thin route containers only; no logic, just layout + widgets
- `widgets/` — Composite UI panels composing features + entities (e.g., `OrderPanel`, `ProductGrid`)
- `features/` — One user action per folder (e.g., `add-item-to-tab/`, `process-payment/`); contains 1 mutation hook + 1 UI component
- `entities/` — Business domain models; each has `model/types.ts`, `model/store.ts`, `model/queries.ts`, `ui/`
- `shared/` — Zero business logic; UI primitives (`shared/ui/`), utilities (`shared/lib/`), constants

## Key Conventions

**Types:** Single source of truth is `src/shared/lib/domain.ts` (Zod schemas). Never manually write entity types — infer from Zod: `type Tab = z.infer<typeof TabSchema>`.

**Generated files — never edit manually:**

- `src/shared/lib/supabase.types.ts` — regenerate with `npx supabase gen types typescript`
- `src/shared/ui/` — shadcn components, add new ones via `npx shadcn@latest add <component>`

**Error handling:** All async operations return `Result<T>` from `src/shared/lib/result.ts` (`Ok(value)` / `Err(error)`). Use the logger from `src/shared/lib/logger.ts` for structured logging.

**State:**

- Zustand stores (`entities/*/model/store.ts`) — UI/local state and Supabase Realtime subscriptions
- TanStack Query hooks (`entities/*/model/queries.ts`) — all server state, use optimistic updates for mutations

**TypeScript:** Strict mode enforced. No `any`. Zod for all external data validation (API responses, user input).

**Styling:** Tailwind CSS with CSS variables for theming. Dark mode is default. Use shadcn/ui components from `shared/ui/` before building custom ones.

**Testing:**

- Unit: Vitest + React Testing Library. Co-locate `.test.ts` files with source. Property-based tests via `fast-check` for pure utilities.
- E2E: Playwright (`e2e/` directory). Config at `bar-pos/playwright.config.ts`. Videos + traces always recorded to `e2e-results/`. Tests require `.env.local` E2E credentials — see `CURSOR_VERIFICATION_PROMPT.md`.
- Storybook: Required for every new `shared/ui/` component.
- CI gate: `npm run test` (unit) must pass before any PR. `npm run test:e2e` is run manually before releases.

## Adding a New Feature

Follow the pattern in existing features (e.g., `src/features/add-item-to-tab/`):

1. Define/extend Zod types in `src/shared/lib/domain.ts`
2. Add entity model in `src/entities/<entity>/model/`
3. Create feature folder in `src/features/<action-name>/` with mutation hook + UI
4. Compose into a widget or page

Refer to `bar-pos/FSD-STRUCTURE.md` and `bar-pos/DOMAIN-CONTRACTS.md` for detailed patterns.

## Routes

All routes are registered in `src/app/router.tsx`. Protected by `<ProtectedRoute>`.

| Path                    | Page            | Notes                                     |
| ----------------------- | --------------- | ----------------------------------------- |
| `/home`                 | HomePage        | Big-box nav dashboard                     |
| `/pos`                  | PosPage         | Tab order entry                           |
| `/pool-tables`          | PoolTablesPage  | Pool table grid                           |
| `/pool-tables/:tableId` | TableStatusPage | Single table detail                       |
| `/inventory`            | InventoryPage   | Stock management (admin/manager)          |
| `/staff`                | StaffPage       | Staff management                          |
| `/reports`              | ReportsPage     | Caja reports (gated by `ReportsRoute`)    |
| `/settings`             | SettingsPage    | Hardware + receipt settings (admin only)  |
| `/rappi`                | RappiOrdersPage | Delivery orders                           |
| `/payments`             | PaymentsPage    | Payments history                          |
| `/login`                | LoginPage       | PIN login                                 |
| `/waitlist`             | WaitlistPage    | Walk-in queue management (manager+)       |
| `/rbac`                 | RbacPage        | Role & permission management (admin only) |
| `/kds`                  | KdsPage         | Kitchen KDS board (gated by `KdsRoute`)   |
| `/kds-bar`              | KdsBarPage      | Bar KDS board (bartender+)                |
| `/kitchen-prep`         | KitchenPrepPage | Batch chef prep production                |
| `/audit`                | AuditPage       | Audit log (gated by `AuditRoute`)         |

## Implemented Features (as of 2026-04-20)

- `add-item-to-tab`, `remove-item-from-tab`, `remove-tab-item` — order management
- `open-tab`, `close-tab`, `transfer-tab` — tab lifecycle
- `process-payment` — payment via edge function
- `start-pool-timer`, `stop-pool-timer`, `stop-and-move-table` — pool sessions
- `assign-pool-session-to-tab` — link pool billing to tab
- `void-order` — order voiding
- `adjust-inventory` — inventory decrement
- `manage-products` — product CRUD
- `manager-pin-gate` — PIN modal for manager-gated actions
- `clock-in-staff`, `clock-out-staff` — shift tracking
- `print-precheque` — receipt printing
- `produce-prep-batch`, `/kitchen-prep` page — batch chef prep production with ingredient depletion (Phase 5)
- `split-tab` (4 modes: evenly/item/person/amount) — SplitTabSheet with sub-tab pattern (Phase 6)
- `process-refund` — RefundSheet with manager PIN gate + optional inventory reversal (Phase 6)
- `add-waitlist-entry`, `notify-waitlist`, `seat-waitlist-party`, `mark-no-show`, `mark-cancelled` — FIFO waitlist queue with WhatsApp notifications (Phase 7)
- `split-payment` (multi-method) — up to 4 payment methods per tab close in a single atomic transaction; `payments.payment_group_id`/`split_index` tag legs of one checkout, `process_split_payment_atomic` RPC + `process-split-payment` edge function enforce all-or-nothing, `PaymentForm`'s split-mode toggle drives per-row method/amount/tip entry with a live remaining-balance display and sequential per-leg receipts (Phase 18)
- `tip-distribution-config` — admin-configurable floor/bar/kitchen tip split (`settings` key=`'tip_distribution'`, floor/bar/kitchen percentages, default 34/33/33, warn-but-allow if the sum isn't 100%); `tip_distribution_entries` is an append-only per-caja-close snapshot computed inside `close_caja_session` via largest-remainder allocation (floor > bar > kitchen tiebreak), pooling `payments.tip_amount` across all payment methods for the session; admin-only `'Tip Split'` Settings tab (`TipDistributionSettingsTab`) + read-only `'Tip Split'` Reports tab (`TipBucketDistributionPanel`), both named apart from the pre-existing per-staff `'Tip Distribution'` tab; this migration also bundles the missed `version + 1` bump fix for `close_caja_session` (Phase 15's version trigger was rejecting every caja close with `STALE_VERSION` before this fix) (Phase 19)
- Touch-target & focus-visible sweep — `focusEmphasis` CVA variant (`default | high`) on the base `Button`/`POSButton`; `touchSize` (44/56/72px) rollout across the pool-tables, pool-table-status, inventory, kitchen-prep, kds, and kds-bar pages; `ConfirmDialog`'s opt-in `confirmClassName` passthrough powering the two 72px/ring-4 destructive confirms (Stop pool session, Stop & Move); `e2e/44-focus-tab-order.spec.ts` regression-tests Tab order on ManagerPinDialog, the inventory filter/sort-header row, and the Batch Adjustment form (Phase 32)

## Key DB Tables (Remote Supabase)

| Table                           | Description                                          |
| ------------------------------- | ---------------------------------------------------- |
| `profiles`                      | Staff accounts + roles                               |
| `shifts`                        | Clock-in/out records                                 |
| `products` / `categories`       | Menu catalog                                         |
| `tabs` / `order_items`          | Orders                                               |
| `pool_tables` / `pool_sessions` | Pool table tracking                                  |
| `payments`                      | Payment records                                      |
| `inventory`                     | Stock levels (linked to `products` via `product_id`) |
| `caja_sessions`                 | Daily cash register sessions                         |
| `receipt_settings`              | Per-terminal receipt config                          |
| `rappi_orders`                  | Delivery order integration                           |
| `tip_distribution_entries`      | Immutable per-caja-close floor/bar/kitchen tip-split allocation snapshot |

## RBAC Actions

Defined in `src/shared/lib/rbac.ts`. Roles: `bartender < manager < admin`.

Key actions: `create_order`, `close_tab`, `void_order`, `view_reports`, `adjust_inventory`, `manage_products`, `manage_staff`, `manage_settings`, `manage_caja`, `transfer_tab`, `delete_tab`, `view_all_shifts`.

Settings page requires `manage_settings` (admin only). Inventory page requires `adjust_inventory` (manager+).

Writing the `tip_distribution` settings key is admin-only (existing settings RLS — no additional client-side gating). Every `close_caja_session` call records a `tip_distribution.compute` audit action (`record_audit`) alongside the existing `caja.close` action, capturing the computed floor/bar/kitchen amounts and the percentages that produced them.

## Offline Queue

Offline mutation queue is in `tabsStore.offlineQueue` (Zustand). `OfflineQueueProcessor` component replays queued actions on reconnect. Guard mutations with `isOnline()` from `@shared/lib/network`. `OfflineBanner` in `@shared/ui` surfaces connection state.

## Supabase

Realtime subscriptions are initialized in Zustand stores, not React components. Edge function contracts are defined in `src/shared/lib/edge-function-contracts.ts`. See `bar-pos/SUPABASE-CONTRACTS.md` for the full API contract.

**Missing generated types workaround:** When a new table or RPC exists in the DB but `supabase.types.ts` has not been regenerated yet, use `const db = supabase as any` at the file level with a file-level `/* eslint-disable */` comment. Regenerate types ASAP with `npx supabase gen types typescript --local > src/shared/lib/supabase.types.ts` and remove the cast.

**Migration DOWN scripts:** Phase 8 (S6) migrations include DOWN scripts. Pre-Phase-8 migrations (52 of 76) lack DOWN scripts — retroactive addition is out of scope as Supabase Cloud has no automated rollback mechanism.

## E2E Test Suite (`bar-pos/e2e/`)

23 spec files — all must pass before release:
`01-ci`, `02-caja`, `03-tab-order`, `04-pool-timer`, `05-payments`, `06-transfer`, `07-reports`, `08-settings-receipt`, `09-rbac`, `10-inventory`, `11-offline`, `12-infrastructure`, `13-tauri-build`, `14-manual-stubs`, `15-home-navigation`, `16-table-status`, `17-payment-pane`, `38-audit-logs`, `39-concurrent-edits`, `40-kds-bar`, `41-split-payment`, `42-tip-distribution`, `44-focus-tab-order`

Auth helpers are in `e2e/helpers/auth.ts`. Use `loginAs(page, 'admin')` — admin PIN is `0000`.

## TypeScript Gotchas

**`exactOptionalPropertyTypes` is enabled.** Never write `prop?: string` for mutation inputs — write `prop: string | undefined` instead. Optional chaining and default values still work normally.

**AppErrorCode** — the full union is in `src/shared/lib/result.ts`. When adding a new error code, add it to that union first, then use `const appErr: AppError = { code: 'YOUR_CODE' as AppErrorCode, ... }`.

Current codes: `NETWORK_OFFLINE | AUTH_REQUIRED | AUTH_FORBIDDEN | NOT_FOUND | VALIDATION_ERROR | DUPLICATE_ENTRY | TAB_ALREADY_CLOSED | SESSION_STILL_RUNNING | PAYMENT_DECLINED | PAYMENT_ALREADY_PROCESSED | INVENTORY_NEGATIVE | CAJA_CLOSED | OPEN_TABS_EXIST | POOL_TABLE_OCCUPIED | SUPABASE_ERROR | TAURI_ERROR | UNKNOWN_ERROR`

---

## Paperclip Sprint Team Standards

> This section was appended by the Paperclip company setup generator (2026-04-21).
> It records the authoritative project standards for all Paperclip agents.
> Do not edit this section manually — update it by revising `.paperclip/skills/dev-standards/SKILL.md`.

### Actual Stack (from package.json / tsconfig.json)

| Technology      | Version                                        | Notes                                                                 |
| --------------- | ---------------------------------------------- | --------------------------------------------------------------------- |
| React           | 19.1.0                                         | Function components only; hooks-only                                  |
| TypeScript      | 5.8.3                                          | strict mode; `exactOptionalPropertyTypes: true`                       |
| Desktop runtime | Tauri 2 (`@tauri-apps/api ^2`)                 | **NOT Electron** — IPC via `invoke()` from `@tauri-apps/api/core`     |
| Build tool      | Vite 7                                         |                                                                       |
| Server state    | TanStack Query v5 (`@tanstack/react-query ^5`) | All server state via TanStack Query                                   |
| Local/UI state  | Zustand v5                                     | Realtime subscriptions initialized in stores                          |
| Validation      | Zod v4                                         | Single source of truth for domain types in `src/shared/lib/domain.ts` |
| Styling         | Tailwind CSS v3 + shadcn/ui                    | Do not introduce new CSS systems                                      |
| Unit tests      | Vitest v4 + React Testing Library v16          | `npm run test`                                                        |
| Property-based  | fast-check v4                                  | Use for billing math, boundary conditions                             |
| E2E             | Playwright v1.59                               | `npm run test:e2e`; specs in `bar-pos/e2e/`                           |
| Storybook       | v10                                            | Required for new `shared/ui/` components                              |

### Architecture

Feature-Sliced Design (FSD). Import direction: `app → pages → widgets → features → entities → shared`. Enforced by `eslint-plugin-boundaries`. A boundary violation is a blocking lint error.

### TypeScript Gotchas (Critical)

- **`exactOptionalPropertyTypes: true`** — Never write `prop?: string` for mutation inputs. Write `prop: string | undefined`.
- **`noUncheckedIndexedAccess: true`** — Array access returns `T | undefined`. Always check before use.
- **No `any`** without a justification comment on the same line.

### Forbidden Patterns

```typescript
// ❌ Manual type interfaces for domain entities
interface Tab { id: string }  // use Zod schema in domain.ts instead

// ❌ Ignored Supabase error
const { data } = await supabase.from('tabs').select();  // error must be handled

// ❌ console.log
console.log('debug');  // use src/shared/lib/logger.ts

// ❌ Hardcoded secrets
const key = 'eyJ...';

// ❌ Electron IPC patterns (this is Tauri 2)
ipcRenderer.send('event');
contextBridge.exposeInMainWorld(...);

// ❌ Service-role key in renderer
createClient(url, SUPABASE_SERVICE_ROLE_KEY);

// ❌ any without justification
const x: any = response;
```

### Commit Convention

Conventional Commits: `<type>(<ticket-id>): <description>`
Types: `feat` | `fix` | `refactor` | `test` | `chore`
No `--no-verify`. Pre-commit hooks (husky + lint-staged) must pass.

### Test Commands

```bash
cd bar-pos
npm run typecheck          # tsc --noEmit — must pass before every commit
npm run lint               # ESLint max-warnings: 0
npm run test               # Vitest unit (run once)
npm run test:e2e           # Playwright — requires .env.local E2E credentials
npx vitest run src/path/to/file.test.ts   # single test file
npx playwright test e2e/02-caja.spec.ts   # single E2E spec
```

### Paperclip Agent Files

```
.paperclip/
  company.yaml              # Import into Paperclip UI
  AGENTS.md                 # Shared behavioral contract (all agents read this)
  agents/
    pm.md                   # PM system prompt
    fullstack-engineer.md   # Dev system prompt
    test-engineer.md        # QA system prompt
  skills/
    sprint-decomposition/   # PM: brief → tickets
    ticket-format/          # All: canonical ticket schema
    dev-standards/          # Dev: React/TS/Tauri/Supabase rules
    qa-playbook/            # QA: test pyramid, integration, E2E
    failure-report/         # QA: exact failure report format
  templates/
    ticket.template.md
    sprint-brief.template.md
    dod-checklist.template.md
```
