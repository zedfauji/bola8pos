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

export const TabStatusSchema = z.enum(['open', 'closed', 'paid', 'voided']);
export const TabStatus = {
  OPEN: 'open',
  CLOSED: 'closed',
  PAID: 'paid',
  VOIDED: 'voided',
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

// ============================================================================
// CATEGORY
// ============================================================================

export const CategorySchema = z.object({
  id: UuidSchema,
  name: z.string().min(1).max(50),
  color: HexColorSchema,
  sortOrder: z.number().int().nonnegative(),
  happyHourStart: TimeStringSchema.nullable(),
  happyHourEnd: TimeStringSchema.nullable(),
  isFood: z.boolean().default(false),
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
  amount: MoneySchema,
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
});

export const PaymentCreateSchema = PaymentSchema.omit({
  id: true,
  processedAt: true,
});

export const PaymentUpdateSchema = PaymentSchema.partial().required({ id: true });

export type Payment = z.infer<typeof PaymentSchema>;
export type PaymentCreate = z.infer<typeof PaymentCreateSchema>;
export type PaymentUpdate = z.infer<typeof PaymentUpdateSchema>;

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

    CajaStatus: CajaStatusSchema,
    CajaSession: CajaSessionSchema,
    CajaSessionCreate: CajaSessionCreateSchema,
    CajaEntryType: CajaEntryTypeSchema,
    CajaEntry: CajaEntrySchema,
    CajaEntryCreate: CajaEntryCreateSchema,
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
