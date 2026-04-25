/**
 * Integration tests for entities/waitlist model layer.
 * Wave 0 stub: describe blocks only — filled in by Plan 07-07.
 * Requires live Supabase DB (waitlist_entries and waitlist_notifications tables).
 */
import { describe, it } from 'vitest';

describe('useWaitlistEntries (integration)', () => {
  it.todo('returns entries in FIFO order (created_at ASC)');
  it.todo('excludes seated and cancelled entries');
});

describe('useMutationAddWaitlistEntry (integration)', () => {
  it.todo('inserts a new entry and returns Result.ok with WaitlistEntry');
  it.todo('returns SUPABASE_ERROR when RLS rejects insert');
});

describe('useMutationUpdateWaitlistStatus (integration)', () => {
  it.todo('updates status to notified and triggers pg_net (waitlist_notifications row appears within 2s)');
  it.todo('updates status to seated with table_id and seated_at');
});

describe('useWaitlistLastNotificationsMap (integration)', () => {
  it.todo('returns most recent notification per entry id');
  it.todo('returns empty record when entryIds is empty');
});
