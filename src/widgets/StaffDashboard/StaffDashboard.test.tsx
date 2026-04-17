import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStaffStore } from '@entities/staff/model/store';
import type { Shift, Staff } from '@shared/lib/domain';
import { renderWithProviders } from '@shared/lib/test-utils';
import { StaffDashboard } from './StaffDashboard';

const staffOpen: Staff = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  name: 'Alex',
  email: 'a@b.dev',
  role: 'bartender',
  pin: '123456',
  isActive: true,
};

const staffClosed: Staff = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  name: 'Jamie',
  email: 'j@b.dev',
  role: 'manager',
  pin: '654321',
  isActive: true,
};

const openShift: Shift = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  staffId: staffOpen.id,
  clockIn: new Date('2026-04-17T09:00:00.000Z'),
  clockOut: null,
  openingCash: 100,
  closingCash: null,
};

const useStaffList = vi.fn();
const useOpenShifts = vi.fn();
const usePermissions = vi.fn();

vi.mock('@entities/staff', () => ({
  useStaffList: () => useStaffList(),
  useOpenShifts: () => useOpenShifts(),
  usePermissions: () => usePermissions(),
}));

vi.mock('sonner', () => ({
  toast: { message: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

describe('StaffDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStaffList.mockReturnValue({
      data: [staffOpen, staffClosed],
      isIdleOrLoading: false,
      isEmpty: false,
    });
    useOpenShifts.mockReturnValue({
      data: [openShift],
      isIdleOrLoading: false,
    });
    usePermissions.mockReturnValue({
      can: (action: string) => action === 'manage_staff',
    });
    useStaffStore.setState({
      currentStaff: { ...staffClosed },
      currentShift: null,
      staffList: [],
      isAuthenticated: true,
    });
  });

  it('renders staff rows and clock actions', () => {
    renderWithProviders(<StaffDashboard />);
    expect(screen.getByText('Alex')).toBeInTheDocument();
    expect(screen.getByText('Jamie')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clock Out' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clock In' })).toBeInTheDocument();
  });

  it('shows loading state when queries pending', () => {
    useStaffList.mockReturnValue({ data: undefined, isIdleOrLoading: true });
    useOpenShifts.mockReturnValue({ data: undefined, isIdleOrLoading: true });

    renderWithProviders(<StaffDashboard />);
    expect(screen.getByPlaceholderText('Search staff…')).toBeInTheDocument();
    expect(screen.getAllByRole('status', { name: 'Loading...' }).length).toBeGreaterThan(0);
  });

  it('shows Administration when can manage_staff', () => {
    renderWithProviders(<StaffDashboard />);
    expect(screen.getByRole('heading', { name: 'Administration' })).toBeInTheDocument();
  });

  it('hides Administration when cannot manage_staff', () => {
    usePermissions.mockReturnValue({ can: () => false });
    renderWithProviders(<StaffDashboard />);
    expect(screen.queryByRole('heading', { name: 'Administration' })).not.toBeInTheDocument();
  });

  it('fires toast on Add Staff admin action', async () => {
    const user = userEvent.setup();
    renderWithProviders(<StaffDashboard />);

    await user.click(screen.getByRole('button', { name: 'Add Staff' }));
    expect(toast.message).toHaveBeenCalled();
  });
});
