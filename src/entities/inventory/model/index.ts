/**
 * INVENTORY ENTITY - BARREL EXPORT
 */

// Types & Schemas
export { InventorySchema, InventoryLogSchema } from './types';

export type { Inventory, InventoryLog } from './types';

// State Management
export {
  useInventoryStore,
  inventoryStore,
  selectInventoryByProductId,
  selectIsLowStock,
  useInventoryRealtimeBridge,
} from './store';
export type { LowStockAlertItem } from './store';

// Data Fetching
export {
  inventoryKeys,
  useInventory,
  useInventoryByProduct,
  useLowStockInventory,
  useInventoryAlerts,
  useMutationAdjustInventory,
  useInventoryLog,
} from './queries';
