import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Tab } from '@shared/lib/domain';
import { logger } from '@shared/lib/logger-instance';
import { ok, err, type Result } from '@shared/lib/result';

// ============================================================================
// OFFLINE ACTION QUEUE
// ============================================================================

export type OfflineActionType = 'place-order' | 'open-tab' | 'start-pool-timer' | 'stop-pool-timer';

export interface OfflineAction {
  id: string;
  type: OfflineActionType;
  payload: unknown;
  timestamp: number;
  retryCount: number;
}

// ============================================================================
// STATE & ACTIONS
// ============================================================================

interface TabsState {
  /** All open tabs loaded from the server. */
  tabs: Tab[];
  /** Tab currently being edited in the cart panel. */
  activeTabId: string | null;
  /** Tab selected in the drawer UI (may differ from activeTabId). */
  selectedTabId: string | null;
  /** Controls the tab drawer visibility. */
  isTabDrawerOpen: boolean;
  /** Actions queued while offline; replayed in order when connectivity returns. */
  offlineQueue: OfflineAction[];
  /** True while the queue is being replayed after reconnection. Not persisted. */
  isSyncing: boolean;
}

interface TabsActions {
  /** Replaces the tabs list with the result from TanStack Query. */
  loadTabs: (tabs: Tab[]) => void;

  /** Adds a freshly-created tab; returns DUPLICATE_ENTRY if it already exists. */
  openTab: (tab: Tab) => Result<Tab>;

  /** Sets which tab the cart panel is currently editing. */
  setActiveTab: (id: string | null) => void;

  /** Updates a tab's status; returns NOT_FOUND if the tab is not in the store. */
  updateTabStatus: (id: string, status: Tab['status']) => Result<undefined>;

  /** Applies a Supabase Realtime INSERT / UPDATE / DELETE event to the tabs list. */
  handleRealtimeUpdate: (payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    new: Partial<Tab>;
    old: Partial<Tab>;
  }) => void;

  /** Selects a tab in the drawer UI and sets it as the active cart tab. */
  selectTab: (id: string) => void;

  /** Clears the drawer UI selection. */
  clearSelection: () => void;

  /** Opens the tab drawer. */
  openDrawer: () => void;

  /** Closes the tab drawer. */
  closeDrawer: () => void;

  /** Appends an action to the offline queue. */
  enqueueOfflineAction: (action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>) => void;

  /** Removes a single action from the offline queue by its id. */
  dequeueOfflineAction: (id: string) => void;

  /** Clears all queued offline actions. */
  clearOfflineQueue: () => void;

  /** Sets the syncing flag shown in the OfflineBanner. */
  setSyncing: (flag: boolean) => void;
}

type TabsStore = TabsState & TabsActions;

export const useTabStore = create<TabsStore>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,
      selectedTabId: null,
      isTabDrawerOpen: false,
      offlineQueue: [],
      isSyncing: false,

      loadTabs: tabs => {
        logger.info('tabs.loaded', { count: tabs.length });
        set({ tabs });
      },

      openTab: tab => {
        if (get().tabs.some(t => t.id === tab.id)) {
          logger.warn('tabs.open.duplicate', { tabId: tab.id });
          return err({ code: 'DUPLICATE_ENTRY', message: 'Tab already exists in store.' });
        }
        logger.info('tabs.opened', { tabId: tab.id, customerName: tab.customerName });
        set(state => ({ tabs: [tab, ...state.tabs] }));
        return ok(tab);
      },

      setActiveTab: id => {
        logger.debug('tabs.activeTab.set', { tabId: id });
        set({ activeTabId: id });
      },

      updateTabStatus: (id, status) => {
        if (!get().tabs.some(t => t.id === id)) {
          logger.warn('tabs.updateStatus.notFound', { tabId: id });
          return err({ code: 'NOT_FOUND', message: 'Tab not found.' });
        }
        logger.info('tabs.status.updated', { tabId: id, status });
        set(state => ({
          tabs: state.tabs.map(t => (t.id === id ? { ...t, status } : t)),
        }));
        return ok(undefined);
      },

      handleRealtimeUpdate: ({ eventType, new: newRecord, old: oldRecord }) => {
        logger.debug('tabs.realtime', { eventType, tabId: newRecord.id ?? oldRecord.id });
        set(state => {
          switch (eventType) {
            case 'INSERT':
              if (newRecord.id && !state.tabs.some(t => t.id === newRecord.id)) {
                return { tabs: [newRecord as Tab, ...state.tabs] };
              }
              return state;
            case 'UPDATE':
              return {
                tabs: state.tabs.map(t => (t.id === newRecord.id ? { ...t, ...newRecord } : t)),
              };
            case 'DELETE':
              return { tabs: state.tabs.filter(t => t.id !== oldRecord.id) };
            default:
              return state;
          }
        });
      },

      selectTab: id => {
        logger.debug('tabs.selected', { tabId: id });
        set({ selectedTabId: id, activeTabId: id });
      },

      clearSelection: () => {
        logger.debug('tabs.selectionCleared');
        set({ selectedTabId: null, activeTabId: null });
      },

      openDrawer: () => {
        set({ isTabDrawerOpen: true });
      },

      closeDrawer: () => {
        set({ isTabDrawerOpen: false });
      },

      enqueueOfflineAction: action => {
        const entry: OfflineAction = {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          retryCount: 0,
          ...action,
        };
        logger.warn('offline.action.queued', { type: entry.type, id: entry.id });
        set(state => ({ offlineQueue: [...state.offlineQueue, entry] }));
      },

      dequeueOfflineAction: id => {
        logger.debug('offline.action.dequeued', { id });
        set(state => ({ offlineQueue: state.offlineQueue.filter(a => a.id !== id) }));
      },

      clearOfflineQueue: () => {
        logger.info('offline.queue.cleared');
        set({ offlineQueue: [] });
      },

      setSyncing: flag => {
        set({ isSyncing: flag });
      },
    }),
    {
      name: 'tabs',
      // Only persist UI selection and the offline queue.
      // The tabs array is server state owned by TanStack Query — persisting it
      // causes Date deserialisation bugs and stale data.
      // isSyncing is volatile and must never be persisted.
      partialize: state => ({
        activeTabId: state.activeTabId,
        selectedTabId: state.selectedTabId,
        offlineQueue: state.offlineQueue,
      }),
    }
  )
);

/** Returns a tab by ID, or undefined if not in store. */
export const selectTabById = (id: string): Tab | undefined =>
  useTabStore.getState().tabs.find(t => t.id === id);

/** Returns all tabs with status 'open'. */
export const selectOpenTabs = (): Tab[] =>
  useTabStore.getState().tabs.filter(t => t.status === 'open');
