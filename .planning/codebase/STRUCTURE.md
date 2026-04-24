# Codebase Structure

**Analysis Date:** 2026-04-16

Primary application root: `bar-pos/` (Vite + React + TypeScript). FSD layers live under `bar-pos/src/`. Desktop shell code lives under `bar-pos/src-tauri/`.

## Directory Layout

```
bar-pos/
├── src/                    # React application (FSD layers)
│   ├── app/                # Providers, router, guards, global CSS
│   ├── pages/              # Route folders — thin `index.tsx` per page
│   ├── widgets/            # Composite UI (panels, modals, nav)
│   ├── features/           # One user action per folder (model + ui)
│   ├── entities/           # Domain: types, stores, queries, entity UI
│   └── shared/             # lib, ui primitives, config (no domain rules)
├── src-tauri/              # Tauri (Rust) desktop host
│   ├── src/
│   │   ├── commands/       # Tauri commands (e.g. logger)
│   │   ├── lib.rs          # Tauri builder + invoke_handler
│   │   └── main.rs         # Binary entry
│   └── capabilities/       # Tauri capability JSON
├── index.html              # Vite HTML shell
├── vite.config.ts          # Vite + Tauri-oriented dev options
├── tsconfig.json           # Strict TS + FSD path aliases
└── package.json            # Scripts and dependencies
```

## Directory Purposes

**`bar-pos/src/app/`:**
- Purpose: Application composition only — no business domains.
- Contains: `App.tsx`, `providers.tsx`, `router.tsx`, `ProtectedRoute.tsx`, `globals.css`.
- Key files: `bar-pos/src/app/router.tsx` (all routes), `bar-pos/src/app/providers.tsx` (Query + Auth).
- Subdirectories: Flat (no nested packages).

**`bar-pos/src/pages/`:**
- Purpose: One folder per URL; each exports a default page from `index.tsx`.
- Contains: `login`, `pos`, `pool-tables`, `inventory`, `staff`, `reports` (and optional Storybook next to a page, e.g. `bar-pos/src/pages/pos/index.stories.tsx`).
- Key files: `bar-pos/src/pages/pos/index.tsx` (main POS layout), `bar-pos/src/pages/login/index.tsx`.
- Subdirectories: One level per route name; prefer single `index.tsx` per page per FSD rules.

**`bar-pos/src/widgets/`:**
- Purpose: Larger UI blocks that combine features and entities.
- Contains: PascalCase folder or file groups (`OrderPanel/`, `TabDrawer/`, `PaymentModal/`, `AppNav/`, `PINLoginForm/`, `EmployeeSelector/`).
- Key files: `bar-pos/src/widgets/OrderPanel/OrderPanel.tsx`, `bar-pos/src/widgets/TabDrawer/index.tsx`.
- Subdirectories: Widget-named folders; barrel `index.ts` where used (e.g. `OrderPanel/index.ts`).

**`bar-pos/src/features/`:**
- Purpose: Verb-phrase folders for discrete user actions.
- Contains: `open-tab/` (`model/useOpenTab.ts`, `ui/OpenTabButton.tsx`, …), `add-item-to-tab/` (`model/cartStore.ts`, `ui/ModifierSheet.tsx`), `close-tab/` (`index.ts` exporting `useCloseTab`).
- Key files: `bar-pos/src/features/open-tab/model/useOpenTab.ts`, `bar-pos/src/features/close-tab/index.ts`.
- Subdirectories: Each feature has `model/` and/or `ui/`; optional `README.md`.

**`bar-pos/src/entities/`:**
- Purpose: Per-domain slices: `model/types.ts`, `model/store.ts`, `model/queries.ts`, `model/index.ts`, `ui/*`, root `index.ts`.
- Contains: `tab`, `product`, `pool-table`, `staff`, `inventory`, `payment`.
- Key files: `bar-pos/src/entities/tab/model/queries.ts`, `bar-pos/src/entities/tab/model/store.ts`, `bar-pos/src/entities/staff/model/AuthContext.tsx`, `bar-pos/src/entities/staff/model/authStore.ts`.
- Subdirectories: One folder per entity name; `payment` currently has model only (no `ui/` subtree in tree).

**`bar-pos/src/shared/`:**
- Purpose: Cross-cutting utilities and design system.
- Contains: `lib/` (supabase, logger, result, domain helpers, mocks, test setup), `ui/` (shadcn-style components, POS-specific controls), `config/constants.ts`.
- Key files: `bar-pos/src/shared/lib/supabase.ts`, `bar-pos/src/shared/lib/supabase-realtime.ts`, `bar-pos/src/shared/ui/index.ts`.
- Subdirectories: `lib/`, `ui/`, `config/`.

**`bar-pos/src-tauri/`:**
- Purpose: Native shell, packaging, optional IPC for logging.
- Contains: Rust crate, `capabilities/default.json`, `tauri.conf.json`, `Cargo.toml`.
- Key files: `bar-pos/src-tauri/src/lib.rs`, `bar-pos/src-tauri/src/commands/logger.rs`.
- Subdirectories: `src/commands/`, `capabilities/`.

## Key File Locations

**Entry Points:**
- `bar-pos/src/main.tsx` — React DOM root.
- `bar-pos/src/app/App.tsx` — Provider + router shell.
- `bar-pos/index.html` — Vite mount point `#root`.
- `bar-pos/src-tauri/src/main.rs` — Tauri process entry.

**Configuration:**
- `bar-pos/tsconfig.json` — Path aliases and strict compiler options.
- `bar-pos/vite.config.ts` — Dev server / Tauri watch exclusions for `src-tauri`.
- `bar-pos/package.json` — NPM scripts and dependency versions.
- Environment: Vite variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` consumed in `bar-pos/src/shared/lib/supabase.ts` (do not commit secrets; `.env` files are not documented here).

**Core Logic:**
- Routing: `bar-pos/src/app/router.tsx`.
- Global providers: `bar-pos/src/app/providers.tsx`.
- Data access patterns: `bar-pos/src/entities/*/model/queries.ts`.
- Client state: `bar-pos/src/entities/*/model/store.ts`, `bar-pos/src/features/add-item-to-tab/model/cartStore.ts`.

**Testing:**
- Co-located: `*.test.ts`, `*.test.tsx` beside sources (e.g. `bar-pos/src/features/add-item-to-tab/model/cartStore.test.ts`, `bar-pos/src/widgets/TabDrawer/TabDrawer.test.tsx`).
- Shared setup: `bar-pos/src/shared/lib/test-setup.ts`, `bar-pos/src/shared/lib/test-utils.tsx`.

**Documentation (in-repo, optional):**
- `bar-pos/src/features/open-tab/README.md`, `bar-pos/src/pages/pos/README.md` — feature/page notes.
- FSD law for agents: `.cursor/rules/architecture-fsd.mdc`.

## Naming Conventions

**Files:**
- React components: `PascalCase.tsx` (e.g. `bar-pos/src/entities/tab/ui/TabCard.tsx`).
- Hooks: `use` prefix + `camelCase.ts` (e.g. `bar-pos/src/features/open-tab/model/useOpenTab.ts`).
- Stores: `*Store.ts` (e.g. `bar-pos/src/entities/tab/model/store.ts`, `authStore.ts`).
- Tests: same basename + `.test.ts` / `.test.tsx`.
- Stories: same basename + `.stories.tsx`.

**Directories:**
- FSD layer folders: lowercase plural segment names (`entities`, `features`, `widgets`, `pages`).
- Entity and feature folders: **kebab-case** multi-word names (`pool-table`, `add-item-to-tab`, `open-tab`).

**Special Patterns:**
- Pages: default export function in `index.tsx` only per project rules.
- Widget folders may use PascalCase directory names matching the widget (`OrderPanel/`, `PaymentModal/`).
- Path aliases **must** be used instead of long relative imports across layers (`@entities/...`, `@shared/...`, etc.) per `.cursor/rules/architecture-fsd.mdc`.

## Where to Add New Code

**New Feature (user action):**
- Primary code: `bar-pos/src/features/<verb-noun>/` with `model/` (hook, optional local Zustand) and `ui/` (trigger components).
- Tests: co-located `*.test.ts(x)` next to the hook or UI.
- Do not import other features; lift shared logic to `entities` or `shared/lib` if two features need it.

**New Entity (domain object):**
- Implementation: `bar-pos/src/entities/<name>/` with `model/types.ts`, `model/store.ts` (if client state needed), `model/queries.ts`, `model/index.ts`, optional `ui/`.
- Barrel: `bar-pos/src/entities/<name>/index.ts` re-exporting public API.

**New Page / Route:**
- Page composition: `bar-pos/src/pages/<route-name>/index.tsx` (widgets only).
- Route registration: add lazy import and `<Route>` in `bar-pos/src/app/router.tsx`.
- Guarding: wrap with `ProtectedRoute` from `bar-pos/src/app/ProtectedRoute.tsx` when auth is required.

**New Composite UI Block:**
- Implementation: `bar-pos/src/widgets/<WidgetName>/` (folder or single file), import from `@features/*` and `@entities/*` only.

**Utilities & design tokens:**
- Shared helpers: `bar-pos/src/shared/lib/` (no Supabase queries here — keep queries in `entities/*/model/queries.ts`).
- UI primitives: `bar-pos/src/shared/ui/` (extend shadcn-style components).
- Constants: `bar-pos/src/shared/config/` (currently `constants.ts`; add new config files alongside as needed).

**Tauri / native:**
- New commands: `bar-pos/src-tauri/src/commands/*.rs` and register in `bar-pos/src-tauri/src/lib.rs` `invoke_handler!`.
- Frontend invoke site: typically `bar-pos/src/shared/lib/` (logger already uses dynamic invoke).

## Special Directories

**`bar-pos/node_modules/`:**
- Purpose: NPM dependencies.
- Source: Installed by package manager.
- Committed: No (gitignored).

**`bar-pos/coverage/` (if present locally):**
- Purpose: Vitest coverage HTML/JSON output.
- Source: Test runs with coverage enabled.
- Committed: Typically no.

**`bar-pos/src-tauri/`:**
- Purpose: Desktop packaging and native capabilities.
- Source: Hand-authored Rust + Tauri config.
- Committed: Yes.

---

*Structure analysis: 2026-04-16*
*Update when directory structure changes*
