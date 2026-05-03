/**
 * MOCK DATA
 *
 * Factories merge defaults with overrides, then validate with Zod schemas from `domain.ts`.
 * For an occupied pool table with a linked session in one step, use `generateMockOccupiedPoolTable`.
 * Override `{ status: 'occupied', currentSessionId, currentSession }` on `generateMockPoolTable` if you prefer manual wiring.
 */

import {
  CategorySchema,
  ProductSchema,
  TabSchema,
  OrderSchema,
  OrderItemSchema,
  PoolTableSchema,
  PoolSessionSchema,
  StaffSchema,
  ShiftSchema,
  InventorySchema,
  PaymentSchema,
} from '@shared/lib/domain';
import type {
  Product,
  Category,
  Tab,
  Order,
  OrderItem,
  PoolTable,
  PoolSession,
  Staff,
  Shift,
  Inventory,
  Payment,
} from '@shared/lib/domain';

// ----------------------------------------------------------------------------
// Stable UUIDs for cross-linked Storybook / scenario data (v4 format)
// ----------------------------------------------------------------------------

export const MOCK_IDS = {
  staffBartender: 'a0000000-0000-4000-8000-000000000001',
  staffManager: 'a0000000-0000-4000-8000-000000000002',
  staffAdmin: 'a0000000-0000-4000-8000-000000000003',
  shiftMain: 'a0000000-0000-4000-8000-000000000010',
  categoryBeer: 'b0000000-0000-4000-8000-000000000001',
  categorySpirits: 'b0000000-0000-4000-8000-000000000002',
  categoryMixers: 'b0000000-0000-4000-8000-000000000003',
  productHeineken: 'c0000000-0000-4000-8000-000000000001',
  productCorona: 'c0000000-0000-4000-8000-000000000002',
  productTitos: 'c0000000-0000-4000-8000-000000000003',
  productLimeJuice: 'c0000000-0000-4000-8000-000000000004',
  productGuinness: 'c0000000-0000-4000-8000-000000000005',
  invCorona: 'e0000000-0000-4000-8000-000000000001',
  invTitos: 'e0000000-0000-4000-8000-000000000002',
  invLime: 'e0000000-0000-4000-8000-000000000003',
} as const;

const TAB_IDS_CLOSING = [
  'f0000000-0000-4000-8000-000000000001',
  'f0000000-0000-4000-8000-000000000002',
  'f0000000-0000-4000-8000-000000000003',
  'f0000000-0000-4000-8000-000000000004',
  'f0000000-0000-4000-8000-000000000005',
] as const;

const TAB_IDS_BUSY = [
  'f1000000-0000-4000-8000-000000000001',
  'f1000000-0000-4000-8000-000000000002',
  'f1000000-0000-4000-8000-000000000003',
  'f1000000-0000-4000-8000-000000000004',
  'f1000000-0000-4000-8000-000000000005',
  'f1000000-0000-4000-8000-000000000006',
  'f1000000-0000-4000-8000-000000000007',
  'f1000000-0000-4000-8000-000000000008',
  'f1000000-0000-4000-8000-000000000009',
  'f1000000-0000-4000-8000-00000000000a',
  'f1000000-0000-4000-8000-00000000000b',
  'f1000000-0000-4000-8000-00000000000c',
] as const;

const POOL_TABLE_IDS_BUSY = [
  'd1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000002',
  'd1000000-0000-4000-8000-000000000003',
  'd1000000-0000-4000-8000-000000000004',
  'd1000000-0000-4000-8000-000000000005',
  'd1000000-0000-4000-8000-000000000006',
] as const;

const POOL_SESSION_IDS_BUSY = [
  'd2000000-0000-4000-8000-000000000001',
  'd2000000-0000-4000-8000-000000000002',
  'd2000000-0000-4000-8000-000000000003',
  'd2000000-0000-4000-8000-000000000004',
  'd2000000-0000-4000-8000-000000000005',
  'd2000000-0000-4000-8000-000000000006',
] as const;

const POOL_CLOSING = [
  {
    tableId: 'd0000000-0000-4000-8000-000000000001',
    sessionId: 'd0000000-0000-4000-8000-000000000011',
    n: 1,
    label: 'Table 1 — Diamond',
  },
  {
    tableId: 'd0000000-0000-4000-8000-000000000002',
    sessionId: 'd0000000-0000-4000-8000-000000000012',
    n: 2,
    label: 'Table 2 — Nine-ball',
  },
] as const;

type Scenario = {
  tabs: Tab[];
  openTables: PoolTable[];
  lowStockItems: Inventory[];
};

type StaffRole = 'bartender' | 'manager' | 'admin' | 'kitchen';

const staffRoleDefaults: Record<
  StaffRole,
  Pick<Staff, 'name' | 'email' | 'pin' | 'role' | 'mustChangePin'>
> = {
  bartender: {
    name: 'Alex Rivera',
    email: 'alex.rivera@ball8.bar',
    pin: '123456',
    role: 'bartender',
    mustChangePin: false,
  },
  manager: {
    name: 'Jordan Kim',
    email: 'jordan.kim@ball8.bar',
    pin: '234567',
    role: 'manager',
    mustChangePin: false,
  },
  admin: {
    name: 'Sam Patel',
    email: 'sam.patel@ball8.bar',
    pin: '345678',
    role: 'admin',
    mustChangePin: false,
  },
  kitchen: {
    name: 'Chef Maria',
    email: 'maria.kitchen@ball8.bar',
    pin: '456789',
    role: 'kitchen',
    mustChangePin: false,
  },
};

function openedMinutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1000);
}

// ----------------------------------------------------------------------------
// Factories
// ----------------------------------------------------------------------------

export function generateMockCategory(overrides?: Partial<Category>): Category {
  return CategorySchema.parse({
    id: crypto.randomUUID(),
    name: 'Beer',
    color: '#f59e0b',
    sortOrder: 0,
    happyHourStart: '16:00',
    happyHourEnd: '19:00',
    createdAt: new Date(),
    ...overrides,
  });
}

export function generateMockProduct(overrides?: Partial<Product>): Product {
  const defaultCategory = generateMockCategory({
    id: overrides?.categoryId ?? MOCK_IDS.categoryBeer,
    name: 'Beer',
    color: '#f59e0b',
    sortOrder: 0,
    happyHourStart: '16:00',
    happyHourEnd: '19:00',
    createdAt: new Date(),
  });
  const category = overrides?.category ?? defaultCategory;
  const categoryId = overrides?.categoryId ?? category.id;

  return ProductSchema.parse({
    id: crypto.randomUUID(),
    name: 'Heineken',
    basePrice: 7.0,
    happyHourPrice: 5.5,
    sku: 'HEIN-12OZ',
    isActive: true,
    imageUrl: null,
    stock_threshold: null,
    modifiers: [],
    ...overrides,
    categoryId,
    category: overrides?.category ?? category,
  });
}

export function generateMockStaff(overrides?: Partial<Staff> & { role?: StaffRole }): Staff {
  const { role: roleFromOverrides, ...rest } = overrides ?? {};
  const role = roleFromOverrides ?? 'bartender';
  const base = staffRoleDefaults[role];

  return StaffSchema.parse({
    id: crypto.randomUUID(),
    ...base,
    isActive: true,
    ...rest,
    role,
  });
}

export function generateMockShift(overrides?: Partial<Shift>): Shift {
  return ShiftSchema.parse({
    id: crypto.randomUUID(),
    staffId: MOCK_IDS.staffBartender,
    clockIn: openedMinutesAgo(360),
    clockOut: null,
    openingCash: 200.0,
    closingCash: null,
    ...overrides,
  });
}

export function generateMockTab(overrides?: Partial<Tab>): Tab {
  const staff = generateMockStaff({ id: MOCK_IDS.staffBartender, role: 'bartender' });
  const shift = generateMockShift({ id: MOCK_IDS.shiftMain, staffId: staff.id });

  return TabSchema.parse({
    id: crypto.randomUUID(),
    customerName: 'John D.',
    tableNumber: 4,
    openedAt: openedMinutesAgo(30),
    closedAt: null,
    status: 'open',
    notes: null,
    orders: [],
    items: [],
    poolCharges: [],
    ...overrides,
    staffId: overrides?.staffId ?? staff.id,
    shiftId: overrides?.shiftId ?? shift.id,
    staff: overrides?.staff ?? staff,
  });
}

export function generateMockOrder(overrides?: Partial<Order>): Order {
  return OrderSchema.parse({
    id: crypto.randomUUID(),
    tabId: crypto.randomUUID(),
    staffId: MOCK_IDS.staffBartender,
    createdAt: openedMinutesAgo(20),
    status: 'pending',
    notes: null,
    items: [],
    ...overrides,
  });
}

export function generateMockOrderItem(overrides?: Partial<OrderItem>): OrderItem {
  const product = overrides?.product ?? generateMockProduct();
  const productId = overrides?.productId ?? product.id;
  const resolvedProduct = overrides?.product ?? product;

  return OrderItemSchema.parse({
    id: crypto.randomUUID(),
    orderId: crypto.randomUUID(),
    quantity: 1,
    unitPrice: resolvedProduct.basePrice,
    modifierIds: [],
    modifierPriceDelta: 0,
    notes: null,
    modifiers: [],
    ...overrides,
    productId,
    product: resolvedProduct,
  });
}

export function generateMockPoolTable(overrides?: Partial<PoolTable>): PoolTable {
  return PoolTableSchema.parse({
    id: crypto.randomUUID(),
    number: 1,
    label: 'Table 1',
    ratePerHour: 12.0,
    status: 'available',
    currentSessionId: null,
    ...overrides,
  });
}

export function generateMockPoolSession(overrides?: Partial<PoolSession>): PoolSession {
  const tableId = overrides?.tableId ?? crypto.randomUUID();

  return PoolSessionSchema.parse({
    id: crypto.randomUUID(),
    tableId,
    tabId: null,
    startedAt: openedMinutesAgo(40),
    stoppedAt: null,
    billedMinutes: null,
    totalCharge: null,
    ...overrides,
  });
}

/**
 * Pool table in `occupied` state with a matching `currentSession` (base session shape).
 */
export function generateMockOccupiedPoolTable(overrides?: Partial<PoolTable>): PoolTable {
  const tableId = overrides?.id ?? crypto.randomUUID();
  const sessionId = overrides?.currentSessionId ?? crypto.randomUUID();
  const sessionBase = {
    id: sessionId,
    tableId,
    tabId: null,
    startedAt: openedMinutesAgo(50),
    stoppedAt: null,
    billedMinutes: 48,
    totalCharge: 10.0,
  };
  const currentSessionId = overrides?.currentSessionId ?? sessionId;
  const currentSession = overrides?.currentSession ?? sessionBase;

  return PoolTableSchema.parse({
    id: tableId,
    number: 3,
    label: 'Table 3',
    ratePerHour: 12.0,
    status: 'occupied',
    ...overrides,
    currentSessionId,
    currentSession,
  });
}

export function generateMockInventory(overrides?: Partial<Inventory>): Inventory {
  const product = overrides?.product ?? generateMockProduct();
  const productId = overrides?.productId ?? product.id;
  const resolvedProduct = overrides?.product ?? product;

  return InventorySchema.parse({
    id: crypto.randomUUID(),
    quantityOnHand: 48,
    lowStockThreshold: 12,
    unit: 'bottles',
    ...overrides,
    productId,
    product: resolvedProduct,
  });
}

export function generateMockPayment(overrides?: Partial<Payment>): Payment {
  return PaymentSchema.parse({
    id: crypto.randomUUID(),
    tabId: crypto.randomUUID(),
    amount: 42.5,
    tipAmount: 8.5,
    method: 'cash',
    squarePaymentId: null,
    squareReceiptUrl: null,
    processedAt: new Date(),
    processedBy: MOCK_IDS.staffBartender,
    ...overrides,
  });
}

// ----------------------------------------------------------------------------
// Scenario presets (Storybook)
// ----------------------------------------------------------------------------

const beerCategory = (): Category =>
  CategorySchema.parse({
    id: MOCK_IDS.categoryBeer,
    name: 'Beer',
    color: '#f59e0b',
    sortOrder: 0,
    happyHourStart: '16:00',
    happyHourEnd: '19:00',
    createdAt: new Date('2024-06-01T18:00:00Z'),
  });

const spiritsCategory = (): Category =>
  CategorySchema.parse({
    id: MOCK_IDS.categorySpirits,
    name: 'Spirits',
    color: '#ef4444',
    sortOrder: 1,
    happyHourStart: null,
    happyHourEnd: null,
    createdAt: new Date('2024-06-01T18:00:00Z'),
  });

const mixersCategory = (): Category =>
  CategorySchema.parse({
    id: MOCK_IDS.categoryMixers,
    name: 'Mixers',
    color: '#22c55e',
    sortOrder: 2,
    happyHourStart: null,
    happyHourEnd: null,
    createdAt: new Date('2024-06-01T18:00:00Z'),
  });

function productCorona(): Product {
  return ProductSchema.parse({
    id: MOCK_IDS.productCorona,
    name: 'Corona Extra',
    categoryId: MOCK_IDS.categoryBeer,
    basePrice: 6.5,
    happyHourPrice: 5.0,
    sku: 'CORONA-12',
    isActive: true,
    imageUrl: null,
    stock_threshold: null,
    modifiers: [],
    category: beerCategory(),
  });
}

function productTitos(): Product {
  return ProductSchema.parse({
    id: MOCK_IDS.productTitos,
    name: "Tito's Handmade Vodka",
    categoryId: MOCK_IDS.categorySpirits,
    basePrice: 9.0,
    happyHourPrice: 7.5,
    sku: 'TITOS-1OZ',
    isActive: true,
    imageUrl: null,
    stock_threshold: null,
    modifiers: [],
    category: spiritsCategory(),
  });
}

function productLime(): Product {
  return ProductSchema.parse({
    id: MOCK_IDS.productLimeJuice,
    name: 'Fresh lime juice (pint)',
    categoryId: MOCK_IDS.categoryMixers,
    basePrice: 4.5,
    happyHourPrice: null,
    sku: 'MIX-LIME-PT',
    isActive: true,
    imageUrl: null,
    stock_threshold: null,
    modifiers: [],
    category: mixersCategory(),
  });
}

function productGuinness(): Product {
  return ProductSchema.parse({
    id: MOCK_IDS.productGuinness,
    name: 'Guinness Draught',
    categoryId: MOCK_IDS.categoryBeer,
    basePrice: 7.5,
    happyHourPrice: 6.0,
    sku: 'GUIN-DRAFT',
    isActive: true,
    imageUrl: null,
    stock_threshold: null,
    modifiers: [],
    category: beerCategory(),
  });
}

function buildClosingTime(): Scenario {
  const customerNames = ['John D.', 'Maria L.', 'Chris P.', 'Taylor M.', 'Riley K.'] as const;
  const tabs = TAB_IDS_CLOSING.map((id, i) =>
    generateMockTab({
      id,
      customerName: customerNames[i]!,
      tableNumber: i + 1,
      staffId: MOCK_IDS.staffBartender,
      shiftId: MOCK_IDS.shiftMain,
      notes: i === 0 ? 'Regular — lime with Corona' : null,
    })
  );

  const openTables = POOL_CLOSING.map((row, idx) =>
    generateMockOccupiedPoolTable({
      id: row.tableId,
      number: row.n,
      label: row.label,
      currentSessionId: row.sessionId,
      currentSession: {
        id: row.sessionId,
        tableId: row.tableId,
        tabId: tabs[idx % tabs.length]!.id,
        startedAt: openedMinutesAgo(35 + row.n * 5),
        stoppedAt: null,
        billedMinutes: 32 + row.n * 3,
        totalCharge: 8.0 + row.n * 1.5,
      },
    })
  );

  const lowStockItems = [
    generateMockInventory({
      id: MOCK_IDS.invCorona,
      productId: MOCK_IDS.productCorona,
      quantityOnHand: 6,
      lowStockThreshold: 24,
      unit: 'bottles',
      product: productCorona(),
    }),
    generateMockInventory({
      id: MOCK_IDS.invTitos,
      productId: MOCK_IDS.productTitos,
      quantityOnHand: 1,
      lowStockThreshold: 4,
      unit: 'fifths',
      product: productTitos(),
    }),
    generateMockInventory({
      id: MOCK_IDS.invLime,
      productId: MOCK_IDS.productLimeJuice,
      quantityOnHand: 2,
      lowStockThreshold: 8,
      unit: 'pints',
      product: productLime(),
    }),
  ];

  return { tabs, openTables, lowStockItems };
}

function buildBusyBar(): Scenario {
  const busyCustomerNames = [
    'Jamie W.',
    'Priya S.',
    'Marcus T.',
    'Elena R.',
    'Noah B.',
    'Sofia G.',
    'Diego V.',
    'Hannah K.',
    'Owen L.',
    'Ava M.',
    'Leo F.',
    'Nina C.',
  ] as const;

  const tabs = TAB_IDS_BUSY.map((id, i) =>
    generateMockTab({
      id,
      customerName: busyCustomerNames[i] ?? `Guest ${i + 1}`,
      tableNumber: (i % 12) + 1,
      staffId: MOCK_IDS.staffBartender,
      shiftId: MOCK_IDS.shiftMain,
      status: 'open',
      notes: i === 3 ? 'Birthday — comp dessert shot' : null,
    })
  );

  const openTables = POOL_TABLE_IDS_BUSY.map((tableId, i) => {
    const sessionId = POOL_SESSION_IDS_BUSY[i]!;
    const tab = tabs[i % tabs.length]!;
    return generateMockOccupiedPoolTable({
      id: tableId,
      number: i + 1,
      label: `Table ${i + 1} — ${['House', 'Diamond', 'Stripes', 'Solids', 'Nine-ball', 'Eight-ball'][i]!}`,
      ratePerHour: 10.0 + i * 0.5,
      currentSessionId: sessionId,
      currentSession: {
        id: sessionId,
        tableId,
        tabId: tab.id,
        startedAt: openedMinutesAgo(15 + i * 8),
        stoppedAt: null,
        billedMinutes: 12 + i * 6,
        totalCharge: 5.5 + i * 2.25,
      },
    });
  });

  const lowStockItems = [
    generateMockInventory({
      product: productCorona(),
      productId: MOCK_IDS.productCorona,
      quantityOnHand: 4,
      lowStockThreshold: 36,
      unit: 'bottles',
    }),
    generateMockInventory({
      product: productGuinness(),
      productId: MOCK_IDS.productGuinness,
      quantityOnHand: 8,
      lowStockThreshold: 24,
      unit: 'cans',
    }),
    generateMockInventory({
      product: productTitos(),
      productId: MOCK_IDS.productTitos,
      quantityOnHand: 2,
      lowStockThreshold: 6,
      unit: 'fifths',
    }),
    generateMockInventory({
      product: productLime(),
      productId: MOCK_IDS.productLimeJuice,
      quantityOnHand: 1,
      lowStockThreshold: 10,
      unit: 'pints',
    }),
    generateMockInventory({
      product: generateMockProduct({
        id: MOCK_IDS.productHeineken,
        name: 'Heineken',
        categoryId: MOCK_IDS.categoryBeer,
        basePrice: 7.0,
        category: beerCategory(),
      }),
      productId: MOCK_IDS.productHeineken,
      quantityOnHand: 10,
      lowStockThreshold: 30,
      unit: 'bottles',
    }),
  ];

  return { tabs, openTables, lowStockItems };
}

export const scenarios = {
  busyBar: buildBusyBar(),
  quietNight: {
    tabs: [],
    openTables: [],
    lowStockItems: [],
  } satisfies Scenario,
  closingTime: buildClosingTime(),
} as const;
