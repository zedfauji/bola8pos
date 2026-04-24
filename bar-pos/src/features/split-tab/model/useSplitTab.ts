/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
/**
 * useSplitTab — mutation hooks for all four split modes.
 *
 * Uses `supabase as any` pre-regen cast — split_tab_* RPCs not yet in supabase.types.ts.
 * callProcessPayment is used for the Evenly payment loop (process-payment edge function).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { tabKeys } from '@entities/tab/model/queries';
import { callProcessPayment } from '@shared/lib/edge-function-contracts';
import { err, ok, type AppErrorCode, type Result } from '@shared/lib/result';
import { buildEvenPayments } from '@shared/lib/split-math';
import { supabase } from '@shared/lib/supabase';

const db = supabase as any;

// ── By Item ────────────────────────────────────────────────────────────────

export interface SplitByItemInput {
  parentTabId: string;
  assignments: Array<{ sub_tab_label: string; order_item_ids: string[] }>;
}

export function useSplitByItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SplitByItemInput): Promise<Result<string[]>> => {
      const { data, error } = await db.rpc('split_tab_by_item', {
        p_parent_tab_id: input.parentTabId,
        p_assignments: input.assignments,
      });
      if (error) {
        if ((error.message as string).includes('PARENT_TAB_PAID'))
          return err({
            code: 'PARENT_TAB_PAID' as AppErrorCode,
            message: 'This tab has already been paid and cannot be split.',
          });
        if ((error.message as string).includes('ITEM_ASSIGNED_TWICE'))
          return err({
            code: 'ITEM_ASSIGNED_TWICE' as AppErrorCode,
            message: 'An item was assigned to more than one check. Remove duplicate assignments.',
          });
        if ((error.message as string).includes('ITEM_NOT_IN_PARENT'))
          return err({
            code: 'ITEM_NOT_IN_PARENT' as AppErrorCode,
            message: "One or more items don't belong to this tab.",
          });
        return err({ code: 'SUPABASE_ERROR', message: error.message as string, raw: error });
      }
      void qc.invalidateQueries({ queryKey: tabKeys.lists() });
      void qc.invalidateQueries({ queryKey: tabKeys.detail(input.parentTabId) });
      return ok(data as string[]);
    },
  });
}

// ── Evenly ─────────────────────────────────────────────────────────────────

export interface SplitEvenlyInput {
  parentTabId: string;
  n: number;
  tabTotalCents: number;
  method: 'cash' | 'card' | 'rappi';
  tenderedAmount: number | null;
}

export function useSplitEvenly() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SplitEvenlyInput): Promise<Result<number[]>> => {
      // 1. Validate parent tab via RPC (checks tab is open, not already paid)
      const { error } = await db.rpc('split_tab_evenly', {
        p_parent_tab_id: input.parentTabId,
        p_n: input.n,
      });
      if (error) {
        if ((error.message as string).includes('PARENT_TAB_PAID'))
          return err({
            code: 'PARENT_TAB_PAID' as AppErrorCode,
            message: 'This tab has already been paid and cannot be split.',
          });
        return err({ code: 'SUPABASE_ERROR', message: error.message as string, raw: error });
      }
      // 2. Use local split-math for integer-precise payment amounts
      const payments = buildEvenPayments(input.tabTotalCents, input.n);
      // 3. Insert N payment rows via the process-payment EDGE FUNCTION (not a Postgres RPC).
      //    callProcessPayment uses fetch() with auth token injection.
      //    Do NOT call supabase.rpc('process_payment') — that RPC does not exist.
      for (let i = 0; i < payments.length; i++) {
        const amountCents = payments[i] ?? 0;
        const isLast = i === payments.length - 1;
        const payResult = await callProcessPayment({
          tabId: input.parentTabId,
          amount: amountCents / 100,
          tipAmount: 0,
          method: input.method,
          idempotencyKey: `split-evenly-${input.parentTabId}-${String(i)}-${String(Date.now())}`,
          // Cash payments require tenderedAmount; non-cash must omit field entirely (exactOptionalPropertyTypes)
          ...(input.method === 'cash' && input.tenderedAmount != null
            ? { tenderedAmount: isLast ? input.tenderedAmount : amountCents / 100 }
            : {}),
        });
        if (!payResult.ok) {
          return err({
            code: 'SUPABASE_ERROR',
            message: payResult.error.message,
            raw: payResult.error,
          });
        }
      }
      void qc.invalidateQueries({ queryKey: tabKeys.lists() });
      void qc.invalidateQueries({ queryKey: tabKeys.detail(input.parentTabId) });
      return ok(payments);
    },
  });
}

// ── By Person ──────────────────────────────────────────────────────────────

export interface SplitByPersonInput {
  parentTabId: string;
  n: number;
  assignments: Array<{ sub_tab_label: string; order_item_ids: string[] }>;
}

export function useSplitByPerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SplitByPersonInput): Promise<Result<string[]>> => {
      const { data, error } = await db.rpc('split_tab_by_person', {
        p_parent_tab_id: input.parentTabId,
        p_n: input.n,
        p_assignments: input.assignments,
      });
      if (error) {
        if ((error.message as string).includes('PARENT_TAB_PAID'))
          return err({
            code: 'PARENT_TAB_PAID' as AppErrorCode,
            message: 'This tab has already been paid and cannot be split.',
          });
        if ((error.message as string).includes('ITEM_ASSIGNED_TWICE'))
          return err({
            code: 'ITEM_ASSIGNED_TWICE' as AppErrorCode,
            message: 'An item was assigned to more than one check. Remove duplicate assignments.',
          });
        return err({ code: 'SUPABASE_ERROR', message: error.message as string, raw: error });
      }
      void qc.invalidateQueries({ queryKey: tabKeys.lists() });
      void qc.invalidateQueries({ queryKey: tabKeys.detail(input.parentTabId) });
      return ok(data as string[]);
    },
  });
}

// ── By Amount ─────────────────────────────────────────────────────────────

export interface SplitByAmountInput {
  parentTabId: string;
  amounts: Array<{ sub_tab_label: string; amount: number }>;
}

export function useSplitByAmount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SplitByAmountInput): Promise<Result<string[]>> => {
      const { data, error } = await db.rpc('split_tab_by_amount', {
        p_parent_tab_id: input.parentTabId,
        p_amounts: input.amounts,
      });
      if (error) {
        if ((error.message as string).includes('PARENT_TAB_PAID'))
          return err({
            code: 'PARENT_TAB_PAID' as AppErrorCode,
            message: 'This tab has already been paid and cannot be split.',
          });
        return err({ code: 'SUPABASE_ERROR', message: error.message as string, raw: error });
      }
      void qc.invalidateQueries({ queryKey: tabKeys.lists() });
      void qc.invalidateQueries({ queryKey: tabKeys.detail(input.parentTabId) });
      return ok(data as string[]);
    },
  });
}
