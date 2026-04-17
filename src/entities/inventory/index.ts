export {
  InventorySchema,
  InventoryLogSchema,
  useInventoryStore,
  inventoryStore,
  selectInventoryByProductId,
  selectIsLowStock,
  inventoryKeys,
  useInventory,
  useInventoryByProduct,
  useLowStockInventory,
  useMutationAdjustInventory,
  useInventoryLog,
} from './model';

export type { Inventory, InventoryLog, LowStockAlertItem } from './model';

export { InventoryRow, inventoryRowColumns } from './ui/InventoryRow';
export type { InventoryRowProps } from './ui/InventoryRow';
