# Technology Stack

**Analysis Date:** 2026-04-16

## Languages

**Primary:**
- TypeScript (~5.8.x per `bar-pos/package.json`) — application code under `bar-pos/src/`
- TSX — React components

**Secondary:**
- Rust (edition 2021) — Tauri native shell in `bar-pos/src-tauri/`
- SQL — Supabase migrations and seeds under `bar-pos/supabase/`
- Deno (Supabase Edge Functions runtime) — `bar-pos/supabase/functions/create-staff/index.ts` uses Deno-style imports

## Runtime

**Environment:**
- Node.js — required for Vite, ESLint, Vitest, Storybook, and npm scripts (no `engines` field or `.nvmrc` in `bar-pos/`; use a current LTS compatible with Vite 7)
- WebView2 (Windows) — Tauri 2 desktop host per `CLAUDE.md` project overview
- Browser (Chromium) — Vitest Storybook project uses `@vitest/browser-playwright` in `bar-pos/vitest.config.ts`

**Package Manager:**
- npm — `bar-pos/package-lock.json` present
- Lockfile: `bar-pos/package-lock.json`

## Frameworks

**Core:**
- React ^19.1 — UI (`bar-pos/package.json`)
- React Router DOM ^6.28 — routing
- Tauri 2 — desktop wrapper; Rust deps `tauri` / `tauri-build` ^2 in `bar-pos/src-tauri/Cargo.toml`; JS `@tauri-apps/api` ^2 and `@tauri-apps/cli` ^2
- Vite ^7.0 — dev server and production bundling (`bar-pos/vite.config.ts`, output consumed by Tauri `frontendDist`)

**Testing:**
- Vitest ^4.1 — unit/integration tests (`bar-pos/vitest.config.ts`, `npm run test`)
- `@vitest/coverage-v8` — coverage (`npm run test:coverage`)
- `@testing-library/react` + `jsdom` — component tests
- `@vitest/browser-playwright` + `playwright` — Storybook-driven browser tests
- `fast-check` — property-based tests (dependency present for utilities)

**Build/Dev:**
- TypeScript ~5.8 — `tsc` in `npm run build` and `npm run typecheck`
- ESLint 9 (flat config) — `bar-pos/eslint.config.js`
- Prettier 3 — `bar-pos/.prettierrc`, `npm run format`
- Tailwind CSS 3.4 — styling pipeline (PostCSS / autoprefixer in devDependencies)
- Storybook ^10.3 — `npm run storybook` / `build-storybook`
- Husky + lint-staged — git hooks (`prepare` script)

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` ^2.103 — Postgres/Auth/Realtime client; singleton in `bar-pos/src/shared/lib/supabase.ts`
- `@tanstack/react-query` ^5.99 — async server state in entity query modules (e.g. `bar-pos/src/entities/*/model/queries.ts`)
- `zod` ^4.3 — runtime validation (project convention: domain schemas in `bar-pos/src/shared/lib/domain.ts` per `CLAUDE.md`)
- `zustand` ^5.0 — client/UI state and realtime wiring in entity stores
- `react-error-boundary` ^6.1 — error boundaries in the React tree

**Infrastructure:**
- `drizzle-orm` ^0.45.2 — listed in `bar-pos/package.json` but **no imports** under `bar-pos/src/` at audit time (reserved or stale; data access is Supabase JS + generated types)
- `@tauri-apps/plugin-opener` ^2 — matches Rust `tauri-plugin-opener` in `bar-pos/src-tauri/Cargo.toml`
- `@tauri-apps/plugin-shell` ^2.3.5 and `@tauri-apps/plugin-sql` ^2.4.0 — present in `package.json` but **not** registered in `bar-pos/src-tauri/src/lib.rs` and **not** imported from `bar-pos/src/` (unused in current wiring)
- `supabase` ^2.91.1 (CLI) — dev dependency style package for `npx supabase` (migrations, typegen) per docs in `bar-pos/src/shared/lib/supabase-contracts.ts`
- Radix UI primitives + `class-variance-authority` / `tailwind-merge` — component styling patterns (shadcn-aligned stack)

## Configuration

**Environment:**
- Vite `import.meta.env` — public client vars prefixed with `VITE_` (see `bar-pos/src/shared/lib/supabase.ts`, `bar-pos/src/shared/lib/logger-instance.ts`)
- `.env.local` may exist at `bar-pos/.env.local` (gitignored; **do not commit**); no committed `.env.example` found in repo — document required names in INTEGRATIONS.md only

**Build:**
- `bar-pos/vite.config.ts` — React plugin, FSD path aliases (`@app`, `@pages`, `@widgets`, `@features`, `@entities`, `@shared`), port `1420`, `TAURI_DEV_HOST` for mobile/HMR
- `bar-pos/tsconfig.json` / `bar-pos/tsconfig.node.json` — strict TS, path mirrors Vite aliases
- `bar-pos/src-tauri/tauri.conf.json` — Tauri build hooks (`beforeDevCommand` / `beforeBuildCommand`), `devUrl`, `frontendDist: ../dist`
- `bar-pos/supabase/config.toml` — local Supabase CLI project (API/db ports, Postgres major_version, seed path)

## Platform Requirements

**Development:**
- Windows (primary target per `CLAUDE.md`), macOS/Linux plausible for Vite/web dev
- Rust toolchain via rustup for `cargo` / `tauri` native builds
- Node + npm for frontend tooling

**Production:**
- Tauri desktop installers/bundles (`bar-pos/src-tauri/tauri.conf.json` `bundle.targets`: `all`)
- Remote Supabase project for cloud Postgres/Auth/Realtime (not embedded in the app binary)

---

*Stack analysis: 2026-04-16*
*Update after major dependency changes*
