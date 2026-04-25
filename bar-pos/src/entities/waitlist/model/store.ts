/**
 * entities/waitlist/model/store.ts
 *
 * Minimal Zustand store for waitlist UI state.
 * Realtime subscription is at app-layer (WaitlistRealtimeListener) per Pattern 1.
 */
import { create } from 'zustand';

interface WaitlistStore {
  selectedEntryId: string | null;
  setSelectedEntryId: (id: string | null) => void;
}

export const useWaitlistStore = create<WaitlistStore>((set) => ({
  selectedEntryId: null,
  setSelectedEntryId: (id) => { set({ selectedEntryId: id }); },
}));
