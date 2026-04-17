import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Staff, Shift } from '@shared/lib/domain';
import { logger } from '@shared/lib/logger-instance';
import { supabase } from '@shared/lib/supabase';

interface StaffState {
  currentStaff: Staff | null;
  currentShift: Shift | null;
  /** Active staff profiles from server; refreshed by `useStaffList`. */
  staffList: Staff[];
  isAuthenticated: boolean;
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

      login: (staff, shift) => {
        logger.info('staff.loggedIn', { staffId: staff.id, shiftId: shift.id, role: staff.role });
        set({ currentStaff: staff, currentShift: shift, isAuthenticated: true });
      },

      logout: () => {
        logger.info('staff.loggedOut');
        void supabase.auth.signOut();
        set({ currentStaff: null, currentShift: null, staffList: [], isAuthenticated: false });
      },

      updateShift: shift => {
        logger.info('staff.shift.updated', { shiftId: shift.id });
        set({ currentShift: shift });
      },

      setStaffList: staff => {
        logger.info('staff.list.loaded', { count: staff.length });
        set({ staffList: staff });
      },
    }),
    {
      name: 'staff-store',
      partialize: state => ({
        currentStaff: state.currentStaff,
        currentShift: state.currentShift,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
