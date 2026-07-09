/**
 * audit-actions.ts
 *
 * Master enum of all valid audit log action labels.
 * Format: <entity>.<verb> (lowercase, dot-separated).
 *
 * CI enforcement: src/shared/lib/__tests__/audit-actions.test.ts
 * greps all migration files to assert every record_audit() call uses
 * an action present in AuditActionSchema.options.
 *
 * Phase 14 — SINGLE SOURCE OF TRUTH. Add new actions here before
 * adding record_audit() calls to RPCs.
 */

import { z } from 'zod';

export const AuditActionSchema = z.enum([
  // Payments
  'payment.process',
  'payment.process_split',
  'payment.refund',
  // Tabs
  'tab.close',
  'tab.transfer',
  'tab.void',
  'tab.split',
  // Caja
  'caja.open',
  'caja.close',
  'caja.entry',
  // Orders
  'order.create',
  'order.void',
  // Combos
  'combo.add_to_tab',
  // Inventory
  'inventory.deplete',
  'inventory.manual_adjust',
  'inventory.physical_count',
  // Prep
  'prep.produce',
  // Permissions
  'permission.toggle',
  'permission.force_pin_change',
  // Staff
  'staff.role_change',
  'staff.create',
  // Settings
  'settings.update',
  // Tip distribution
  'tip_distribution.compute',
]);

export type AuditAction = z.infer<typeof AuditActionSchema>;

export const AuditAction = {
  PAYMENT_PROCESS: 'payment.process',
  PAYMENT_PROCESS_SPLIT: 'payment.process_split',
  PAYMENT_REFUND: 'payment.refund',
  TAB_CLOSE: 'tab.close',
  TAB_TRANSFER: 'tab.transfer',
  TAB_VOID: 'tab.void',
  TAB_SPLIT: 'tab.split',
  CAJA_OPEN: 'caja.open',
  CAJA_CLOSE: 'caja.close',
  CAJA_ENTRY: 'caja.entry',
  ORDER_CREATE: 'order.create',
  ORDER_VOID: 'order.void',
  COMBO_ADD_TO_TAB: 'combo.add_to_tab',
  INVENTORY_DEPLETE: 'inventory.deplete',
  INVENTORY_MANUAL_ADJUST: 'inventory.manual_adjust',
  INVENTORY_PHYSICAL_COUNT: 'inventory.physical_count',
  PREP_PRODUCE: 'prep.produce',
  PERMISSION_TOGGLE: 'permission.toggle',
  PERMISSION_FORCE_PIN_CHANGE: 'permission.force_pin_change',
  STAFF_ROLE_CHANGE: 'staff.role_change',
  STAFF_CREATE: 'staff.create',
  SETTINGS_UPDATE: 'settings.update',
  TIP_DISTRIBUTION_COMPUTE: 'tip_distribution.compute',
} as const satisfies Record<string, AuditAction>;
