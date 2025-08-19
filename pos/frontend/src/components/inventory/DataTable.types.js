// @ts-check

/**
 * @typedef {Object} Column
 * @property {string} id - The unique identifier for the column
 * @property {string} label - The display label for the column
 * @property {number} [minWidth] - The minimum width of the column
 * @property {'left'|'right'|'center'} [align] - The alignment of the column content
 * @property {(value: any, row: Object) => React.ReactNode} [format] - Function to format the cell content
 * @property {boolean} [sortable] - Whether the column is sortable
 */

/**
 * @typedef {Object} PaginationOptions
 * @property {number} [page=0] - The current page number (0-based)
 * @property {number} [rowsPerPage=10] - The number of rows per page
 * @property {number[]} [rowsPerPageOptions=[10, 25, 50, 100]] - The available rows per page options
 * @property {number} [total] - The total number of rows
 * @property {boolean} [paginate=true] - Whether to enable pagination
 */

/**
 * @typedef {Object} DataTableProps
 * @property {Column[]} columns - The columns configuration
 * @property {Object[]} data - The data to display
 * @property {boolean} [loading=false] - Whether the table is in a loading state
 * @property {string|null} [error=null] - Error message to display
 * @property {(row: Object, event: React.MouseEvent) => void} [onRowClick] - Callback when a row is clicked
 * @property {(selected: any[]) => void} [onSelectionChange] - Callback when row selection changes
 * @property {any[]} [selectedRows=[]] - The currently selected rows
 * @property {{field: string, order: 'asc'|'desc'}} [defaultSort] - Default sort configuration
 * @property {PaginationOptions} [pagination] - Pagination configuration
 * @property {(newPage: number) => void} [onPageChange] - Callback when page changes
 * @property {(rowsPerPage: number) => void} [onRowsPerPageChange] - Callback when rows per page changes
 * @property {(field: string, order: 'asc'|'desc') => void} [onSort] - Callback when sort changes
 * @property {string} [emptyMessage='No data available'] - Message to display when there's no data
 * @property {boolean} [showCheckboxes=false] - Whether to show checkboxes for row selection
 * @property {string} [rowKey='id'] - The key used to identify rows
 * @property {React.CSSProperties} [sx] - Custom styles
 */

// This file provides JSDoc type definitions for the DataTable component
// It helps with code completion and type checking in JavaScript files
