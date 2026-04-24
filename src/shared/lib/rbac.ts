import type { UserRole } from '@shared/lib/domain';

/** Same as persisted profile role — alias for RBAC naming. */
export type StaffRole = UserRole;

export const STAFF_ROLES = [
  'bartender',
  'manager',
  'admin',
  'kitchen',
] as const satisfies readonly StaffRole[];

export const STAFF_ACTIONS = [
  'create_order',
  'view_own_tabs',
  'view_all_tabs',
  'start_pool_timer',
  'stop_pool_timer',
  'clock_in',
  'clock_out',
  'close_tab',
  'void_order',
  'view_reports',
  'adjust_inventory',
  'manage_products',
  'manage_staff',
  'manage_settings',
  'delete_tab',
  'view_all_shifts',
  'manage_caja',
  'transfer_tab',
  'view_kds',
  'process_refund',
] as const;

export type StaffAction = (typeof STAFF_ACTIONS)[number];

const BARTENDER_ACTIONS: ReadonlySet<StaffAction> = new Set([
  'create_order',
  'view_own_tabs',
  'view_all_tabs', // any bartender can see and operate any open tab
  'start_pool_timer',
  'stop_pool_timer',
  'clock_in',
  'clock_out',
  'transfer_tab', // bartenders can transfer tabs between tables
  'close_tab', // bartenders can process payments via PIN verification
]);

const MANAGER_EXTRA: ReadonlySet<StaffAction> = new Set([
  'close_tab',
  'void_order',
  'view_reports',
  'adjust_inventory',
  'manage_products',
  'manage_caja', // open and close the daily caja session
  'process_refund', // process payment refunds (manager+ only)
]);

const KITCHEN_ACTIONS: ReadonlySet<StaffAction> = new Set(['view_kds', 'clock_in', 'clock_out']);

const ADMIN_EXTRA: ReadonlySet<StaffAction> = new Set([
  'manage_staff',
  'manage_settings',
  'delete_tab',
  'view_all_shifts',
  'view_kds',
]);

const MANAGER_ACTIONS: ReadonlySet<StaffAction> = new Set([...BARTENDER_ACTIONS, ...MANAGER_EXTRA]);

const ADMIN_ACTIONS: ReadonlySet<StaffAction> = new Set([...MANAGER_ACTIONS, ...ADMIN_EXTRA]);

const ROLE_SET: Record<StaffRole, ReadonlySet<StaffAction>> = {
  bartender: BARTENDER_ACTIONS,
  manager: MANAGER_ACTIONS,
  admin: ADMIN_ACTIONS,
  kitchen: KITCHEN_ACTIONS,
};

/** Actions that require admin (tooltip copy). */
const ADMIN_ONLY_ACTIONS: ReadonlySet<StaffAction> = ADMIN_EXTRA;

export function canAccess(role: StaffRole | null | undefined, action: string): boolean {
  if (role == null) return false;
  return ROLE_SET[role].has(action as StaffAction);
}

export function isStaffAction(action: string): action is StaffAction {
  return (STAFF_ACTIONS as readonly string[]).includes(action);
}

/** Tooltip when the control is disabled due to RBAC. */
export function rbacDenialMessage(action: StaffAction): string {
  if (ADMIN_ONLY_ACTIONS.has(action)) {
    return 'Admin access required';
  }
  return 'Manager access required';
}
