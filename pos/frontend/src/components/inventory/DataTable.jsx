import React, { useState, useMemo } from 'react';
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
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  FirstPage as FirstPageIcon,
  LastPage as LastPageIcon,
  KeyboardArrowLeft,
  KeyboardArrowRight,
} from '@mui/icons-material';

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

const StyledTableRow = styled(TableRow)(({ theme, selected }) => ({
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

const StyledTableCell = styled(TableCell)(({ align }) => ({
  padding: '12px 16px',
  textAlign: align || 'left',
}));

const LoadingRow = ({ colSpan }) => (
  <TableRow>
    <TableCell colSpan={colSpan} align="center" sx={{ py: 4 }}>
      <Box display="flex" justifyContent="center" alignItems="center">
        <CircularProgress size={24} sx={{ mr: 2 }} />
        <Typography variant="body2">Loading data...</Typography>
      </Box>
    </TableCell>
  </TableRow>
);

const EmptyRow = ({ message, colSpan }) => (
  <TableRow>
    <TableCell colSpan={colSpan} align="center" sx={{ py: 4 }}>
      <Typography variant="body2" color="textSecondary">
        {message || 'No data available'}
      </Typography>
    </TableCell>
  </TableRow>
);

// Custom pagination actions
const TablePaginationActions = ({ count, page, rowsPerPage, onPageChange }) => {
  const handleFirstPage = (event) => {
    onPageChange(event, 0);
  };

  const handleBackButtonClick = (event) => {
    onPageChange(event, page - 1);
  };

  const handleNextButtonClick = (event) => {
    onPageChange(event, page + 1);
  };

  const handleLastPage = (event) => {
    onPageChange(event, Math.max(0, Math.ceil(count / rowsPerPage) - 1));
  };

  return (
    <Box sx={{ flexShrink: 0, ml: 2.5 }}>
      <IconButton
        onClick={handleFirstPage}
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
        disabled={page >= Math.ceil(count / rowsPerPage) - 1}
        aria-label="next page"
      >
        <KeyboardArrowRight />
      </IconButton>
      <IconButton
        onClick={handleLastPage}
        disabled={page >= Math.ceil(count / rowsPerPage) - 1}
        aria-label="last page"
      >
        <LastPageIcon />
      </IconButton>
    </Box>
  );
};

const DataTable = ({
  columns,
  data,
  loading = false,
  error = null,
  onRowClick,
  onSelectionChange,
  selectedRows = [],
  defaultSort = { field: 'id', order: 'asc' },
  pagination = {},
  onPageChange,
  onRowsPerPageChange,
  onSort,
  emptyMessage = 'No data available',
  showCheckboxes = false,
  rowKey = 'id',
  sx = {},
}) => {
  const [order, setOrder] = useState(defaultSort.order);
  const [orderBy, setOrderBy] = useState(defaultSort.field);
  const [page, setPage] = useState(pagination.page || 0);
  const [rowsPerPage, setRowsPerPage] = useState(pagination.rowsPerPage || 10);

  // Handle sort request
  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    const newOrder = isAsc ? 'desc' : 'asc';
    setOrder(newOrder);
    setOrderBy(property);
    
    if (onSort) {
      onSort(property, newOrder);
    }
  };\n
  // Handle select all click
  const handleSelectAllClick = (event) => {
    if (event.target.checked && data) {
      const newSelected = data.map((row) => row[rowKey]);
      onSelectionChange?.(newSelected);
      return;
    }
    onSelectionChange?.([]);
  };

  // Handle row selection
  const handleRowSelect = (event, id) => {
    event.stopPropagation();
    
    const selectedIndex = selectedRows.indexOf(id);
    let newSelected = [];

    if (selectedIndex === -1) {
      newSelected = [...selectedRows, id];
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

    onSelectionChange?.(newSelected);
  };

  // Handle row click
  const handleRowClickInternal = (row) => {
    if (onRowClick) {
      onRowClick(row);
    }
  };

  // Handle page change
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
    if (onPageChange) {
      onPageChange(newPage, rowsPerPage);
    }
  };

  // Handle rows per page change
  const handleChangeRowsPerPage = (event) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    setPage(0);
    
    if (onRowsPerPageChange) {
      onRowsPerPageChange(newRowsPerPage);
    }
    
    if (onPageChange) {
      onPageChange(0, newRowsPerPage);
    }
  };

  // Check if a row is selected
  const isSelected = (id) => selectedRows.indexOf(id) !== -1;

  // Calculate pagination
  const paginatedData = useMemo(() => {
    if (!pagination.paginate || !data) return data;
    
    const startIndex = page * rowsPerPage;
    return data.slice(startIndex, startIndex + rowsPerPage);
  }, [data, page, rowsPerPage, pagination.paginate]);

  // Display data based on pagination
  const displayData = pagination.paginate ? paginatedData : data;

  return (
    <StyledTableContainer sx={sx}>
      <TableContainer>
        <StyledTable>
          <StyledTableHead>
            <TableRow>
              {showCheckboxes && (
                <StyledTableCell padding="checkbox">
                  <Checkbox
                    indeterminate={
                      selectedRows.length > 0 &&
                      selectedRows.length < (data?.length || 0)
                    }
                    checked={
                      data && data.length > 0 && selectedRows.length === data.length
                    }
                    onChange={handleSelectAllClick}
                    inputProps={{ 'aria-label': 'select all items' }}
                  />
                </StyledTableCell>
              )}
              {columns.map((column) => (
                <StyledTableCell
                  key={column.id}
                  align={column.align || 'left'}
                  sortDirection={orderBy === column.id ? order : false}
                  width={column.width}
                >
                  {column.sortable !== false ? (
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
                </StyledTableCell>
              ))}
            </TableRow>
          </StyledTableHead>
          <TableBody>
            {loading ? (
              <LoadingRow colSpan={columns.length + (showCheckboxes ? 1 : 0)} />
            ) : error ? (
              <EmptyRow 
                colSpan={columns.length + (showCheckboxes ? 1 : 0)} 
                message={error} 
              />
            ) : !displayData || displayData.length === 0 ? (
              <EmptyRow 
                colSpan={columns.length + (showCheckboxes ? 1 : 0)} 
                message={emptyMessage} 
              />
            ) : (
              displayData.map((row) => {
                const isItemSelected = isSelected(row[rowKey]);
                return (
                  <StyledTableRow
                    hover
                    key={row[rowKey]}
                    selected={isItemSelected}
                    onClick={() => handleRowClickInternal(row)}
                    sx={{
                      cursor: onRowClick ? 'pointer' : 'default',
                    }}
                  >
                    {showCheckboxes && (
                      <StyledTableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isItemSelected}
                          onChange={(event) => handleRowSelect(event, row[rowKey])}
                          onClick={(e) => e.stopPropagation()}
                          inputProps={{ 'aria-label': `select item ${row[rowKey]}` }}
                        />
                      </StyledTableCell>
                    )}
                    {columns.map((column) => (
                      <StyledTableCell
                        key={`${row[rowKey]}-${column.id}`}
                        align={column.align || 'left'}
                      >
                        {column.render ? (
                          column.render(row[column.id], row)
                        ) : column.format ? (
                          column.format(row[column.id], row)
                        ) : (
                          row[column.id]
                        )}
                      </StyledTableCell>
                    ))}
                  </StyledTableRow>
                );
              })
            )}
          </TableBody>
        </StyledTable>
      </TableContainer>
      
      {pagination.paginate && (
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50, 100]}
          component="div"
          count={pagination.total || 0}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          ActionsComponent={TablePaginationActions}
          sx={{
            borderTop: '1px solid rgba(224, 224, 224, 1)',
          }}
        />
      )}
    </StyledTableContainer>
  );
};

export default DataTable;
