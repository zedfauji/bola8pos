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
  useInventoryAlerts,
  useMutationAdjustInventory,
  useInventoryLog,
  useInventoryRealtimeBridge,
} from './model';

export type { Inventory, InventoryLog, LowStockAlertItem } from './model';

export { InventoryRow, inventoryRowColumns } from './ui/InventoryRow';
export type { InventoryRowProps } from './ui/InventoryRow';

export { LowStockBadge } from './ui/LowStockBadge';
