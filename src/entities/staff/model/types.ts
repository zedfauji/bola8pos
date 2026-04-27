import {
  StaffSchema,
  StaffCreateSchema,
  StaffUpdateSchema,
  ShiftSchema,
  ShiftCreateSchema,
  ShiftUpdateSchema,
} from '@shared/lib/domain';
import type {
  Staff,
  StaffCreate,
  StaffUpdate,
  Shift,
  ShiftCreate,
  ShiftUpdate,
} from '@shared/lib/domain';

export {
  StaffSchema,
  StaffCreateSchema,
  StaffUpdateSchema,
  ShiftSchema,
  ShiftCreateSchema,
  ShiftUpdateSchema,
};

export type { Staff, StaffCreate, StaffUpdate, Shift, ShiftCreate, ShiftUpdate };

// Re-export mock data if needed, but ideally move to shared mocks
export const mockStaff: Staff[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Alex Martinez',
    email: 'alex@barpos.dev',
    role: 'bartender',
    pin: '123456',
    isActive: true,
  },
  {
    id: '22222222-3333-4444-5555-666666666666',
    name: 'Jamie Chen',
    email: 'jamie@barpos.dev',
    role: 'manager',
    pin: '789012',
    isActive: true,
  },
];
