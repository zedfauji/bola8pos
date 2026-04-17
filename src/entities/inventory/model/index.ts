/**
 * INVENTORY ENTITY - BARREL EXPORT
 */

// Types & Schemas
export { InventorySchema, InventoryLogSchema } from './types';

export type { Inventory, InventoryLog } from './types';

// State Management
export { useInventoryStore, selectInventoryByProductId, selectIsLowStock } from './store';

// Data Fetching
export {
  inventoryKeys,
  useInventory,
  useInventoryByProduct,
  useLowStockInventory,
  useMutationAdjustInventory,
  useInventoryLog,
} from './queries';
