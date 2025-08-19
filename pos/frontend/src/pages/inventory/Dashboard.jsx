import React, { useState, useEffect } from 'react';
import { Box, Grid, Typography, Paper, Card, CardContent, CardHeader, Divider, Button, IconButton } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningIcon from '@mui/icons-material/Warning';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import InventoryIcon from '@mui/icons-material/Inventory';
import { useInventoryContext } from '../../contexts/InventoryContext';
import { inventoryApi } from '../../services/inventoryService';
import { useSnackbar } from 'notistack';
import { Link } from 'react-router-dom';

// Widget components
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
          lowStockItems.map((item) => (
            <Box key={item.id} sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
              <WarningIcon color="warning" sx={{ mr: 1 }} />
              <Box>
                <Typography variant="body2" fontWeight="bold">
                  {item.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Current: {item.quantity} | Min: {item.minQuantity}
                </Typography>
              </Box>
            </Box>
          ))
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
      </CardContent>
      <Divider />
      <Box sx={{ p: 1, textAlign: 'center' }}>
        <Button component={Link} to="/inventory/reports" size="small">
          View Reports
        </Button>
      </Box>
    </Card>
  );
};

const RecentMovementsWidget = ({ movements, onRefresh }) => {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader 
        title="Recent Movements" 
        action={
          <IconButton onClick={onRefresh}>
            <RefreshIcon />
          </IconButton>
        }
      />
      <Divider />
      <CardContent sx={{ flexGrow: 1, overflow: 'auto' }}>
        {movements.length === 0 ? (
          <Typography variant="body2" color="text.secondary" align="center">
            No recent movements
          </Typography>
        ) : (
          movements.map((movement) => (
            <Box key={movement.id} sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" fontWeight="bold">
                  {movement.productName}
                </Typography>
                <Typography 
                  variant="body2" 
                  color={movement.type === 'in' ? 'success.main' : 'error.main'}
                >
                  {movement.type === 'in' ? '+' : '-'}{movement.quantity}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                {new Date(movement.timestamp).toLocaleString()} - {movement.reason}
              </Typography>
            </Box>
          ))
        )}
      </CardContent>
      <Divider />
      <Box sx={{ p: 1, textAlign: 'center' }}>
        <Button component={Link} to="/inventory/movements" size="small">
          View All Movements
        </Button>
      </Box>
    </Card>
  );
};

const QuickSearchWidget = ({ onSearch }) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const handleSearch = (e) => {
    e.preventDefault();
    onSearch(searchTerm);
  };
  
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader title="Quick Search" />
      <Divider />
      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <form onSubmit={handleSearch}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search products..."
              style={{ 
                flex: 1, 
                padding: '8px 12px', 
                border: '1px solid #ccc', 
                borderRadius: '4px' 
              }}
            />
            <Button type="submit" variant="contained" size="small">
              Search
            </Button>
          </Box>
        </form>
        
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Quick Links
          </Typography>
          <Button 
            component={Link} 
            to="/inventory/products/new" 
            variant="outlined" 
            size="small" 
            fullWidth 
            sx={{ mb: 1 }}
          >
            Add New Product
          </Button>
          <Button 
            component={Link} 
            to="/inventory/movements/new" 
            variant="outlined" 
            size="small" 
            fullWidth 
            sx={{ mb: 1 }}
          >
            Record Movement
          </Button>
          <Button 
            component={Link} 
            to="/inventory/suppliers" 
            variant="outlined" 
            size="small" 
            fullWidth
          >
            Manage Suppliers
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

const InventoryDashboard = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { loadProducts } = useInventoryContext();
  
  const [lowStockItems, setLowStockItems] = useState([]);
  const [inventoryValue, setInventoryValue] = useState({ total: 0, trend: 0 });
  const [recentMovements, setRecentMovements] = useState([]);
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
        trend: snapshotResponse.data?.trend || 0
      });
      
      // Fetch recent movements
      // This would typically come from a dedicated endpoint, but we're simulating it
      // In a real implementation, you would have a proper API endpoint for this
      const movementsData = [
        {
          id: 1,
          productName: 'Heineken Beer',
          type: 'in',
          quantity: 24,
          timestamp: new Date().toISOString(),
          reason: 'Purchase Order #1234'
        },
        {
          id: 2,
          productName: 'Tequila',
          type: 'out',
          quantity: 2,
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          reason: 'Sales'
        },
        {
          id: 3,
          productName: 'Whiskey',
          type: 'out',
          quantity: 1,
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          reason: 'Sales'
        }
      ];
      setRecentMovements(movementsData);
      
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
  
  const handleSearch = (term) => {
    // Navigate to products page with search term
    // In a real implementation, you would use react-router's navigate
    console.log('Searching for:', term);
    // navigate('/inventory/products', { state: { searchTerm: term } });
  };
  
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
        <InventoryIcon sx={{ mr: 1 }} /> Inventory Dashboard
      </Typography>
      
      <Grid container spacing={3}>
        {/* Low Stock Alerts */}
        <Grid item xs={12} md={6} lg={3}>
          <LowStockWidget 
            lowStockItems={lowStockItems} 
            onRefresh={fetchDashboardData} 
          />
        </Grid>
        
        {/* Inventory Value */}
        <Grid item xs={12} md={6} lg={3}>
          <InventoryValueWidget 
            inventoryValue={inventoryValue} 
            onRefresh={fetchDashboardData} 
          />
        </Grid>
        
        {/* Recent Movements */}
        <Grid item xs={12} md={6} lg={3}>
          <RecentMovementsWidget 
            movements={recentMovements} 
            onRefresh={fetchDashboardData} 
          />
        </Grid>
        
        {/* Quick Search */}
        <Grid item xs={12} md={6} lg={3}>
          <QuickSearchWidget onSearch={handleSearch} />
        </Grid>
      </Grid>
    </Box>
  );
};

export default InventoryDashboard;
