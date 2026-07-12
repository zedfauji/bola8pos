/**
 * MASTER DOMAIN CONTRACTS
 *
 * This is the SINGLE SOURCE OF TRUTH for all business entity types.
 * Every entity store, feature hook, and UI component imports types from HERE.
 * NEVER define entity types anywhere else.
 */

import { z } from 'zod';

// ============================================================================
// SHARED PRIMITIVES
// ============================================================================

export const MoneySchema = z.number().nonnegative().multipleOf(0.01);
export const UuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid UUID');
export const TimestampSchema = z.coerce.date();
export const PinSchema = z
  .string()
  .length(6)
  .regex(/^\d{6}$/, 'PIN must be exactly 6 digits');
export const HexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
export const TimeStringSchema = z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/);
export const UrlSchema = z
  .string()
  .regex(/^https?:\/\/.+/, 'Invalid URL')
  .refine(val => {
    try {
      new URL(val);
      return true;
    } catch {
      return false;
    }
  }, 'Invalid URL format');

// ============================================================================
// ENUMS
// ============================================================================

export const UserRoleSchema = z.enum(['bartender', 'manager', 'admin', 'kitchen']);
export const UserRole = {
  BARTENDER: 'bartender',
  MANAGER: 'manager',
  ADMIN: 'admin',
  KITCHEN: 'kitchen',
} as const;

export type UserRole = z.infer<typeof UserRoleSchema>;

// Phase 13: role_permissions table — DB-backed RBAC matrix.
// One row per (role, action) pair that grants the permission.
export const RolePermissionSchema = z.object({
  id: UuidSchema,
  role: UserRoleSchema,
  action: z.string(),
  createdAt: TimestampSchema,
});

export const RolePermissionCreateSchema = RolePermissionSchema.omit({
  id: true,
  createdAt: true,
});

export type RolePermission = z.infer<typeof RolePermissionSchema>;
export type RolePermissionCreate = z.infer<typeof RolePermissionCreateSchema>;

export const TabStatusSchema = z.enum(['open', 'closed', 'paid', 'voided', 'split']);
export const TabStatus = {
  OPEN: 'open',
  CLOSED: 'closed',
  PAID: 'paid',
  VOIDED: 'voided',
  SPLIT: 'split',
} as const;

export const OrderStatusSchema = z.enum(['pending', 'served', 'voided']);
export const OrderStatus = {
  PENDING: 'pending',
  SERVED: 'served',
  VOIDED: 'voided',
} as const;

export const KdsStatusSchema = z.enum(['pending', 'in_progress', 'done']);
export const KdsStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
} as const;
export type KdsStatus = z.infer<typeof KdsStatusSchema>;

export const PoolTableStatusSchema = z.enum(['available', 'occupied', 'reserved', 'maintenance']);

export const PoolTableTypeSchema = z.enum(['pool', 'carom', 'consumption']);
export type PoolTableType = z.infer<typeof PoolTableTypeSchema>;
export const PoolTableStatus = {
  AVAILABLE: 'available',
  OCCUPIED: 'occupied',
  RESERVED: 'reserved',
  MAINTENANCE: 'maintenance',
} as const;

export const PaymentMethodSchema = z.enum(['cash', 'card', 'rappi']);
export const PaymentMethod = {
  CASH: 'cash',
  CARD: 'card',
  RAPPI: 'rappi',
} as const;

export const InventoryAdjustReasonSchema = z.enum([
  'sale',
  'manual_adjustment',
  'waste',
  'delivery',
  'correction',
  'physical_count',
]);
export const InventoryAdjustReason = {
  SALE: 'sale',
  MANUAL_ADJUSTMENT: 'manual_adjustment',
  WASTE: 'waste',
  DELIVERY: 'delivery',
  CORRECTION: 'correction',
  PHYSICAL_COUNT: 'physical_count',
} as const;

/** Extended reason enum for the stock_movements ledger table (superset of InventoryAdjustReason) */
export const StockMovementReasonSchema = z.enum([
  'sale',
  'manual_adjustment',
  'waste',
  'delivery',
  'correction',
  'physical_count',
  'prep_production',
  'prep_consumption',
  'combo_component',
  'refund',
  'void',
]);
export const StockMovementReason = {
  SALE: 'sale',
  MANUAL_ADJUSTMENT: 'manual_adjustment',
  WASTE: 'waste',
  DELIVERY: 'delivery',
  CORRECTION: 'correction',
  PHYSICAL_COUNT: 'physical_count',
  PREP_PRODUCTION: 'prep_production',
  PREP_CONSUMPTION: 'prep_consumption',
  COMBO_COMPONENT: 'combo_component',
  REFUND: 'refund',
  VOID: 'void',
} as const;
export type StockMovementReason = z.infer<typeof StockMovementReasonSchema>;

export const DiscountScopeSchema = z.enum(['all', 'pool_only', 'consumptions_only']);
export const DiscountScope = {
  ALL: 'all',
  POOL_ONLY: 'pool_only',
  CONSUMPTIONS_ONLY: 'consumptions_only',
} as const;
export type DiscountScope = z.infer<typeof DiscountScopeSchema>;

export const DiscountTypeSchema = z.enum(['percent', 'fixed']);
export const DiscountType = {
  PERCENT: 'percent',
  FIXED: 'fixed',
} as const;
export type DiscountType = z.infer<typeof DiscountTypeSchema>;

export const CategoryRoutingSchema = z.enum(['KITCHEN', 'BAR', 'NONE']);
export type CategoryRouting = z.infer<typeof CategoryRoutingSchema>;

// ============================================================================
// CATEGORY
// ============================================================================

export const CategorySchema = z.object({
  id: UuidSchema,
  name: z.string().min(1).max(50),
  color: HexColorSchema,
  sortOrder: z.number().int().nonnegative(),
  /**
   * DEPRECATED — superseded by the promotions engine (Phase 20, D-01).
   * Always null now; kept nullable (not a JSDoc `@deprecated` tag — that
   * trips `@typescript-eslint/no-deprecated` across the remaining client
   * display consumers, which Plan 20-11 removes) to bound blast radius
   * pending that housekeeping removal.
   */
  happyHourStart: TimeStringSchema.nullable(),
  /**
   * DEPRECATED — superseded by the promotions engine (Phase 20, D-01).
   * Always null now; see {@link happyHourStart} for the full rationale.
   */
  happyHourEnd: TimeStringSchema.nullable(),
  routing: CategoryRoutingSchema.default('NONE'),
  /** Parent category id for hierarchical nesting (max depth 3). Null = root category. */
  parentId: UuidSchema.nullable().optional(),
  createdAt: TimestampSchema,
});

export const CategoryCreateSchema = CategorySchema.omit({
  id: true,
  createdAt: true,
});

export const CategoryUpdateSchema = CategorySchema.partial().required({ id: true });

export type Category = z.infer<typeof CategorySchema>;
export type CategoryCreate = z.infer<typeof CategoryCreateSchema>;
export type CategoryUpdate = z.infer<typeof CategoryUpdateSchema>;

// ============================================================================
// MODIFIER
// ============================================================================

export const ModifierSchema = z.object({
  id: UuidSchema,
  name: z.string().min(1).max(50),
  priceDelta: z.number().multipleOf(0.01),
  sortOrder: z.number().int().nonnegative(),
});

export const ModifierCreateSchema = ModifierSchema.omit({ id: true });

export const ModifierUpdateSchema = ModifierSchema.partial().required({ id: true });

export type Modifier = z.infer<typeof ModifierSchema>;
export type ModifierCreate = z.infer<typeof ModifierCreateSchema>;
export type ModifierUpdate = z.infer<typeof ModifierUpdateSchema>;

// ============================================================================
// PRODUCT
// ============================================================================

export const ProductSchema = z.object({
  id: UuidSchema,
  name: z.string().min(1).max(100),
  categoryId: UuidSchema,
  basePrice: MoneySchema,
  /**
   * DEPRECATED — superseded by the promotions engine (Phase 20, D-01).
   * Always null now; kept nullable (not a JSDoc `@deprecated` tag — that
   * trips `@typescript-eslint/no-deprecated` across the remaining client
   * display consumers, which Plan 20-11 removes) to bound blast radius
   * pending that housekeeping removal.
   */
  happyHourPrice: MoneySchema.nullable(),
  sku: z.string().nullable(),
  isActive: z.boolean(),
  imageUrl: UrlSchema.nullable(),
  stock_threshold: z.number().nullable(),
  barcode: z.string().nullable().optional(),
  /** True when this product can be used as a component in a combo product */
  comboEligible: z.boolean().optional().default(true),
  /** True when this product IS a combo (composed of other products) */
  isCombo: z.boolean().optional().default(false),
  /** Null means price = sum of child list prices; absent = null (optional for backward compat) */
  comboPriceOverride: MoneySchema.nullable().optional(),
  category: CategorySchema.optional(),
  modifiers: z.array(ModifierSchema).default([]),
});

export const ProductCreateSchema = ProductSchema.omit({
  id: true,
  category: true,
  modifiers: true,
});

export const ProductUpdateSchema = ProductSchema.omit({
  category: true,
  modifiers: true,
})
  .partial()
  .required({ id: true });

export type Product = z.infer<typeof ProductSchema>;
export type ProductCreate = z.infer<typeof ProductCreateSchema>;
export type ProductUpdate = z.infer<typeof ProductUpdateSchema>;

// ============================================================================
// STAFF / PROFILE
// ============================================================================

export const StaffSchema = z.object({
  id: UuidSchema,
  name: z.string().min(1).max(100),
  email: z.email(),
  role: UserRoleSchema,
  pin: PinSchema,
  isActive: z.boolean(),
  mustChangePin: z.boolean(),
});

export const StaffCreateSchema = StaffSchema.omit({ id: true });

export const StaffUpdateSchema = StaffSchema.partial().required({ id: true });

export type Staff = z.infer<typeof StaffSchema>;
export type StaffCreate = z.infer<typeof StaffCreateSchema>;
export type StaffUpdate = z.infer<typeof StaffUpdateSchema>;

// ============================================================================
// SHIFT
// ============================================================================

export const ShiftSchema = z.object({
  id: UuidSchema,
  staffId: UuidSchema,
  clockIn: TimestampSchema,
  clockOut: TimestampSchema.nullable(),
  openingCash: MoneySchema,
  closingCash: MoneySchema.nullable(),
  staff: StaffSchema.optional(),
});

export const ShiftCreateSchema = ShiftSchema.omit({
  id: true,
  staff: true,
});

export const ShiftUpdateSchema = ShiftSchema.omit({ staff: true }).partial().required({ id: true });

export type Shift = z.infer<typeof ShiftSchema>;
export type ShiftCreate = z.infer<typeof ShiftCreateSchema>;
export type ShiftUpdate = z.infer<typeof ShiftUpdateSchema>;

// ============================================================================
// ORDER ITEM
// ============================================================================

export const OrderItemSchema = z.object({
  id: UuidSchema,
  orderId: UuidSchema,
  productId: UuidSchema,
  quantity: z.number().int().min(1).max(99),
  unitPrice: MoneySchema,
  modifierIds: z.array(UuidSchema).default([]),
  modifierPriceDelta: MoneySchema.default(0),
  notes: z.string().max(200).nullable(),
  kdsStatus: KdsStatusSchema.default('pending'),
  product: ProductSchema.optional(),
  modifiers: z.array(ModifierSchema).default([]),
  lineTotal: MoneySchema.optional(),
});

export const OrderItemCreateSchema = OrderItemSchema.omit({
  id: true,
  kdsStatus: true,
  product: true,
  modifiers: true,
  lineTotal: true,
});

export const OrderItemUpdateSchema = OrderItemSchema.omit({
  product: true,
  modifiers: true,
  lineTotal: true,
})
  .partial()
  .required({ id: true });

export type OrderItem = z.infer<typeof OrderItemSchema>;
export type OrderItemCreate = z.infer<typeof OrderItemCreateSchema>;
export type OrderItemUpdate = z.infer<typeof OrderItemUpdateSchema>;

// ============================================================================
// ORDER
// ============================================================================

export const OrderSchema = z.object({
  id: UuidSchema,
  tabId: UuidSchema,
  staffId: UuidSchema,
  createdAt: TimestampSchema,
  status: OrderStatusSchema,
  notes: z.string().max(500).nullable(),
  items: z.array(OrderItemSchema).default([]),
  orderTotal: MoneySchema.optional(),
});

export const OrderCreateSchema = OrderSchema.omit({
  id: true,
  createdAt: true,
  items: true,
  orderTotal: true,
});

export const OrderUpdateSchema = OrderSchema.omit({
  items: true,
  orderTotal: true,
})
  .partial()
  .required({ id: true });

export type Order = z.infer<typeof OrderSchema>;
export type OrderCreate = z.infer<typeof OrderCreateSchema>;
export type OrderUpdate = z.infer<typeof OrderUpdateSchema>;

// ============================================================================
// POOL SESSION SUMMARY (used in tab display)
// ============================================================================

export const PoolSessionSummarySchema = z.object({
  sessionId: UuidSchema,
  tableNumber: z.number().int(),
  tableLabel: z.string(),
  billedMinutes: z.number().int(),
  ratePerHour: MoneySchema,
  totalCharge: MoneySchema,
});

export type PoolSessionSummary = z.infer<typeof PoolSessionSummarySchema>;

// ============================================================================
// TAB
// ============================================================================

export const TabSchema = z.object({
  id: UuidSchema,
  customerName: z.string().min(1).max(100),
  tableNumber: z.number().int().min(1).max(200).nullable(),
  staffId: UuidSchema,
  shiftId: UuidSchema,
  openedAt: TimestampSchema,
  closedAt: TimestampSchema.nullable(),
  status: TabStatusSchema,
  notes: z.string().max(500).nullable(),
  orders: z.array(OrderSchema).default([]),
  items: z.array(OrderItemSchema).default([]),
  poolCharges: z.array(PoolSessionSummarySchema).default([]),
  /** True when a pool session linked to this tab has not been stopped yet */
  hasActivePoolSession: z.boolean().optional(),
  /** Pool table number for the running session, when hasActivePoolSession */
  activePoolTableNumber: z.number().int().nullable().optional(),
  subtotal: MoneySchema.optional(),
  staff: StaffSchema.optional(),
  /** External Rappi order id when tab originated from delivery */
  rappiOrderId: z.string().min(1).max(128).nullable().optional(),
  /** Caja session under which this tab was opened */
  cajaSessionId: UuidSchema.nullable().optional(),
  /** Parent tab id when this tab is a split child */
  parentTabId: UuidSchema.nullable().optional(),
  /** How the bill was split (set on parent tab when status = 'split') */
  splitMode: z.enum(['item', 'evenly', 'by_person', 'by_amount']).nullable().optional(),
  /** Display label for split sub-tabs (e.g. "Table 3 – Part 1") */
  splitLabel: z.string().max(50).nullable().optional(),
  /** Phase 15: optimistic-concurrency version. Server bumps on every UPDATE. */
  version: z.number().int().nonnegative().optional(),
});

export const TabCreateSchema = TabSchema.omit({
  id: true,
  openedAt: true,
  closedAt: true,
  orders: true,
  poolCharges: true,
  hasActivePoolSession: true,
  activePoolTableNumber: true,
  subtotal: true,
  staff: true,
});

export const TabUpdateSchema = TabSchema.omit({
  orders: true,
  poolCharges: true,
  hasActivePoolSession: true,
  activePoolTableNumber: true,
  subtotal: true,
  staff: true,
})
  .partial()
  .required({ id: true });

export type Tab = z.infer<typeof TabSchema>;
export type TabCreate = z.infer<typeof TabCreateSchema>;
export type TabUpdate = z.infer<typeof TabUpdateSchema>;

// ============================================================================
// RAPPI DELIVERY ORDER
// ============================================================================

export const RappiOrderStatusSchema = z.enum([
  'pending_acceptance',
  'accepted',
  'preparing',
  'ready_for_pickup',
  'completed',
  'rejected',
]);

export const RappiOrderStatus = {
  PENDING_ACCEPTANCE: 'pending_acceptance',
  ACCEPTED: 'accepted',
  PREPARING: 'preparing',
  READY_FOR_PICKUP: 'ready_for_pickup',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
} as const;

export type RappiOrderStatus = z.infer<typeof RappiOrderStatusSchema>;

/** One line item stored in rappi_orders.items (JSON) and mapped to POS order_items.notes */
export const RappiOrderItemSchema = z
  .object({
    name: z.string().min(1),
    quantity: z.number().int().min(1).max(999).default(1),
    unitPrice: MoneySchema,
  })
  .loose();

export type RappiOrderItem = z.infer<typeof RappiOrderItemSchema>;

export const RappiOrderSchema = z.object({
  id: UuidSchema,
  rappiOrderId: z.string().min(1).max(128),
  tabId: UuidSchema.nullable(),
  status: RappiOrderStatusSchema,
  customerName: z.string(),
  deliveryAddress: z.string(),
  items: z.array(RappiOrderItemSchema),
  subtotal: MoneySchema,
  rappiTotal: MoneySchema,
  receivedAt: TimestampSchema,
  acceptedAt: TimestampSchema.nullable(),
  completedAt: TimestampSchema.nullable(),
  tenantId: UuidSchema,
  rejectionReason: z.string().max(2000).nullable().optional(),
});

export type RappiOrder = z.infer<typeof RappiOrderSchema>;

// ============================================================================
// POOL SESSION (base fields; `table` added below after PoolTableSchema)
// ============================================================================

const PoolSessionBaseSchema = z.object({
  id: UuidSchema,
  tableId: UuidSchema,
  tabId: UuidSchema.nullable(),
  startedAt: TimestampSchema,
  stoppedAt: TimestampSchema.nullable(),
  billedMinutes: z.number().int().nonnegative().nullable(),
  totalCharge: MoneySchema.nullable(),
  previousTableId: UuidSchema.nullable().optional(),
  previousTableNumber: z.number().int().nullable().optional(),
  /** Phase 15: optimistic-concurrency version. Server bumps on every UPDATE. */
  version: z.number().int().nonnegative().optional(),
});

// ============================================================================
// POOL TABLE
// ============================================================================

export const PoolTableSchema = z.object({
  id: UuidSchema,
  number: z.number().int().min(1).max(30),
  label: z.string().min(1).max(50),
  ratePerHour: MoneySchema,
  status: PoolTableStatusSchema,
  tableType: PoolTableTypeSchema.default('pool'),
  currentSessionId: UuidSchema.nullable(),
  currentSession: PoolSessionBaseSchema.optional(),
});

export const PoolTableCreateSchema = PoolTableSchema.omit({ id: true, currentSession: true });

export const PoolTableUpdateSchema = PoolTableSchema.partial().required({ id: true });

export type PoolTable = z.infer<typeof PoolTableSchema>;
export type PoolTableCreate = z.infer<typeof PoolTableCreateSchema>;
export type PoolTableUpdate = z.infer<typeof PoolTableUpdateSchema>;

// ============================================================================
// POOL SESSION
// ============================================================================

export const PoolSessionSchema = PoolSessionBaseSchema.extend({
  table: z.lazy(() => PoolTableSchema).optional(),
});

export const PoolSessionCreateSchema = PoolSessionSchema.omit({
  id: true,
  startedAt: true,
  stoppedAt: true,
  billedMinutes: true,
  totalCharge: true,
  table: true,
});

export const PoolSessionUpdateSchema = PoolSessionSchema.omit({ table: true })
  .partial()
  .required({ id: true });

export type PoolSession = z.infer<typeof PoolSessionSchema>;
export type PoolSessionCreate = z.infer<typeof PoolSessionCreateSchema>;
export type PoolSessionUpdate = z.infer<typeof PoolSessionUpdateSchema>;

// ============================================================================
// PAYMENT
// ============================================================================

export const PaymentSchema = z.object({
  id: UuidSchema,
  tabId: UuidSchema,
  // Refund rows (isRefund: true) store a negative amount — the app's actual
  // ledger convention (see process_refund RPC) — so this can't be MoneySchema
  // (nonnegative). Keep the multipleOf(0.01) precision constraint without the
  // sign restriction.
  amount: z.number().multipleOf(0.01),
  tipAmount: MoneySchema,
  method: PaymentMethodSchema,
  squarePaymentId: z.string().nullable(),
  squareReceiptUrl: UrlSchema.nullable(),
  tenderedAmount: MoneySchema.nullable().optional(),
  referenceNumber: z.string().max(64).nullable().optional(),
  idempotencyKey: z.string().min(1).max(255).nullable().optional(),
  processedAt: TimestampSchema,
  processedBy: UuidSchema,
  discountScope: DiscountScopeSchema.optional(),
  discountType: DiscountTypeSchema.optional(),
  discountValue: z.number().nonnegative().optional(),
  discountAmount: MoneySchema.optional(),
  /** True when this payment record represents a refund (negative flow) */
  isRefund: z.boolean().default(false),
  /** FK to the refund record when isRefund = true */
  refundId: UuidSchema.nullable().optional(),
  /** Groups sibling payment rows created by a single split-payment submission */
  paymentGroupId: UuidSchema.nullable().optional(),
  /** Position (0-3) of this payment within its split-payment group */
  splitIndex: z.number().int().min(0).max(3).nullable().optional(),
});

export const PaymentCreateSchema = PaymentSchema.omit({
  id: true,
  processedAt: true,
});

export const PaymentUpdateSchema = PaymentSchema.partial().required({ id: true });

export type Payment = z.infer<typeof PaymentSchema>;
export type PaymentCreate = z.infer<typeof PaymentCreateSchema>;
export type PaymentUpdate = z.infer<typeof PaymentUpdateSchema>;

/**
 * One row of a split-payment submission — any payment method per row, each
 * with its own tip and method-specific fields (D-02/D-03).
 */
export const SplitPaymentLegSchema = z.object({
  method: PaymentMethodSchema,
  amount: MoneySchema,
  tipAmount: MoneySchema,
  tenderedAmount: MoneySchema.nullable().optional(),
  referenceNumber: z.string().max(64).nullable().optional(),
  rappiOrderId: z.string().max(128).nullable().optional(),
});

export type SplitPaymentLeg = z.infer<typeof SplitPaymentLegSchema>;

// ============================================================================
// INVENTORY
// ============================================================================

export const InventorySchema = z.object({
  id: UuidSchema,
  productId: UuidSchema,
  quantityOnHand: z.number().int().nonnegative(),
  lowStockThreshold: z.number().int().nonnegative(),
  unit: z.string().min(1).max(20),
  product: ProductSchema.optional(),
});

export const InventoryCreateSchema = InventorySchema.omit({
  id: true,
  product: true,
});

export const InventoryUpdateSchema = InventorySchema.omit({ product: true })
  .partial()
  .required({ id: true });

export type Inventory = z.infer<typeof InventorySchema>;
export type InventoryCreate = z.infer<typeof InventoryCreateSchema>;
export type InventoryUpdate = z.infer<typeof InventoryUpdateSchema>;

// ============================================================================
// INVENTORY LOG
// ============================================================================

export const InventoryLogSchema = z.object({
  id: UuidSchema,
  productId: UuidSchema,
  quantityDelta: z.number().int(),
  reason: InventoryAdjustReasonSchema,
  staffId: UuidSchema,
  createdAt: TimestampSchema,
});

export const InventoryLogCreateSchema = InventoryLogSchema.omit({
  id: true,
  createdAt: true,
});

export const InventoryLogUpdateSchema = InventoryLogSchema.partial().required({ id: true });

export type InventoryLog = z.infer<typeof InventoryLogSchema>;
export type InventoryLogCreate = z.infer<typeof InventoryLogCreateSchema>;
export type InventoryLogUpdate = z.infer<typeof InventoryLogUpdateSchema>;

// ============================================================================
// STOCK MOVEMENT (ledger table replacing inventory_log)
// ============================================================================

export const StockMovementSchema = z.object({
  id: UuidSchema,
  /** FK to products. null for ingredient-only movements (Phase 3+). */
  productId: UuidSchema.nullable(),
  quantityDelta: z.number(),
  reason: StockMovementReasonSchema,
  staffId: UuidSchema,
  /** Polymorphic reference type (e.g. 'order_item', 'manual_adjustment') */
  refType: z.string().nullable().optional(),
  /** Polymorphic reference id */
  refId: UuidSchema.nullable().optional(),
  /** FK to ingredient record (Phase 3 prep module; nullable until then) */
  ingredientId: UuidSchema.nullable().optional(),
  createdAt: TimestampSchema,
});

export const StockMovementCreateSchema = StockMovementSchema.omit({
  id: true,
  createdAt: true,
});

export type StockMovement = z.infer<typeof StockMovementSchema>;
export type StockMovementCreate = z.infer<typeof StockMovementCreateSchema>;

// ============================================================================
// MODIFIER GROUP
// ============================================================================

export const ModifierGroupSchema = z.object({
  id: UuidSchema,
  name: z.string().min(1).max(100),
  minSelect: z.number().int().nonnegative(),
  maxSelect: z.number().int().min(1),
  isRequired: z.boolean().default(false),
  sortOrder: z.number().int().nonnegative(),
  createdAt: TimestampSchema,
});

export const ModifierGroupCreateSchema = ModifierGroupSchema.omit({
  id: true,
  createdAt: true,
});

export const ModifierGroupUpdateSchema = ModifierGroupSchema.partial().required({ id: true });

export type ModifierGroup = z.infer<typeof ModifierGroupSchema>;
export type ModifierGroupCreate = z.infer<typeof ModifierGroupCreateSchema>;
export type ModifierGroupUpdate = z.infer<typeof ModifierGroupUpdateSchema>;

// ============================================================================
// MODIFIER GROUP ITEM (links modifier_groups ↔ modifiers)
// ============================================================================

export const ModifierGroupItemSchema = z.object({
  groupId: UuidSchema,
  modifierId: UuidSchema,
  sortOrder: z.number().int().nonnegative(),
});

export const ModifierGroupItemCreateSchema = ModifierGroupItemSchema;

export type ModifierGroupItem = z.infer<typeof ModifierGroupItemSchema>;
export type ModifierGroupItemCreate = z.infer<typeof ModifierGroupItemCreateSchema>;

// ============================================================================
// PRODUCT MODIFIER GROUP (links products ↔ modifier_groups)
// ============================================================================

export const ProductModifierGroupSchema = z.object({
  productId: UuidSchema,
  groupId: UuidSchema,
  sortOrder: z.number().int().nonnegative().nullable(),
});

export const ProductModifierGroupCreateSchema = ProductModifierGroupSchema;

export type ProductModifierGroup = z.infer<typeof ProductModifierGroupSchema>;
export type ProductModifierGroupCreate = z.infer<typeof ProductModifierGroupCreateSchema>;

// ============================================================================
// INVENTORY ALERT
// ============================================================================

/**
 * Represents a product that is at or below its stock threshold.
 * Derived by joining inventory.quantity_on_hand with products.stock_threshold.
 */
export const InventoryAlertSchema = z.object({
  productId: UuidSchema,
  productName: z.string().min(1),
  currentStock: z.number().int().nonnegative(),
  threshold: z.number().int().nonnegative(),
});

export type InventoryAlert = z.infer<typeof InventoryAlertSchema>;

// ============================================================================
// SETTINGS
// ============================================================================

export const SettingsKeySchema = z.enum([
  'general',
  'billing',
  'rappi',
  'email_receipts',
  'pool_tables',
  'receipt',
  'payment_labels',
  'tip_distribution',
]);
export type SettingsKey = z.infer<typeof SettingsKeySchema>;

export const GeneralSettingsSchema = z.object({
  barName: z.string().min(1).max(120),
  address: z.string().min(1).max(300),
  timezone: z.string().min(1).max(100),
  currency: z.string().length(3).default('MXN'),
  receiptFooterText: z.string().max(240).default(''),
});

export type GeneralSettings = z.infer<typeof GeneralSettingsSchema>;

export const BillingPaymentMethodsSchema = z.object({
  cash: z.boolean().default(true),
  bbvaCard: z.boolean().default(true),
  rappi: z.boolean().default(true),
});

export const PaymentMethodLabelsSchema = z.object({
  cash: z.string().min(1).max(40).default('Efectivo'),
  card: z.string().min(1).max(40).default('Terminal BBVA'),
  rappi: z.string().min(1).max(40).default('Rappi'),
});

export type PaymentMethodLabels = z.infer<typeof PaymentMethodLabelsSchema>;

export const BillingSettingsSchema = z.object({
  taxRatePercent: z.number().min(0).max(100).default(16),
  defaultTipPercentages: z
    .array(z.number().int().min(0).max(100))
    .min(1)
    .max(4)
    .default([10, 15, 18, 20]),
  paymentMethods: BillingPaymentMethodsSchema.default({
    cash: true,
    bbvaCard: true,
    rappi: true,
  }),
  firstHourMode: z.enum(['full', 'prorated']).default('prorated'),
});

export type BillingSettings = z.infer<typeof BillingSettingsSchema>;

export const RappiSettingsSchema = z.object({
  storeId: z.string().max(120).default(''),
  lastSyncAt: z.iso.datetime().nullable().default(null),
});

export type RappiSettings = z.infer<typeof RappiSettingsSchema>;

export const EmailReceiptSettingsSchema = z.object({
  fromEmail: z.email().trim().default(''),
});

export type EmailReceiptSettings = z.infer<typeof EmailReceiptSettingsSchema>;

export const TipDistributionSettingsSchema = z.object({
  floorPct: z.number().min(0).max(100),
  barPct: z.number().min(0).max(100),
  kitchenPct: z.number().min(0).max(100),
});

export type TipDistributionSettings = z.infer<typeof TipDistributionSettingsSchema>;

// ============================================================================
// RECEIPT SETTINGS
// ============================================================================

export const ReceiptPaperWidthSchema = z.union([z.literal(32), z.literal(40), z.literal(48)]);

export const ReceiptSettingsSchema = z.object({
  paperWidthChars: ReceiptPaperWidthSchema.default(32),
  showCashierName: z.boolean().default(true),
  showCustomerName: z.boolean().default(true),
  showReceiptNumber: z.boolean().default(true),
  headerLine2: z.string().max(48).default(''),
  footerText: z.string().max(480).default(''),
  boldTotals: z.boolean().default(true),
  printOnStart: z.boolean().default(false),
  autoCut: z.boolean().default(false),
  kdsEnabled: z.boolean().default(false),
  logoDataUrl: z.string().nullable().default(null),
});

export type ReceiptSettings = z.infer<typeof ReceiptSettingsSchema>;

// ============================================================================
// CAJA SESSION
// ============================================================================

export const CajaStatusSchema = z.enum(['open', 'closed']);
export type CajaStatus = z.infer<typeof CajaStatusSchema>;

export const CajaSessionSchema = z.object({
  id: UuidSchema,
  openedAt: TimestampSchema,
  closedAt: TimestampSchema.nullable(),
  openedBy: UuidSchema,
  closedBy: UuidSchema.nullable(),
  openingCash: MoneySchema,
  closingCash: MoneySchema.nullable(),
  notes: z.string().max(500).nullable(),
  status: CajaStatusSchema,
  openedByName: z.string().optional(),
  closedByName: z.string().nullable().optional(),
  /** Phase 15: optimistic-concurrency version. Server bumps on every UPDATE. */
  version: z.number().int().nonnegative().optional(),
});

export const CajaSessionCreateSchema = CajaSessionSchema.omit({
  id: true,
  closedAt: true,
  closedBy: true,
  closingCash: true,
  status: true,
  openedByName: true,
  closedByName: true,
});

export type CajaSession = z.infer<typeof CajaSessionSchema>;
export type CajaSessionCreate = z.infer<typeof CajaSessionCreateSchema>;

// ============================================================================
// CAJA ENTRY (expense / income against an open caja session)
// ============================================================================

export const CajaEntryTypeSchema = z.enum(['expense', 'income']);
export type CajaEntryType = z.infer<typeof CajaEntryTypeSchema>;

export const CajaEntrySchema = z.object({
  id: UuidSchema,
  cajaSessionId: UuidSchema,
  type: CajaEntryTypeSchema,
  amount: MoneySchema,
  concept: z.string().min(1).max(200),
  createdAt: TimestampSchema,
  staffId: UuidSchema,
  staffName: z.string().optional(),
});
export type CajaEntry = z.infer<typeof CajaEntrySchema>;

// ============================================================================
// TIP DISTRIBUTION ENTRY (immutable per-caja-close 3-way split snapshot)
// ============================================================================

export const TipDistributionEntrySchema = z.object({
  id: UuidSchema,
  cajaSessionId: UuidSchema,
  floorPct: z.number().min(0).max(100),
  barPct: z.number().min(0).max(100),
  kitchenPct: z.number().min(0).max(100),
  totalTips: MoneySchema,
  floorAmount: MoneySchema,
  barAmount: MoneySchema,
  kitchenAmount: MoneySchema,
  createdAt: TimestampSchema,
});
export type TipDistributionEntry = z.infer<typeof TipDistributionEntrySchema>;

export const CajaEntryCreateSchema = z.object({
  cajaSessionId: UuidSchema,
  type: CajaEntryTypeSchema,
  amount: MoneySchema,
  concept: z.string().min(1).max(200),
  staffId: UuidSchema,
});
export type CajaEntryCreate = z.infer<typeof CajaEntryCreateSchema>;

// ============================================================================
// CAJA REPORT (returned by get_caja_report RPC)
// ============================================================================

export const CajaReportSummarySchema = z.object({
  totalRevenue: MoneySchema,
  cashSales: MoneySchema,
  cardSales: MoneySchema,
  rappiSales: MoneySchema,
  orderCount: z.number().int().nonnegative(),
  tabCount: z.number().int().nonnegative(),
  totalExpenses: MoneySchema,
  totalIncome: MoneySchema,
  // netBalance can be negative when expenses exceed revenue, so use a signed money schema
  netBalance: z.number().multipleOf(0.01),
});

export const CashReconciliationSchema = z.object({
  openingCash: MoneySchema,
  cashSales: MoneySchema,
  expectedCash: MoneySchema,
  closingCash: MoneySchema.nullable(),
  variance: z.number().nullable(),
});

export const CajaReportTopProductSchema = z.object({
  productName: z.string(),
  quantity: z.number().int(),
  revenue: MoneySchema,
});

export const CajaReportStaffSchema = z.object({
  staffId: UuidSchema,
  staffName: z.string(),
  orderCount: z.number().int(),
  salesTotal: MoneySchema,
});

export const CajaReportSchema = z.object({
  cajaSession: CajaSessionSchema,
  summary: CajaReportSummarySchema,
  cashReconciliation: CashReconciliationSchema,
  topProducts: z.array(CajaReportTopProductSchema),
  staffSummary: z.array(CajaReportStaffSchema),
  cajaEntries: z.array(CajaEntrySchema),
});

export type CajaReport = z.infer<typeof CajaReportSchema>;
export type CajaReportSummary = z.infer<typeof CajaReportSummarySchema>;
export type CashReconciliation = z.infer<typeof CashReconciliationSchema>;
export type CajaReportTopProduct = z.infer<typeof CajaReportTopProductSchema>;
export type CajaReportStaff = z.infer<typeof CajaReportStaffSchema>;

// ============================================================================
// STAFF METRICS (for Staff Reports)
// ============================================================================

export const StaffMetricSchema = z.object({
  staffId: UuidSchema,
  staffName: z.string().min(1),
  revenue: MoneySchema,
  transactionCount: z.number().int().nonnegative(),
  avgCheckSize: MoneySchema,
  voidCount: z.number().int().nonnegative(),
});

export const StaffTipsSchema = z.object({
  staffId: UuidSchema,
  staffName: z.string().min(1),
  totalTips: MoneySchema,
});

export type StaffMetric = z.infer<typeof StaffMetricSchema>;
export type StaffTips = z.infer<typeof StaffTipsSchema>;

// ============================================================================
// TAB TRANSFER
// ============================================================================

export const TabTransferTypeSchema = z.enum([
  'staff',
  'table',
  'pool_to_dining',
  'dining_to_pool',
  'pool_to_pool',
  'manual',
]);

export type TabTransferType = z.infer<typeof TabTransferTypeSchema>;

export const TabTransferSchema = z.object({
  id: UuidSchema,
  tabId: UuidSchema,
  transferredAt: TimestampSchema,
  transferredBy: UuidSchema,
  fromStaffId: UuidSchema.nullable(),
  toStaffId: UuidSchema.nullable(),
  fromTable: z.number().int().nullable(),
  toTable: z.number().int().nullable(),
  reason: z.string().max(500).nullable(),
  transferType: TabTransferTypeSchema,
});

export const TabTransferCreateSchema = TabTransferSchema.omit({
  id: true,
  transferredAt: true,
});

export type TabTransfer = z.infer<typeof TabTransferSchema>;
export type TabTransferCreate = z.infer<typeof TabTransferCreateSchema>;

// ============================================================================
// POOL TABLE TRANSFER
// ============================================================================

export const PoolTableTransferSchema = z.object({
  id: UuidSchema,
  poolSessionId: UuidSchema,
  transferredAt: TimestampSchema,
  transferredBy: UuidSchema,
  fromPoolTableId: UuidSchema,
  toPoolTableId: UuidSchema,
  reason: z.string().max(500).nullable(),
});

export type PoolTableTransfer = z.infer<typeof PoolTableTransferSchema>;

export const SettingsBackupSummarySchema = z.object({
  id: UuidSchema,
  label: z.string().min(1).max(120),
  createdAt: TimestampSchema,
  createdBy: UuidSchema.nullable(),
  restoredAt: TimestampSchema.nullable(),
  restoredBy: UuidSchema.nullable(),
});

export type SettingsBackupSummary = z.infer<typeof SettingsBackupSummarySchema>;

// ============================================================================
// REPORT ROW TYPES (used by report queries and exporters)
// ============================================================================

export type ProductSalesRow = {
  productId: string;
  productName: string;
  categoryName: string;
  units: number;
  revenue: number;
  pctTotal: number;
};

export type HourlyRow = {
  hour: number;
  orderCount: number;
  revenue: number;
};

export const VoidRefundRowSchema = z.object({
  orderId: UuidSchema,
  voidedAt: TimestampSchema,
  staffName: z.string(),
  amount: MoneySchema,
  reason: z.string(),
});

export type VoidRefundRow = z.infer<typeof VoidRefundRowSchema>;

export type CategoryRevenueRow = {
  categoryId: string;
  categoryName: string;
  unitsSold: number;
  orderCount: number;
  revenue: number;
  pctTotal: number;
};

// ============================================================================
// CART ITEM (client-only â€” not in DB)
// ============================================================================

export const CartItemSchema = z.object({
  tempId: z.string(),
  product: ProductSchema,
  quantity: z.number().int().min(1),
  selectedModifiers: z.array(ModifierSchema),
  unitPrice: MoneySchema,
  notes: z.string().max(200).default(''),
  lineTotal: MoneySchema,
});

export const CartItemCreateSchema = CartItemSchema.omit({ tempId: true, lineTotal: true });

export const CartItemInputSchema = z.object({
  productId: UuidSchema,
  product: ProductSchema,
  quantity: z.number().int().positive(),
  selectedModifiers: z.array(ModifierSchema),
  unitPrice: MoneySchema,
});

export type CartItem = z.infer<typeof CartItemSchema>;
export type CartItemCreate = z.infer<typeof CartItemCreateSchema>;
export type CartItemInput = z.infer<typeof CartItemInputSchema>;

// ============================================================================
// DOMAIN NAMESPACE EXPORT
// ============================================================================

export const domain = {
  schemas: {
    // Primitives
    Money: MoneySchema,
    Uuid: UuidSchema,
    Timestamp: TimestampSchema,
    Pin: PinSchema,
    HexColor: HexColorSchema,
    TimeString: TimeStringSchema,

    // Enums
    UserRole: UserRoleSchema,
    TabStatus: TabStatusSchema,
    OrderStatus: OrderStatusSchema,
    KdsStatus: KdsStatusSchema,
    PoolTableStatus: PoolTableStatusSchema,
    PoolTableType: PoolTableTypeSchema,
    PaymentMethod: PaymentMethodSchema,
    InventoryAdjustReason: InventoryAdjustReasonSchema,
    StockMovementReason: StockMovementReasonSchema,

    // Entities
    Category: CategorySchema,
    CategoryCreate: CategoryCreateSchema,
    CategoryUpdate: CategoryUpdateSchema,

    Modifier: ModifierSchema,
    ModifierCreate: ModifierCreateSchema,
    ModifierUpdate: ModifierUpdateSchema,

    Product: ProductSchema,
    ProductCreate: ProductCreateSchema,
    ProductUpdate: ProductUpdateSchema,

    Staff: StaffSchema,
    StaffCreate: StaffCreateSchema,
    StaffUpdate: StaffUpdateSchema,

    Shift: ShiftSchema,
    ShiftCreate: ShiftCreateSchema,
    ShiftUpdate: ShiftUpdateSchema,

    OrderItem: OrderItemSchema,
    OrderItemCreate: OrderItemCreateSchema,
    OrderItemUpdate: OrderItemUpdateSchema,

    Order: OrderSchema,
    OrderCreate: OrderCreateSchema,
    OrderUpdate: OrderUpdateSchema,

    Tab: TabSchema,
    TabCreate: TabCreateSchema,
    TabUpdate: TabUpdateSchema,

    RappiOrderStatus: RappiOrderStatusSchema,
    RappiOrderItem: RappiOrderItemSchema,
    RappiOrder: RappiOrderSchema,

    PoolTable: PoolTableSchema,
    PoolTableCreate: PoolTableCreateSchema,
    PoolTableUpdate: PoolTableUpdateSchema,

    PoolSession: PoolSessionSchema,
    PoolSessionCreate: PoolSessionCreateSchema,
    PoolSessionUpdate: PoolSessionUpdateSchema,

    PoolSessionSummary: PoolSessionSummarySchema,

    Payment: PaymentSchema,
    PaymentCreate: PaymentCreateSchema,
    PaymentUpdate: PaymentUpdateSchema,

    Inventory: InventorySchema,
    InventoryCreate: InventoryCreateSchema,
    InventoryUpdate: InventoryUpdateSchema,

    InventoryLog: InventoryLogSchema,
    InventoryLogCreate: InventoryLogCreateSchema,
    InventoryLogUpdate: InventoryLogUpdateSchema,

    StockMovement: StockMovementSchema,
    StockMovementCreate: StockMovementCreateSchema,

    ModifierGroup: ModifierGroupSchema,
    ModifierGroupCreate: ModifierGroupCreateSchema,
    ModifierGroupUpdate: ModifierGroupUpdateSchema,

    ModifierGroupItem: ModifierGroupItemSchema,
    ModifierGroupItemCreate: ModifierGroupItemCreateSchema,

    ProductModifierGroup: ProductModifierGroupSchema,
    ProductModifierGroupCreate: ProductModifierGroupCreateSchema,

    SettingsKey: SettingsKeySchema,
    GeneralSettings: GeneralSettingsSchema,
    BillingPaymentMethods: BillingPaymentMethodsSchema,
    PaymentMethodLabels: PaymentMethodLabelsSchema,
    BillingSettings: BillingSettingsSchema,
    RappiSettings: RappiSettingsSchema,
    EmailReceiptSettings: EmailReceiptSettingsSchema,
    ReceiptSettings: ReceiptSettingsSchema,
    SettingsBackupSummary: SettingsBackupSummarySchema,
    TipDistributionSettings: TipDistributionSettingsSchema,

    CajaStatus: CajaStatusSchema,
    CajaSession: CajaSessionSchema,
    CajaSessionCreate: CajaSessionCreateSchema,
    CajaEntryType: CajaEntryTypeSchema,
    CajaEntry: CajaEntrySchema,
    CajaEntryCreate: CajaEntryCreateSchema,
    TipDistributionEntry: TipDistributionEntrySchema,
    CajaReport: CajaReportSchema,
    CajaReportSummary: CajaReportSummarySchema,
    CashReconciliation: CashReconciliationSchema,
    CajaReportTopProduct: CajaReportTopProductSchema,
    CajaReportStaff: CajaReportStaffSchema,

    StaffMetric: StaffMetricSchema,
    StaffTips: StaffTipsSchema,

    TabTransferType: TabTransferTypeSchema,
    TabTransfer: TabTransferSchema,
    TabTransferCreate: TabTransferCreateSchema,
    PoolTableTransfer: PoolTableTransferSchema,

    CartItem: CartItemSchema,
    CartItemCreate: CartItemCreateSchema,
    CartItemInput: CartItemInputSchema,
  },
  types: {} as {
    // Enums
    UserRole: z.infer<typeof UserRoleSchema>;
    TabStatus: z.infer<typeof TabStatusSchema>;
    OrderStatus: z.infer<typeof OrderStatusSchema>;
    KdsStatus: KdsStatus;
    PoolTableStatus: z.infer<typeof PoolTableStatusSchema>;
    PoolTableType: PoolTableType;
    PaymentMethod: z.infer<typeof PaymentMethodSchema>;
    InventoryAdjustReason: z.infer<typeof InventoryAdjustReasonSchema>;
    StockMovementReason: StockMovementReason;

    // Entities
    Category: Category;
    CategoryCreate: CategoryCreate;
    CategoryUpdate: CategoryUpdate;

    Modifier: Modifier;
    ModifierCreate: ModifierCreate;
    ModifierUpdate: ModifierUpdate;

    Product: Product;
    ProductCreate: ProductCreate;
    ProductUpdate: ProductUpdate;

    Staff: Staff;
    StaffCreate: StaffCreate;
    StaffUpdate: StaffUpdate;

    Shift: Shift;
    ShiftCreate: ShiftCreate;
    ShiftUpdate: ShiftUpdate;

    OrderItem: OrderItem;
    OrderItemCreate: OrderItemCreate;
    OrderItemUpdate: OrderItemUpdate;

    Order: Order;
    OrderCreate: OrderCreate;
    OrderUpdate: OrderUpdate;

    Tab: Tab;
    TabCreate: TabCreate;
    TabUpdate: TabUpdate;

    RappiOrderStatus: RappiOrderStatus;
    RappiOrderItem: RappiOrderItem;
    RappiOrder: RappiOrder;

    PoolTable: PoolTable;
    PoolTableCreate: PoolTableCreate;
    PoolTableUpdate: PoolTableUpdate;

    PoolSession: PoolSession;
    PoolSessionCreate: PoolSessionCreate;
    PoolSessionUpdate: PoolSessionUpdate;

    PoolSessionSummary: PoolSessionSummary;

    Payment: Payment;
    PaymentCreate: PaymentCreate;
    PaymentUpdate: PaymentUpdate;

    Inventory: Inventory;
    InventoryCreate: InventoryCreate;
    InventoryUpdate: InventoryUpdate;

    InventoryLog: InventoryLog;
    InventoryLogCreate: InventoryLogCreate;
    InventoryLogUpdate: InventoryLogUpdate;

    StockMovement: StockMovement;
    StockMovementCreate: StockMovementCreate;

    ModifierGroup: ModifierGroup;
    ModifierGroupCreate: ModifierGroupCreate;
    ModifierGroupUpdate: ModifierGroupUpdate;

    ModifierGroupItem: ModifierGroupItem;
    ModifierGroupItemCreate: ModifierGroupItemCreate;

    ProductModifierGroup: ProductModifierGroup;
    ProductModifierGroupCreate: ProductModifierGroupCreate;

    SettingsKey: SettingsKey;
    GeneralSettings: GeneralSettings;
    BillingSettings: BillingSettings;
    PaymentMethodLabels: PaymentMethodLabels;
    RappiSettings: RappiSettings;
    EmailReceiptSettings: EmailReceiptSettings;
    ReceiptSettings: ReceiptSettings;
    SettingsBackupSummary: SettingsBackupSummary;

    CajaStatus: CajaStatus;
    CajaSession: CajaSession;
    CajaSessionCreate: CajaSessionCreate;
    CajaEntryType: CajaEntryType;
    CajaEntry: CajaEntry;
    CajaEntryCreate: CajaEntryCreate;
    CajaReport: CajaReport;

    StaffMetric: StaffMetric;
    StaffTips: StaffTips;

    TabTransferType: TabTransferType;
    TabTransfer: TabTransfer;
    TabTransferCreate: TabTransferCreate;
    PoolTableTransfer: PoolTableTransfer;

    CartItem: CartItem;
    CartItemCreate: CartItemCreate;
    CartItemInput: CartItemInput;
  },
  mocks: {
    tab: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      customerName: 'Alice',
      tableNumber: 1,
      staffId: '123e4567-e89b-12d3-a456-426614174001',
      shiftId: '123e4567-e89b-12d3-a456-426614174002',
      openedAt: new Date(),
      closedAt: null,
      status: 'open',
      notes: null,
      orders: [],
      poolCharges: [],
      items: [],
      subtotal: 0,
    } as Tab,
    product: {
      id: '123e4567-e89b-12d3-a456-426614174003',
      name: 'Beer',
      categoryId: '123e4567-e89b-12d3-a456-426614174004',
      basePrice: 500,
      happyHourPrice: 400,
      sku: 'BEER-01',
      isActive: true,
      imageUrl: null,
      stock_threshold: null,
      comboEligible: true,
      isCombo: false,
      modifiers: [],
    } as Product,
    cartItem: {
      tempId: 'temp_1',
      product: {
        id: '123e4567-e89b-12d3-a456-426614174003',
        name: 'Beer',
        categoryId: '123e4567-e89b-12d3-a456-426614174004',
        basePrice: 500,
        happyHourPrice: 400,
        sku: 'BEER-01',
        isActive: true,
        imageUrl: null,
        stock_threshold: null,
        comboEligible: true,
        isCombo: false,
        modifiers: [],
      },
      quantity: 1,
      selectedModifiers: [],
      unitPrice: 500,
      notes: '',
      lineTotal: 500,
    } as CartItem,
  },
};

// ============================================================================
// COMBO
// ============================================================================

export const ComboSlotTypeSchema = z.enum(['product', 'pool_time']);
export type ComboSlotType = z.infer<typeof ComboSlotTypeSchema>;

export const ComboSlotSchema = z.object({
  id: UuidSchema,
  comboProductId: UuidSchema,
  label: z.string().min(1).max(100),
  slotType: ComboSlotTypeSchema,
  minQty: z.number().int().min(1),
  maxQty: z.number().int().min(1),
  isRequired: z.boolean().default(true),
  sortOrder: z.number().int().nonnegative(),
  createdAt: TimestampSchema,
});

export const ComboSlotCreateSchema = ComboSlotSchema.omit({ id: true, createdAt: true });
export const ComboSlotUpdateSchema = ComboSlotSchema.partial().required({ id: true });

export type ComboSlot = z.infer<typeof ComboSlotSchema>;
export type ComboSlotCreate = z.infer<typeof ComboSlotCreateSchema>;
export type ComboSlotUpdate = z.infer<typeof ComboSlotUpdateSchema>;

export const ComboSlotOptionSchema = z.object({
  id: UuidSchema,
  comboSlotId: UuidSchema,
  childProductId: UuidSchema.nullable(), // null for pool_time slots
  prepaidMinutes: z.number().int().nonnegative().nullable(), // populated for pool_time
  sortOrder: z.number().int().nonnegative(),
  createdAt: TimestampSchema,
});

export const ComboSlotOptionCreateSchema = ComboSlotOptionSchema.omit({
  id: true,
  createdAt: true,
});

export type ComboSlotOption = z.infer<typeof ComboSlotOptionSchema>;
export type ComboSlotOptionCreate = z.infer<typeof ComboSlotOptionCreateSchema>;

export const ComboAvailabilitySchema = z.object({
  id: UuidSchema,
  comboProductId: UuidSchema,
  daysOfWeek: z.array(z.number().int().min(1).max(7)).min(1),
  startTime: TimeStringSchema.nullable(), // null = all day
  endTime: TimeStringSchema.nullable(), // null = all day
  startDate: z.string().nullable(), // ISO date string or null
  endDate: z.string().nullable(), // ISO date string or null
  createdAt: TimestampSchema,
});

export const ComboAvailabilityCreateSchema = ComboAvailabilitySchema.omit({
  id: true,
  createdAt: true,
});

export type ComboAvailability = z.infer<typeof ComboAvailabilitySchema>;
export type ComboAvailabilityCreate = z.infer<typeof ComboAvailabilityCreateSchema>;

// SlotSelection — the shape passed to add_combo_to_tab RPC
export const SlotSelectionSchema = z.object({
  slotId: UuidSchema,
  childProductId: UuidSchema.nullable(),
  qty: z.number().int().min(1),
});

export type SlotSelection = z.infer<typeof SlotSelectionSchema>;

// AddComboToTabInput — full RPC input shape (used in useAddComboToTab mutation)
export const AddComboToTabInputSchema = z.object({
  comboProductId: UuidSchema,
  tabId: UuidSchema,
  slotSelections: z.array(SlotSelectionSchema).min(1),
  overrideAvailability: z.boolean().default(false),
  overrideReason: z.string().nullable().default(null),
});

export type AddComboToTabInput = z.infer<typeof AddComboToTabInputSchema>;

// ============================================================================
// S3a — INGREDIENT FOUNDATION
// ============================================================================

export const UomSchema = z.enum(['g', 'kg', 'ml', 'L', 'unit', 'case_24', 'portion']);
export type Uom = z.infer<typeof UomSchema>;

/** Base UOM: the smallest measuring unit stored per ingredient. Excludes case_24. */
export const BaseUomSchema = z.enum(['g', 'kg', 'ml', 'L', 'unit', 'portion']);
export type BaseUom = z.infer<typeof BaseUomSchema>;

/** Reasons valid for manual stock adjustments (the 4 operator-initiated reasons). */
export const ManualAdjustReasonSchema = z.enum([
  'waste',
  'delivery',
  'correction',
  'physical_count',
]);
export type ManualAdjustReason = z.infer<typeof ManualAdjustReasonSchema>;

export const IngredientSchema = z.object({
  id: UuidSchema,
  name: z.string().min(1).max(100),
  uom: BaseUomSchema,
  purchaseUom: UomSchema.nullable().optional(),
  purchaseToBaseFactor: z.number().positive(),
  costPerBaseUnit: z.number().nonnegative(),
  quantityOnHand: z.number(),
  reorderPoint: z.number().nonnegative().nullable().optional(),
  isPrep: z.boolean().default(false),
  isActive: z.boolean().default(true),
  category: z.string().nullable().optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const IngredientCreateSchema = IngredientSchema.omit({
  id: true,
  quantityOnHand: true,
  createdAt: true,
  updatedAt: true,
});

export const IngredientUpdateSchema = IngredientSchema.partial().required({ id: true });

export type Ingredient = z.infer<typeof IngredientSchema>;
export type IngredientCreate = z.infer<typeof IngredientCreateSchema>;
export type IngredientUpdate = z.infer<typeof IngredientUpdateSchema>;

// ============================================================================
// S4 — SPLIT BILL + REFUND
// ============================================================================

export const RefundReasonSchema = z.enum([
  'wrong_order',
  'quality_issue',
  'customer_complaint',
  'billing_error',
  'other',
]);

export const RefundItemSchema = z.object({
  id: UuidSchema,
  refundId: UuidSchema,
  orderItemId: UuidSchema,
  qty: z.number().int().min(1),
  amount: z.number().positive(),
  restock: z.boolean(),
  createdAt: TimestampSchema,
});

export const RefundSchema = z.object({
  id: UuidSchema,
  originalPaymentId: UuidSchema,
  reason: RefundReasonSchema,
  amount: z.number().positive(),
  createdBy: UuidSchema,
  createdAt: TimestampSchema,
  items: z.array(RefundItemSchema).default([]),
});

export const RefundCreateSchema = RefundSchema.omit({ id: true, createdAt: true, items: true });

export type Refund = z.infer<typeof RefundSchema>;
export type RefundCreate = z.infer<typeof RefundCreateSchema>;
export type RefundItem = z.infer<typeof RefundItemSchema>;
export type RefundReason = z.infer<typeof RefundReasonSchema>;

// ============================================================================
// RECIPE (Phase 4)
// ============================================================================

export const RecipeItemSchema = z.object({
  id: UuidSchema,
  recipeId: UuidSchema,
  ingredientId: UuidSchema,
  qty: z.number().positive(),
});

const RecipeRowSchema = z.object({
  id: UuidSchema,
  productId: UuidSchema.nullable(),
  prepIngredientId: UuidSchema.nullable(),
  yieldQty: z.number().positive(),
  notes: z.string().nullable().optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

function recipeOwnerRefine(
  val: { productId: string | null; prepIngredientId: string | null },
  ctx: z.RefinementCtx
): void {
  const hasProduct = val.productId != null;
  const hasPrep = val.prepIngredientId != null;
  if (hasProduct === hasPrep) {
    ctx.addIssue({
      code: 'custom',
      message: 'Recipe must be owned by exactly one of productId or prepIngredientId',
      path: hasProduct && hasPrep ? ['productId', 'prepIngredientId'] : ['productId'],
    });
  }
}

export const RecipeSchema = RecipeRowSchema.superRefine(recipeOwnerRefine);

export const RecipeWithItemsSchema = RecipeSchema.extend({
  items: z.array(RecipeItemSchema),
});

export const RecipeCreateSchema = RecipeRowSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).superRefine(recipeOwnerRefine);

export const RecipeUpdateSchema = RecipeRowSchema.partial()
  .required({ id: true })
  .superRefine((val, ctx) => {
    if (val.productId === undefined && val.prepIngredientId === undefined) {
      return;
    }
    recipeOwnerRefine(
      {
        productId: val.productId ?? null,
        prepIngredientId: val.prepIngredientId ?? null,
      },
      ctx
    );
  });
export const RecipeItemCreateSchema = RecipeItemSchema.omit({ id: true });

export type Recipe = z.infer<typeof RecipeSchema>;
export type RecipeCreate = z.infer<typeof RecipeCreateSchema>;
export type RecipeUpdate = z.infer<typeof RecipeUpdateSchema>;
export type RecipeItem = z.infer<typeof RecipeItemSchema>;
export type RecipeItemCreate = z.infer<typeof RecipeItemCreateSchema>;
export type RecipeWithItems = z.infer<typeof RecipeWithItemsSchema>;

// ============================================================================
// MODIFIER INVENTORY RULES (Phase 17)
// ============================================================================

export const ModifierInventoryRuleSchema = z.object({
  id: UuidSchema,
  modifierId: UuidSchema,
  ingredientId: UuidSchema,
  delta: z.number().multipleOf(0.001).refine(v => v !== 0, 'delta must be nonzero'),
});

export const ModifierInventoryRuleCreateSchema = ModifierInventoryRuleSchema.omit({ id: true });

export type ModifierInventoryRule = z.infer<typeof ModifierInventoryRuleSchema>;
export type ModifierInventoryRuleCreate = z.infer<typeof ModifierInventoryRuleCreateSchema>;

// ============================================================================
// PREP PRODUCTION (Phase 5)
// ============================================================================

export const PrepProductionSchema = z.object({
  id: UuidSchema,
  prepIngredientId: UuidSchema,
  qtyProduced: z.number().positive(),
  notes: z.string().nullable().optional(),
  producedBy: UuidSchema.nullable().optional(),
  createdAt: TimestampSchema,
});

export const PrepProductionCreateSchema = z.object({
  prepIngredientId: UuidSchema,
  qtyProduced: z.number().positive(),
  notes: z.string().nullable().optional(),
  producedBy: UuidSchema.nullable().optional(),
});

export type PrepProduction = z.infer<typeof PrepProductionSchema>;
export type PrepProductionCreate = z.infer<typeof PrepProductionCreateSchema>;

// ────────────────────────────────────────────────────────────────────────────
// Phase 7: Waitlist + WhatsApp
// ────────────────────────────────────────────────────────────────────────────

export const WaitlistEntryStatusSchema = z.enum([
  'waiting',
  'notified',
  'seated',
  'no_show',
  'cancelled',
]);
export type WaitlistEntryStatus = z.infer<typeof WaitlistEntryStatusSchema>;

/**
 * E.164 phone number (e.g. +525512345678).
 * Validated client-side by libphonenumber-js (phone.ts).
 * This schema enforces the format regex for Zod parsing only.
 */
export const PhoneE164Schema = z
  .string()
  .regex(/^\+[1-9]\d{6,14}$/, 'Must be a valid E.164 phone number');

export const WaitlistEntrySchema = z.object({
  id: UuidSchema,
  name: z.string().min(1).max(100),
  partySize: z.number().int().min(1).max(20),
  phoneE164: PhoneE164Schema.nullable(),
  status: WaitlistEntryStatusSchema,
  tableId: UuidSchema.nullable(),
  seatedAt: TimestampSchema.nullable(),
  notifiedAt: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
});

/** Input for creating a new waitlist entry — omits server-generated fields */
export const WaitlistEntryCreateSchema = WaitlistEntrySchema.omit({
  id: true,
  status: true,
  tableId: true,
  seatedAt: true,
  notifiedAt: true,
  createdAt: true,
});

export const WaitlistNotificationSchema = z.object({
  id: UuidSchema,
  waitlistEntryId: UuidSchema,
  channel: z.enum(['whatsapp', 'manager']),
  status: z.enum(['sent', 'failed', 'pending']),
  providerMessageId: z.string().nullable(),
  error: z.string().nullable(),
  createdAt: TimestampSchema,
});

export type WaitlistEntry = z.infer<typeof WaitlistEntrySchema>;
export type WaitlistEntryCreate = z.infer<typeof WaitlistEntryCreateSchema>;
export type WaitlistNotification = z.infer<typeof WaitlistNotificationSchema>;

// ============================================================================
// Phase 8 S6-01: Report row schemas for analytics widgets
// ============================================================================

export const ComboMixRowSchema = z.object({
  date: z.string(),
  comboProductId: UuidSchema,
  comboName: z.string(),
  qtySold: z.number().int(),
  netRevenue: z.number(),
  avgPrice: z.number(),
  overrideCount: z.number().int(),
});
export type ComboMixRow = z.infer<typeof ComboMixRowSchema>;

export const RecipeVarianceRowSchema = z.object({
  date: z.string(),
  ingredientId: UuidSchema,
  ingredientName: z.string(),
  theoreticalUsed: z.number(),
  physicalDelta: z.number(),
  variancePct: z.number(),
});
export type RecipeVarianceRow = z.infer<typeof RecipeVarianceRowSchema>;

export const WaitlistMetricsRowSchema = z.object({
  date: z.string(),
  partiesSeated: z.number().int(),
  avgQuotedWait: z.number().nullable(),
  avgActualWait: z.number().nullable(),
  noShowRate: z.number().nullable(),
});
export type WaitlistMetricsRow = z.infer<typeof WaitlistMetricsRowSchema>;

export const RefundRegisterRowSchema = z.object({
  id: UuidSchema,
  date: TimestampSchema,
  operatorName: z.string(),
  originalPaymentId: UuidSchema,
  amount: z.number().positive(),
  reason: RefundReasonSchema,
  restockCount: z.number().int(),
  items: z.array(RefundItemSchema).default([]),
});
export type RefundRegisterRow = z.infer<typeof RefundRegisterRowSchema>;

export const ComboOverrideRowSchema = z.object({
  id: UuidSchema,
  ts: TimestampSchema,
  actorName: z.string(),
  comboName: z.string(),
  reason: z.string().nullable(),
});
export type ComboOverrideRow = z.infer<typeof ComboOverrideRowSchema>;

// ============================================================================
// AUDIT LOG (Phase 14)
// ============================================================================

export const AuditSourceSchema = z.enum(['rpc', 'edge', 'client', 'trigger']);
export type AuditSource = z.infer<typeof AuditSourceSchema>;

export const AuditLogSchema = z.object({
  id: UuidSchema,
  actorId: UuidSchema.nullable(),
  action: z.string().min(1),
  entityType: z.string().min(1),
  entityId: UuidSchema.nullable(),
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  terminalId: z.string().nullable(),
  source: AuditSourceSchema,
  createdAt: TimestampSchema,
});

export type AuditLog = z.infer<typeof AuditLogSchema>;

export const AuditLogFiltersSchema = z.object({
  action: z.string().optional(),
  entityType: z.string().optional(),
  actorId: UuidSchema.optional(),
  dateFrom: TimestampSchema.optional(),
  dateTo: TimestampSchema.optional(),
  search: z.string().optional(),
});

export type AuditLogFilters = z.infer<typeof AuditLogFiltersSchema>;

// ============================================================================
// OFFLINE ACTION QUEUE — Phase 15 Plan 04
// Locked enum: 4 literals only. Pre-Phase-15 queues may contain other types
// (e.g. 'close-tab') — store rehydration filters those out.
// ============================================================================

export const OfflineActionTypeSchema = z.enum([
  'open-tab',
  'place-order',
  'start-pool-timer',
  'stop-pool-timer',
] as const);
export type OfflineActionType = z.infer<typeof OfflineActionTypeSchema>;

export const OfflineActionSchema = z.object({
  id: UuidSchema,
  type: OfflineActionTypeSchema,
  payload: z.unknown(),
  expectedVersion: z.number().int().min(0),
  timestamp: z.number().int().nonnegative(),
  retryCount: z.number().int().min(0),
});
export type OfflineAction = z.infer<typeof OfflineActionSchema>;

// ============================================================================
// PROMOTIONS — Phase 20 Plan 02
// Deliberately distinct enums from DiscountType/DiscountScope (the existing
// manual-payment discount feature in PaymentForm.tsx) — see 20-RESEARCH.md
// Pitfall 5. Do NOT reuse/extend DiscountType/DiscountScope here.
// ============================================================================

export const PromotionDiscountTypeSchema = z.enum(['percentage', 'fixed_amount', 'fixed_price']);
export type PromotionDiscountType = z.infer<typeof PromotionDiscountTypeSchema>;

export const PromotionTargetTypeSchema = z.enum(['item', 'category', 'pool_billing', 'pool_grant']);
export type PromotionTargetType = z.infer<typeof PromotionTargetTypeSchema>;

/** Percentage discounts cannot exceed 100% off; fixed_amount/fixed_price are unbounded (validated nonnegative only). */
function promotionPercentageRefine(val: {
  discountType?: PromotionDiscountType | undefined;
  discountValue?: number | undefined;
}): boolean {
  if (val.discountType !== 'percentage') return true;
  if (val.discountValue === undefined) return true;
  return val.discountValue <= 100;
}

const PromotionBaseSchema = z.object({
  id: UuidSchema,
  name: z.string().min(1).max(100),
  discountType: PromotionDiscountTypeSchema,
  discountValue: z.number().nonnegative(),
  targetType: PromotionTargetTypeSchema,
  targetProductId: UuidSchema.nullable(),
  targetCategoryId: UuidSchema.nullable(),
  priority: z.number().int(),
  isActive: z.boolean(),
  createdAt: TimestampSchema,
});

export const PromotionSchema = PromotionBaseSchema.refine(promotionPercentageRefine, {
  message: 'percentage discount value cannot exceed 100',
  path: ['discountValue'],
});

export const PromotionCreateSchema = PromotionBaseSchema.omit({
  id: true,
  createdAt: true,
}).refine(promotionPercentageRefine, {
  message: 'percentage discount value cannot exceed 100',
  path: ['discountValue'],
});

export const PromotionUpdateSchema = PromotionBaseSchema.partial()
  .required({ id: true })
  .refine(promotionPercentageRefine, {
    message: 'percentage discount value cannot exceed 100',
    path: ['discountValue'],
  });

export type Promotion = z.infer<typeof PromotionSchema>;
export type PromotionCreate = z.infer<typeof PromotionCreateSchema>;
export type PromotionUpdate = z.infer<typeof PromotionUpdateSchema>;

export const PromotionAvailabilitySchema = z.object({
  id: UuidSchema,
  promotionId: UuidSchema,
  daysOfWeek: z.array(z.number().int().min(1).max(7)).min(1),
  startTime: TimeStringSchema.nullable(), // null = all day
  endTime: TimeStringSchema.nullable(), // null = all day
  startDate: z.string().nullable(), // ISO date string or null
  endDate: z.string().nullable(), // ISO date string or null
  createdAt: TimestampSchema,
});

export const PromotionAvailabilityCreateSchema = PromotionAvailabilitySchema.omit({
  id: true,
  createdAt: true,
});

export type PromotionAvailability = z.infer<typeof PromotionAvailabilitySchema>;
export type PromotionAvailabilityCreate = z.infer<typeof PromotionAvailabilityCreateSchema>;

// Immutable audit row — no UpdateSchema (applied_promotions is append-only).
// promotionId is nullable: ON DELETE SET NULL preserves the audit trail if the
// source promotion is later hard-deleted (see 20-RESEARCH.md Open Question 4).
export const AppliedPromotionSchema = z.object({
  id: UuidSchema,
  promotionId: UuidSchema.nullable(),
  promotionNameSnapshot: z.string(),
  targetType: PromotionTargetTypeSchema,
  discountType: PromotionDiscountTypeSchema.nullable(),
  discountValue: z.number().nullable(),
  tabId: UuidSchema.nullable(),
  orderItemId: UuidSchema.nullable(),
  poolSessionId: UuidSchema.nullable(),
  originalAmount: z.number().nullable(),
  discountedAmount: z.number().nullable(),
  poolMinutesGranted: z.number().int().nullable(),
  consumedAt: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
});

export type AppliedPromotion = z.infer<typeof AppliedPromotionSchema>;
