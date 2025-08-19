import React, { useState, useMemo, MouseEvent, ChangeEvent } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Paper,
  TablePagination,
  Checkbox,
  CircularProgress,
  Typography,
  Box,
  IconButton,
  Tooltip,
  TableFooter,
  TablePaginationProps,
  TableCellProps,
  TableContainerProps,
  TableProps,
  TableHeadProps,
  TableBodyProps,
  TableRowProps,
  ButtonBaseProps,
  SxProps,
  Theme,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  FirstPage as FirstPageIcon,
  LastPage as LastPageIcon,
  KeyboardArrowLeft,
  KeyboardArrowRight,
} from '@mui/icons-material';

// Types
export interface Column<T = any> {
  id: string;
  label: string;
  minWidth?: number;
  align?: TableCellProps['align'];
  format?: (value: any, row: T) => React.ReactNode;
  sortable?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export interface PaginationOptions {
  page?: number;
  rowsPerPage?: number;
  rowsPerPageOptions?: number[];
  total?: number;
  paginate?: boolean;
}

export interface DataTableProps<T = any> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  error?: string | null;
  onRowClick?: (row: T, event: MouseEvent<HTMLTableRowElement>) => void;
  onSelectionChange?: (selected: T[]) => void;
  selectedRows?: T[];
  defaultSort?: { field: string; order: 'asc' | 'desc' };
  pagination?: PaginationOptions;
  onPageChange?: (newPage: number) => void;
  onRowsPerPageChange?: (rowsPerPage: number) => void;
  onSort?: (field: string, order: 'asc' | 'desc') => void;
  emptyMessage?: string | React.ReactNode;
  showCheckboxes?: boolean;
  rowKey?: string;
  sx?: SxProps<Theme>;
  tableProps?: TableProps;
  tableContainerProps?: TableContainerProps;
  tableHeadProps?: TableHeadProps;
  tableBodyProps?: TableBodyProps;
  tableRowProps?: (row: T, index: number) => TableRowProps;
  tableCellProps?: (row: T, column: Column<T>, index: number) => TableCellProps;
  loadingComponent?: React.ReactNode;
  errorComponent?: React.ReactNode;
  emptyComponent?: React.ReactNode;
  checkboxProps?: (row: T) => Partial<ButtonBaseProps>;
}

// Styled components
const StyledTableContainer = styled(Paper)(({ theme }) => ({
  width: '100%',
  overflowX: 'auto',
  boxShadow: theme.shadows[1],
  borderRadius: theme.shape.borderRadius,
}));

const StyledTable = styled(Table)({
  minWidth: 650,
});

const StyledTableHead = styled(TableHead)(({ theme }) => ({
  backgroundColor: theme.palette.grey[50],
  '& th': {
    fontWeight: '600',
    color: theme.palette.text.secondary,
  },
}));

const StyledTableRow = styled(TableRow, {
  shouldForwardProp: (prop) => prop !== 'selected',
})<{ selected?: boolean }>(({ theme, selected }) => ({
  '&:nth-of-type(odd)': {
    backgroundColor: theme.palette.action.hover,
  },
  '&:hover': {
    backgroundColor: theme.palette.action.selected,
  },
  ...(selected && {
    backgroundColor: `${theme.palette.primary.light}20 !important`,
  }),
}));

const StyledTableCell = styled(TableCell, {
  shouldForwardProp: (prop) => prop !== 'isNumeric',
})<{ isNumeric?: boolean }>(({ isNumeric }) => ({
  ...(isNumeric && { justifyContent: 'flex-end' }),
}));

// Table pagination actions component
interface TablePaginationActionsProps {
  count: number;
  page: number;
  rowsPerPage: number;
  onPageChange: (event: MouseEvent<HTMLButtonElement>, newPage: number) => void;
}

function TablePaginationActions(props: TablePaginationActionsProps) {
  const { count, page, rowsPerPage, onPageChange } = props;
  const totalPages = Math.ceil(count / rowsPerPage) - 1;

  const handleFirstPageButtonClick = (event: MouseEvent<HTMLButtonElement>) => {
    onPageChange(event, 0);
  };

  const handleBackButtonClick = (event: MouseEvent<HTMLButtonElement>) => {
    onPageChange(event, page - 1);
  };

  const handleNextButtonClick = (event: MouseEvent<HTMLButtonElement>) => {
    onPageChange(event, page + 1);
  };

  const handleLastPageButtonClick = (event: MouseEvent<HTMLButtonElement>) => {
    onPageChange(event, totalPages);
  };

  return (
    <Box sx={{ flexShrink: 0, ml: 2.5 }}>
      <IconButton
        onClick={handleFirstPageButtonClick}
        disabled={page === 0}
        aria-label="first page"
      >
        <FirstPageIcon />
      </IconButton>
      <IconButton
        onClick={handleBackButtonClick}
        disabled={page === 0}
        aria-label="previous page"
      >
        <KeyboardArrowLeft />
      </IconButton>
      <IconButton
        onClick={handleNextButtonClick}
        disabled={page >= totalPages}
        aria-label="next page"
      >
        <KeyboardArrowRight />
      </IconButton>
      <IconButton
        onClick={handleLastPageButtonClick}
        disabled={page >= totalPages}
        aria-label="last page"
      >
        <LastPageIcon />
      </IconButton>
    </Box>
  );
}

// Main DataTable component
function DataTable<T extends Record<string, any> = any>({
  columns,
  data,
  loading = false,
  error = null,
  onRowClick,
  onSelectionChange,
  selectedRows = [],
  defaultSort = { field: '', order: 'asc' as const },
  pagination = {},
  onPageChange,
  onRowsPerPageChange,
  onSort,
  emptyMessage = 'No data available',
  showCheckboxes = false,
  rowKey = 'id',
  sx,
  tableProps = {},
  tableContainerProps = {},
  tableHeadProps = {},
  tableBodyProps = {},
  tableRowProps = () => ({}),
  tableCellProps = () => ({}),
  loadingComponent,
  errorComponent,
  emptyComponent,
  checkboxProps = () => ({}),
}: DataTableProps<T>) {
  // State for sorting
  const [orderBy, setOrderBy] = useState<string>(defaultSort.field);
  const [order, setOrder] = useState<'asc' | 'desc'>(defaultSort.order);

  // State for pagination
  const [page, setPage] = useState(pagination.page || 0);
  const [rowsPerPage, setRowsPerPage] = useState(pagination.rowsPerPage || 10);

  // Handle sort request
  const handleRequestSort = (property: string) => {
    const isAsc = orderBy === property && order === 'asc';
    const newOrder = isAsc ? 'desc' : 'asc';
    
    setOrder(newOrder);
    setOrderBy(property);
    
    if (onSort) {
      onSort(property, newOrder);
    }
  };

  // Handle row click
  const handleRowClick = (event: MouseEvent<HTMLTableRowElement>, row: T) => {
    if (onRowClick) {
      onRowClick(row, event);
    }
  };

  // Handle select all click
  const handleSelectAllClick = (event: ChangeEvent<HTMLInputElement>) => {
    if (onSelectionChange) {
      if (event.target.checked) {
        const newSelected = [...selectedRows];
        data.forEach((row) => {
          if (!selectedRows.some((selected) => selected[rowKey] === row[rowKey])) {
            newSelected.push(row);
          }
        });
        onSelectionChange(newSelected);
      } else {
        onSelectionChange([]);
      }
    }
  };

  // Handle checkbox click
  const handleCheckboxClick = (event: MouseEvent, row: T) => {
    event.stopPropagation();
    
    if (!onSelectionChange) return;
    
    const selectedIndex = selectedRows.findIndex(
      (selected) => selected[rowKey] === row[rowKey]
    );
    let newSelected: T[] = [];

    if (selectedIndex === -1) {
      newSelected = [...selectedRows, row];
    } else if (selectedIndex === 0) {
      newSelected = selectedRows.slice(1);
    } else if (selectedIndex === selectedRows.length - 1) {
      newSelected = selectedRows.slice(0, -1);
    } else if (selectedIndex > 0) {
      newSelected = [
        ...selectedRows.slice(0, selectedIndex),
        ...selectedRows.slice(selectedIndex + 1),
      ];
    }

    onSelectionChange(newSelected);
  };

  // Handle change page
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
    if (onPageChange) {
      onPageChange(newPage);
    }
  };

  // Handle change rows per page
  const handleChangeRowsPerPage = (event: ChangeEvent<HTMLInputElement>) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    setPage(0);
    
    if (onRowsPerPageChange) {
      onRowsPerPageChange(newRowsPerPage);
    }
    
    if (onPageChange) {
      onPageChange(0);
    }
  };

  // Check if a row is selected
  const isSelected = (row: T) => 
    selectedRows.some((selected) => selected[rowKey] === row[rowKey]);

  // Get the current page data
  const getCurrentPageData = () => {
    if (!pagination.paginate) {
      return data;
    }
    
    const start = page * rowsPerPage;
    const end = start + rowsPerPage;
    return data.slice(start, end);
  };

  // Sort the data
  const sortedData = useMemo(() => {
    if (!orderBy) return data;
    
    return [...data].sort((a, b) => {
      if (a[orderBy] < b[orderBy]) {
        return order === 'asc' ? -1 : 1;
      }
      if (a[orderBy] > b[orderBy]) {
        return order === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [data, orderBy, order]);

  // Get the paginated and sorted data
  const paginatedData = useMemo(() => {
    const sorted = orderBy ? sortedData : data;
    
    if (!pagination.paginate) {
      return sorted;
    }
    
    const start = page * rowsPerPage;
    return sorted.slice(start, start + rowsPerPage);
  }, [sortedData, data, orderBy, pagination.paginate, page, rowsPerPage]);

  // Calculate the total count
  const totalCount = pagination.total !== undefined ? 
    pagination.total : data.length;

  // Loading state
  if (loading) {
    return loadingComponent || (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Error state
  if (error) {
    return errorComponent || (
      <Box sx={{ p: 3, color: 'error.main', textAlign: 'center' }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  // Empty state
  if (data.length === 0) {
    return emptyComponent || (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography>{emptyMessage}</Typography>
      </Box>
    );
  }

  return (
    <StyledTableContainer sx={sx} {...tableContainerProps}>
      <TableContainer>
        <StyledTable {...tableProps}>
          <StyledTableHead {...tableHeadProps}>
            <TableRow>
              {showCheckboxes && (
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={
                      selectedRows.length > 0 && 
                      selectedRows.length < data.length
                    }
                    checked={
                      data.length > 0 && 
                      selectedRows.length === data.length
                    }
                    onChange={handleSelectAllClick}
                    inputProps={{ 'aria-label': 'select all' }}
                  />
                </TableCell>
              )}
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  align={column.align}
                  style={{ minWidth: column.minWidth }}
                  sortDirection={orderBy === column.id ? order : false}
                >
                  {column.sortable ? (
                    <TableSortLabel
                      active={orderBy === column.id}
                      direction={orderBy === column.id ? order : 'asc'}
                      onClick={() => handleRequestSort(column.id)}
                    >
                      {column.label}
                    </TableSortLabel>
                  ) : (
                    column.label
                  )}
                </TableCell>
              ))}
            </TableRow>
          </StyledTableHead>
          <TableBody {...tableBodyProps}>
            {paginatedData.map((row, rowIndex) => {
              const isItemSelected = isSelected(row);
              const rowProps = tableRowProps(row, rowIndex);
              
              return (
                <StyledTableRow
                  hover
                  key={row[rowKey] || rowIndex}
                  selected={isItemSelected}
                  onClick={(event) => handleRowClick(event, row)}
                  {...rowProps}
                >
                  {showCheckboxes && (
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={isItemSelected}
                        onClick={(event) => handleCheckboxClick(event, row)}
                        inputProps={{ 'aria-labelledby': `table-checkbox-${rowIndex}` }}
                        {...checkboxProps(row)}
                      />
                    </TableCell>
                  )}
                  {columns.map((column, colIndex) => {
                    const cellProps = tableCellProps(row, column, colIndex);
                    const value = row[column.id];
                    
                    return (
                      <StyledTableCell
                        key={`${row[rowKey] || rowIndex}-${column.id}`}
                        align={column.align}
                        {...cellProps}
                      >
                        {column.format
                          ? column.format(value, row)
                          : value != null ? String(value) : '—'}
                      </StyledTableCell>
                    );
                  })}
                </StyledTableRow>
              );
            })}
          </TableBody>
          {pagination.paginate && (
            <TableFooter>
              <TableRow>
                <TablePagination
                  rowsPerPageOptions={
                    pagination.rowsPerPageOptions || [5, 10, 25, 50, 100]
                  }
                  colSpan={columns.length + (showCheckboxes ? 1 : 0)}
                  count={totalCount}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  ActionsComponent={TablePaginationActions}
                />
              </TableRow>
            </TableFooter>
          )}
        </StyledTable>
      </TableContainer>
    </StyledTableContainer>
  );
}

export default DataTable;
