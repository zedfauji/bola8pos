import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Divider,
  Grid,
  TextField,
  MenuItem,
  InputAdornment,
  IconButton,
  Tooltip,
  Chip,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Alert,
  Stack,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { useInventory } from '../../../hooks/useInventory';
import DataTable from '../../../components/inventory/DataTable';
import ProductForm from '../../../components/inventory/forms/ProductForm';
import LowStockBadge from '../../../components/inventory/LowStockBadge';

const ProductsPage = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogType, setDialogType] = useState('add');
  const [currentProduct, setCurrentProduct] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  
  // Fetch products and categories
  const {
    products,
    loading,
    error,
    pagination,
    fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    categories,
    fetchCategories,
  } = useInventory();

  // Initial data fetch
  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  // Handle search
  const handleSearch = useCallback((e) => {
    const value = e.target.value;
    setSearchTerm(value);
    // Add debounce here if needed
    fetchProducts({ search: value, category: categoryFilter, status: statusFilter });
  }, [categoryFilter, statusFilter, fetchProducts]);

  // Handle category filter change
  const handleCategoryFilterChange = (e) => {
    const value = e.target.value;
    setCategoryFilter(value);
    fetchProducts({ search: searchTerm, category: value, status: statusFilter });
  };

  // Handle status filter change
  const handleStatusFilterChange = (e) => {
    const value = e.target.value;
    setStatusFilter(value);
    fetchProducts({ search: searchTerm, category: categoryFilter, status: value });
  };

  // Handle pagination
  const handlePageChange = (newPage, rowsPerPage) => {
    fetchProducts({
      page: newPage + 1,
      limit: rowsPerPage,
      search: searchTerm,
      category: categoryFilter,
      status: statusFilter,
    });
  };

  // Handle sort
  const handleSort = (field, order) => {
    fetchProducts({
      sortBy: field,
      sortOrder: order,
      search: searchTerm,
      category: categoryFilter,
      status: statusFilter,
    });
  };

  // Handle add product
  const handleAddProduct = () => {
    setCurrentProduct(null);
    setDialogType('add');
    setOpenDialog(true);
  };

  // Handle edit product
  const handleEditProduct = (product) => {
    setCurrentProduct(product);
    setDialogType('edit');
    setOpenDialog(true);
  };

  // Handle view product
  const handleViewProduct = (product) => {
    navigate(`/inventory/products/${product.id}`);
  };

  // Handle delete product
  const handleDeleteClick = (product) => {
    setCurrentProduct(product);
    setDeleteConfirmOpen(true);
  };

  // Confirm delete product
  const confirmDeleteProduct = async () => {
    try {
      await deleteProduct(currentProduct.id);
      enqueueSnackbar('Product deleted successfully', { variant: 'success' });
      setDeleteConfirmOpen(false);
      setCurrentProduct(null);
    } catch (error) {
      enqueueSnackbar(error.message || 'Failed to delete product', { variant: 'error' });
    }
  };

  // Handle bulk delete
  const handleBulkDelete = () => {
    if (selectedProducts.length === 0) return;
    setBulkDeleteConfirmOpen(true);
  };

  // Confirm bulk delete
  const confirmBulkDelete = async () => {
    try {
      // Implement bulk delete logic here
      // This is a placeholder - you'll need to implement the actual API call
      const deletePromises = selectedProducts.map(id => deleteProduct(id));
      await Promise.all(deletePromises);
      
      enqueueSnackbar(`${selectedProducts.length} products deleted successfully`, { 
        variant: 'success' 
      });
      
      setSelectedProducts([]);
      setBulkDeleteConfirmOpen(false);
    } catch (error) {
      enqueueSnackbar('Failed to delete selected products', { variant: 'error' });
    }
  };

  // Handle form submission
  const handleSubmit = async (formData) => {
    try {
      if (dialogType === 'add') {
        await createProduct(formData);
        enqueueSnackbar('Product created successfully', { variant: 'success' });
      } else {
        await updateProduct(currentProduct.id, formData);
        enqueueSnackbar('Product updated successfully', { variant: 'success' });
      }
      setOpenDialog(false);
    } catch (error) {
      enqueueSnackbar(error.message || 'An error occurred', { variant: 'error' });
    }
  };

  // Table columns
  const columns = [
    {
      id: 'name',
      label: 'Product Name',
      sortable: true,
      render: (value, row) => (
        <Box>
          <Typography variant="subtitle2">{value}</Typography>
          <Typography variant="body2" color="textSecondary">
            SKU: {row.sku}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'category',
      label: 'Category',
      sortable: true,
      render: (value) => value?.name || 'Uncategorized',
    },
    {
      id: 'price',
      label: 'Price',
      align: 'right',
      sortable: true,
      render: (value) => `$${parseFloat(value).toFixed(2)}`,
    },
    {
      id: 'stock',
      label: 'In Stock',
      align: 'right',
      sortable: true,
      render: (_, row) => (
        <Typography
          color={
            row.stockQuantity <= row.lowStockThreshold
              ? 'error'
              : 'textPrimary'
          }
        >
          {row.stockQuantity} {row.unit || 'units'}
        </Typography>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      sortable: true,
      render: (value) => (
        <Chip
          label={value === 'active' ? 'Active' : 'Inactive'}
          color={value === 'active' ? 'success' : 'default'}
          size="small"
        />
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (_, row) => (
        <Box display="flex" justifyContent="flex-end">
          <Tooltip title="View">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleViewProduct(row);
              }}
            >
              <VisibilityIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleEditProduct(row);
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteClick(row);
              }}
              color="error"
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <Card>
        <CardHeader
          title="Products"
          action={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LowStockBadge clickable to="/inventory?low=1" pollMs={15000} notifyOnIncrease />
              <Button
                color="primary"
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddProduct}
              >
                Add Product
              </Button>
            </Box>
          }
        />
        <Divider />
        <CardContent>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search products..."
                value={searchTerm}
                onChange={handleSearch}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                select
                fullWidth
                label="Category"
                value={categoryFilter}
                onChange={handleCategoryFilterChange}
              >
                <MenuItem value="all">All Categories</MenuItem>
                {categories.map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                select
                fullWidth
                label="Status"
                value={statusFilter}
                onChange={handleStatusFilterChange}
              >
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
                <MenuItem value="out_of_stock">Out of Stock</MenuItem>
                <MenuItem value="low_stock">Low Stock</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<FilterListIcon />}
                sx={{ height: '56px' }}
              >
                More Filters
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => fetchProducts()}
                sx={{ height: '56px' }}
              >
                Refresh
              </Button>
            </Grid>
          </Grid>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <DataTable
            columns={columns}
            data={products}
            loading={loading}
            error={error}
            onRowClick={handleViewProduct}
            onSelectionChange={setSelectedProducts}
            selectedRows={selectedProducts}
            onSort={handleSort}
            pagination={{
              paginate: true,
              page: (pagination?.page || 1) - 1,
              rowsPerPage: pagination?.limit || 10,
              total: pagination?.total || 0,
              onPageChange: handlePageChange,
            }}
            showCheckboxes={true}
            rowKey="id"
            sx={{
              '& .MuiTableCell-root': {
                py: 1.5,
              },
            }}
          />
        </CardContent>
      </Card>

      {/* Add/Edit Product Dialog */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {dialogType === 'add' ? 'Add New Product' : 'Edit Product'}
        </DialogTitle>
        <DialogContent>
          <ProductForm
            product={currentProduct}
            categories={categories}
            onSubmit={handleSubmit}
            onCancel={() => setOpenDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle>Delete Product</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "{currentProduct?.name}"? This action
            cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button
            onClick={confirmDeleteProduct}
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog
        open={bulkDeleteConfirmOpen}
        onClose={() => setBulkDeleteConfirmOpen(false)}
      >
        <DialogTitle>Delete Selected Products</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete {selectedProducts.length} selected products?
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDeleteConfirmOpen(false)}>Cancel</Button>
          <Button
            onClick={confirmBulkDelete}
            color="error"
            variant="contained"
          >
            Delete {selectedProducts.length} Products
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProductsPage;
