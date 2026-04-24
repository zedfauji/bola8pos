# External Integrations

**Analysis Date:** 2026-04-16

## APIs & External Services

**Backend-as-a-service / data API:**
- Supabase (hosted project + local CLI) — primary backend: PostgreSQL over PostgREST, Auth, Realtime channels
  - SDK/Client: `@supabase/supabase-js` — `createClient` in `bar-pos/src/shared/lib/supabase.ts`, typed with `bar-pos/src/shared/lib/supabase.types.ts`
  - Auth (anon): `VITE_SUPABASE_ANON_KEY` (public to browser; RLS enforced server-side)
  - Project URL: `VITE_SUPABASE_URL`
  - Usage examples: entity query modules such as `bar-pos/src/entities/tab/model/queries.ts`, `bar-pos/src/entities/product/model/queries.ts`, `bar-pos/src/entities/staff/model/AuthContext.tsx`
  - Realtime: `bar-pos/src/shared/lib/supabase-realtime.ts`; teardown on sign-out / provider unmount in `bar-pos/src/app/providers.tsx`

**Supabase Edge Functions:**
- `create-staff` — admin-style user creation (`bar-pos/supabase/functions/create-staff/index.ts`)
  - Integration method: Deno deploy; uses `createClient` from esm.sh `@supabase/supabase-js`
  - Auth: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` read from Deno env at runtime (configure in Supabase dashboard / secrets; never commit values)
  - Note: no `supabase.functions.invoke` usage found under `bar-pos/src/` at audit time — function is part of backend tooling, not yet wired from the React app

**CLI / schema workflow:**
- Supabase CLI — migrations under `bar-pos/supabase/migrations/`, seed `bar-pos/supabase/seed.sql`, config `bar-pos/supabase/config.toml` (`project_id`, local API port 54321, DB port 54322, Postgres `major_version = 17`)
- Type generation workflow documented in `bar-pos/src/shared/lib/supabase-contracts.ts` comments (`supabase gen types typescript` → `bar-pos/src/shared/lib/supabase.types.ts`)

**Payment Processing:**
- Not detected in application dependencies or `bar-pos/src/` imports

**Email/SMS:**
- Not detected

**External APIs (third-party SaaS beyond Supabase):**
- Not detected in runtime app code

## Data Storage

**Databases:**
- PostgreSQL (Supabase) — canonical store for POS entities (tabs, orders, products, inventory, pool tables/sessions, profiles, etc.) per generated types in `bar-pos/src/shared/lib/supabase.types.ts`
  - Connection: HTTPS to Supabase REST/RPC; no direct `DATABASE_URL` in the Vite frontend
  - Client: `@supabase/supabase-js` only (no Prisma/Drizzle runtime client in `src/`)
  - Migrations: SQL files in `bar-pos/supabase/migrations/`; local reset/seed per `bar-pos/supabase/config.toml` `[db.seed]` → `./seed.sql`

**File Storage:**
- Not a separate S3-style integration in app code; any Supabase Storage use would be via Supabase client (not observed in grep of `storage` APIs at audit time — confirm if added later)

**Caching:**
- None as a dedicated service; TanStack Query provides in-memory request caching

## Authentication & Identity

**Auth Provider:**
- Supabase Auth — email/session flow via `supabase.auth` in `bar-pos/src/entities/staff/model/AuthContext.tsx` (`getSession`, `onAuthStateChange`, `signOut` from `bar-pos/src/widgets/AppNav/ui/AppNav.tsx`)
  - Implementation: browser client with `persistSession` / `autoRefreshToken` in `bar-pos/src/shared/lib/supabase.ts`
  - Profiles: reads from `profiles` table joined with staff role metadata in `AuthContext.tsx`

**OAuth Integrations:**
- Not detected in code (could be enabled in Supabase project settings independently)

## Monitoring & Observability

**Error Tracking:**
- Not detected (no Sentry/Datadog SDK in `bar-pos/package.json`)

**Analytics:**
- Not detected

**Logs:**
- Structured app logging utilities in `bar-pos/src/shared/lib/logger.ts` / `bar-pos/src/shared/lib/logger-instance.ts` using `VITE_TERMINAL_ID` and `VITE_APP_VERSION` (defaults `POS-1` / `0.0.0` if unset)
- Rust file `bar-pos/src-tauri/src/commands/logger.rs` defines a `write_log` command with rotation — **not** wired in `bar-pos/src-tauri/src/lib.rs` at audit time (orphan module)

## CI/CD & Deployment

**Hosting:**
- Desktop distribution via Tauri bundles (`bar-pos/src-tauri/tauri.conf.json`)
- Supabase cloud project for API/DB (environment-specific URLs/keys)

**CI Pipeline:**
- No `.github/workflows` directory detected at repository root — CI not defined in-repo at audit time

## Environment Configuration

**Development:**
- Required public env vars for app boot: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (`bar-pos/src/shared/lib/supabase.ts` throws if missing)
- Optional: `VITE_TERMINAL_ID`, `VITE_APP_VERSION` (`bar-pos/src/shared/lib/logger-instance.ts`)
- Optional Vite/Tauri dev: `TAURI_DEV_HOST` (`bar-pos/vite.config.ts`) for LAN/mobile HMR
- Secrets location: local `.env` / `.env.local` under `bar-pos/` (typical Vite convention); `.env.local` exists in workspace but must not be committed or quoted
- `npm run setup:dev` / `setup:dev-users` / `seed:dev` in `bar-pos/package.json` reference `bar-pos/scripts/*.ts` — **scripts directory not present** in workspace at audit time (integration gap for onboarding automation)

**Staging:**
- Same variable names; values point to non-production Supabase project (operational convention, not enforced in repo)

**Production:**
- Bundle Supabase URL/anon key into Tauri/Vite build as public `VITE_*` vars; rotate keys in Supabase dashboard if compromised
- Service role key only for Edge Functions / server automation (`SUPABASE_SERVICE_ROLE_KEY` in function env), never in the desktop client

## Webhooks & Callbacks

**Incoming:**
- None detected in `bar-pos/src/` (no HTTP server in the Vite app)

**Outgoing:**
- None detected (no Stripe webhooks, CRM callbacks, etc.)

---

*Integration audit: 2026-04-16*
*Update when adding/removing external services*
