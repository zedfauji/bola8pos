import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
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
  IconButton,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormHelperText,
  InputAdornment,
  Alert,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useInventoryContext } from '../../../contexts/InventoryContext';

const PurchaseOrderForm = ({ preSelectedSupplierId, onCancel, onSuccess }) => {
  const { suppliers, products } = useInventoryContext();
  
  // Form state
  const [formData, setFormData] = useState({
    supplierId: preSelectedSupplierId || '',
    orderDate: new Date(),
    expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    notes: '',
    items: [],
  });
  
  // Validation state
  const [errors, setErrors] = useState({});
  
  // Product selection dialog
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productQuantity, setProductQuantity] = useState(1);
  const [productPrice, setProductPrice] = useState(0);
  const [editingItemIndex, setEditingItemIndex] = useState(-1);
  
  // Loading state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  
  // Calculate total amount
  const totalAmount = formData.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );
  
  // Handle form field changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    
    // Clear error for this field if any
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: null,
      }));
    }
  };
  
  // Handle date changes
  const handleDateChange = (name, date) => {
    setFormData((prev) => ({
      ...prev,
      [name]: date,
    }));
    
    // Clear error for this field if any
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: null,
      }));
    }
  };
  
  // Open product dialog
  const handleAddItem = () => {
    setSelectedProduct(null);
    setProductQuantity(1);
    setProductPrice(0);
    setEditingItemIndex(-1);
    setProductDialogOpen(true);
  };
  
  // Edit existing item
  const handleEditItem = (index) => {
    const item = formData.items[index];
    setSelectedProduct(item.productId);
    setProductQuantity(item.quantity);
    setProductPrice(item.unitPrice);
    setEditingItemIndex(index);
    setProductDialogOpen(true);
  };
  
  // Remove item
  const handleRemoveItem = (index) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };
  
  // Handle product selection
  const handleProductChange = (e) => {
    const productId = e.target.value;
    setSelectedProduct(productId);
    
    // Find product default price
    const product = products.find((p) => p.id === productId);
    if (product) {
      setProductPrice(product.purchasePrice || 0);
    }
  };
  
  // Handle product dialog save
  const handleSaveProduct = () => {
    if (!selectedProduct) {
      return;
    }
    
    const product = products.find((p) => p.id === selectedProduct);
    if (!product) {
      return;
    }
    
    const newItem = {
      productId: selectedProduct,
      productName: product.name,
      quantity: productQuantity,
      unitPrice: productPrice,
      total: productQuantity * productPrice,
    };
    
    if (editingItemIndex >= 0) {
      // Update existing item
      setFormData((prev) => ({
        ...prev,
        items: prev.items.map((item, i) =>
          i === editingItemIndex ? newItem : item
        ),
      }));
    } else {
      // Add new item
      setFormData((prev) => ({
        ...prev,
        items: [...prev.items, newItem],
      }));
    }
    
    setProductDialogOpen(false);
  };
  
  // Validate form
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.supplierId) {
      newErrors.supplierId = 'Supplier is required';
    }
    
    if (!formData.orderDate) {
      newErrors.orderDate = 'Order date is required';
    }
    
    if (!formData.expectedDeliveryDate) {
      newErrors.expectedDeliveryDate = 'Expected delivery date is required';
    } else if (formData.expectedDeliveryDate < formData.orderDate) {
      newErrors.expectedDeliveryDate = 'Delivery date cannot be before order date';
    }
    
    if (formData.items.length === 0) {
      newErrors.items = 'At least one item is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setSubmitting(true);
      setSubmitError(null);
      
      // In a real implementation, this would be an API call
      // For now, we'll simulate a successful submission
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      // Generate a mock PO ID
      const poId = `PO-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      
      onSuccess(poId);
    } catch (err) {
      setSubmitError(err.message || 'Failed to create purchase order');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Mock data for products (in a real app, this would come from the context)
  const mockProducts = [
    { id: 1, name: 'Heineken Beer', purchasePrice: 125.00 },
    { id: 2, name: 'Jack Daniels Whiskey', purchasePrice: 350.00 },
    { id: 3, name: 'Tequila', purchasePrice: 350.00 },
    { id: 4, name: 'Craft Beer', purchasePrice: 100.00 },
    { id: 5, name: 'Vodka', purchasePrice: 250.00 },
  ];
  
  // Mock data for suppliers (in a real app, this would come from the context)
  const mockSuppliers = [
    { id: 1, name: 'Heineken Distributor' },
    { id: 2, name: 'Premium Spirits Inc' },
    { id: 3, name: 'Local Brewery Co' },
    { id: 4, name: 'Wine Importers Ltd' },
  ];
  
  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
        <IconButton onClick={onCancel} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5">Create Purchase Order</Typography>
      </Box>
      
      <form onSubmit={handleSubmit}>
        <Card sx={{ mb: 3 }}>
          <CardHeader title="Order Information" />
          <Divider />
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Supplier"
                  name="supplierId"
                  select
                  value={formData.supplierId}
                  onChange={handleChange}
                  error={!!errors.supplierId}
                  helperText={errors.supplierId}
                  required
                >
                  {mockSuppliers.map((supplier) => (
                    <MenuItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="Order Date"
                    value={formData.orderDate}
                    onChange={(date) => handleDateChange('orderDate', date)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        fullWidth
                        required
                        error={!!errors.orderDate}
                        helperText={errors.orderDate}
                      />
                    )}
                  />
                </LocalizationProvider>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="Expected Delivery Date"
                    value={formData.expectedDeliveryDate}
                    onChange={(date) => handleDateChange('expectedDeliveryDate', date)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        fullWidth
                        required
                        error={!!errors.expectedDeliveryDate}
                        helperText={errors.expectedDeliveryDate}
                      />
                    )}
                  />
                </LocalizationProvider>
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notes"
                  name="notes"
                  multiline
                  rows={3}
                  value={formData.notes}
                  onChange={handleChange}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
        
        <Card sx={{ mb: 3 }}>
          <CardHeader
            title="Order Items"
            action={
              <Button
                color="primary"
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddItem}
              >
                Add Item
              </Button>
            }
          />
          <Divider />
          <CardContent>
            {formData.items.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <Typography variant="body1" color="text.secondary" gutterBottom>
                  No items added yet
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={handleAddItem}
                  sx={{ mt: 2 }}
                >
                  Add Your First Item
                </Button>
                {errors.items && (
                  <FormHelperText error sx={{ mt: 1, textAlign: 'center' }}>
                    {errors.items}
                  </FormHelperText>
                )}
              </Box>
            ) : (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Product</TableCell>
                      <TableCell align="right">Quantity</TableCell>
                      <TableCell align="right">Unit Price</TableCell>
                      <TableCell align="right">Total</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {formData.items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.productName}</TableCell>
                        <TableCell align="right">{item.quantity}</TableCell>
                        <TableCell align="right">${item.unitPrice.toFixed(2)}</TableCell>
                        <TableCell align="right">${item.total.toFixed(2)}</TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            onClick={() => handleEditItem(index)}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleRemoveItem(index)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3} align="right">
                        <Typography variant="subtitle1">Total:</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="subtitle1">${totalAmount.toFixed(2)}</Typography>
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
        
        {submitError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {submitError}
          </Alert>
        )}
        
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Button variant="outlined" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={submitting}
          >
            {submitting ? 'Creating...' : 'Create Purchase Order'}
          </Button>
        </Box>
      </form>
      
      {/* Product Selection Dialog */}
      <Dialog open={productDialogOpen} onClose={() => setProductDialogOpen(false)}>
        <DialogTitle>
          {editingItemIndex >= 0 ? 'Edit Item' : 'Add Item'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Product"
                select
                value={selectedProduct || ''}
                onChange={handleProductChange}
                required
              >
                {mockProducts.map((product) => (
                  <MenuItem key={product.id} value={product.id}>
                    {product.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Quantity"
                type="number"
                value={productQuantity}
                onChange={(e) => setProductQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                inputProps={{ min: 1 }}
                required
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Unit Price"
                type="number"
                value={productPrice}
                onChange={(e) => setProductPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
                inputProps={{ min: 0, step: 0.01 }}
                required
              />
            </Grid>
            
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="subtitle2">Total:</Typography>
                <Typography variant="subtitle1">
                  ${(productQuantity * productPrice).toFixed(2)}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProductDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSaveProduct}
            color="primary"
            disabled={!selectedProduct || productQuantity < 1}
          >
            {editingItemIndex >= 0 ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

PurchaseOrderForm.propTypes = {
  preSelectedSupplierId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onCancel: PropTypes.func.isRequired,
  onSuccess: PropTypes.func.isRequired,
};

export default PurchaseOrderForm;
