import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  inventoryRowColumns,
  useInventory,
  useInventoryLog,
  useMutationAdjustInventory,
  type Inventory,
} from '@entities/inventory';
import { useStaffStore } from '@entities/staff/model/store';
import { InventoryAdjustReason } from '@shared/lib/domain';
import { DataTable } from '@shared/ui/DataTable';
import { POSButton } from '@shared/ui/POSButton';
import { ProtectedAction } from '@shared/ui/ProtectedAction';
import { SectionHeader } from '@shared/ui/SectionHeader';
import { Badge } from '@shared/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@shared/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';

function stockSortPriority(inv: Inventory): number {
  if (inv.quantityOnHand === 0) return 2;
  if (inv.quantityOnHand <= inv.lowStockThreshold) return 1;
  return 0;
}

function sortInventoryRows(rows: Inventory[]): Inventory[] {
  return [...rows].sort((a, b) => {
    const p = stockSortPriority(b) - stockSortPriority(a);
    if (p !== 0) return p;
    return (a.product?.name ?? '').localeCompare(b.product?.name ?? '', undefined, {
      sensitivity: 'base',
    });
  });
}

function rowHighlightClass(inv: Inventory): string | undefined {
  if (inv.quantityOnHand === 0) {
    return 'border-l-4 border-destructive bg-destructive/5';
  }
  if (inv.quantityOnHand <= inv.lowStockThreshold) {
    return 'border-l-4 border-amber-500 bg-amber-500/5';
  }
  return undefined;
}

function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadInventoryCsv(rows: Inventory[]) {
  const headers = [
    'product',
    'category',
    'sku',
    'quantity_on_hand',
    'unit',
    'low_stock_threshold',
    'base_price',
  ];
  const lines = [
    headers.join(','),
    ...rows.map(r => {
      const cells = [
        r.product?.name ?? '',
        r.product?.category?.name ?? '',
        r.product?.sku ?? '',
        String(r.quantityOnHand),
        r.unit,
        String(r.lowStockThreshold),
        r.product?.basePrice != null ? String(r.product.basePrice) : '',
      ];
      return cells.map(escapeCsvField).join(',');
    }),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function InventoryPagePanel() {
  const currentStaff = useStaffStore(s => s.currentStaff);
  const currentRole = currentStaff?.role;
  const staffId = currentStaff?.id ?? '';

  const { data, isLoading, resultError, isEmpty } = useInventory();
  const { data: logs, isLoading: logsLoading } = useInventoryLog();
  const adjustMutation = useMutationAdjustInventory();

  const [categoryFilter, setCategoryFilter] = useState<string>('__all__');
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchProductId, setBatchProductId] = useState<string>('');
  const [batchDelta, setBatchDelta] = useState<string>('1');

  const columns = useMemo(
    () => inventoryRowColumns(staffId || '00000000-0000-0000-0000-000000000001'),
    [staffId]
  );

  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    for (const row of data ?? []) {
      const n = row.product?.category?.name;
      if (n) set.add(n);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [data]);

  const displayedRows = useMemo(() => {
    let rows = data ?? [];
    if (categoryFilter !== '__all__') {
      rows = rows.filter(r => (r.product?.category?.name ?? '') === categoryFilter);
    }
    return sortInventoryRows(rows);
  }, [data, categoryFilter]);

  const stats = useMemo(() => {
    const rows = data ?? [];
    const totalSkus = rows.length;
    let lowStock = 0;
    let outOfStock = 0;
    for (const r of rows) {
      if (r.quantityOnHand === 0) outOfStock += 1;
      else if (r.quantityOnHand <= r.lowStockThreshold) lowStock += 1;
    }
    return { totalSkus, lowStock, outOfStock };
  }, [data]);

  const toolbar = (
    <div className="flex flex-wrap items-center gap-3">
      <label htmlFor="inv-category-filter" className="text-sm text-muted-foreground">
        Category
      </label>
      <select
        id="inv-category-filter"
        className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-xs"
        value={categoryFilter}
        onChange={e => {
          setCategoryFilter(e.target.value);
        }}
      >
        <option value="__all__">All categories</option>
        {uniqueCategories.map(c => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  );

  const handleExportCsv = () => {
    if (!displayedRows.length) {
      toast.message('Nothing to export');
      return;
    }
    downloadInventoryCsv(displayedRows);
    toast.success('CSV downloaded');
  };

  const handleBatchSubmit = async () => {
    if (!staffId) {
      toast.error('Sign in to adjust inventory.');
      return;
    }
    const delta = Number.parseInt(batchDelta, 10);
    if (!batchProductId || Number.isNaN(delta) || delta === 0) {
      toast.error('Choose a product and a non-zero whole number delta.');
      return;
    }
    const res = await adjustMutation.mutateAsync({
      productId: batchProductId,
      quantityDelta: delta,
      reason: InventoryAdjustReason.MANUAL_ADJUSTMENT,
      staffId,
    });
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success('Stock updated');
    setBatchOpen(false);
    setBatchDelta('1');
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {resultError ? (
        <p className="text-sm text-destructive" role="alert">
          {resultError.message}
        </p>
      ) : null}

      {!staffId ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
          Sign in to adjust inventory and export CSV.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <div className="rounded-lg border bg-card px-4 py-3 text-center">
          <div className="text-xs text-muted-foreground">Total SKUs</div>
          <div className="text-2xl font-semibold tabular-nums">{stats.totalSkus}</div>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3 text-center">
          <div className="text-xs text-muted-foreground">Low stock</div>
          <Badge variant="destructive" className="mt-1 text-base tabular-nums">
            {stats.lowStock}
          </Badge>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3 text-center">
          <div className="text-xs text-muted-foreground">Out of stock</div>
          <Badge variant="destructive" className="mt-1 text-base tabular-nums">
            {stats.outOfStock}
          </Badge>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <ProtectedAction action="adjust_inventory" currentRole={currentRole}>
            <POSButton
              type="button"
              touchSize="large"
              variant="secondary"
              onClick={() => {
                setBatchOpen(true);
              }}
            >
              Adjust
            </POSButton>
          </ProtectedAction>
          <ProtectedAction action="adjust_inventory" currentRole={currentRole}>
            <POSButton
              type="button"
              touchSize="large"
              variant="outline"
              disabled={displayedRows.length === 0}
              onClick={handleExportCsv}
            >
              Export CSV
            </POSButton>
          </ProtectedAction>
        </div>
      </div>

      <section>
        <SectionHeader
          title="On-hand levels"
          description="Sort columns, filter by category, quick-adjust quantities."
        />
        <DataTable<Inventory>
          columns={columns}
          data={displayedRows}
          isLoading={isLoading}
          enableSorting
          toolbar={toolbar}
          getRowClassName={rowHighlightClass}
          emptyState={
            isEmpty ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No inventory records yet.
              </p>
            ) : (data?.length ?? 0) > 0 && displayedRows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No rows for this category. Choose &quot;All categories&quot; to see everything.
              </p>
            ) : undefined
          }
        />
      </section>

      <section>
        <SectionHeader
          title="Change log"
          description="Recent manual and system adjustments (last 100)."
        />
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Product ID</TableHead>
                <TableHead>Delta</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Staff ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logsLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : !logs?.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No log entries.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {log.createdAt.toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{log.productId}</TableCell>
                    <TableCell className="tabular-nums">{log.quantityDelta}</TableCell>
                    <TableCell>{log.reason}</TableCell>
                    <TableCell className="font-mono text-xs">{log.staffId}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Batch adjustment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label htmlFor="batch-product" className="text-sm font-medium">
                Product
              </label>
              <select
                id="batch-product"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={batchProductId}
                onChange={e => {
                  setBatchProductId(e.target.value);
                }}
              >
                <option value="">Select…</option>
                {(data ?? []).map(inv => (
                  <option key={inv.productId} value={inv.productId}>
                    {inv.product?.name ?? inv.productId}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="batch-delta" className="text-sm font-medium">
                Quantity delta
              </label>
              <input
                id="batch-delta"
                type="number"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={batchDelta}
                onChange={e => {
                  setBatchDelta(e.target.value);
                }}
              />
              <p className="text-xs text-muted-foreground">Use negative numbers to remove stock.</p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <POSButton
              type="button"
              variant="outline"
              touchSize="large"
              onClick={() => {
                setBatchOpen(false);
              }}
            >
              Cancel
            </POSButton>
            <POSButton
              type="button"
              touchSize="large"
              disabled={adjustMutation.isPending}
              onClick={() => {
                void handleBatchSubmit();
              }}
            >
              Apply
            </POSButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
