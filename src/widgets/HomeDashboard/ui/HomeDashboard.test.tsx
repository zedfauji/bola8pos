import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type * as ReactRouterDom from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useStaffStore } from '@entities/staff/model/store';
import { usePermissions } from '@entities/staff/model/usePermissions';
import { renderWithProviders } from '@shared/lib/test-utils';

import { HomeDashboard } from './HomeDashboard';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async importOriginal => {
  const actual = await importOriginal<typeof ReactRouterDom>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@entities/staff/model/usePermissions', () => ({
  usePermissions: vi.fn(),
}));

vi.mock('@entities/staff/model/store', () => ({
  useStaffStore: vi.fn(),
}));

// Suppress ManagerPinDialog queries in unit tests
vi.mock('@features/manager-pin-gate', () => ({
  ManagerPinDialog: ({ open }: { open: boolean }) =>
    open ? <div role="alertdialog" aria-label="Manager PIN dialog" /> : null,
}));

const mockBartender = {
  id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  name: 'Test Bartender',
  email: 'bartender@example.com',
  role: 'bartender' as const,
  pin: '123456',
  isActive: true,
};

const mockManager = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  name: 'Test Manager',
  email: 'manager@example.com',
  role: 'manager' as const,
  pin: '789012',
  isActive: true,
};

const mockLogout = vi.fn();

// Simulate Zustand selector: receives a partial state, runs the selector against it.
// Using ReturnType trick to extract the internal store state shape.
type StoreState = Parameters<Parameters<typeof useStaffStore>[0]>[0];
const mockStoreState =
  (partial: Partial<StoreState>) =>
  (fn: (s: StoreState) => unknown): unknown =>
    fn(partial as StoreState);

function setupBartender() {
  vi.mocked(usePermissions).mockReturnValue({ can: (action: string) => action === 'create_order' });
  vi.mocked(useStaffStore).mockImplementation(
    mockStoreState({ currentStaff: mockBartender, logout: mockLogout })
  );
}

function setupManager() {
  vi.mocked(usePermissions).mockReturnValue({
    can: (action: string) =>
      ['create_order', 'view_reports', 'adjust_inventory', 'close_tab'].includes(action),
  });
  vi.mocked(useStaffStore).mockImplementation(
    mockStoreState({ currentStaff: mockManager, logout: mockLogout })
  );
}

describe('HomeDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupBartender();
  });

  it('renders all 7 navigation button labels', () => {
    renderWithProviders(<HomeDashboard />);
    expect(screen.getByRole('button', { name: 'POS Register' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pool Tables' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rappi Orders' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Staff' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reports' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inventory' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
  });

  it('shows welcome message with staff name and role', () => {
    renderWithProviders(<HomeDashboard />);
    expect(screen.getByText('Welcome, Test Bartender')).toBeInTheDocument();
    expect(screen.getByText('bartender')).toBeInTheDocument();
  });

  it('bartender clicking POS Register navigates directly to /pos', async () => {
    const user = userEvent.setup();
    renderWithProviders(<HomeDashboard />);

    await user.click(screen.getByRole('button', { name: 'POS Register' }));

    expect(mockNavigate).toHaveBeenCalledWith('/pos');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('bartender clicking Reports opens Manager PIN dialog instead of navigating', async () => {
    const user = userEvent.setup();
    renderWithProviders(<HomeDashboard />);

    await user.click(screen.getByRole('button', { name: 'Reports' }));

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('manager clicking Reports navigates directly without dialog', async () => {
    setupManager();
    const user = userEvent.setup();
    renderWithProviders(<HomeDashboard />);

    await user.click(screen.getByRole('button', { name: 'Reports' }));

    expect(mockNavigate).toHaveBeenCalledWith('/reports');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('gated buttons show lock icon for bartender', () => {
    renderWithProviders(<HomeDashboard />);
    const lockIcons = screen.getAllByTestId('lock-icon');
    // Reports, Inventory, Settings are gated for bartender
    expect(lockIcons.length).toBe(3);
  });

  it('logout button calls logout and navigates to /login', async () => {
    const user = userEvent.setup();
    renderWithProviders(<HomeDashboard />);

    await user.click(screen.getByRole('button', { name: /logout/i }));

    expect(mockLogout).toHaveBeenCalledOnce();
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});
