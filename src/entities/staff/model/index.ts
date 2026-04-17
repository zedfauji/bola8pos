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

// State Management
export { useStaffStore } from './store';

// Context
export { AuthProvider, useAuth } from './AuthContext';

// Data Fetching
export { staffKeys, useStaffList, useMutationClockIn, useMutationClockOut } from './queries';
