import React, { useState, useEffect } from 'react';
import { Box, Grid, Typography, Card, CardContent, CardHeader, Divider, Button, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Dialog, DialogTitle, DialogContent, DialogActions, FormControl, FormControlLabel, Checkbox, FormGroup, CircularProgress, TextField, MenuItem, Select, InputLabel } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningIcon from '@mui/icons-material/Warning';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import InventoryIcon from '@mui/icons-material/Inventory';
import ReceiptIcon from '@mui/icons-material/Receipt';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import BackupIcon from '@mui/icons-material/Backup';
import RestoreIcon from '@mui/icons-material/Restore';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import { useInventoryContext } from '../../contexts/InventoryContext';
import { inventoryApi, backupApi } from '../../services/inventoryService';
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

/**
 * @typedef {Object} Backup
 * @property {string} filename - Backup filename
 * @property {string} createdAt - Creation timestamp
 * @property {number} size - Size in bytes
 * @property {string[]} collections - Included collections
 */

/**
 * Backup Management Widget Component
 * @param {Object} props - Component props
 * @param {Backup[]} props.backups - List of backup files
 * @param {Function} props.onRefresh - Function to refresh backups list
 */
const BackupManagementWidget = ({ backups, onRefresh }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState(/** @type {Backup|null} */ (null));
  const [isLoading, setIsLoading] = useState(false);
  const [collections, setCollections] = useState({
    categories: true,
    locations: true,
    products: true,
    inventory: true,
    stockMovements: true,
    suppliers: true,
    purchaseOrders: true
  });
  const [restoreOptions, setRestoreOptions] = useState({
    clearExisting: false,
    collections: {
      categories: true,
      locations: true,
      products: true,
      inventory: true,
      stockMovements: true,
      suppliers: true,
      purchaseOrders: true
    }
  });

  const handleCreateBackup = async () => {
    try {
      setIsLoading(true);
      await backupApi.createBackup({ collections });
      enqueueSnackbar('Backup created successfully', { variant: 'success' });
      setCreateDialogOpen(false);
      onRefresh();
    } catch (error) {
      console.error('Error creating backup:', error);
      enqueueSnackbar('Failed to create backup', { variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Restore data from the selected backup file
   */
  const handleRestoreBackup = async () => {
    if (!selectedBackup) return;
    
    try {
      setIsLoading(true);
      await backupApi.restoreBackup(selectedBackup.filename, restoreOptions);
      enqueueSnackbar('Backup restored successfully', { variant: 'success' });
      setRestoreDialogOpen(false);
      onRefresh();
    } catch (error) {
      console.error('Error restoring backup:', error);
      enqueueSnackbar('Failed to restore backup', { variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Delete a backup file
   * @param {string} filename - Name of the backup file to delete
   */
  const handleDeleteBackup = async (filename) => {
    try {
      await backupApi.deleteBackup(filename);
      enqueueSnackbar('Backup deleted successfully', { variant: 'success' });
      onRefresh();
    } catch (error) {
      console.error('Error deleting backup:', error);
      enqueueSnackbar('Failed to delete backup', { variant: 'error' });
    }
  };

  /**
   * Format date string to readable format
   * @param {string} dateString - ISO date string
   * @returns {string} Formatted date string
   */
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <Card>
      <CardHeader
        title="Backup Management"
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton onClick={() => onRefresh()} disabled={isLoading}>
              <RefreshIcon />
            </IconButton>
            <Button
              variant="contained"
              color="primary"
              startIcon={<BackupIcon />}
              onClick={() => setCreateDialogOpen(true)}
              disabled={isLoading}
              size="small"
            >
              Create Backup
            </Button>
          </Box>
        }
      />
      <Divider />
      <CardContent sx={{ p: 0 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : backups.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No backups available
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Filename</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Size</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {backups.map((backup) => (
                  <TableRow key={backup.filename} hover>
                    <TableCell>{backup.filename}</TableCell>
                    <TableCell>{formatDate(backup.createdAt)}</TableCell>
                    <TableCell>
                      {(backup.size / 1024).toFixed(2)} KB
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSelectedBackup(backup);
                          setRestoreDialogOpen(true);
                        }}
                        title="Restore from backup"
                      >
                        <RestoreIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteBackup(backup.filename)}
                        title="Delete backup"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>

      {/* Create Backup Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Backup</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" paragraph>
            Select which collections to include in the backup:
          </Typography>
          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox
                  checked={collections.categories}
                  onChange={(e) => setCollections({ ...collections, categories: e.target.checked })}
                />
              }
              label="Categories"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={collections.locations}
                  onChange={(e) => setCollections({ ...collections, locations: e.target.checked })}
                />
              }
              label="Locations"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={collections.products}
                  onChange={(e) => setCollections({ ...collections, products: e.target.checked })}
                />
              }
              label="Products"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={collections.inventory}
                  onChange={(e) => setCollections({ ...collections, inventory: e.target.checked })}
                />
              }
              label="Inventory"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={collections.stockMovements}
                  onChange={(e) => setCollections({ ...collections, stockMovements: e.target.checked })}
                />
              }
              label="Stock Movements"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={collections.suppliers}
                  onChange={(e) => setCollections({ ...collections, suppliers: e.target.checked })}
                />
              }
              label="Suppliers"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={collections.purchaseOrders}
                  onChange={(e) => setCollections({ ...collections, purchaseOrders: e.target.checked })}
                />
              }
              label="Purchase Orders"
            />
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateBackup}
            variant="contained"
            color="primary"
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={20} /> : null}
          >
            Create Backup
          </Button>
        </DialogActions>
      </Dialog>

      {/* Restore Backup Dialog */}
      <Dialog open={restoreDialogOpen} onClose={() => setRestoreDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Restore from Backup</DialogTitle>
        <DialogContent>
          {selectedBackup && (
            <>
              <Typography variant="body1" gutterBottom>
                Restore from: <strong>{selectedBackup.filename}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Created: {formatDate(selectedBackup.createdAt)}
              </Typography>
              
              <FormControlLabel
                control={
                  <Checkbox
                    checked={restoreOptions.clearExisting}
                    onChange={(e) => setRestoreOptions({ ...restoreOptions, clearExisting: e.target.checked })}
                  />
                }
                label="Clear existing data before restore"
              />
              
              <Typography variant="body2" sx={{ mt: 2, mb: 1 }}>
                Select collections to restore:
              </Typography>
              
              <FormGroup>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={restoreOptions.collections.categories}
                      onChange={(e) => setRestoreOptions({
                        ...restoreOptions,
                        collections: {
                          ...restoreOptions.collections,
                          categories: e.target.checked
                        }
                      })}
                    />
                  }
                  label="Categories"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={restoreOptions.collections.locations}
                      onChange={(e) => setRestoreOptions({
                        ...restoreOptions,
                        collections: {
                          ...restoreOptions.collections,
                          locations: e.target.checked
                        }
                      })}
                    />
                  }
                  label="Locations"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={restoreOptions.collections.products}
                      onChange={(e) => setRestoreOptions({
                        ...restoreOptions,
                        collections: {
                          ...restoreOptions.collections,
                          products: e.target.checked
                        }
                      })}
                    />
                  }
                  label="Products"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={restoreOptions.collections.inventory}
                      onChange={(e) => setRestoreOptions({
                        ...restoreOptions,
                        collections: {
                          ...restoreOptions.collections,
                          inventory: e.target.checked
                        }
                      })}
                    />
                  }
                  label="Inventory"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={restoreOptions.collections.stockMovements}
                      onChange={(e) => setRestoreOptions({
                        ...restoreOptions,
                        collections: {
                          ...restoreOptions.collections,
                          stockMovements: e.target.checked
                        }
                      })}
                    />
                  }
                  label="Stock Movements"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={restoreOptions.collections.suppliers}
                      onChange={(e) => setRestoreOptions({
                        ...restoreOptions,
                        collections: {
                          ...restoreOptions.collections,
                          suppliers: e.target.checked
                        }
                      })}
                    />
                  }
                  label="Suppliers"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={restoreOptions.collections.purchaseOrders}
                      onChange={(e) => setRestoreOptions({
                        ...restoreOptions,
                        collections: {
                          ...restoreOptions.collections,
                          purchaseOrders: e.target.checked
                        }
                      })}
                    />
                  }
                  label="Purchase Orders"
                />
              </FormGroup>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={() => handleRestoreBackup()}
            variant="contained"
            color="primary"
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={20} /> : null}
          >
            Restore
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

const AdminDashboard = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { loadProducts } = useInventoryContext();
  
  /**
   * @typedef {Object} LowStockItem
   * @property {string} id - Product ID
   * @property {string} name - Product name
   * @property {number} currentStock - Current stock level
   * @property {number} minStock - Minimum stock threshold
   */
  const [lowStockItems, setLowStockItems] = useState(/** @type {LowStockItem[]} */ ([]));
  
  /**
   * @typedef {Object} InventoryValueData
   * @property {number} total - Total inventory value
   * @property {number} trend - Trend percentage
   * @property {Array<{name: string, value: number}>} categories - Value by category
   */
  const [inventoryValue, setInventoryValue] = useState(/** @type {InventoryValueData} */ ({
    total: 0,
    trend: 0,
    categories: []
  }));
  
  /**
   * @typedef {Object} PendingOrder
   * @property {string} id - Order ID
   * @property {string} supplierName - Supplier name
   * @property {string} status - Order status
   * @property {number} total - Order total value
   */
  const [pendingOrders, setPendingOrders] = useState(/** @type {PendingOrder[]} */ ([]));
  
  /**
   * @typedef {Object} InventoryAdjustment
   * @property {number} id - Adjustment ID
   * @property {string} timestamp - Timestamp
   * @property {string} productName - Product name
   * @property {string} adjustedBy - User who made adjustment
   * @property {string} changeType - Type of change (increase/decrease)
   * @property {number} quantity - Quantity adjusted
   * @property {string} reason - Reason for adjustment
   */
  const [recentAdjustments, setRecentAdjustments] = useState(/** @type {InventoryAdjustment[]} */ ([]));
  
  /**
   * @typedef {Object} Backup
   * @property {string} filename - Backup filename
   * @property {string} createdAt - Creation timestamp
   * @property {number} size - Size in bytes
   * @property {string[]} collections - Included collections
   */
  const [backups, setBackups] = useState(/** @type {Backup[]} */ ([]));
    // Loading state for different sections of the dashboard
  const [loading, setLoading] = useState(/** @type {{lowStock: boolean, inventoryValue: boolean, pendingOrders: boolean, recentAdjustments: boolean, backups: boolean}} */ ({
    lowStock: false,
    inventoryValue: false,
    pendingOrders: false,
    recentAdjustments: false,
    backups: false
  }));
  
  // Use loading state in UI components for widgets
  const isLowStockLoading = loading.lowStock;
  const isInventoryValueLoading = loading.inventoryValue;
  const isPendingOrdersLoading = loading.pendingOrders;
  const isRecentAdjustmentsLoading = loading.recentAdjustments;
  const isBackupsLoading = loading.backups;
  
  const fetchDashboardData = async () => {
    try {
      setLoading((prevLoading) => ({ 
        ...prevLoading, 
        lowStock: true,
        inventoryValue: true,
        pendingOrders: true,
        recentAdjustments: true,
        backups: true
      }));
      
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
      
      // Fetch backups list
      try {
        const backupsResponse = await backupApi.listBackups();
        setBackups(backupsResponse.data || []);
      } catch (backupError) {
        console.error('Error fetching backups:', backupError);
        enqueueSnackbar('Failed to load backup data', { variant: 'warning' });
      }
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      enqueueSnackbar('Failed to load dashboard data', { variant: 'error' });
    } finally {
      setLoading((prevLoading) => ({ 
        ...prevLoading, 
        lowStock: false,
        inventoryValue: false,
        pendingOrders: false,
        recentAdjustments: false,
        backups: false
      }));
    }
  };
  
  const handleRefreshBackups = async () => {
    try {
      setLoading((prevLoading) => ({ ...prevLoading, backups: true }));
      const backupsResponse = await backupApi.listBackups();
      setBackups(backupsResponse.data || []);
    } catch (error) {
      console.error('Error fetching backups:', error);
      enqueueSnackbar('Failed to refresh backups', { variant: 'error' });
    } finally {
      setLoading((prevLoading) => ({ ...prevLoading, backups: false }));
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
      
      {/* Backup Management */}
      <Grid container spacing={3} sx={{ mt: 3 }}>
        <Grid item xs={12}>
          <BackupManagementWidget 
            backups={backups} 
            onRefresh={handleRefreshBackups} 
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
