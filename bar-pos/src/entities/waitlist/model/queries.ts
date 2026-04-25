/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
/**
 * entities/waitlist/model/queries.ts
 *
 * TanStack Query hooks for waitlist data.
 * Uses `const db = supabase as any` pre-regen cast — waitlist_entries table
 * not yet in supabase.types.ts. Regenerate after migrations applied.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  WaitlistEntry,
  WaitlistEntryCreate,
  WaitlistEntryStatus,
  WaitlistNotification,
} from '@shared/lib/domain';
import { WaitlistEntrySchema, WaitlistNotificationSchema } from '@shared/lib/domain';
import { logger } from '@shared/lib/logger-instance';
import { err, ok, type Result } from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';

// Pre-regen cast: waitlist_entries not yet in supabase.types.ts
const db = supabase as any;

// ────────────────────────────────────────────────────────────────────────────
// Row mappers: DB snake_case → domain camelCase
// ────────────────────────────────────────────────────────────────────────────
function mapRow(row: Record<string, unknown>): WaitlistEntry {
  return WaitlistEntrySchema.parse({
    id: row['id'],
    name: row['name'],
    partySize: row['party_size'],
    phoneE164: row['phone_e164'] ?? null,
    status: row['status'],
    tableId: row['table_id'] ?? null,
    seatedAt: row['seated_at'] ? new Date(row['seated_at'] as string) : null,
    notifiedAt: row['notified_at'] ? new Date(row['notified_at'] as string) : null,
    createdAt: new Date(row['created_at'] as string),
  });
}

function mapNotificationRow(row: Record<string, unknown>): WaitlistNotification {
  return WaitlistNotificationSchema.parse({
    id: row['id'],
    waitlistEntryId: row['waitlist_entry_id'],
    channel: row['channel'],
    status: row['status'],
    providerMessageId: row['provider_message_id'] ?? null,
    error: row['error'] ?? null,
    createdAt: new Date(row['created_at'] as string),
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Query key factory
// ────────────────────────────────────────────────────────────────────────────
export const waitlistKeys = {
  all: ['waitlist_entries'] as const,
  lists: () => [...waitlistKeys.all, 'list'] as const,
  detail: (id: string) => [...waitlistKeys.all, 'detail', id] as const,
  waitingCount: () => [...waitlistKeys.all, 'waiting-count'] as const,
  lastNotifications: (entryIds: string[]) =>
    [
      ...waitlistKeys.all,
      'last-notifications',
      entryIds.slice().sort().join(','),
    ] as const,
};

// ────────────────────────────────────────────────────────────────────────────
// Query hooks
// ────────────────────────────────────────────────────────────────────────────

/** Returns all non-seated, non-cancelled entries in FIFO order (created_at ASC). */
export function useWaitlistEntries() {
  return useQuery({
    queryKey: waitlistKeys.lists(),
    queryFn: async (): Promise<WaitlistEntry[]> => {
      const { data, error } = await db
        .from('waitlist_entries')
        .select('*')
        .not('status', 'in', '("seated","cancelled")')
        .order('created_at', { ascending: true });

      if (error) {
        logger.error('useWaitlistEntries: query failed', { error });
        throw error;
      }
      return ((data ?? []) as Record<string, unknown>[]).map(mapRow);
    },
    staleTime: 30 * 1000,
  });
}

/** Returns a single waitlist entry by id. */
export function useWaitlistEntry(id: string) {
  return useQuery({
    queryKey: waitlistKeys.detail(id),
    queryFn: async (): Promise<WaitlistEntry | null> => {
      const { data, error } = await db
        .from('waitlist_entries')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        logger.error('useWaitlistEntry: query failed', { id, error });
        throw error;
      }
      if (!data) return null;
      return mapRow(data as Record<string, unknown>);
    },
    staleTime: 30 * 1000,
  });
}

/** Returns count of entries with status='waiting'. Used for Home tile badge. */
export function useWaitlistWaitingCount() {
  return useQuery({
    queryKey: waitlistKeys.waitingCount(),
    queryFn: async (): Promise<number> => {
      const { count, error } = await db
        .from('waitlist_entries')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'waiting');

      if (error) {
        logger.error('useWaitlistWaitingCount: query failed', { error });
        throw error;
      }
      return count ?? 0;
    },
    staleTime: 15 * 1000,
  });
}

/**
 * Returns a map of the most recent notification per entry id.
 * Queries waitlist_notifications ordered by created_at DESC, grouped by waitlist_entry_id.
 * Returns Record<string, WaitlistNotification> keyed by entry id.
 * Used by WaitlistQueue widget to pass lastNotification to each WaitlistEntryCard.
 */
export function useWaitlistLastNotificationsMap(entryIds: string[]) {
  return useQuery({
    queryKey: waitlistKeys.lastNotifications(entryIds),
    queryFn: async (): Promise<Record<string, WaitlistNotification>> => {
      if (entryIds.length === 0) return {};

      const { data, error } = await db
        .from('waitlist_notifications')
        .select('*')
        .in('waitlist_entry_id', entryIds)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('useWaitlistLastNotificationsMap: query failed', { error });
        throw error;
      }

      // Keep only the first (most recent) row per entry id
      const map: Record<string, WaitlistNotification> = {};
      for (const row of (data ?? []) as Record<string, unknown>[]) {
        const entryId = row['waitlist_entry_id'] as string;
        if (!(entryId in map)) {
          map[entryId] = mapNotificationRow(row);
        }
      }
      return map;
    },
    staleTime: 15 * 1000,
    enabled: entryIds.length > 0,
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Mutation hooks
// ────────────────────────────────────────────────────────────────────────────

/** Inserts a new waitlist entry. Returns Result<WaitlistEntry>. */
export function useMutationAddWaitlistEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: WaitlistEntryCreate): Promise<Result<WaitlistEntry>> => {
      const { data, error } = await db
        .from('waitlist_entries')
        .insert({
          name: input.name,
          party_size: input.partySize,
          phone_e164: input.phoneE164,
        })
        .select()
        .single();

      if (error) {
        logger.error('useMutationAddWaitlistEntry: insert failed', { error });
        return err({
          code: 'SUPABASE_ERROR' as const,
          message: (error as { message?: string }).message ?? '',
        });
      }

      const parsed = WaitlistEntrySchema.safeParse(mapRow(data as Record<string, unknown>));
      if (!parsed.success) {
        return err({ code: 'VALIDATION_ERROR' as const, message: 'Invalid waitlist entry returned' });
      }
      return ok(parsed.data);
    },
    onSuccess: (result) => {
      if (!result.ok) return;
      void queryClient.invalidateQueries({ queryKey: waitlistKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: waitlistKeys.waitingCount() });
    },
  });
}

/** Updates status (and optionally table_id, seated_at, notified_at). Returns Result<WaitlistEntry>. */
export function useMutationUpdateWaitlistStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      status: WaitlistEntryStatus;
      tableId: string | undefined;
      seatedAt: string | undefined;
      notifiedAt: string | undefined;
    }): Promise<Result<WaitlistEntry>> => {
      const updatePayload: Record<string, unknown> = { status: input.status };
      if (input.tableId !== undefined) updatePayload['table_id'] = input.tableId;
      if (input.seatedAt !== undefined) updatePayload['seated_at'] = input.seatedAt;
      if (input.notifiedAt !== undefined) updatePayload['notified_at'] = input.notifiedAt;

      const { data, error } = await db
        .from('waitlist_entries')
        .update(updatePayload)
        .eq('id', input.id)
        .select()
        .single();

      if (error) {
        logger.error('useMutationUpdateWaitlistStatus: update failed', { error });
        return err({
          code: 'SUPABASE_ERROR' as const,
          message: (error as { message?: string }).message ?? '',
        });
      }

      const parsed = WaitlistEntrySchema.safeParse(mapRow(data as Record<string, unknown>));
      if (!parsed.success) {
        return err({ code: 'VALIDATION_ERROR' as const, message: 'Invalid waitlist entry returned' });
      }
      return ok(parsed.data);
    },
    onSuccess: (result) => {
      if (!result.ok) return;
      void queryClient.invalidateQueries({ queryKey: waitlistKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: waitlistKeys.waitingCount() });
      void queryClient.invalidateQueries({ queryKey: waitlistKeys.detail(result.data.id) });
    },
  });
}
