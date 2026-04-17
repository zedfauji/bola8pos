/**
 * DATA TABLE COMPONENT
 *
 * Generic table wrapper using TanStack Table.
 * Supports loading states, empty states, search, and row clicks.
 */

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import { FileQuestion } from 'lucide-react';
import * as React from 'react';

import { cn } from '@shared/lib/utils';

import { EmptyState } from './EmptyState';
import { TableRowSkeleton } from './LoadingSkeletons';
import { SearchInput } from './SearchInput';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

export interface DataTableProps<T> {
  /** Column definitions */
  columns: ColumnDef<T>[];
  /** Table data */
  data: T[];
  /** Loading state - shows skeleton rows */
  isLoading?: boolean;
  /** Empty state component */
  emptyState?: React.ReactNode;
  /** Called when row is clicked */
  onRowClick?: (row: T) => void;
  /** Enable search functionality */
  searchable?: boolean;
  /** Search input placeholder */
  searchPlaceholder?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * DataTable - Generic table component with TanStack Table
 *
 * Features:
 * - Loading state with skeleton rows
 * - Empty state with custom component
 * - Optional search with local filtering
 * - Row click handler with hover highlight
 * - Fully typed with TypeScript generics
 *
 * @example
 * ```tsx
 * const columns: ColumnDef<Product>[] = [
 *   { accessorKey: 'name', header: 'Name' },
 *   { accessorKey: 'price', header: 'Price' },
 * ]
 *
 * <DataTable
 *   columns={columns}
 *   data={products}
 *   isLoading={isLoading}
 *   searchable
 *   searchPlaceholder="Search products..."
 *   onRowClick={(product) => console.log(product)}
 * />
 * ```
 */
export function DataTable<T>({
  columns,
  data,
  isLoading = false,
  emptyState,
  onRowClick,
  searchable = false,
  searchPlaceholder = 'Search...',
  className,
}: DataTableProps<T>) {
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = React.useState('');

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      columnFilters,
      globalFilter,
    },
  });

  // Show loading state
  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        {searchable && <SearchInput value="" onChange={() => {}} placeholder={searchPlaceholder} />}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map(headerGroup => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRowSkeleton key={i} columns={columns.length} />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  // Show empty state
  if (data.length === 0) {
    return (
      <div className={cn('space-y-4', className)}>
        {searchable && (
          <SearchInput
            value={globalFilter}
            onChange={setGlobalFilter}
            placeholder={searchPlaceholder}
          />
        )}
        {emptyState || (
          <EmptyState icon={FileQuestion} title="No data" description="No records found." />
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Search Input */}
      {searchable && (
        <SearchInput
          value={globalFilter}
          onChange={setGlobalFilter}
          placeholder={searchPlaceholder}
        />
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  {emptyState || (
                    <EmptyState
                      icon={FileQuestion}
                      title="No results"
                      description="No records match your search."
                    />
                  )}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map(row => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className={cn(onRowClick && 'cursor-pointer')}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
