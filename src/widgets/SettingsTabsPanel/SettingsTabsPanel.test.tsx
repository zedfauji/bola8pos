import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SettingsTabsPanel } from './index';

const permissionState = {
  manageSettings: false,
  manageProducts: false,
};

const roleState: { role: 'admin' | 'manager' | 'bartender' | null } = {
  role: 'admin',
};

vi.mock('@entities/staff/model/store', () => ({
  useStaffStore: (selector: (state: { currentStaff: { role: string } | null }) => unknown) =>
    selector({
      currentStaff: roleState.role ? { role: roleState.role } : null,
    }),
}));

vi.mock('@entities/staff/model/usePermissions', () => ({
  usePermissions: () => ({
    can: (action: string) => {
      if (action === 'manage_settings') return permissionState.manageSettings;
      if (action === 'manage_products') return permissionState.manageProducts;
      return false;
    },
  }),
}));

vi.mock('./tabs/GeneralSettingsTab', () => ({
  GeneralSettingsTab: () => <div>General tab content</div>,
}));
vi.mock('./tabs/HardwareSettingsTab', () => ({
  HardwareSettingsTab: () => <div>Hardware tab content</div>,
}));
vi.mock('./tabs/RappiSettingsTab', () => ({
  RappiSettingsTab: () => <div>Rappi tab content</div>,
}));
vi.mock('./tabs/EmailReceiptsSettingsTab', () => ({
  EmailReceiptsSettingsTab: () => <div>Email tab content</div>,
}));
vi.mock('./tabs/BackupSettingsTab', () => ({
  BackupSettingsTab: () => <div>Backup tab content</div>,
}));
vi.mock('./tabs/ProductsSettingsTab', () => ({
  ProductsSettingsTab: () => <div>Products tab content</div>,
}));
vi.mock('./tabs/PoolTablesSettingsTab', () => ({
  PoolTablesSettingsTab: () => <div>Pool tab content</div>,
}));
vi.mock('./tabs/BillingSettingsTab', () => ({
  BillingSettingsTab: () => <div>Billing tab content</div>,
}));

describe('SettingsTabsPanel', () => {
  beforeEach(() => {
    permissionState.manageSettings = false;
    permissionState.manageProducts = false;
    roleState.role = 'admin';
  });

  it('shows manager tabs when only manage_products is granted', () => {
    permissionState.manageProducts = true;
    permissionState.manageSettings = false;
    roleState.role = 'manager';

    render(<SettingsTabsPanel />);

    expect(screen.getByRole('tab', { name: 'Products' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Pool Tables' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Billing' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'General' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Backup' })).not.toBeInTheDocument();
  });

  it('shows all tabs for admin with both permissions', () => {
    permissionState.manageProducts = true;
    permissionState.manageSettings = true;
    roleState.role = 'admin';

    render(<SettingsTabsPanel />);

    expect(screen.getByRole('tab', { name: 'General' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Products' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Backup' })).toBeInTheDocument();
  });
});
