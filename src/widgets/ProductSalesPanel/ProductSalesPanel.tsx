import type { ColumnDef } from '@tanstack/react-table';
import { BarChart2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ExportButtons } from '@features/export-report';
import { useProductSalesReport, type ProductSalesRow } from '@entities/tab/model/queries-reports';
import { DataTable, EmptyState, LoadingSpinner, MoneyDisplay } from '@shared/ui';

type Props = {
  dateRange: { from: Date; to: Date };
};

const ALL_CATEGORIES = 'All';

export function ProductSalesPanel({ dateRange }: Props) {
  const { data: result, isLoading } = useProductSalesReport(dateRange.from, dateRange.to);

  const rawRows = useMemo(() => (result?.ok ? result.data : []), [result]);

  // Unique categories for filter
  const categories = useMemo(() => {
    const set = new Set(rawRows.map(r => r.categoryName));
    return [ALL_CATEGORIES, ...Array.from(set).sort()];
  }, [rawRows]);

  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_CATEGORIES);
  const [sortBy, setSortBy] = useState<'revenue' | 'units'>('revenue');

  const filtered = useMemo(() => {
    let out =
      selectedCategory === ALL_CATEGORIES
        ? rawRows
        : rawRows.filter(r => r.categoryName === selectedCategory);

    if (sortBy === 'units') {
      out = [...out].sort((a, b) => b.units - a.units);
    } else {
      out = [...out].sort((a, b) => b.revenue - a.revenue);
    }
    return out;
  }, [rawRows, selectedCategory, sortBy]);

  const columns: ColumnDef<ProductSalesRow>[] = useMemo(
    () => [
      {
        accessorKey: 'productName',
        header: 'Product',
        cell: info => <span className="font-medium">{info.getValue<string>()}</span>,
      },
      {
        accessorKey: 'categoryName',
        header: 'Category',
      },
      {
        accessorKey: 'units',
        header: 'Units Sold',
        cell: info => <span className="tabular-nums">{info.getValue<number>()}</span>,
      },
      {
        accessorKey: 'revenue',
        header: 'Revenue',
        cell: info => <MoneyDisplay amount={info.getValue<number>()} size="sm" />,
      },
      {
        accessorKey: 'pctTotal',
        header: '% of Total',
        cell: info => (
          <span className="tabular-nums text-muted-foreground">{info.getValue<number>()}%</span>
        ),
      },
    ],
    []
  );

  const exportData = { rows: filtered, dateRange };

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className="rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        value={selectedCategory}
        onChange={e => {
          setSelectedCategory(e.target.value);
        }}
        aria-label="Filter by category"
      >
        {categories.map(cat => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </select>

      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => {
            setSortBy('revenue');
          }}
          className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
            sortBy === 'revenue'
              ? 'bg-primary text-primary-foreground'
              : 'border border-input bg-background text-foreground hover:bg-muted'
          }`}
        >
          By Revenue
        </button>
        <button
          type="button"
          onClick={() => {
            setSortBy('units');
          }}
          className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
            sortBy === 'units'
              ? 'bg-primary text-primary-foreground'
              : 'border border-input bg-background text-foreground hover:bg-muted'
          }`}
        >
          By Units
        </button>
      </div>

      {rawRows.length > 0 && <ExportButtons reportType="products" data={exportData} />}
    </div>
  );

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <DataTable
      columns={columns}
      data={filtered}
      toolbar={toolbar}
      emptyState={
        <EmptyState
          icon={BarChart2}
          title="No sales in this range"
          description="No products sold in this date range."
        />
      }
      getRowClassName={(row: ProductSalesRow) => {
        const idx = filtered.indexOf(row);
        if (idx < 3 && filtered.length > 0) {
          return 'border-l-2 border-l-amber-400 bg-amber-500/5';
        }
        return undefined;
      }}
    />
  );
}
