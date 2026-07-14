# Codebase Concerns

**Analysis Date:** 2026-04-16

Scope: primary app under `bar-pos/` (Vite + React + Tauri + Supabase). Evidence is from repository files and SQL migrations unless explicitly labeled **Inference**.

## Tech Debt

**POS flows stubbed while UI implies success:**

- Issue: `Place Order` does not persist orders to Supabase; it shows a success toast and clears the cart. Open-tab dialog simulates API delay and assigns a mock `tab-${Date.now()}` id instead of creating a tab.
- Why: Explicit `TODO` placeholders in UI widgets.
- Impact: Operators see success without database writes; downstream features (tabs, payments, reports) cannot be trusted in manual testing.
- Fix approach: Wire `handlePlaceOrder` in `bar-pos/src/widgets/OrderPanel/CartPanel.tsx` to a TanStack mutation (e.g. `useAddOrderToTab` as noted in the TODO). Replace mock path in `bar-pos/src/features/open-tab/ui/OpenTabDialog.tsx` with `useCreateTab()` / `bar-pos/src/entities/tab/model/queries.ts` patterns.

**Active tab header uses hard-coded mock data:**

- Issue: `ActiveTabSelector` hard-codes `openTabCount = 3` and customer/table display not tied to Supabase.
- Why: `TODO: Fetch actual tab data from Supabase` in `bar-pos/src/widgets/OrderPanel/ActiveTabSelector.tsx`.
- Impact: Misleading UI during demos and QA; masks integration bugs between cart store and tab queries.
- Fix approach: Subscribe to `useOpenTabs` / active tab id from `useCartStore` and map real tab rows.

**Duplicate query modifier in open-tabs list:**

- Issue: `useOpenTabs` calls `.order('opened_at', { ascending: false })` twice in the same chain in `bar-pos/src/entities/tab/model/queries.ts`.
- Why: Likely copy-paste; harmless at runtime but obscures intent.
- Impact: Noise in code review; possible confusion when changing sort behavior.
- Fix approach: Remove the redundant `.order` call.

**Dual auth models (Zustand PIN gate vs Supabase session):**

- Issue: `ProtectedRoute` gates on `useAuthStore` `isAuthenticated` only (`bar-pos/src/app/ProtectedRoute.tsx`), while `AuthProvider` manages Supabase `user` / `profile` / `currentShift` (`bar-pos/src/entities/staff/model/AuthContext.tsx`). Logout updates Supabase and navigates to `/login` but does not reset `useAuthStore` (`bar-pos/src/widgets/AppNav/ui/AppNav.tsx`).
- Why: PIN flow added without unifying session and route guard.
- Impact: After logout, `isAuthenticated` can remain `true` (**Inference**: user navigating directly to `/pos` may bypass the login screen while Supabase session is cleared, or conversely experience inconsistent state). Risk rated **High** for in-store terminals.
- Fix approach: On `signOut`, clear `useAuthStore` (e.g. `clearSelection` + `setAuthenticated(false)`); optionally align `ProtectedRoute` with `useAuth().user` or a single auth selector.

## Known Bugs

**Logout may not clear PIN-route authentication state:**

- Symptoms: Zustand `isAuthenticated` stays `true` after `handleLogout` because only `supabase.auth.signOut()` runs in `bar-pos/src/widgets/AppNav/ui/AppNav.tsx`.
- Trigger: Complete PIN login (`bar-pos/src/widgets/PINLoginForm/PINLoginForm.tsx` sets `setAuthenticated(true)`), then use nav Logout, then navigate to `/pos` (e.g. bookmark or address bar).
- Workaround: Full page reload or clear site data (**Inference** — not implemented in app).
- Root cause: No bridge between Supabase sign-out and `bar-pos/src/entities/staff/model/authStore.ts`.
- Blocked by: None.

**Close tab mutation vs RLS for bartenders:**

- Symptoms: `useCloseTab` performs `supabase.from('tabs').update({ status: 'closed', ... })` in `bar-pos/src/features/close-tab/index.ts`. Migrations define only `tabs_update_manager_admin` (managers/admins) on `tabs` — no bartender UPDATE policy in `bar-pos/supabase/migrations/20260414000009_rls_policies.sql` (lines 207–212).
- Trigger: Authenticated user with role `bartender` attempts cash close from `bar-pos/src/widgets/PaymentModal/index.tsx`.
- Workaround: Use a manager/admin account (**Inference** from policy names only).
- Root cause: Client assumes any authenticated staff can close tabs; RLS does not grant bartenders `UPDATE` on `tabs`.
- Blocked by: Product decision on whether bartenders may close tabs; if yes, add policy or RPC with `SECURITY DEFINER` and audit.

## Security Considerations

**Staff PINs readable by anonymous clients (RLS + query shape):**

- Risk: Policy `profiles_select_anon` in `bar-pos/supabase/migrations/20260414000010_fix_profiles_anon_access.sql` allows `anon` `SELECT` on `profiles` where `is_active = true`. `useActiveStaff` uses `.select('*')` and maps `pin` in `bar-pos/src/entities/staff/model/queries.ts`. Schema stores `pin` as plaintext numeric `VARCHAR(6)` per `bar-pos/supabase/migrations/20260414000002_profiles_and_shifts.sql`. `PINLoginForm` compares entered PIN to `selectedStaff.pin` client-side (`bar-pos/src/widgets/PINLoginForm/PINLoginForm.tsx`).
- Current mitigation: None in application code beyond staff picker UX; relies on network and device trust.
- Recommendations: Remove `pin` from columns returned to anon (view or `select` list without `pin`); verify PIN via Supabase RPC or Edge Function using hashed secrets; narrow `profiles_select_anon` to non-sensitive columns only (**partially product/DB design**).

**`create-staff` Edge Function uses service role without visible request authorization:**

- Risk: `bar-pos/supabase/functions/create-staff/index.ts` builds an admin client with `SUPABASE_SERVICE_ROLE_KEY`, parses JSON body, and creates auth users + profile rows. No JWT verification, shared secret, or role check appears in this file.
- Current mitigation: Not visible in repository (may exist in Supabase dashboard config — **Inference**, do not assume).
- Recommendations: Require verified caller (e.g. service key header, JWT with admin role), rate limit, and validate input server-side before shipping to production.

**Tauri webview CSP unset:**

- Risk: `"csp": null` in `bar-pos/src-tauri/tauri.conf.json` disables a strict Content Security Policy for the embedded webview.
- Current mitigation: Default Tauri window + `opener:default` only in `bar-pos/src-tauri/capabilities/default.json`.
- Recommendations: Define a CSP appropriate for Vite dev (`unsafe-eval` only in dev) and production asset origins; review if remote content is ever loaded.

**Structured logger posts to non-repo Edge Function path:**

- Risk: `remoteTransport` in `bar-pos/src/shared/lib/logger.ts` POSTs to `/functions/v1/ingest-logs`. Only `create-staff` exists under `bar-pos/supabase/functions/` in this repo, so remote log shipping likely 404s or depends on undeployed/local-only function (**Inference** for runtime behavior).
- Current mitigation: Errors are caught and logged to console; batches may accumulate silently.
- Recommendations: Add `ingest-logs` function or gate `enableRemoteLogging` until implemented; add health metric for failed batches.

## Performance Bottlenecks

**Large nested select for open tabs:**

- Problem: `useOpenTabs` selects tabs with nested `orders`, `order_items`, and `product:products(*)` in `bar-pos/src/entities/tab/model/queries.ts`.
- Measurement: Not measured in this audit (no benchmark artifacts in repo).
- Cause: Single query returns a wide graph; may grow with order history if filters do not limit rows.
- Improvement path: Add column filters / limits on orders, paginate, or split queries; confirm indexes on foreign keys used in filters (migrations already add several indexes — verify against query plans in Supabase).

**Generated and contract files are very large (maintainability, not necessarily runtime):**

- Problem: `bar-pos/src/shared/lib/supabase.types.ts` (~788 lines) and `bar-pos/src/shared/lib/domain.ts` (~701 lines) dominate the tree by line count (scripted line count, 2026-04-16).
- Measurement: Line counts from local scan; not CPU profiled.
- Cause: Type generation and domain modeling concentration.
- Improvement path: Split domain modules by aggregate; keep generated types isolated (already excluded from coverage in `bar-pos/vitest.config.ts`).

## Fragile Areas

**Tab entity queries module:**

- Why fragile: Combines query keys, nested PostgREST selects, Zod parsing, and multiple mutations in one file (`bar-pos/src/entities/tab/model/queries.ts`, ~472 lines).
- Common failures: RLS errors (`42501` — see `bar-pos/src/shared/lib/supabase-contracts.ts` / `result.ts`), schema drift vs `supabase.types.ts`, nested shape mismatches.
- Safe modification: Extend via small hooks or extracted `queryFn` helpers; add integration tests against a real or local Supabase schema.
- Test coverage: UI tests exist for tab presentation (`TabDetail`, `TabCard`); **no** `*.test.*` co-located with `queries.ts`.

**RLS helper `get_user_role()`:**

- Why fragile: `SECURITY DEFINER` SQL function in `bar-pos/supabase/migrations/20260414000009_rls_policies.sql` underpins most policies; incorrect role data in `profiles` affects authorization globally.
- Common failures: Policy denied errors for entire app surface.
- Safe modification: Migration-only changes with policy regression tests (SQL or pgTAP); avoid ad-hoc role writes from client.
- Test coverage: Not covered by Vitest (database layer).

## Scaling Limits

**Supabase Realtime channel usage:**

- Current capacity: Multiple channels per subscription setup in `bar-pos/src/shared/lib/supabase-realtime.ts` (tabs, orders, pool tables, sessions).
- Limit: Realtime connection and channel limits per Supabase project tier (**Inference** — depends on hosted plan).
- Symptoms at limit: Missed live updates, reconnect churn.
- Scaling path: Consolidate channels, filter server-side, or fall back to polling for low-priority entities.

**Client-side PIN verification:**

- Current capacity: Suitable only for low-threat, physically controlled terminals.
- Limit: Anyone who can call the anon API with the public anon key can retrieve PIN column values if policies remain as deployed in migrations (see Security section).
- Symptoms at limit: Account takeover equivalent for staff identities.
- Scaling path: Move verification server-side and strip sensitive columns from anon access.

## Dependencies at Risk

**`drizzle-orm` declared but unused in `src`:**

- Risk: Dead dependency in `bar-pos/package.json` (no imports under `bar-pos/src` as of grep on 2026-04-16).
- Impact: Larger install surface; confusion when onboarding.
- Migration plan: Remove if intentionally unused, or wire up the planned local/Tauri SQL path (`@tauri-apps/plugin-sql` is present — **Inference** that Drizzle was intended for local DB).

**`@tauri-apps/plugin-shell` in dependencies:**

- Risk: Shell plugin misuse can become arbitrary command execution; not referenced from `src` in grep results (may be unused or reserved).
- Impact: Supply-chain / foot-gun if later enabled without capability review.
- Migration plan: Drop if unused; if used, lock down `allowlist` in Tauri 2 permissions (not audited here beyond `default.json`).

## Missing Critical Features

**Persisted ordering from POS cart:**

- Problem: No server write on place order (see Tech Debt — `CartPanel.tsx`).
- Current workaround: None; data loss on refresh.
- Blocks: Kitchen/inventory reconciliation, accurate tabs.
- Implementation complexity: Medium (mutation + invalidation + error UX).

**Payment recording:**

- Problem: `PaymentModal` closes tab via tab status update only; no `payments` row insert in `useCloseTab` (`bar-pos/src/features/close-tab/index.ts`).
- Current workaround: None for audit trail.
- Blocks: Reports and cash drawer reconciliation tied to `payments` table from migrations.
- Implementation complexity: Medium (transactional RPC or multi-table mutation + RLS alignment).

## Test Coverage Gaps

**Supabase-backed entity query hooks:**

- What's not tested: `useOpenTabs`, tab mutations, `bar-pos/src/entities/product/model/queries.ts`, `bar-pos/src/entities/pool-table/model/queries.ts`, `bar-pos/src/entities/inventory/model/queries.ts`, staff queries (`bar-pos/src/entities/staff/model/queries.ts`).
- Risk: RLS and schema regressions ship unnoticed (e.g. bartender close-tab mismatch).
- Priority: High.
- Difficulty to test: Requires Supabase test project, Docker, or heavy mocking of `supabase` client (global mock exists in `bar-pos/src/shared/lib/test-setup.ts` but does not exercise policies).

**Auth and routing integration:**

- What's not tested: Interaction between `ProtectedRoute`, `AuthProvider`, and `useAuthStore` on logout and deep linking.
- Risk: Session/state desync bugs (see Known Bugs).
- Priority: High.
- Difficulty to test: Needs a small integration suite (RTL + memory router + mocked `supabase.auth`).

**Widgets: `OrderPanel`, `PaymentModal`, `AppNav`:**

- What's not tested: No `*.test.*` files matched for these paths in `bar-pos/src/widgets/OrderPanel/` or `PaymentModal` / `AppNav` (glob audit 2026-04-16).
- Risk: Regression in primary operator flows.
- Priority: Medium.
- Difficulty to test: Presentational + mutation wiring; can use MSW or mocked hooks.

---

*Concerns audit: 2026-04-16*
*Update as issues are fixed or new ones discovered*
