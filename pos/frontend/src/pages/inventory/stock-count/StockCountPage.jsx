import { useState, useEffect, useContext } from 'react';
// import { useNavigate } from 'react-router-dom'; // Not used in this component
import { useSnackbar } from 'notistack';

/**
 * @typedef {Object} StockCountItem
 * @property {string} id - Product ID
 * @property {string} name - Product name
 * @property {string} [sku] - Product SKU
 * @property {number} expectedQty - Expected quantity
 * @property {number} countedQty - Counted quantity
 * @property {number} unitCost - Unit cost
 * @property {string} category - Product category
 * @property {string} [location] - Product location
 * @property {string} [notes] - Optional notes about the item
 */

/**
 * @typedef {Object} StockCount
 * @property {string} id - Stock count ID
 * @property {string} name - Stock count name
 * @property {Date} date - Date created
 * @property {string} status - Status (in_progress, completed, cancelled)
 * @property {StockCountItem[]} items - Stock count items
 * @property {Date|null} lastSaved - Last saved date
 * @property {number} discrepancies - Number of discrepancies
 * @property {number} totalDiscrepancyValue - Total discrepancy value
 * @property {string} [type] - Type of count (full or partial)
 * @property {number} [totalItems] - Total number of items in the count
 * @property {string} [countedBy] - User who performed the count
 * @property {string} [category] - Category for partial counts
 * @property {Date} [completedAt] - Date when count was completed
 * @property {Date} [cancelledAt] - Date when count was cancelled
 */

/**
 * @typedef {Object} HistoryItem
 * @property {string} id - History item ID
 * @property {string} name - History item name
 * @property {Date} date - Date created
 * @property {string} status - Status
 * @property {number} items - Number of items
 * @property {number} discrepancies - Number of discrepancies
 * @property {number} totalDiscrepancyValue - Total discrepancy value
 * @property {string} [type] - Type of count (full or partial)
 * @property {string} [countedBy] - User who performed the count
 * @property {string} [category] - Category for partial counts
 * @property {number} [totalItems] - Total number of items in the count
 */

/**
 * @typedef {Object} HistoryItemWithArrayItems
 * @property {string} id - History item ID
 * @property {string} name - History item name
 * @property {Date} date - Date created
 * @property {string} status - Status
 * @property {Array<any>} items - Items array
 * @property {number} discrepancies - Number of discrepancies
 * @property {number} totalDiscrepancyValue - Total discrepancy value
 * @property {string} [type] - Type of count (full or partial)
 * @property {string} [countedBy] - User who performed the count
 * @property {string} [category] - Category for partial counts
 * @property {number} [totalItems] - Total number of items in the count
 */

/**
 * @typedef {Object} Product
 * @property {string} productId - Product ID
 * @property {string} productName - Product name
 * @property {string} [sku] - Product SKU
 * @property {number} quantity - Product quantity
 * @property {number} unitCost - Unit cost
 * @property {string} category - Product category
 * @property {string} [location] - Product location
 */
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputAdornment,
  InputLabel,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Alert
} from '@mui/material';
import {
  Add as AddIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  ArrowForward as ArrowForwardIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import { InventoryContext } from '../../../contexts/InventoryContext';

/**
 * Stock Count Page Component
 * @returns {JSX.Element} The stock count page component
 */
const StockCountPage = () => {
  // const navigate = useNavigate(); // Unused variable
  const { enqueueSnackbar } = useSnackbar();
  /** @type {{products: Product[], loading: boolean}} */
  const { products, loading: inventoryLoading } = useContext(InventoryContext);

  // State for stock counts and history
  const [stockCounts, setStockCounts] = useState(/** @type {StockCount[]} */ ([]));
  const [stockCountHistory, setStockCountHistory] = useState(/** @type {HistoryItem[]} */ ([]));
  const [currentCount, setCurrentCount] = useState(/** @type {StockCount|null} */ (null));
  
  // UI state
  const [loading, setLoading] = useState(false);
  // Keep error state for future error handling UI improvements
  // Used for future error handling UI improvements
  // eslint-disable-next-line no-unused-vars
  const [error, setError] = useState(/** @type {Error|null} */ (null));
  
  // Dialog states
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [newCountDialogOpen, setNewCountDialogOpen] = useState(false);
  const [confirmCompleteDialogOpen, setConfirmCompleteDialogOpen] = useState(false);
  const [confirmCancelDialogOpen, setConfirmCancelDialogOpen] = useState(false);
  
  // Filter and search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(/** @type {string|null} */ (null));
  const [selectedLocation] = useState('');
  const [countType, setCountType] = useState('full');
  const [loadingHistory, setLoadingHistory] = useState(false);

  const STOCK_COUNT_STATUSES = {
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        if (!products.length) {
          // await loadInventory();
        }
        
        // Simulate API call to get stock counts
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Sample data
        const mockItems = products.map((/** @type {Product} */ item) => ({
          id: item.productId,
          name: item.productName,
          sku: item.sku,
          expectedQty: item.quantity,
          countedQty: 0,
          unitCost: item.unitCost,
          category: item.category,
          location: item.location
        }));
        
        const mockCounts = [
          { 
            id: 'count1', 
            name: 'Weekly Inventory Count', 
            date: new Date(), 
            status: STOCK_COUNT_STATUSES.IN_PROGRESS,
            items: mockItems.filter((/** @type {StockCountItem} */ item) => selectedLocation ? item.location === selectedLocation : true),
            lastSaved: null,
            discrepancies: 0,
            totalDiscrepancyValue: 0
          }
        ];
        
        setStockCounts(mockCounts);
        setCurrentCount(mockCounts[0]);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        // Store error for potential display in UI
        setError(err instanceof Error ? err : new Error(String(err)));
        enqueueSnackbar(`Error loading stock count data: ${errorMessage}`, { variant: 'error' });
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [products, inventoryLoading, selectedLocation, enqueueSnackbar]);

  /**
   * Handles search input changes
   * @param {import('react').ChangeEvent<HTMLInputElement|HTMLTextAreaElement>} e - The change event
   */
  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  /**
   * Updates the counted quantity for a product
   * @param {string} itemId - Item ID to update
   * @param {string|number} value - New counted quantity value
   */
  const handleUpdateCountedQty = (itemId, value) => {
    if (currentCount) {
      setCurrentCount(prev => {
        if (!prev) return null;
        return {
          ...prev,
          items: prev.items.map(item => {
            if (item.id === itemId) {
              // Convert string value to number to ensure type compatibility
              const numValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
              return { ...item, countedQty: numValue };
            }
            return item;
          })
        };
      });
    }
  };

  const handleOpenHistoryDialog = () => {
    setHistoryDialogOpen(true);
    // Load history when dialog opens
    loadStockCountHistory();
  };

  const handleCloseHistoryDialog = () => {
    setHistoryDialogOpen(false);
  };

  const handleOpenNewCountDialog = () => {
    setNewCountDialogOpen(true);
  };

  const handleCloseNewCountDialog = () => {
    setNewCountDialogOpen(false);
    setCountType('full');
    setSelectedCategory(null);
  };

    /**
   * Calculates the discrepancy between expected and counted quantities
   * @param {number|string} expected - Expected quantity
   * @param {number|string} counted - Counted quantity
   * @returns {number} - Discrepancy value
   */
  const calculateDiscrepancy = (expected, counted) => {
    return parseInt(String(counted || 0)) - parseInt(String(expected || 0));
  };

  /**
   * Calculates the discrepancy value
   * @param {number|string} expected - Expected quantity
   * @param {number|string} counted - Counted quantity
   * @param {number|string} unitCost - Unit cost
   * @returns {number} - Discrepancy value
   */
  const calculateDiscrepancyValue = (expected, counted, unitCost) => {
    const discrepancy = calculateDiscrepancy(expected, counted);
    return discrepancy * parseFloat(String(unitCost || 0));
  };

  /**
   * Formats a number as currency
   * @param {number} value - Value to format
   * @returns {string} - Formatted currency string
   */
  const formatCurrency = (value) => {
    return Math.abs(value).toFixed(2) + (value < 0 ? ' (-)' : value > 0 ? ' (+)' : '');
  };

  /**
   * Returns a chip component for the given status
   * @param {string} status - Status value
   * @returns {JSX.Element} - Status chip component
   */
  const getStatusChip = (status) => {
    /** @type {"default"|"success"|"error"|"warning"} */
    let color = 'default';
    let label = 'Unknown';

    if (status === STOCK_COUNT_STATUSES.COMPLETED) {
      color = 'success';
      label = 'Completed';
    } else if (status === STOCK_COUNT_STATUSES.CANCELLED) {
      color = 'error';
      label = 'Cancelled';
    } else if (status === STOCK_COUNT_STATUSES.IN_PROGRESS) {
      color = 'warning';
      label = 'In Progress';
    }

    return <Chip size="small" label={label} color={color} />;
  };

  /**
   * Returns the color for a discrepancy value
   * @param {number} discrepancy - Discrepancy value
   * @returns {"success"|"warning"|"error"} - MUI color
   */
  const getDiscrepancyColor = (discrepancy) => {
    if (discrepancy === 0) return 'success';
    if (discrepancy > 0) return 'warning';
    return 'error';
  };

  const handleSaveCount = async () => {
    if (!currentCount) return;

    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Update stock counts with the saved count
      setStockCounts(prev => prev.map(count => {
        if (count.id === currentCount.id) {
          return { ...currentCount };
        }
        return count;
      }));

      enqueueSnackbar('Stock count saved successfully', { variant: 'success' });
    } catch (err) {
      // @ts-ignore - Error state can handle any error type
      setError(err);
      enqueueSnackbar('Failed to save stock count', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Completes the current stock count
   */
  const handleCompleteCount = async () => {
    if (!currentCount) return;

    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Create history item from current count
      /** @type {HistoryItem} */
      const historyItem = {
        id: currentCount.id,
        name: currentCount.name,
        date: new Date(),
        status: STOCK_COUNT_STATUSES.COMPLETED,
        type: currentCount.type,
        category: currentCount.category || 'All',
        countedBy: 'Current User', // This would come from auth context in a real app
        totalItems: currentCount.items.length,
        items: currentCount.items.length, // Set items to match the HistoryItem type
        discrepancies: currentCount.items.filter(item => calculateDiscrepancy(item.expectedQty, item.countedQty) !== 0).length,
        totalDiscrepancyValue: currentCount.items.reduce((total, item) => {
          return total + calculateDiscrepancyValue(item.expectedQty, item.countedQty, item.unitCost);
        }, 0)
      };

      // Update stock count history
      setStockCountHistory(prev => [historyItem, ...prev]);

      // Update stock counts (remove the completed one)
      setStockCounts(/** @type {function(StockCount[]): StockCount[]} */ (prev => prev.filter(count => count.id !== currentCount.id)));

      // Clear current count
      setCurrentCount(null);

      // Close dialog
      setConfirmCompleteDialogOpen(false);

      enqueueSnackbar('Stock count completed', { variant: 'success' });
    } catch (err) {
      // @ts-ignore - Error state can handle any error type
      setError(err);
      enqueueSnackbar('Failed to complete stock count', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Cancels the current stock count
   */
  const handleCancelCount = async () => {
    if (!currentCount) return;

    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Create history item from current count
      /** @type {HistoryItem} */
      const historyItem = {
        id: currentCount.id,
        name: currentCount.name,
        date: new Date(),
        status: STOCK_COUNT_STATUSES.CANCELLED,
        type: currentCount.type,
        category: currentCount.category || 'All',
        countedBy: 'Current User', // This would come from auth context in a real app
        totalItems: currentCount.items.length,
        items: currentCount.items.length, // Set items to match the HistoryItem type
        discrepancies: 0,
        totalDiscrepancyValue: 0
      };

      // Update stock count history
      setStockCountHistory(prev => [historyItem, ...prev]);
      
      // Update stock counts (remove the cancelled one)
      setStockCounts(/** @type {function(StockCount[]): StockCount[]} */ (prev => prev.filter(count => count.id !== currentCount.id)));

      // Clear current count
      setCurrentCount(null);

      // Close dialog
      setConfirmCancelDialogOpen(false);

      enqueueSnackbar('Stock count cancelled', { variant: 'info' });
    } catch (err) {
      // @ts-ignore - Error state can handle any error type
      setError(err);
      enqueueSnackbar('Failed to cancel stock count', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Starts a new stock count
   */
  const handleStartNewCount = async () => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Generate a new count based on selected options
      const newCount = {
        id: `SC-${Date.now().toString().slice(-6)}`,
        name: `${countType === 'full' ? 'Full' : 'Partial'} Stock Count ${new Date().toLocaleDateString()}`,
        date: new Date(),
        status: STOCK_COUNT_STATUSES.IN_PROGRESS,
        type: countType,
        category: selectedCategory || undefined, // Convert null to undefined for type compatibility
        items: products
          .filter(product => {
            // Filter by category if it's a partial count
            if (countType === 'partial' && selectedCategory) {
              return product.category === selectedCategory;
            }
            return true;
          })
          .map(product => ({
            id: product.productId,
            name: product.productName,
            sku: product.sku,
            expectedQty: product.quantity,
            countedQty: 0,
            unitCost: product.unitCost,
            category: product.category,
            location: product.location
          })),
        lastSaved: null,
        discrepancies: 0,
        totalDiscrepancyValue: 0
      };

      // Add to stock counts
      setStockCounts(prev => [newCount, ...prev]);

      // Set as current count
      setCurrentCount(newCount);

      // Close dialog
      setNewCountDialogOpen(false);

      enqueueSnackbar('New stock count started', { variant: 'success' });
    } catch (err) {
      // @ts-ignore - Error state can handle any error type
      setError(err);
      enqueueSnackbar('Failed to start new count', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Loads stock count history
   */
  const loadStockCountHistory = async () => {
    try {
      setLoadingHistory(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Sample data - create directly as HistoryItem objects
      /** @type {HistoryItem[]} */
      const mockHistory = [
        { id: 'hist1', name: 'Weekly Count', date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), status: STOCK_COUNT_STATUSES.COMPLETED, type: 'full', category: 'All', countedBy: 'User 1', totalItems: 120, items: 120, discrepancies: 5, totalDiscrepancyValue: -250 },
        { id: 'hist2', name: 'Monthly Count', date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), status: STOCK_COUNT_STATUSES.COMPLETED, type: 'full', category: 'All', countedBy: 'User 2', totalItems: 150, items: 150, discrepancies: 12, totalDiscrepancyValue: 450 },
        { id: 'hist3', name: 'Partial Count', date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), status: STOCK_COUNT_STATUSES.CANCELLED, type: 'partial', category: 'Electronics', countedBy: 'User 1', totalItems: 45, items: 45, discrepancies: 0, totalDiscrepancyValue: 0 },
        { id: 'hist4', name: 'Quarterly Count', date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), status: STOCK_COUNT_STATUSES.COMPLETED, type: 'full', category: 'All', countedBy: 'User 3', totalItems: 200, items: 200, discrepancies: 18, totalDiscrepancyValue: -1200 }
      ];
      
      setStockCountHistory(mockHistory);
      
      enqueueSnackbar('Stock count history loaded', { variant: 'success' });
    } catch (err) {
      // @ts-ignore - Error state can handle any error type
      setError(err);
      enqueueSnackbar('Failed to load history', { variant: 'error' });
    } finally {
      setLoadingHistory(false);
    }
  };

  // Filter items based on search query and category
  /** @type {StockCountItem[]} */
  const filteredItems = currentCount?.items.filter(item => {
    if (!searchQuery || !searchQuery.trim()) return true;
    return item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.sku?.toLowerCase().includes(searchQuery.toLowerCase()) || false);
  }).filter(item => {
    if (!selectedCategory) return true;
    return item.category === selectedCategory;
  }) || [];

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={8}>
        {currentCount ? (
          <>
            {/* Active Count */}
            <Card sx={{ mb: 3 }}>
                <CardHeader
                  title={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Typography variant="h6" sx={{ mr: 2 }}>
                        {currentCount.id} - {currentCount.name}
                      </Typography>
                    </Box>
                  }
                />
                <CardContent>
                  <Box sx={{ mb: 2 }}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Search Products"
                      variant="outlined"
                      value={searchQuery}
                      onChange={handleSearch}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon />
                          </InputAdornment>
                        ),
                      }}
                      disabled={loading}
                    />
                  </Box>

                  {currentCount.items.length === 0 ? (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      No items found for this count. Please check your location and category selection.
                    </Alert>
                  ) : (
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Product</TableCell>
                            <TableCell>Category</TableCell>
                            <TableCell align="right">Expected</TableCell>
                            <TableCell align="right">Counted</TableCell>
                            <TableCell align="right">Discrepancy</TableCell>
                            <TableCell align="right">Value ($)</TableCell>
                            <TableCell>Action</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {filteredItems.map((/** @type {StockCountItem} */ item) => {
                            const discrepancy = calculateDiscrepancy(item.expectedQty, item.countedQty);
                            const discrepancyValue = calculateDiscrepancyValue(item.expectedQty, item.countedQty, item.unitCost);

                            return (
                              <TableRow key={item.id}>
                                <TableCell>{item.name}</TableCell>
                                <TableCell>{item.category}</TableCell>
                                <TableCell align="right">{item.expectedQty}</TableCell>
                                <TableCell align="right">
                                  <TextField
                                    type="number"
                                    size="small"
                                    value={item.countedQty}
                                    onChange={(e) => handleUpdateCountedQty(item.id, e.target.value)}
                                    InputProps={{ inputProps: { min: 0 } }}
                                    sx={{ width: 80 }}
                                    disabled={loading}
                                  />
                                </TableCell>
                                <TableCell align="right">
                                  <Chip size="small" label={discrepancy.toString()} color={getDiscrepancyColor(discrepancy)} />
                                </TableCell>
                                <TableCell align="right">
                                  ${formatCurrency(discrepancyValue)}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    size="small"
                                    onClick={() => handleUpdateCountedQty(item.id, item.expectedQty)}
                                    disabled={loading}
                                  >
                                    Match
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}

                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2, gap: 1 }}>
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={() => setConfirmCancelDialogOpen(true)}
                      disabled={loading}
                    >
                      Cancel Count
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={handleSaveCount}
                      disabled={loading}
                      startIcon={loading ? <CircularProgress size={20} /> : null}
                    >
                      Save
                    </Button>
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={() => setConfirmCompleteDialogOpen(true)}
                      disabled={loading}
                    >
                      Complete Count
                    </Button>
                  </Box>
                </CardContent>
              </Card>

            {/* Previous counts */}
            <Paper sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    Previous Stock Counts
                  </Typography>
                  <Button
                    size="small"
                    endIcon={<ArrowForwardIcon />}
                    onClick={handleOpenHistoryDialog}
                    disabled={loading}
                  >
                    View All
                  </Button>
                </Box>

                {stockCounts.filter(count => count.status !== 'in_progress').length === 0 ? (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    No previous stock counts found.
                  </Alert>
                ) : (
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>ID</TableCell>
                          <TableCell>Date</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell align="right">Items</TableCell>
                          <TableCell align="right">Discrepancies</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {stockCounts
                          .filter(count => count.status !== 'in_progress')
                          .slice(0, 5)
                          .map((count) => (
                            <TableRow key={count.id}>
                              <TableCell>{count.id}</TableCell>
                              <TableCell>{count.date.toLocaleDateString()}</TableCell>
                              <TableCell>{count.type === 'full' ? 'Full' : 'Partial'}</TableCell>
                              <TableCell>
                                {getStatusChip(count.status)}
                              </TableCell>
                              <TableCell align="right">{count.items.length}</TableCell>
                              <TableCell align="right">{count.discrepancies}</TableCell>
                            </TableRow>
                          ))
                        }
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Paper>
            </>
          ) : (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary" sx={{ py: 4 }}>
                No active stock count. Start a new count to begin.
              </Typography>
              <Button
                variant="contained"
                color="primary"
                onClick={handleOpenNewCountDialog}
                startIcon={<AddIcon />}
              >
                Start New Count
              </Button>
            </Paper>
          )}
        </Grid>
      <Grid item xs={12} md={4}>
        {/* Quick tips */}
        <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Quick Tips
            </Typography>

            <List dense>
              <ListItem>
                <ListItemIcon>
                  <CheckCircleOutlineIcon color="primary" />
                </ListItemIcon>
                <ListItemText primary="Use 'Match' to quickly set counted quantity to expected" />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <CheckCircleOutlineIcon color="primary" />
                </ListItemIcon>
                <ListItemText primary="Save your count regularly to avoid losing data" />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <CheckCircleOutlineIcon color="primary" />
                </ListItemIcon>
                <ListItemText primary="Complete the count when all items have been verified" />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <CheckCircleOutlineIcon color="primary" />
                </ListItemIcon>
                <ListItemText primary="Use search to quickly find specific products" />
              </ListItem>
            </List>
          </Paper>
      </Grid>
    </Grid>

    {/* New Count Dialog */}
    <Dialog
      open={newCountDialogOpen}
      onClose={handleCloseNewCountDialog}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>Start New Stock Count</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel id="count-type-label">Count Type</InputLabel>
                <Select
                  labelId="count-type-label"
                  value={countType}
                  label="Count Type"
                  onChange={(e) => setCountType(e.target.value)}
                >
                  <MenuItem value="full">Full Inventory Count</MenuItem>
                  <MenuItem value="partial">Partial Count (By Category)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {countType === 'partial' && (
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel id="category-label">Category</InputLabel>
                  <Select
                    labelId="category-label"
                    value={selectedCategory}
                    label="Category"
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    <MenuItem value="category-1">Category 1</MenuItem>
                    <MenuItem value="category-2">Category 2</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseNewCountDialog}>
            Cancel
          </Button>
          <Button
            onClick={handleStartNewCount}
            color="primary"
            variant="contained"
            disabled={countType === 'partial' && !selectedCategory || loading}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            Start Count
          </Button>
        </DialogActions>
      </Dialog>
      
    {/* History Dialog */}
    <Dialog
      open={historyDialogOpen}
      onClose={handleCloseHistoryDialog}
      aria-labelledby="history-dialog-title"
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle id="history-dialog-title">
        Stock Count History
      </DialogTitle>
      <DialogContent>
        {loadingHistory ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : stockCountHistory.length === 0 ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              No stock count history found
            </Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Counted By</TableCell>
                    <TableCell align="right">Items</TableCell>
                    <TableCell align="right">Discrepancies</TableCell>
                    <TableCell align="right">Value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stockCountHistory.map((count) => (
                    <TableRow key={count.id}>
                      <TableCell>{count.id}</TableCell>
                      <TableCell>{count.date.toLocaleDateString()}</TableCell>
                      <TableCell>
                        {count.type === 'full' ? 'Full' : `Partial (${count.category})`}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={
                            count.status === STOCK_COUNT_STATUSES.COMPLETED ? 'Completed' : 
                            count.status === STOCK_COUNT_STATUSES.CANCELLED ? 'Cancelled' : 'In Progress'
                          }
                          color={
                            count.status === STOCK_COUNT_STATUSES.COMPLETED ? 'success' : 
                            count.status === STOCK_COUNT_STATUSES.CANCELLED ? 'error' : 'warning'
                          }
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{count.countedBy}</TableCell>
                      <TableCell align="right">{count.totalItems}</TableCell>
                      <TableCell align="right">{count.discrepancies}</TableCell>
                      <TableCell align="right">
                        ${Math.abs(count.totalDiscrepancyValue).toFixed(2)}
                        {count.totalDiscrepancyValue < 0 ? ' (-)' : count.totalDiscrepancyValue > 0 ? ' (+)' : ''}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseHistoryDialog}>
            Close
          </Button>
        </DialogActions>
    </Dialog>

    {/* Confirm Complete Dialog */}
    <Dialog
      open={confirmCompleteDialogOpen}
      onClose={() => setConfirmCompleteDialogOpen(false)}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Complete Stock Count</DialogTitle>
      <DialogContent>
        <Typography>
          Are you sure you want to complete this stock count? This action cannot be undone.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Completing the count will finalize all discrepancies and move it to history.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setConfirmCompleteDialogOpen(false)}>Cancel</Button>
        <Button 
          variant="contained" 
          color="primary"
          onClick={handleCompleteCount}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          Complete Count
        </Button>
      </DialogActions>
    </Dialog>

    {/* Confirm Cancel Dialog */}
    <Dialog
      open={confirmCancelDialogOpen}
      onClose={() => setConfirmCancelDialogOpen(false)}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Cancel Stock Count</DialogTitle>
      <DialogContent>
        <Typography>
          Are you sure you want to cancel this stock count? All progress will be lost.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          This action cannot be undone.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setConfirmCancelDialogOpen(false)}>No, Keep Count</Button>
        <Button 
          variant="contained" 
          color="error"
          onClick={handleCancelCount}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          Cancel Count
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StockCountPage;
