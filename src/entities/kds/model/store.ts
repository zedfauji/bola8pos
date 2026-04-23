import { create } from 'zustand';
import type { KdsOrderItem } from './types';

interface KdsState {
  items: KdsOrderItem[];
}

interface KdsActions {
  setItems: (items: KdsOrderItem[]) => void;
  handleRealtimeUpdate: (payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    new: Record<string, unknown>;
    old: Record<string, unknown>;
  }) => void;
}

export const useKdsStore = create<KdsState & KdsActions>()(set => ({
  items: [],

  setItems: items => {
    set({ items });
  },

  handleRealtimeUpdate: ({ eventType, new: newRow, old: oldRow }) => {
    const id = (newRow['id'] ?? oldRow['id']) as string;
    set(state => {
      switch (eventType) {
        case 'INSERT': {
          if (state.items.some(i => i.id === id)) return state;
          // New items are added via query invalidation, not directly from raw Realtime row
          // (because we need joined product/category/tab data not in the raw row)
          return state;
        }
        case 'UPDATE': {
          const kdsStatus = newRow['kds_status'] as string;
          if (kdsStatus === 'done') {
            return { items: state.items.filter(i => i.id !== id) };
          }
          return {
            items: state.items.map(i =>
              i.id === id ? { ...i, kdsStatus: kdsStatus as KdsOrderItem['kdsStatus'] } : i
            ),
          };
        }
        case 'DELETE':
          return { items: state.items.filter(i => i.id !== id) };
        default:
          return state;
      }
    });
  },
}));
