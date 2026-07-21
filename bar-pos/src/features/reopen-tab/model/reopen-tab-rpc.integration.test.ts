/**
 * Integration tests: reopen_tab RPC (Phase 23, Plan 01 — Wave-0 scaffold).
 *
 * Mirrors src/features/edit-paid-tab/model/edit-paid-tab-rpc.integration.test.ts
 * (service-role seed/cleanup client + temp auth users + signInWithPassword,
 * since reopen_tab's AUTH_FORBIDDEN check is `auth.uid()`-based and must see
 * a real authenticated, non-service-role JWT).
 *
 * This file is a PENDING scaffold only — Plan 04 fills in the live-Supabase
 * seed/cleanup harness and converts each `it.todo` below into a real test.
 * No live RPC calls are made here; the suite must collect and report todo
 * tests with 0 failed.
 *
 * Requires: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 * Run: cd bar-pos && npx vitest run src/features/reopen-tab/model/reopen-tab-rpc.integration.test.ts
 */
import { describe, it } from 'vitest';

// ── Env guards ────────────────────────────────────────────────────────────────

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const skip = !url || !anonKey || !serviceKey;

describe.skipIf(skip)('reopen_tab RPC (integration)', () => {
  // ── SC-1: happy path + version guard + auth gate ──────────────────────────

  it.todo(
    'SC-1 happy path: reopening a closed/paid tab flips status to open, ' +
      'voids its completed payment(s) (status -> reopened_void), and bumps ' +
      'tabs.version',
  );

  it.todo(
    'SC-1: STALE_VERSION is returned when p_expected_version does not match tabs.version',
  );

  it.todo(
    'SC-1: AUTH_FORBIDDEN is returned when the caller is not manager/admin role (bartender)',
  );

  // ── SC-3: reopen cap + window ──────────────────────────────────────────────

  it.todo(
    'SC-3: REOPEN_CAP_EXCEEDED is returned when the tab has already been reopened twice (reopen_count = 2)',
  );

  it.todo(
    'SC-3: REOPEN_WINDOW_EXPIRED is returned when last_reopened_at is more than 24h ago',
  );

  // ── SC-2: offsetting caja_entries row ──────────────────────────────────────

  it.todo(
    'SC-2: a successful reopen with an open caja session inserts exactly one offsetting caja_entries row',
  );

  // ── SC-4: audit trail ───────────────────────────────────────────────────────

  it.todo(
    "SC-4: a successful reopen writes an audit_logs row (action='tab.reopen') with before/after diff and the reason",
  );

  // ── Implicit regression (highest-risk gap — do not skip in Plan 04) ────────

  it.todo(
    'CRITICAL: re-paying a reopened tab via process_payment_atomic does NOT ' +
      'double-count the reopened_void amount — the tab closes only once the ' +
      'new payment covers the full owed total, not owed minus the voided amount',
  );
});
