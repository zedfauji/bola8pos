import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Divider,
  Grid,
  TextField,
  Typography,
  IconButton,
  Badge,
  Tabs,
  Tab,
  Paper,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableFooter,
  TablePagination,
  Tooltip,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  Delete as DeleteIcon,
  Receipt as ReceiptIcon,
  Search as SearchIcon,
  Close as CloseIcon,
  Print as PrintIcon,
  Payment as PaymentIcon,
  Discount as DiscountIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useInventoryContext } from '../../../contexts/InventoryContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { styled } from '@mui/material/styles';
import LowStockBadge from '../../../components/inventory/LowStockBadge';

const BarSalesPage = () => {
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('products');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [cart, setCart] = useState([]);
  const [customerNote, setCustomerNote] = useState('');
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState('percentage'); // 'percentage' or 'amount'
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [tenderedAmount, setTenderedAmount] = useState('');
  const [selectedTable, setSelectedTable] = useState(null);
  const [tables, setTables] = useState([
    { id: 1, name: 'Bar 1', status: 'available' },
    { id: 2, name: 'Bar 2', status: 'occupied' },
    { id: 3, name: 'Table 1', status: 'available' },
    { id: 4, name: 'Table 2', status: 'available' },
  ]);

  const {
    products,
    loading,
    error: inventoryError,
    loadProducts,
    inventory,
    loadInventory,
    locations,
    loadLocations,
  } = useInventoryContext();

  // Load initial data
  useEffect(() => {
    const initializeData = async () => {
      try {
        setIsLoading(true);
        setError('');
        
        await Promise.all([
          loadProducts({ status: 'active' }),
          loadLocations(),
        ]);
        
        // Load inventory for bar locations
        const barLocation = locations.find(loc => loc.type === 'bar');
        if (barLocation) {
          await loadInventory(barLocation.id);
        }
        
        // Simulate loading for better UX
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        const errorMessage = error.response?.data?.message || 'Failed to load data. Please try again.';
        setError(errorMessage);
        enqueueSnackbar(errorMessage, { variant: 'error' });
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeData();
  }, []);

  // Filter and sort products based on search term, stock, and category
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    
    return products
      .filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (product.sku && product.sku.toLowerCase().includes(searchTerm.toLowerCase()));
        
        // Only show products that are in stock at bar location
        const barStock = inventory.find(item => 
          item.product_id === product.id && item.location_type === 'bar'
        );
        
        return matchesSearch && barStock && barStock.quantity_available > 0;
      })
      .sort((a, b) => {
        // Sort by category and then by name
        if (a.category_id !== b.category_id) {
          return (a.category_name || '').localeCompare(b.category_name || '');
        }
        return a.name.localeCompare(b.name);
      });
  }, [products, searchTerm, inventory]);
  
  // Group products by category
  const productsByCategory = useMemo(() => {
    return filteredProducts.reduce((acc, product) => {
      const category = product.category_name || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(product);
      return acc;
    }, {});
  }, [filteredProducts]);

  // Calculate cart totals
  const cartTotal = useMemo(() => {
    return cart.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    if (discountType === 'percentage') {
      return (cartTotal * discount) / 100;
    }
    return Math.min(discount, cartTotal); // Ensure discount doesn't exceed total
  }, [discount, discountType, cartTotal]);

  const grandTotal = cartTotal - discountAmount;
  const changeDue = Math.max(0, (parseFloat(tenderedAmount) || 0) - grandTotal);

  // Handle adding item to cart with animation feedback
  const handleAddToCart = (product) => {
    // Check stock before adding to cart
    const stockItem = inventory.find(
      item => item.product_id === product.id && item.location_type === 'bar'
    );
    
    if (stockItem && stockItem.quantity_available <= 0) {
      enqueueSnackbar(`${product.name} is out of stock`, { variant: 'warning' });
      return;
    }
    
    // Add to cart with animation
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id);
      
      if (existingItem) {
        // Check if adding more than available
        if (stockItem && existingItem.quantity >= stockItem.quantity_available) {
          enqueueSnackbar(`Only ${stockItem.quantity_available} ${product.name} available`, { 
            variant: 'warning' 
          });
          return prevCart;
        }
        
        return prevCart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      
      return [
        ...prevCart,
        {
          id: product.id,
          name: product.name,
          price: product.selling_price,
          quantity: 1,
          product
        }
      ];
    });
    
    // Visual feedback
    enqueueSnackbar(`${product.name} added to cart`, { 
      variant: 'success',
      autoHideDuration: 1000
    });
  };

  // Handle quantity change
  const handleQuantityChange = (productId, newQuantity) => {
    if (newQuantity < 1) {
      handleRemoveFromCart(productId);
      return;
    }
    
    setCart(prevCart =>
      prevCart.map(item =>
        item.id === productId
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
  };

  // Handle removing item from cart
  const handleRemoveFromCart = (productId) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId));
  };

  // Handle payment
  const handleProcessPayment = () => {
    if (cart.length === 0) {
      enqueueSnackbar('Cart is empty', { variant: 'warning' });
      return;
    }
    
    if (!selectedTable) {
      enqueueSnackbar('Please select a table', { variant: 'warning' });
      return;
    }
    
    setPaymentDialogOpen(true);
  };

  // Handle payment confirmation
  const handleConfirmPayment = async () => {
    if (!tenderedAmount || parseFloat(tenderedAmount) < grandTotal) {
      enqueueSnackbar('Please enter a valid amount', { variant: 'error' });
      return;
    }

    try {
      setIsProcessing(true);
      
      // 1. Create order record
      const orderData = {
        tableId: selectedTable?.id,
        tableName: selectedTable?.name,
        items: cart.map(item => ({
          productId: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity,
        })),
        subtotal: cartTotal,
        discount: {
          type: discountType,
          value: discount,
          amount: discountAmount,
        },
        tax: cartTotal * 0.1, // Example 10% tax
        total: grandTotal,
        paymentMethod,
        tenderedAmount: parseFloat(tenderedAmount),
        change: changeDue,
        customerNote,
        status: 'completed',
      };

      // In a real app, this would be an API call
      console.log('Processing order:', orderData);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      // 2. Update inventory
      const updates = cart.map(item => ({
        productId: item.id,
        quantity: -item.quantity, // Negative for reduction
        locationType: 'bar',
        type: 'sale',
        reference: `Order #${Date.now()}`,
      }));
      
      // In a real app, this would be an API call
      console.log('Updating inventory:', updates);
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call

      setSuccessMessage(`Order #${Date.now().toString().slice(-6)} completed successfully!`);
      enqueueSnackbar('Payment processed successfully', { 
        variant: 'success',
        autoHideDuration: 3000,
      });
      
      // Reset cart and close dialog
      setCart([]);
      setCustomerNote('');
      setDiscount(0);
      setPaymentDialogOpen(false);
      setTenderedAmount('');
      
      // Print receipt
      handlePrintReceipt();
      
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to process payment';
      setError(errorMessage);
      enqueueSnackbar(errorMessage, { 
        variant: 'error',
        autoHideDuration: 3000,
      });
      console.error('Payment error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle printing receipt
  const handlePrintReceipt = () => {
    // TODO: Implement receipt printing
    // This would open a print dialog with a formatted receipt
    window.print();
  };

  // Handle table selection
  const handleSelectTable = (table) => {
    if (table.status === 'available') {
      setSelectedTable(table);
      // In a real app, you would mark the table as occupied here
      setTables(prevTables =>
        prevTables.map(t =>
          t.id === table.id ? { ...t, status: 'occupied' } : t
        )
      );
    } else if (table.id === selectedTable?.id) {
      // Deselect if clicking the same table
      setSelectedTable(null);
    } else {
      enqueueSnackbar('Table is already occupied', { variant: 'warning' });
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '60vh' 
      }}>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress size={60} thickness={4} />
          <Typography variant="h6" sx={{ mt: 2 }}>Loading Bar Sales...</Typography>
        </Box>
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert 
          severity="error" 
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">Bar Sales</Typography>
        <LowStockBadge clickable to="/inventory?low=1" pollMs={15000} notifyOnIncrease />
      </Box>
      <Grid container spacing={3}>
        {/* Left Side - Products and Tables */}
        <Grid item xs={12} md={7}>
          <Card sx={{ mb: 3 }}>
            <Tabs
              value={activeTab}
              onChange={(e, newValue) => setActiveTab(newValue)}
              variant="fullWidth"
              indicatorColor="primary"
              textColor="primary"
            >
              <Tab value="products" label="Products" />
              <Tab value="tables" label="Tables" />
            </Tabs>
            
            <Divider />
            
            <CardContent>
              {activeTab === 'products' ? (
                <>
                  <TextField
                    fullWidth
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      ),
                    }}
                    sx={{ mb: 2 }}
                  />
                  
                  <Box sx={{ maxHeight: '60vh', overflowY: 'auto', p: 1 }}>
                    {Object.entries(productsByCategory).map(([category, categoryProducts]) => (
                      <Box key={category} sx={{ mb: 3 }}>
                        <Typography 
                          variant="subtitle2" 
                          sx={{ 
                            color: 'text.secondary', 
                            mb: 1, 
                            pl: 1,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            fontSize: '0.75rem',
                            fontWeight: 600
                          }}
                        >
                          {category}
                        </Typography>
                        <Grid container spacing={1}>
                          {categoryProducts.map((product) => {
                            const stockItem = inventory.find(
                              item => item.product_id === product.id && item.location_type === 'bar'
                            );
                            const inStock = stockItem ? stockItem.quantity_available : 0;
                            const isLowStock = inStock > 0 && inStock <= 3;
                            const isOutOfStock = inStock <= 0;
                            
                            return (
                              <Grid item xs={6} sm={4} md={3} key={product.id}>
                                <motion.div
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                >
                                  <Paper
                                    elevation={isOutOfStock ? 0 : 1}
                                    sx={{
                                      p: 1.5,
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                                      opacity: isOutOfStock ? 0.6 : 1,
                                      border: isOutOfStock ? '1px dashed' : 'none',
                                      borderColor: 'divider',
                                      height: '100%',
                                      transition: 'all 0.2s',
                                      '&:hover': {
                                        backgroundColor: isOutOfStock ? 'background.paper' : 'action.hover',
                                      },
                                    }}
                                    onClick={() => !isOutOfStock && handleAddToCart(product)}
                                  >
                                    <Box 
                                      sx={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: '50%',
                                        bgcolor: 'primary.light',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        mb: 1,
                                        color: 'primary.contrastText',
                                        fontSize: '1.25rem',
                                      }}
                                    >
                                      {product.emoji || '🍺'}
                                    </Box>
                                    <Typography 
                                      variant="subtitle2" 
                                      align="center" 
                                      noWrap 
                                      sx={{ 
                                        width: '100%',
                                        fontWeight: 500,
                                        color: isOutOfStock ? 'text.disabled' : 'text.primary'
                                      }}
                                    >
                                      {product.name}
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                      <Typography 
                                        variant="body2" 
                                        sx={{ 
                                          fontWeight: 600,
                                          color: isOutOfStock ? 'text.disabled' : 'primary.main'
                                        }}
                                      >
                                        ${product.selling_price.toFixed(2)}
                                      </Typography>
                                      {!isOutOfStock && (
                                        <Chip
                                          label={isLowStock ? `Only ${inStock} left` : 'In Stock'}
                                          size="small"
                                          color={isLowStock ? 'warning' : 'success'}
                                          variant="outlined"
                                          sx={{ 
                                            height: 20, 
                                            fontSize: '0.65rem',
                                            '& .MuiChip-label': { px: 0.75 }
                                          }}
                                        />
                                      )}
                                    </Box>
                                  </Paper>
                                </motion.div>
                              </Grid>
                            );
                          })}
                        </Grid>
                      </Box>
                    ))}
                    
                    {Object.keys(productsByCategory).length === 0 && (
                      <Box sx={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        py: 8,
                        textAlign: 'center'
                      }}>
                        <Box sx={{ fontSize: '3rem', mb: 2 }}>🔍</Box>
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                          No products found
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Try adjusting your search or check back later
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </>
              ) : (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Select Table
                  </Typography>
                  <Grid container spacing={2}>
                    {tables.map((table) => (
                      <Grid item xs={6} sm={4} md={3} key={table.id}>
                        <Paper
                          elevation={table.id === selectedTable?.id ? 3 : 1}
                          sx={{
                            p: 2,
                            textAlign: 'center',
                            cursor: 'pointer',
                            border: table.id === selectedTable?.id ? '2px solid' : 'none',
                            borderColor: 'primary.main',
                            backgroundColor: table.status === 'occupied' ? 'action.hover' : 'background.paper',
                            opacity: table.status === 'available' || table.id === selectedTable?.id ? 1 : 0.7,
                            '&:hover': {
                              backgroundColor: 'action.hover',
                            },
                          }}
                          onClick={() => handleSelectTable(table)}
                        >
                          <Typography variant="subtitle1">{table.name}</Typography>
                          <Chip
                            label={table.status === 'available' ? 'Available' : 'Occupied'}
                            size="small"
                            color={table.status === 'available' ? 'success' : 'default'}
                            sx={{ mt: 1 }}
                          />
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right Side - Cart */}
        <Grid item xs={12} md={5}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardHeader
              title={
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <span>Order</span>
                  {selectedTable && (
                    <Chip
                      label={`Table: ${selectedTable.name}`}
                      color="primary"
                      size="small"
                      onDelete={() => setSelectedTable(null)}
                    />
                  )}
                </Box>
              }
              action={
                <Badge badgeContent={cart.length} color="primary">
                  <ReceiptIcon />
                </Badge>
              }
            />
            <Divider />
            
            <CardContent sx={{ flexGrow: 1, overflowY: 'auto', p: 0 }}>
              <AnimatePresence>
                {cart.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    style={{ width: '100%' }}
                  >
                    <Box
                      display="flex"
                      flexDirection="column"
                      alignItems="center"
                      justifyContent="center"
                      minHeight="200px"
                      p={3}
                    >
                      <ReceiptIcon color="disabled" sx={{ fontSize: 48, mb: 2, opacity: 0.7 }} />
                      <Typography color="textSecondary" align="center" variant="subtitle2">
                        Your cart is empty
                      </Typography>
                      <Typography variant="body2" color="text.secondary" align="center">
                        Add items from the products tab
                      </Typography>
                    </Box>
                  </motion.div>
                ) : (
                  <List disablePadding>
                    <AnimatePresence>
                      {cart.map((item, index) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -100 }}
                          transition={{ duration: 0.2 }}
                          style={{ width: '100%' }}
                        >
                          <ListItem
                            divider
                            sx={{
                              '&:hover': {
                                backgroundColor: 'action.hover',
                              },
                              transition: 'background-color 0.2s',
                            }}
                            secondaryAction={
                              <Box display="flex" alignItems="center">
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleQuantityChange(item.id, item.quantity - 1);
                                  }}
                                  sx={{
                                    '&:hover': { backgroundColor: 'primary.light', color: 'primary.contrastText' },
                                    transition: 'all 0.2s',
                                  }}
                                >
                                  <RemoveIcon fontSize="small" />
                                </IconButton>
                                <Box 
                                  sx={{ 
                                    minWidth: 24, 
                                    textAlign: 'center',
                                    fontWeight: 600,
                                    fontSize: '0.85rem'
                                  }}
                                >
                                  {item.quantity}
                                </Box>
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleQuantityChange(item.id, item.quantity + 1);
                                  }}
                                  sx={{
                                    '&:hover': { backgroundColor: 'primary.light', color: 'primary.contrastText' },
                                    transition: 'all 0.2s',
                                  }}
                                >
                                  <AddIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveFromCart(item.id);
                                  }}
                                  sx={{
                                    ml: 0.5,
                                    '&:hover': { backgroundColor: 'error.light', color: 'error.contrastText' },
                                    transition: 'all 0.2s',
                                  }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            }
                          >
                            <ListItemText
                              primary={
                                <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>
                                  {item.name}
                                </Typography>
                              }
                              secondary={
                                <Box component="span" sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                                  <Typography 
                                    variant="body2" 
                                    color="text.secondary" 
                                    sx={{ 
                                      fontSize: '0.8rem',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 0.5
                                    }}
                                  >
                                    ${item.price.toFixed(2)} × {item.quantity}
                                  </Typography>
                                </Box>
                              }
                              sx={{ pr: 8 }}
                            />
                            <Typography 
                              variant="subtitle1" 
                              sx={{ 
                                fontWeight: 600,
                                minWidth: 70,
                                textAlign: 'right'
                              }}
                            >
                              ${(item.price * item.quantity).toFixed(2)}
                            </Typography>
                          </ListItem>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </List>
                )}
              </AnimatePresence>
            </CardContent>
            
            <Divider />
            
            <Box sx={{ p: 2 }}>
              <TextField
                fullWidth
                label="Customer Note"
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                multiline
                rows={2}
                margin="normal"
              />
              
              <Box sx={{ mt: 2 }}>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography>Subtotal:</Typography>
                  <Typography>${cartTotal.toFixed(2)}</Typography>
                </Box>
                
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Box display="flex" alignItems="center">
                    <Typography>Discount:</Typography>
                    <Tooltip title={discountType === 'percentage' ? 'Percentage' : 'Fixed Amount'}>
                      <IconButton
                        size="small"
                        onClick={() => setDiscountType(prev => prev === 'percentage' ? 'amount' : 'percentage')}
                        sx={{ ml: 0.5 }}
                      >
                        <DiscountIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Box display="flex" alignItems="center">
                    <TextField
                      size="small"
                      type="number"
                      value={discount}
                      onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                      inputProps={{
                        min: 0,
                        max: discountType === 'percentage' ? 100 : undefined,
                        step: discountType === 'percentage' ? 1 : 0.01,
                        style: { width: '60px', textAlign: 'right' },
                      }}
                      sx={{ mr: 1 }}
                    />
                    <Typography>{discountType === 'percentage' ? '%' : '$'}</Typography>
                  </Box>
                </Box>
                
                <Divider sx={{ my: 1 }} />
                
                <Box display="flex" justifyContent="space-between" mb={2}>
                  <Typography variant="subtitle1">Total:</Typography>
                  <Typography variant="h6">${grandTotal.toFixed(2)}</Typography>
                </Box>
                
                <Button
                  type="submit"
                  color="primary"
                  variant="contained"
                  disabled={isProcessing || !tenderedAmount || changeDue < 0}
                  startIcon={isProcessing ? <CircularProgress size={20} color="inherit" /> : <PaymentIcon />}
                >
                  {isProcessing ? 'Processing...' : 'Complete Payment'}
                </Button>
              </Box>
            </Box>
          </Card>
        </Grid>
      </Grid>

      {/* Success Message */}
      {successMessage && (
        <Snackbar
          open={!!successMessage}
          autoHideDuration={6000}
          onClose={() => setSuccessMessage('')}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert 
            onClose={() => setSuccessMessage('')} 
            severity="success" 
            sx={{ width: '100%' }}
          >
            {successMessage}
          </Alert>
        </Snackbar>
      )}
      
      {/* Payment Dialog */}
      <Dialog
        open={paymentDialogOpen}
        onClose={() => setPaymentDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Process Payment</DialogTitle>
        <DialogContent>
          <Box mb={3}>
            <Typography variant="subtitle1" gutterBottom>
              Order Summary
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Item</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Price</TableCell>
                    <TableCell align="right">Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cart.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell align="right">{item.quantity}</TableCell>
                      <TableCell align="right">${item.price.toFixed(2)}</TableCell>
                      <TableCell align="right">${(item.price * item.quantity).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3} align="right">Subtotal:</TableCell>
                    <TableCell align="right">${cartTotal.toFixed(2)}</TableCell>
                  </TableRow>
                  {discount > 0 && (
                    <TableRow>
                      <TableCell colSpan={3} align="right">
                        Discount ({discountType === 'percentage' ? `${discount}%` : `$${discount.toFixed(2)}`}):
                      </TableCell>
                      <TableCell align="right">-${discountAmount.toFixed(2)}</TableCell>
                    </TableRow>
                  )}
                  <TableRow>
                    <TableCell colSpan={3} align="right">
                      <strong>Total:</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>${grandTotal.toFixed(2)}</strong>
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </TableContainer>
          </Box>
          
          <Box mb={3}>
            <Typography variant="subtitle1" gutterBottom>
              Payment Method
            </Typography>
            <Grid container spacing={2}>
              {['cash', 'credit_card', 'debit_card', 'mobile_payment'].map((method) => (
                <Grid item xs={6} sm={3} key={method}>
                  <Paper
                    elevation={paymentMethod === method ? 3 : 1}
                    sx={{
                      p: 2,
                      textAlign: 'center',
                      cursor: 'pointer',
                      border: paymentMethod === method ? '2px solid' : 'none',
                      borderColor: 'primary.main',
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      },
                    }}
                    onClick={() => setPaymentMethod(method)}
                  >
                    <Typography variant="body2">
                      {method.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Box>
          
          <Box>
            <TextField
              fullWidth
              label="Amount Tendered"
              type="number"
              value={tenderedAmount}
              onChange={(e) => setTenderedAmount(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
              }}
              margin="normal"
            />
            
            {tenderedAmount > 0 && (
              <Box mt={2} p={2} bgcolor="action.hover" borderRadius={1}>
                <Typography variant="subtitle2">Change Due:</Typography>
                <Typography variant="h5" color={changeDue >= 0 ? 'success.main' : 'error.main'}>
                  ${Math.abs(changeDue).toFixed(2)} {changeDue < 0 && '(Insufficient)'}
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleConfirmPayment}
            disabled={!tenderedAmount || changeDue < 0}
            startIcon={<PaymentIcon />}
          >
            Complete Payment
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BarSalesPage;
