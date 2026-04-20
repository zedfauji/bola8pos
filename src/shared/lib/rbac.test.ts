import { describe, it, expect } from 'vitest';
import {
  STAFF_ACTIONS,
  STAFF_ROLES,
  canAccess,
  isStaffAction,
  rbacDenialMessage,
  type StaffRole,
} from './rbac';

/** Mirror of product rules — kept in sync with rbac.ts sets. */
const ALLOWED: Record<StaffRole, ReadonlySet<string>> = {
  bartender: new Set([
    'create_order',
    'view_own_tabs',
    'view_all_tabs',
    'start_pool_timer',
    'stop_pool_timer',
    'clock_in',
    'clock_out',
    'transfer_tab',
  ]),
  manager: new Set([
    'create_order',
    'view_own_tabs',
    'view_all_tabs',
    'start_pool_timer',
    'stop_pool_timer',
    'clock_in',
    'clock_out',
    'transfer_tab',
    'close_tab',
    'void_order',
    'view_reports',
    'adjust_inventory',
    'manage_products',
    'manage_caja',
  ]),
  admin: new Set(STAFF_ACTIONS),
};

describe('rbac', () => {
  describe('canAccess', () => {
    it.each(STAFF_ROLES.flatMap(role => STAFF_ACTIONS.map(action => [role, action] as const)))(
      '%s may %s iff matrix allows',
      (role, action) => {
        expect(canAccess(role, action)).toBe(ALLOWED[role].has(action));
      }
    );

    it('returns false for null or undefined role', () => {
      expect(canAccess(null, 'close_tab')).toBe(false);
      expect(canAccess(undefined, 'close_tab')).toBe(false);
    });

    it('returns false for unknown action strings', () => {
      expect(canAccess('admin', 'not_an_action')).toBe(false);
    });
  });

  describe('isStaffAction', () => {
    it('recognizes known actions', () => {
      expect(isStaffAction('close_tab')).toBe(true);
    });
    it('rejects unknown', () => {
      expect(isStaffAction('manage_pool_tables')).toBe(false);
    });
  });

  describe('rbacDenialMessage', () => {
    it('uses admin copy for admin-only actions', () => {
      expect(rbacDenialMessage('manage_settings')).toBe('Admin access required');
      expect(rbacDenialMessage('manage_staff')).toBe('Admin access required');
      expect(rbacDenialMessage('delete_tab')).toBe('Admin access required');
      expect(rbacDenialMessage('view_all_shifts')).toBe('Admin access required');
    });
    it('uses manager copy for manager-tier actions', () => {
      expect(rbacDenialMessage('close_tab')).toBe('Manager access required');
      expect(rbacDenialMessage('void_order')).toBe('Manager access required');
    });
  });
});
