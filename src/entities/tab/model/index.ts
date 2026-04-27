/**
 * TAB ENTITY - BARREL EXPORT
 */

// Types & Schemas
export {
  TabSchema,
  OrderSchema,
  OrderItemSchema,
  OrderItemCreateSchema,
  CartItemInputSchema,
  mockTab,
  mockTabItem,
} from './types';

export type {
  Tab,
  Order,
  OrderItem,
  CreateTab,
  CreateOrder,
  CreateOrderItem,
  CartItemInput,
  TabStatus,
  OrderStatus,
} from './types';

// State Management
export { useTabStore, selectTabById, selectOpenTabs } from './store';
export { useCartStore } from './cartStore';

// Data Fetching
export {
  tabKeys,
  useTabs,
  useTab,
  useSubTabs,
  useMutationOpenTab,
  useMutationAddOrder,
  useMutationUpdateTabStatus,
  useMutationRecordTabPayment,
  useVoidOrder,
  useOpenTabsPendingTotal,
} from './queries';
