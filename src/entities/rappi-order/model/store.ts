import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import type { RappiOrder } from '@shared/lib/domain';
import { logger } from '@shared/lib/logger-instance';
import { processRappiPayment } from '@shared/lib/payment-processor';
import { supabase } from '@shared/lib/supabase';
import {
  acceptRappiOrder,
  markRappiOrderCompleted,
  markRappiOrderReady,
  rejectRappiOrder,
  setRappiOrderPreparing,
} from './accept-flow';
import { mapRappiOrderRow } from './map-row';
import { rappiOrderKeys } from './queries';

function playIncomingChime(): void {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 880;
    o.type = 'sine';
    g.gain.setValueAtTime(0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + 0.25);
    o.onended = () => void ctx.close();
  } catch {
    /* ignore */
  }
}

function notifyBrowser(title: string, body: string): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body });
  } catch {
    /* ignore */
  }
}

interface RappiOrderStore {
  orders: RappiOrder[];
  setOrdersFromServer: (rows: RappiOrder[]) => void;
  pendingAcceptanceCount: () => number;
  acceptOrder: typeof acceptRappiOrder;
  rejectOrder: typeof rejectRappiOrder;
  markPreparing: typeof setRappiOrderPreparing;
  markReady: typeof markRappiOrderReady;
  markCompleted: (order: RappiOrder) => ReturnType<typeof processRappiPayment>;
}

export const useRappiOrderStore = create<RappiOrderStore>((set, get) => ({
  orders: [],
  setOrdersFromServer: rows => {
    set({ orders: rows });
  },
  pendingAcceptanceCount: () => get().orders.filter(o => o.status === 'pending_acceptance').length,
  acceptOrder: acceptRappiOrder,
  rejectOrder: rejectRappiOrder,
  markPreparing: setRappiOrderPreparing,
  markReady: markRappiOrderReady,
  markCompleted: async (order: RappiOrder) => {
    if (order.status !== 'ready_for_pickup') {
      return {
        ok: false as const,
        error: { code: 'VALIDATION_ERROR', message: 'Mark ready for pickup first.' },
      };
    }
    if (!order.tabId) {
      return { ok: false as const, error: { code: 'VALIDATION_ERROR', message: 'No tab linked.' } };
    }
    const amount = order.subtotal;
    const r = await processRappiPayment(order.tabId, amount, order.rappiOrderId);
    if (!r.ok) return r;
    const done = await markRappiOrderCompleted(order.id);
    if (!done.ok) {
      logger.warn('rappi.mark_completed_failed', {
        orderId: order.id,
        message: done.error.message,
      });
    }
    return r;
  },
}));

/** Sync TanStack list into Zustand + Supabase Realtime (broadcast + postgres_changes). */
export function useRappiOrdersRealtimeBridge() {
  const queryClient = useQueryClient();
  const warnedRef = useRef(false);

  useEffect(() => {
    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: rappiOrderKeys.list() });
    };

    const ch = supabase
      .channel('rappi:new_order')
      .on('broadcast', { event: 'new_order' }, () => {
        invalidate();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rappi_orders' }, payload => {
        invalidate();
        const row = payload.new as Record<string, unknown> | undefined;
        if (payload.eventType === 'INSERT' && row && typeof row === 'object' && 'id' in row) {
          const m = mapRappiOrderRow(row as Parameters<typeof mapRappiOrderRow>[0]);
          if (m.ok && m.data.status === 'pending_acceptance') {
            playIncomingChime();
            if (
              !warnedRef.current &&
              typeof Notification !== 'undefined' &&
              Notification.permission === 'default'
            ) {
              warnedRef.current = true;
              void Notification.requestPermission();
            }
            if (Notification.permission === 'granted') {
              notifyBrowser('New Rappi order', m.data.customerName);
            }
          }
        }
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [queryClient]);
}
