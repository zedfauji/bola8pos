import React, { useState, useEffect } from 'react';
import { Box, Grid, Typography, Card, CardContent, CardHeader, Divider, Button, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningIcon from '@mui/icons-material/Warning';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import InventoryIcon from '@mui/icons-material/Inventory';
import ReceiptIcon from '@mui/icons-material/Receipt';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { useInventoryContext } from '../../contexts/InventoryContext';
import { inventoryApi } from '../../services/inventoryService';
import { useSnackbar } from 'notistack';
import { Link } from 'react-router-dom';

// Admin-specific widgets
const PendingOrdersWidget = ({ orders, onRefresh }) => {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader 
        title="Pending Purchase Orders" 
        action={
          <IconButton onClick={onRefresh}>
            <RefreshIcon />
          </IconButton>
        }
      />
      <Divider />
      <CardContent sx={{ flexGrow: 1, overflow: 'auto' }}>
        {orders.length === 0 ? (
          <Typography variant="body2" color="text.secondary" align="center">
            No pending orders
          </Typography>
        ) : (
          <TableContainer component={Box}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Order #</TableCell>
                  <TableCell>Supplier</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id} hover>
                    <TableCell>
                      <Link to={`/inventory/purchase-orders/${order.id}`} className="text-blue-600 hover:underline">
                        #{order.id}
                      </Link>
                    </TableCell>
                    <TableCell>{order.supplierName}</TableCell>
                    <TableCell>{order.status}</TableCell>
                    <TableCell>${order.total.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
      <Divider />
      <Box sx={{ p: 1, textAlign: 'center' }}>
        <Button component={Link} to="/inventory/purchase-orders" size="small">
          View All Orders
        </Button>
      </Box>
    </Card>
  );
};

const InventoryAdjustmentsWidget = ({ adjustments, onRefresh }) => {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader 
        title="Recent Inventory Adjustments" 
        action={
          <IconButton onClick={onRefresh}>
            <RefreshIcon />
          </IconButton>
        }
      />
      <Divider />
      <CardContent sx={{ flexGrow: 1, overflow: 'auto' }}>
        {adjustments.length === 0 ? (
          <Typography variant="body2" color="text.secondary" align="center">
            No recent adjustments
          </Typography>
        ) : (
          <TableContainer component={Box}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Product</TableCell>
                  <TableCell>Adjusted By</TableCell>
                  <TableCell>Change</TableCell>
                  <TableCell>Reason</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {adjustments.map((adj) => (
                  <TableRow key={adj.id} hover>
                    <TableCell>{new Date(adj.timestamp).toLocaleDateString()}</TableCell>
                    <TableCell>{adj.productName}</TableCell>
                    <TableCell>{adj.adjustedBy}</TableCell>
                    <TableCell sx={{ 
                      color: adj.changeType === 'increase' ? 'success.main' : 'error.main' 
                    }}>
                      {adj.changeType === 'increase' ? '+' : '-'}{adj.quantity}
                    </TableCell>
                    <TableCell>{adj.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
      <Divider />
      <Box sx={{ p: 1, textAlign: 'center' }}>
        <Button component={Link} to="/inventory/movements" size="small">
          View All Adjustments
        </Button>
      </Box>
    </Card>
  );
};

const InventoryValueWidget = ({ inventoryValue, onRefresh }) => {
  const theme = useTheme();
  
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader 
        title="Inventory Value" 
        action={
          <IconButton onClick={onRefresh}>
            <RefreshIcon />
          </IconButton>
        }
      />
      <Divider />
      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <Typography variant="h3" component="div" color="primary">
          ${inventoryValue.total.toFixed(2)}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
          {inventoryValue.trend > 0 ? (
            <TrendingUpIcon sx={{ color: theme.palette.success.main, mr: 1 }} />
          ) : (
            <TrendingDownIcon sx={{ color: theme.palette.error.main, mr: 1 }} />
          )}
          <Typography 
            variant="body2" 
            color={inventoryValue.trend > 0 ? 'success.main' : 'error.main'}
          >
            {Math.abs(inventoryValue.trend)}% from last month
          </Typography>
        </Box>
        <Box sx={{ mt: 2, width: '100%' }}>
          <Typography variant="subtitle2" gutterBottom>
            Value by Category
          </Typography>
          <TableContainer component={Box}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Category</TableCell>
                  <TableCell align="right">Value</TableCell>
                  <TableCell align="right">% of Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {inventoryValue.categories?.map((category) => (
                  <TableRow key={category.name} hover>
                    <TableCell>{category.name}</TableCell>
                    <TableCell align="right">${category.value.toFixed(2)}</TableCell>
                    <TableCell align="right">
                      {((category.value / inventoryValue.total) * 100).toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </CardContent>
      <Divider />
      <Box sx={{ p: 1, textAlign: 'center' }}>
        <Button component={Link} to="/inventory/reports" size="small">
          View Detailed Reports
        </Button>
      </Box>
    </Card>
  );
};

const LowStockWidget = ({ lowStockItems, onRefresh }) => {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader 
        title="Low Stock Alerts" 
        action={
          <IconButton onClick={onRefresh}>
            <RefreshIcon />
          </IconButton>
        }
      />
      <Divider />
      <CardContent sx={{ flexGrow: 1, overflow: 'auto' }}>
        {lowStockItems.length === 0 ? (
          <Typography variant="body2" color="text.secondary" align="center">
            No low stock items
          </Typography>
        ) : (
          <TableContainer component={Box}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Product</TableCell>
                  <TableCell>Current</TableCell>
                  <TableCell>Min</TableCell>
                  <TableCell>Reorder</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {lowStockItems.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <WarningIcon color="warning" sx={{ mr: 1, fontSize: '1rem' }} />
                        {item.name}
                      </Box>
                    </TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>{item.minQuantity}</TableCell>
                    <TableCell>
                      <Button 
                        size="small" 
                        variant="outlined" 
                        component={Link} 
                        to={`/inventory/purchase-orders/new?product=${item.id}`}
                      >
                        Reorder
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
      <Divider />
      <Box sx={{ p: 1, textAlign: 'center' }}>
        <Button component={Link} to="/inventory/products" size="small">
          View All Products
        </Button>
      </Box>
    </Card>
  );
};

const AdminDashboard = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { loadProducts } = useInventoryContext();
  
  const [lowStockItems, setLowStockItems] = useState([]);
  const [inventoryValue, setInventoryValue] = useState({ 
    total: 0, 
    trend: 0,
    categories: []
  });
  const [pendingOrders, setPendingOrders] = useState([]);
  const [recentAdjustments, setRecentAdjustments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch low stock items
      const lowStockResponse = await inventoryApi.getLowStock();
      setLowStockItems(lowStockResponse.data || []);
      
      // Fetch inventory snapshot for value calculation
      const snapshotResponse = await inventoryApi.getSnapshot();
      setInventoryValue({
        total: snapshotResponse.data?.totalValue || 0,
        trend: snapshotResponse.data?.trend || 0,
        categories: snapshotResponse.data?.categories || [
          { name: 'Beverages', value: 5200.00 },
          { name: 'Food', value: 2100.00 },
          { name: 'Equipment', value: 1800.00 },
          { name: 'Merchandise', value: 900.00 }
        ]
      });
      
      // Fetch pending purchase orders
      // This would typically come from a dedicated endpoint
      const ordersData = [
        {
          id: 'PO-1001',
          supplierName: 'Beverage Distributors Inc.',
          status: 'Pending Approval',
          total: 1250.00
        },
        {
          id: 'PO-1002',
          supplierName: 'Pool Equipment Supply',
          status: 'Pending Delivery',
          total: 875.50
        },
        {
          id: 'PO-1003',
          supplierName: 'Food Wholesale Co.',
          status: 'Pending Approval',
          total: 450.25
        }
      ];
      setPendingOrders(ordersData);
      
      // Fetch recent inventory adjustments
      const adjustmentsData = [
        {
          id: 1,
          timestamp: new Date().toISOString(),
          productName: 'Heineken Beer',
          adjustedBy: 'John Manager',
          changeType: 'increase',
          quantity: 24,
          reason: 'Inventory count correction'
        },
        {
          id: 2,
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          productName: 'Tequila',
          adjustedBy: 'Sarah Admin',
          changeType: 'decrease',
          quantity: 1,
          reason: 'Damaged product'
        },
        {
          id: 3,
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          productName: 'Pool Cues',
          adjustedBy: 'John Manager',
          changeType: 'decrease',
          quantity: 2,
          reason: 'Broken equipment'
        }
      ];
      setRecentAdjustments(adjustmentsData);
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      enqueueSnackbar('Failed to load dashboard data', { variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchDashboardData();
    // Also load products in the background for other components
    loadProducts();
  }, [loadProducts]);
  
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
        <InventoryIcon sx={{ mr: 1 }} /> Admin Inventory Dashboard
      </Typography>
      
      <Grid container spacing={3}>
        {/* Inventory Value */}
        <Grid item xs={12} md={6}>
          <InventoryValueWidget 
            inventoryValue={inventoryValue} 
            onRefresh={fetchDashboardData} 
          />
        </Grid>
        
        {/* Low Stock Alerts */}
        <Grid item xs={12} md={6}>
          <LowStockWidget 
            lowStockItems={lowStockItems} 
            onRefresh={fetchDashboardData} 
          />
        </Grid>
        
        {/* Pending Purchase Orders */}
        <Grid item xs={12} md={6}>
          <PendingOrdersWidget 
            orders={pendingOrders} 
            onRefresh={fetchDashboardData} 
          />
        </Grid>
        
        {/* Recent Inventory Adjustments */}
        <Grid item xs={12} md={6}>
          <InventoryAdjustmentsWidget 
            adjustments={recentAdjustments} 
            onRefresh={fetchDashboardData} 
          />
        </Grid>
      </Grid>
      
      {/* Admin Actions */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" gutterBottom>
          Administrative Actions
        </Typography>
        <Grid container spacing={2}>
          <Grid item>
            <Button 
              variant="contained" 
              startIcon={<ReceiptIcon />}
              component={Link}
              to="/inventory/purchase-orders/new"
            >
              Create Purchase Order
            </Button>
          </Grid>
          <Grid item>
            <Button 
              variant="contained" 
              startIcon={<LocalShippingIcon />}
              component={Link}
              to="/inventory/suppliers"
            >
              Manage Suppliers
            </Button>
          </Grid>
          <Grid item>
            <Button 
              variant="contained" 
              startIcon={<InventoryIcon />}
              component={Link}
              to="/inventory/stock-count"
            >
              Start Stock Count
            </Button>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

export default AdminDashboard;
