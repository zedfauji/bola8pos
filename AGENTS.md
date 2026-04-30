# AGENTS.md

## Cursor Cloud specific instructions

### Environment

- **Node.js** is managed via nvm at `/home/ubuntu/.nvm`. The active version is v22 (LTS). Ensure nvm is sourced before running any Node commands: `export NVM_DIR="/home/ubuntu/.nvm" && . "$NVM_DIR/nvm.sh"`.
- **Working directory** for all development commands is `bar-pos/` (not the repository root).
- **Package manager** is npm (lockfile: `package-lock.json`). Use `npm ci` for clean installs.

### Required Secrets

The app and tests require Supabase credentials. These must be provided as environment secrets:

| Secret Name | Required For |
|-------------|-------------|
| `VITE_SUPABASE_URL` | App startup, unit tests, E2E tests |
| `VITE_SUPABASE_ANON_KEY` | App startup, unit tests, E2E tests |
| `SUPABASE_SERVICE_ROLE_KEY` | Unit test global setup, seed scripts |

Without these, the Vite dev server will run but the app shows "Supabase not initialized" error. Unit tests (`npm run test`) fail at global setup with a clear error about missing credentials.

### Running Services

- **Vite dev server**: `cd bar-pos && npm run dev` — serves on http://localhost:1420
- No local backend needed — the app connects directly to Supabase Cloud.
- Tauri desktop build (`npm run tauri dev`) requires Rust toolchain and is not needed for frontend development.

### Key Commands (from `bar-pos/`)

See `CLAUDE.md` for the full command reference. Quick summary:

| Command | Notes |
|---------|-------|
| `npm run typecheck` | tsc --noEmit; passes cleanly |
| `npm run lint` | ESLint with max-warnings:0; has pre-existing errors in `src/shared/lib/agent/` |
| `npm run test` | Vitest unit tests; requires Supabase credentials |
| `npm run test:e2e` | Playwright E2E; requires credentials + `npx playwright install chromium --with-deps` |
| `npm run dev` | Vite dev server on port 1420 |

### Gotchas

- The `prepare` script (husky) warns `.git can't be found` because the git repo root is `/workspace` but `package.json` is in `bar-pos/`. This is harmless and does not affect development.
- Lint reports ~213 pre-existing errors (mostly in `src/shared/lib/agent/` files — import ordering and `any` usage). These are not caused by setup issues.
- The vitest `globalSetup` at `src/test/global-setup.ts` validates Supabase connectivity before running any test. There is no way to skip this for offline unit testing.
- Playwright browsers must be installed separately: `npx playwright install chromium --with-deps`.
