import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Staff, Shift } from '@shared/lib/domain';
import i18n from '@shared/lib/i18n';
import { logger } from '@shared/lib/logger-instance';
import { supabase } from '@shared/lib/supabase';
/* eslint-disable i18next/no-literal-string -- zustand persist store name below
   is a localStorage key, not UI copy. */

interface StaffState {
  currentStaff: Staff | null;
  currentShift: Shift | null;
  /** Active staff profiles from server; refreshed by `useStaffList`. */
  staffList: Staff[];
  isAuthenticated: boolean;
  /**
   * True once zustand's persist middleware has finished reading localStorage
   * and applying the restored state. `persist` hydration runs in a microtask
   * AFTER React's first paint, so any consumer that gates on `isAuthenticated`
   * before this flag is true (e.g. ProtectedRoute) sees the pre-hydration
   * default (false) on every fresh page load and can redirect away before the
   * real persisted value is ever applied. Not persisted — reset to false on
   * every load, flips true once by `onRehydrateStorage` below.
   */
  hasHydrated: boolean;
  /**
   * Actions temporarily unlocked via Manager PIN dialog for the current session.
   * Cleared on logout. Not persisted — intentionally session-scoped.
   */
  managerGrantedActions: ReadonlySet<string>;
}

interface StaffActions {
  /**
   * Sets the logged-in staff member and their active shift.
   * Called after a successful PIN auth + shift lookup / creation.
   */
  login: (staff: Staff, shift: Shift) => void;

  /** Clears staff and shift state; called on explicit logout or session expiry. */
  logout: () => void;

  /** Replaces the current shift (e.g. after clock-out or opening cash update). */
  updateShift: (shift: Shift) => void;

  /** Replaces cached staff directory from TanStack Query. */
  setStaffList: (staff: Staff[]) => void;

  /** Grants a set of actions via Manager PIN approval for this session. */
  grantManagerActions: (actions: string[]) => void;
}

type StaffStore = StaffState & StaffActions;

/** Persisted so staff do not need to re-authenticate on page reload. */
export const useStaffStore = create<StaffStore>()(
  persist(
    set => ({
      currentStaff: null,
      currentShift: null,
      staffList: [],
      isAuthenticated: false,
      hasHydrated: false,
      managerGrantedActions: new Set<string>(),

      login: (staff, shift) => {
        logger.info('staff.loggedIn', { staffId: staff.id, shiftId: shift.id, role: staff.role });
        set({
          currentStaff: staff,
          currentShift: shift,
          isAuthenticated: true,
          managerGrantedActions: new Set<string>(),
        });
        // D-01/D-02: locale is staff-attribute-driven, never navigator.language —
        // prevents one staff member's language leaking onto the next shift's
        // login on the same shared kiosk terminal.
        void i18n.changeLanguage(staff.locale);
      },

      logout: () => {
        logger.info('staff.loggedOut');
        void supabase.auth.signOut();
        set({
          currentStaff: null,
          currentShift: null,
          staffList: [],
          isAuthenticated: false,
          managerGrantedActions: new Set<string>(),
        });
      },

      updateShift: shift => {
        logger.info('staff.shift.updated', { shiftId: shift.id });
        set({ currentShift: shift });
      },

      setStaffList: staff => {
        logger.info('staff.list.loaded', { count: staff.length });
        set({ staffList: staff });
      },

      grantManagerActions: (actions: string[]) => {
        logger.info('staff.managerActions.granted', { actions });
        set(state => ({
          managerGrantedActions: new Set([...state.managerGrantedActions, ...actions]),
        }));
      },
    }),
    {
      name: 'staff-store',
      partialize: state => ({
        currentStaff: state.currentStaff,
        currentShift: state.currentShift,
        isAuthenticated: state.isAuthenticated,
        // managerGrantedActions intentionally NOT persisted — session-only
      }),
      onRehydrateStorage: () => state => {
        useStaffStore.setState({ hasHydrated: true });
        // Reloaded page / restored session: re-apply the persisted staff's
        // locale (D-01) rather than defaulting to navigator.language.
        if (state?.currentStaff) {
          void i18n.changeLanguage(state.currentStaff.locale);
        }
      },
    }
  )
);
