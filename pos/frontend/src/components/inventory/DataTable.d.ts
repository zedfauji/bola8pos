import React from 'react';

declare module './DataTable' {
  export interface Column {
    id: string;
    label: string;
    minWidth?: number;
    align?: 'left' | 'right' | 'center';
    format?: (value: any) => React.ReactNode;
    sortable?: boolean;
  }

  export interface PaginationOptions {
    page?: number;
    rowsPerPage?: number;
    rowsPerPageOptions?: number[];
    total?: number;
    paginate?: boolean;
  }

  export interface DataTableProps<T = any> {
    columns: Column[];
    data: T[];
    loading?: boolean;
    error?: string | null;
    onRowClick?: (row: T, event: React.MouseEvent) => void;
    onSelectionChange?: (selected: any[]) => void;
    selectedRows?: any[];
    defaultSort?: { field: string; order: 'asc' | 'desc' };
    pagination?: PaginationOptions;
    onPageChange?: (newPage: number) => void;
    onRowsPerPageChange?: (rowsPerPage: number) => void;
    onSort?: (field: string, order: 'asc' | 'desc') => void;
    emptyMessage?: string;
    showCheckboxes?: boolean;
    rowKey?: string;
    sx?: React.CSSProperties;
  }

  const DataTable: React.FC<DataTableProps>;
  export default DataTable;
}
