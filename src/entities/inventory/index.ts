export {
  InventorySchema,
  InventoryLogSchema,
  useInventoryStore,
  selectInventoryByProductId,
  selectIsLowStock,
  inventoryKeys,
  useInventory,
  useInventoryByProduct,
  useLowStockInventory,
  useMutationAdjustInventory,
  useInventoryLog,
} from './model';

export type { Inventory, InventoryLog } from './model';
