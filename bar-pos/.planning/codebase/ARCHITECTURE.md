# Architecture

**Analysis Date:** 2026-04-16

## Pattern Overview

**Overall:** Single-page React application (Vite) organized as **Feature-Sliced Design (FSD)** with **Supabase** as the backend, **TanStack Query** for async server state, **Zustand** for client/UI and some domain snapshots, and an optional **Tauri** desktop shell. Project rules live in `.cursor/rules/architecture-fsd.mdc` and define strict import boundaries.

**Key Characteristics:**
- Layered composition: `app` → `pages` → `widgets` → `features` → `entities` → `shared` (lower layers never import higher).
- **Pages are thin:** compose widgets only; no data-fetching or business logic in page files.
- **Entities** own Zod-shaped types, Zustand slices, and TanStack Query hooks that call Supabase.
- **Features** encode one user verb phrase per folder (e.g. `open-tab`, `close-tab`); they coordinate hooks/stores but do not import other features.

## Layers

**`app/` (application shell):**
- Purpose: Bootstrap React, global providers, routing, route guards.
- Contains: `App.tsx`, `providers.tsx`, `router.tsx`, `ProtectedRoute.tsx`, global styles.
- Depends on: `pages`, `widgets`, `features`, `entities`, `shared` (via path aliases).
- Used by: Browser/Tauri loads `bar-pos/src/main.tsx`, which renders `App`.

**`pages/` (route-level composition):**
- Purpose: One default export per route folder (`index.tsx`); layout and widget placement only.
- Contains: Thin page components under `bar-pos/src/pages/*/` (e.g. `pos`, `login`, `pool-tables`).
- Depends on: `widgets`, `features`, `entities`, `shared` only as needed for composition.
- Used by: `bar-pos/src/app/router.tsx` lazy-loads each page.

**`widgets/` (composite UI blocks):**
- Purpose: Assemble features + entities into panels (order rail, drawers, modals, nav).
- Contains: `OrderPanel`, `TabDrawer`, `PaymentModal`, `AppNav`, `PINLoginForm`, `EmployeeSelector`, etc. under `bar-pos/src/widgets/`.
- Depends on: `features`, `entities`, `shared` — not `pages` or `app`.
- Used by: Pages (e.g. `bar-pos/src/pages/pos/index.tsx` composes `ProductGrid`, `OrderPanel`, `TabDrawer`).

**`features/` (user actions):**
- Purpose: One folder per action; `model/` (hooks, local stores) and `ui/` (buttons, sheets).
- Contains: `open-tab`, `add-item-to-tab`, `close-tab` under `bar-pos/src/features/`.
- Depends on: `entities`, `shared` only; **no cross-feature imports** per FSD rules.
- Used by: Widgets and sometimes entity UI when the action is triggered from there.

**`entities/` (domain slices):**
- Purpose: Types + validation, Zustand stores, TanStack Query (`queries.ts`), read-oriented UI.
- Contains: `tab`, `product`, `pool-table`, `staff`, `inventory`, `payment` under `bar-pos/src/entities/`.
- Depends on: `shared` only (Supabase client, types, helpers, logger).
- Used by: `features`, `widgets`, `pages` (composition), `app` (`AuthProvider` in `providers.tsx`).

**`shared/` (infrastructure and primitives):**
- Purpose: Supabase singleton, generated DB types, logger, Result helpers, shadcn-style UI kit, test utilities, optional realtime wiring.
- Contains: `bar-pos/src/shared/lib/*`, `bar-pos/src/shared/ui/*`, `bar-pos/src/shared/config/constants.ts`.
- Depends on: External packages only (no imports from `entities`/`features`/etc.).
- Used by: All upper layers.

## Data Flow

**Application bootstrap:**

1. `bar-pos/src/main.tsx` mounts `<App />` into `#root`.
2. `bar-pos/src/app/App.tsx` wraps children with `Providers` then `Router`.
3. `bar-pos/src/app/providers.tsx` creates a module-scoped `QueryClient` (staleTime 30s, single retry, no refetch on focus), wraps with `QueryClientProvider`, then `AuthProvider` from `bar-pos/src/entities/staff/model/AuthContext.tsx`. On unmount it calls `supabase.removeAllChannels()`.
4. `bar-pos/src/app/router.tsx` uses `BrowserRouter`, `Suspense`, and `react-router-dom` `Routes` with lazy page imports.

**Authenticated navigation:**

1. Protected routes wrap page elements with `bar-pos/src/app/ProtectedRoute.tsx`.
2. `ProtectedRoute` reads `useAuthStore` from `bar-pos/src/entities/staff/model/authStore.ts` (`isAuthenticated`); unauthenticated users are redirected to `/login`.

**Reading server state (typical POS screen):**

1. A widget (e.g. `bar-pos/src/widgets/OrderPanel/OrderPanel.tsx`) reads Zustand (`useTabStore` for `selectedTabId`) and calls entity query hooks such as `useTabDetail` from `bar-pos/src/entities/tab/model/queries.ts`.
2. Query `queryFn` uses the shared `supabase` client from `bar-pos/src/shared/lib/supabase.ts`, maps rows through Zod schemas in `bar-pos/src/entities/tab/model/types.ts`, and returns typed domain objects.
3. UI renders loading/error/data from TanStack Query; local dialog open state may live in the widget (`useState`).

**Mutations and cache (example: open tab):**

1. `bar-pos/src/features/open-tab/model/useOpenTab.ts` calls `useCreateTab()` from entity queries and `mutation.mutateAsync`.
2. On success it updates UX via `useTabStore` (`selectTab`, `openDrawer`) and logs via `bar-pos/src/shared/lib/logger.ts`.
3. On failure it returns a structured `{ ok: false, error }` object.

**Mutations (example: close tab):**

1. `bar-pos/src/features/close-tab/index.ts` exports `useCloseTab`, which uses `useMutation` with an inline `supabase.from('tabs').update(...)` (still feature-owned), reads pool session state via `selectSessionsByTabId` from `bar-pos/src/entities/pool-table/model/store.ts`, invalidates `tabKeys` from tab queries, and updates tab store selection.

**Auth/session context:**

1. `AuthProvider` subscribes to `supabase.auth` session and loads `profiles` and open `shifts` for the signed-in user.
2. PIN/staff selection flow uses `authStore` and login widgets (`EmployeeSelector`, `PINLoginForm`).

**State management:**
- **Server state:** TanStack Query in `entities/*/model/queries.ts` (query key factories such as `tabKeys` in `bar-pos/src/entities/tab/model/queries.ts`).
- **Client and synced lists:** Zustand (`create`, sometimes `persist`) in `entities/*/model/store.ts` — e.g. `useTabStore` documents that `loadTabs` replaces lists from query results and `handleRealtimeUpdate` applies realtime payloads.
- **Feature-local cart state:** `bar-pos/src/features/add-item-to-tab/model/cartStore.ts` (Immer middleware in Zustand).

**Supabase Realtime (library vs. wiring):**
- `bar-pos/src/shared/lib/supabase-realtime.ts` exposes `registerRealtimeHandlers` and `setupRealtimeSubscriptions` to push Postgres changes into registered store handlers. As of this analysis, **no file under `bar-pos/src/` imports these functions** (only the module defines them), so realtime channels are not active from the app layer until something calls setup.

## Key Abstractions

**Entity query module (`queries.ts`):**
- Purpose: Single place per aggregate for `useQuery` / `useMutation`, Supabase access, cache keys, and invalidation targets.
- Examples: `bar-pos/src/entities/tab/model/queries.ts`, `bar-pos/src/entities/product/model/queries.ts`, `bar-pos/src/entities/staff/model/queries.ts`, `bar-pos/src/entities/pool-table/model/queries.ts`, `bar-pos/src/entities/inventory/model/queries.ts`.
- Pattern: Query key factory object + hooks; errors thrown from `queryFn` / mutation for TanStack to surface.

**Entity store (`store.ts`):**
- Purpose: UI selection, drawer visibility, lists mirrored from server or realtime, domain actions returning `Result` from `bar-pos/src/shared/lib/result.ts`.
- Examples: `bar-pos/src/entities/tab/model/store.ts`, `bar-pos/src/entities/pool-table/model/store.ts`, `bar-pos/src/entities/staff/model/authStore.ts`.
- Pattern: Zustand `create`; tab store uses `persist` middleware.

**Feature hook:**
- Purpose: Orchestrate one user-facing action across mutation + stores + logging.
- Examples: `bar-pos/src/features/open-tab/model/useOpenTab.ts`, `bar-pos/src/features/close-tab/index.ts` (`useCloseTab`).
- Pattern: Wrap entity mutations/queries; avoid importing sibling features.

**Supabase client:**
- Purpose: Typed `createClient<Database>` singleton and row type aliases.
- Examples: `bar-pos/src/shared/lib/supabase.ts`, types in `bar-pos/src/shared/lib/supabase.types.ts` (generated).
- Pattern: `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — throws if missing.

**Logger + Tauri bridge:**
- Purpose: Structured namespaced events (`category.action`); transports include console, optional Tauri file write, optional remote batch to `/functions/v1/ingest-logs`.
- Examples: `bar-pos/src/shared/lib/logger.ts`, instantiated context in `bar-pos/src/shared/lib/logger-instance.ts`.
- Pattern: Dynamic `import('@tauri-apps/api/core')` then `invoke('write_log', { entry: JSON.stringify(entry) })` when `__TAURI__` is present and not in development.

## Entry Points

**Vite / web shell:**
- Location: `bar-pos/src/main.tsx`
- Triggers: Page load in browser or Tauri webview.
- Responsibilities: `createRoot`, `StrictMode`, render `App`, import `bar-pos/src/app/globals.css`.

**React application root:**
- Location: `bar-pos/src/app/App.tsx`
- Triggers: Rendered from `main.tsx`.
- Responsibilities: Nest `Providers` and `Router`.

**Router:**
- Location: `bar-pos/src/app/router.tsx`
- Triggers: In-app navigation.
- Responsibilities: Route table (`/login`, `/pos`, `/pool-tables`, `/inventory`, `/staff`, `/reports`), lazy pages, default redirect `/` → `/pos`.

**Tauri native entry:**
- Location: `bar-pos/src-tauri/src/main.rs` → `bar_pos_lib::run()` in `bar-pos/src-tauri/src/lib.rs`
- Triggers: Desktop app start.
- Responsibilities: Tauri builder; current `invoke_handler` registers `greet` only. A separate `write_log` command implementation exists in `bar-pos/src-tauri/src/commands/logger.rs` but is **not** registered in `lib.rs` alongside `greet`, so frontend `invoke('write_log', ...)` and the Rust command may be out of sync until the handler list is updated.

## Error Handling

**Strategy:** Mix of thrown errors in TanStack Query paths, `Result` types for store-level operations, and feature-level `{ ok, error }` objects for user-initiated flows; toasts in some features (`close-tab` uses `sonner`).

**Patterns:**
- Query/mutation `queryFn` / `mutationFn`: throw `Error` with message on Supabase failure (see `bar-pos/src/entities/tab/model/queries.ts`).
- Zustand entity stores: return `ok` / `err` from `bar-pos/src/shared/lib/result.ts` for predictable outcomes (`useTabStore` `openTab`, etc.).
- Feature hooks: try/catch around `mutateAsync`, log with `logger`, return discriminated union results (`useOpenTab`).

## Cross-Cutting Concerns

**Logging:**
- `createLogger` in `bar-pos/src/shared/lib/logger.ts` with context, level gating, console pretty-print in dev, optional Tauri and remote transports.

**Validation:**
- Zod schemas in entity `types.ts` files (e.g. `bar-pos/src/entities/tab/model/types.ts`) parse/normalize Supabase rows at the entity boundary.

**Authentication:**
- Supabase Auth session in `AuthProvider` (`bar-pos/src/entities/staff/model/AuthContext.tsx`); staff PIN flow and `isAuthenticated` in `bar-pos/src/entities/staff/model/authStore.ts`; route gating in `ProtectedRoute`.

**Path aliases:**
- Enforced by `bar-pos/tsconfig.json`: `@app/*`, `@pages/*`, `@widgets/*`, `@features/*`, `@entities/*`, `@shared/*` — align imports with FSD layers.

---

*Architecture analysis: 2026-04-16*
*Update when major patterns change*
