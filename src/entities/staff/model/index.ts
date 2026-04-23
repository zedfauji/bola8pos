/**
 * STAFF ENTITY - BARREL EXPORT
 */

// Types & Schemas
export {
  StaffSchema,
  StaffCreateSchema,
  StaffUpdateSchema,
  ShiftSchema,
  StaffCreateSchema as CreateStaffSchema, // Keep alias if needed or just fix downstream
  StaffUpdateSchema as UpdateStaffSchema,
  ShiftCreateSchema,
  ShiftUpdateSchema,
  mockStaff,
} from './types';

export type { Staff, StaffCreate, StaffUpdate, Shift, ShiftCreate, ShiftUpdate } from './types';
export type { ShiftClosePreview } from './queries';

// State Management
export { useStaffStore } from './store';
export { useLoginUiStore } from './loginUiStore';

// Data Fetching
export {
  staffKeys,
  useStaffList,
  useOpenShifts,
  useShiftClosePreview,
  useMutationClockIn,
  useMutationClockOut,
  useStaffMetrics,
  useStaffTips,
} from './queries';
export { usePermissions } from './usePermissions';
