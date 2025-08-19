import React, { useState, useEffect } from 'react';
import { Box, Grid, Typography, Card, CardContent, CardHeader, Divider, Button, IconButton, List, ListItem, ListItemText, ListItemIcon } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningIcon from '@mui/icons-material/Warning';
import InventoryIcon from '@mui/icons-material/Inventory';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import SearchIcon from '@mui/icons-material/Search';
import { useInventoryContext } from '../../contexts/InventoryContext';
import { inventoryApi } from '../../services/inventoryService';
import { useSnackbar } from 'notistack';
import { Link } from 'react-router-dom';

// Employee/Manager specific widgets
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
          <List dense>
            {lowStockItems.map((item) => (
              <ListItem key={item.id}>
                <ListItemIcon>
                  <WarningIcon color="warning" />
                </ListItemIcon>
                <ListItemText 
                  primary={item.name}
                  secondary={`Current: ${item.quantity} | Min: ${item.minQuantity}`}
                />
              </ListItem>
            ))}
          </List>
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
          <List dense>
            {movements.map((movement) => (
              <ListItem key={movement.id}>
                <ListItemIcon>
                  {movement.type === 'in' ? 
                    <AddCircleIcon color="success" /> : 
                    <RemoveCircleIcon color="error" />
                  }
                </ListItemIcon>
                <ListItemText 
                  primary={`${movement.productName} (${movement.type === 'in' ? '+' : '-'}${movement.quantity})`}
                  secondary={`${new Date(movement.timestamp).toLocaleString()} - ${movement.reason}`}
                />
              </ListItem>
            ))}
          </List>
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

const QuickActionsWidget = () => {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader title="Quick Actions" />
      <Divider />
      <CardContent sx={{ flexGrow: 1 }}>
        <Grid container spacing={2} direction="column">
          <Grid item>
            <Button 
              variant="outlined" 
              fullWidth 
              startIcon={<AddCircleIcon />}
              component={Link}
              to="/inventory/movements/new?type=in"
            >
              Record Stock In
            </Button>
          </Grid>
          <Grid item>
            <Button 
              variant="outlined" 
              fullWidth 
              startIcon={<RemoveCircleIcon />}
              component={Link}
              to="/inventory/movements/new?type=out"
            >
              Record Stock Out
            </Button>
          </Grid>
          <Grid item>
            <Button 
              variant="outlined" 
              fullWidth 
              startIcon={<SearchIcon />}
              component={Link}
              to="/inventory/products"
            >
              Find Product
            </Button>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

const ProductSearchWidget = ({ onSearch }) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const handleSearch = (e) => {
    e.preventDefault();
    onSearch(searchTerm);
  };
  
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader title="Product Search" />
      <Divider />
      <CardContent sx={{ flexGrow: 1 }}>
        <form onSubmit={handleSearch}>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
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
              <SearchIcon />
            </Button>
          </Box>
        </form>
        
        <Typography variant="subtitle2" gutterBottom>
          Popular Products
        </Typography>
        <List dense>
          <ListItem button component={Link} to="/inventory/products/1">
            <ListItemText primary="Heineken Beer" secondary="24 units in stock" />
          </ListItem>
          <ListItem button component={Link} to="/inventory/products/2">
            <ListItemText primary="Tequila" secondary="12 bottles in stock" />
          </ListItem>
          <ListItem button component={Link} to="/inventory/products/3">
            <ListItemText primary="Pool Cues" secondary="15 units in stock" />
          </ListItem>
        </List>
      </CardContent>
    </Card>
  );
};

const EmployeeDashboard = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { loadProducts } = useInventoryContext();
  
  const [lowStockItems, setLowStockItems] = useState([]);
  const [recentMovements, setRecentMovements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch low stock items
      const lowStockResponse = await inventoryApi.getLowStock();
      setLowStockItems(lowStockResponse.data || []);
      
      // Fetch recent movements
      // This would typically come from a dedicated endpoint, but we're simulating it
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
        <Grid item xs={12} md={6}>
          <LowStockWidget 
            lowStockItems={lowStockItems} 
            onRefresh={fetchDashboardData} 
          />
        </Grid>
        
        {/* Recent Movements */}
        <Grid item xs={12} md={6}>
          <RecentMovementsWidget 
            movements={recentMovements} 
            onRefresh={fetchDashboardData} 
          />
        </Grid>
        
        {/* Quick Actions */}
        <Grid item xs={12} md={6}>
          <QuickActionsWidget />
        </Grid>
        
        {/* Product Search */}
        <Grid item xs={12} md={6}>
          <ProductSearchWidget onSearch={handleSearch} />
        </Grid>
      </Grid>
    </Box>
  );
};

export default EmployeeDashboard;
