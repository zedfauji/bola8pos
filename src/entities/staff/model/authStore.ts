import { create } from 'zustand';
import type { Staff } from './types';

type AuthState = {
  selectedStaff: Staff | null;
  isAuthenticated: boolean;
  currentShiftId: string | null;
  setSelectedStaff: (staff: Staff | null) => void;
  setAuthenticated: (value: boolean) => void;
  setCurrentShiftId: (shiftId: string | null) => void;
  clearSelection: () => void;
};

export const useAuthStore = create<AuthState>(set => ({
  selectedStaff: null,
  isAuthenticated: false,
  currentShiftId: null,
  setSelectedStaff: staff => {
    set({ selectedStaff: staff, isAuthenticated: false, currentShiftId: null });
  },
  setAuthenticated: value => {
    set({ isAuthenticated: value });
  },
  setCurrentShiftId: shiftId => {
    set({ currentShiftId: shiftId });
  },
  clearSelection: () => {
    set({ selectedStaff: null, isAuthenticated: false, currentShiftId: null });
  },
}));
