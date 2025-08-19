import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Divider,
  Grid,
  TextField,
  InputAdornment,
  Typography,
  Alert,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useInventoryContext } from '../../../contexts/InventoryContext';
import DataTable from '../../../components/inventory/DataTable';
import PurchaseOrderForm from './PurchaseOrderForm';
import PurchaseOrderDetail from './PurchaseOrderDetail';

const PurchaseOrdersPage = ({ isNew = false, isDetail = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { enqueueSnackbar } = useSnackbar();
  const { 
    purchaseOrders, 
    suppliers, 
    loading, 
    error, 
    loadSuppliers, 
    loadPurchaseOrders,
    createPurchaseOrder,
    updatePurchaseOrderStatus,
    receivePurchaseOrderItems,
    pagination,
    setPagination,
    setFilters
  } = useInventoryContext();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPurchaseOrder, setSelectedPurchaseOrder] = useState(null);
  
  // Get pre-selected supplier from location state (if navigated from supplier page)
  const preSelectedSupplierId = location.state?.supplierId;

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        await loadSuppliers();
        await loadPurchaseOrders();
      } catch (err) {
        enqueueSnackbar(err.message || 'Failed to load data', { variant: 'error' });
      }
    };
    
    fetchData();
  }, [loadSuppliers, loadPurchaseOrders, enqueueSnackbar]);

  // Refresh purchase orders
  const refreshPurchaseOrders = useCallback(() => {
    loadPurchaseOrders({
      page: pagination.page + 1, // API uses 1-indexed pages
      limit: pagination.limit,
      search: searchTerm
    });
  }, [loadPurchaseOrders, pagination.page, pagination.limit, searchTerm]);

  // Handle search
  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setPagination({ page: 0, limit: pagination.limit }); // Reset to first page
    
    // Debounce search to avoid too many API calls
    const timer = setTimeout(() => {
      setFilters({ search: value });
      loadPurchaseOrders({ page: 1, limit: pagination.limit, search: value });
    }, 500);
    
    return () => clearTimeout(timer);
  };

  // Handle pagination
  const handlePageChange = (newPage, rowsPerPage) => {
    const updatedPagination = {
      page: newPage,
      limit: rowsPerPage,
    };
    
    setPagination(updatedPagination);
    loadPurchaseOrders({
      page: newPage + 1, // API uses 1-indexed pages
      limit: rowsPerPage,
      search: searchTerm
    });
  };

  // Handle create new PO
  const handleCreatePO = () => {
    navigate('/inventory/purchase-orders/new');
  };
  
  // Handle submit new PO
  const handleSubmitPO = async (poData) => {
    try {
      const result = await createPurchaseOrder(poData);
      if (result.success) {
        enqueueSnackbar('Purchase order created successfully', { variant: 'success' });
        navigate(`/inventory/purchase-orders/${result.data.id}`);
        return true;
      } else {
        enqueueSnackbar(result.error || 'Failed to create purchase order', { variant: 'error' });
        return false;
      }
    } catch (err) {
      enqueueSnackbar(err.message || 'Failed to create purchase order', { variant: 'error' });
      return false;
    }
  };

  // Handle view PO details
  const handleViewPO = (po) => {
    navigate(`/inventory/purchase-orders/${po.id}`);
  };

  // Table columns
  const columns = [
    {
      id: 'id',
      label: 'PO Number',
      sortable: true,
    },
    {
      id: 'supplierName',
      label: 'Supplier',
      sortable: true,
    },
    {
      id: 'orderDate',
      label: 'Order Date',
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      id: 'expectedDeliveryDate',
      label: 'Expected Delivery',
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      id: 'status',
      label: 'Status',
      sortable: true,
      render: (value) => {
        let color;
        
        switch (value) {
          case 'pending':
            color = 'warning';
            break;
          case 'received':
            color = 'success';
            break;
          case 'cancelled':
            color = 'error';
            break;
          case 'partial':
            color = 'info';
            break;
          default:
            color = 'default';
        }
        
        return <Chip 
          label={value.charAt(0).toUpperCase() + value.slice(1)} 
          color={color} 
          size="small" 
        />;
      },
    },
    {
      id: 'totalAmount',
      label: 'Total Amount',
      align: 'right',
      sortable: true,
      render: (value) => `$${value.toFixed(2)}`,
    },
  ];

  // If we're in "new" mode, render the form
  if (isNew) {
    return (
      <PurchaseOrderForm 
        suppliers={suppliers}
        preSelectedSupplierId={preSelectedSupplierId} 
        onCancel={() => navigate('/inventory/purchase-orders')}
        onSubmit={handleSubmitPO}
        loading={loading}
      />
    );
  }

  // If we're in "detail" mode, render the detail view
  if (isDetail && id) {
    // Find the PO in our data
    useEffect(() => {
      const fetchPurchaseOrderDetail = async () => {
        try {
          // In a real implementation, we would fetch the specific PO by ID
          // For now, we'll find it in the existing list or fetch all if needed
          if (purchaseOrders.length === 0) {
            await loadPurchaseOrders();
          }
          
          const po = purchaseOrders.find(po => po.id === id);
          setSelectedPurchaseOrder(po || null);
        } catch (err) {
          enqueueSnackbar(err.message || 'Failed to load purchase order details', { variant: 'error' });
        }
      };
      
      fetchPurchaseOrderDetail();
    }, [id, purchaseOrders, loadPurchaseOrders, enqueueSnackbar]);
    
    if (loading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <CircularProgress />
        </Box>
      );
    }
    
    if (!selectedPurchaseOrder && !loading) {
      return (
        <Box sx={{ p: 3 }}>
          <Alert severity="error">
            Purchase order not found. The order may have been deleted or you don't have permission to view it.
          </Alert>
          <Box sx={{ mt: 2 }}>
            <Button 
              variant="contained" 
              onClick={() => navigate('/inventory/purchase-orders')}
            >
              Back to Purchase Orders
            </Button>
          </Box>
        </Box>
      );
    }
    
    return (
      <PurchaseOrderDetail 
        purchaseOrder={selectedPurchaseOrder} 
        onBack={() => navigate('/inventory/purchase-orders')}
        onStatusChange={updatePurchaseOrderStatus}
        onReceiveItems={receivePurchaseOrderItems}
      />
    );
  }

  // Default view - list of purchase orders
  return (
    <Box>
      <Card>
        <CardHeader
          title="Purchase Orders"
          action={
            <Button
              color="primary"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreatePO}
            >
              Create Purchase Order
            </Button>
          }
        />
        <Divider />
        <CardContent>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                placeholder="Search purchase orders..."
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
            <Grid item xs={12} md={4}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={refreshPurchaseOrders}
                disabled={loading}
                sx={{ height: '56px' }}
              >
                {loading ? 'Loading...' : 'Refresh'}
              </Button>
            </Grid>
          </Grid>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {purchaseOrders.length === 0 && !loading && !error ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary" gutterBottom>
                No purchase orders found
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleCreatePO}
                sx={{ mt: 2 }}
              >
                Create Your First Purchase Order
              </Button>
            </Box>
          ) : (
            <DataTable
              columns={columns}
              data={purchaseOrders}
              loading={loading}
              error={error}
              onRowClick={handleViewPO}
              pagination={{
                paginate: true,
                page: pagination.page,
                rowsPerPage: pagination.limit,
                total: pagination.total || 0,
                onPageChange: handlePageChange,
              }}
              rowKey="id"
              sx={{
                '& .MuiTableCell-root': {
                  py: 1.5,
                },
              }}
            />
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default PurchaseOrdersPage;
