import React, { useState, useEffect, useCallback } from 'react';
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
  Rating,
  Stack,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  LocationOn as LocationOnIcon,
  AttachMoney as AttachMoneyIcon,
  ShoppingCart as ShoppingCartIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { useInventoryContext } from '../../../contexts/InventoryContext';
import DataTable from '../../../components/inventory/DataTable';

// Supplier Form Component
const SupplierForm = ({ supplier, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    country: '',
    website: '',
    notes: '',
    paymentTerms: '',
    rating: 3,
    active: true,
    ...supplier,
  });
  
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Clear error when field is edited
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleRatingChange = (_, newValue) => {
    setFormData((prev) => ({ ...prev, rating: newValue }));
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name) newErrors.name = 'Supplier name is required';
    if (!formData.email) newErrors.email = 'Email is required';
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    if (!formData.phone) newErrors.phone = 'Phone number is required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            required
            label="Supplier Name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            error={!!errors.name}
            helperText={errors.name}
          />
        </Grid>
        
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Contact Person"
            name="contactName"
            value={formData.contactName}
            onChange={handleChange}
          />
        </Grid>
        
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            required
            label="Email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            error={!!errors.email}
            helperText={errors.email}
          />
        </Grid>
        
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            required
            label="Phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            error={!!errors.phone}
            helperText={errors.phone}
          />
        </Grid>
        
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Website"
            name="website"
            value={formData.website}
            onChange={handleChange}
          />
        </Grid>
        
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Address"
            name="address"
            value={formData.address}
            onChange={handleChange}
          />
        </Grid>
        
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            label="City"
            name="city"
            value={formData.city}
            onChange={handleChange}
          />
        </Grid>
        
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            label="State/Province"
            name="state"
            value={formData.state}
            onChange={handleChange}
          />
        </Grid>
        
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            label="ZIP/Postal Code"
            name="zip"
            value={formData.zip}
            onChange={handleChange}
          />
        </Grid>
        
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Country"
            name="country"
            value={formData.country}
            onChange={handleChange}
          />
        </Grid>
        
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Payment Terms"
            name="paymentTerms"
            value={formData.paymentTerms}
            onChange={handleChange}
            placeholder="e.g., Net 30, COD"
          />
        </Grid>
        
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography component="legend" sx={{ mr: 2 }}>
              Supplier Rating:
            </Typography>
            <Rating
              name="rating"
              value={formData.rating}
              onChange={handleRatingChange}
            />
          </Box>
        </Grid>
        
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            multiline
            rows={3}
          />
        </Grid>
        
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2 }}>
            <Button onClick={onCancel}>Cancel</Button>
            <Button type="submit" variant="contained" color="primary">
              {supplier ? 'Update Supplier' : 'Add Supplier'}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </form>
  );
};

// Supplier Detail Component
const SupplierDetail = ({ supplier, onClose, onEdit, onCreatePO }) => {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (_, newValue) => {
    setTabValue(newValue);
  };

  if (!supplier) return null;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">{supplier.name}</Typography>
        <Box>
          <Button 
            startIcon={<EditIcon />} 
            onClick={onEdit}
            sx={{ mr: 1 }}
          >
            Edit
          </Button>
          <Button 
            startIcon={<ShoppingCartIcon />} 
            variant="contained" 
            color="primary"
            onClick={onCreatePO}
          >
            Create Purchase Order
          </Button>
        </Box>
      </Box>
      
      <Divider sx={{ mb: 2 }} />
      
      <Tabs value={tabValue} onChange={handleTabChange} sx={{ mb: 2 }}>
        <Tab label="Details" />
        <Tab label="Purchase History" />
        <Tab label="Products" />
      </Tabs>
      
      {tabValue === 0 && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  Contact Information
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                {supplier.contactName && (
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Contact Person
                    </Typography>
                    <Typography variant="body1">
                      {supplier.contactName}
                    </Typography>
                  </Box>
                )}
                
                <Box sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                  <EmailIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                  <Typography variant="body1">
                    {supplier.email}
                  </Typography>
                </Box>
                
                <Box sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                  <PhoneIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                  <Typography variant="body1">
                    {supplier.phone}
                  </Typography>
                </Box>
                
                {supplier.website && (
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Website
                    </Typography>
                    <Typography variant="body1" component="a" href={supplier.website} target="_blank">
                      {supplier.website}
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  Address
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <Box sx={{ display: 'flex' }}>
                  <LocationOnIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  <Typography variant="body1">
                    {supplier.address}<br />
                    {supplier.city}, {supplier.state} {supplier.zip}<br />
                    {supplier.country}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  Payment Information
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <Box sx={{ mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Payment Terms
                  </Typography>
                  <Typography variant="body1">
                    {supplier.paymentTerms || 'Not specified'}
                  </Typography>
                </Box>
                
                <Box sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                  <AttachMoneyIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    Total Spent:
                  </Typography>
                  <Typography variant="body1" sx={{ ml: 1 }}>
                    ${supplier.totalSpent?.toFixed(2) || '0.00'}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  Supplier Rating
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Rating value={supplier.rating || 0} readOnly />
                  <Typography variant="body2" sx={{ ml: 1 }}>
                    ({supplier.rating || 0}/5)
                  </Typography>
                </Box>
                
                <Typography variant="body2" color="text.secondary">
                  Notes
                </Typography>
                <Typography variant="body1">
                  {supplier.notes || 'No notes available'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
      
      {tabValue === 1 && (
        <Typography variant="body1" color="text.secondary" align="center" sx={{ py: 4 }}>
          Purchase history will be displayed here
        </Typography>
      )}
      
      {tabValue === 2 && (
        <Typography variant="body1" color="text.secondary" align="center" sx={{ py: 4 }}>
          Products supplied by this vendor will be displayed here
        </Typography>
      )}
    </Box>
  );
};

const SuppliersPage = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { 
    suppliers, 
    loadSuppliers, 
    addSupplier, 
    editSupplier, 
    removeSupplier 
  } = useInventoryContext();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogType, setDialogType] = useState('add');
  const [detailDialog, setDetailDialog] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pagination, setPagination] = useState({
    page: 0,
    limit: 10,
    total: 0,
  });

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        await loadSuppliers();
      } catch (err) {
        setError(err.message || 'Failed to load suppliers');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [loadSuppliers]);

  // Handle search
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    // In a real implementation, you would call an API with the search term
  };

  // Handle pagination
  const handlePageChange = (newPage, rowsPerPage) => {
    setPagination({
      ...pagination,
      page: newPage,
      limit: rowsPerPage,
    });
    // In a real implementation, you would call an API with the pagination params
  };

  // Handle add supplier
  const handleAddSupplier = () => {
    setSelectedSupplier(null);
    setDialogType('add');
    setOpenDialog(true);
  };

  // Handle edit supplier
  const handleEditSupplier = (supplier) => {
    setSelectedSupplier(supplier);
    setDialogType('edit');
    setOpenDialog(true);
    setDetailDialog(false);
  };

  // Handle view supplier
  const handleViewSupplier = (supplier) => {
    setSelectedSupplier(supplier);
    setDetailDialog(true);
  };

  // Handle delete supplier
  const handleDeleteClick = (supplier) => {
    setSelectedSupplier(supplier);
    setDeleteConfirmOpen(true);
  };

  // Confirm delete supplier
  const confirmDeleteSupplier = async () => {
    try {
      await removeSupplier(selectedSupplier.id);
      enqueueSnackbar('Supplier deleted successfully', { variant: 'success' });
      setDeleteConfirmOpen(false);
      setSelectedSupplier(null);
    } catch (error) {
      enqueueSnackbar(error.message || 'Failed to delete supplier', { variant: 'error' });
    }
  };

  // Handle form submission
  const handleSubmitSupplier = async (formData) => {
    try {
      if (dialogType === 'add') {
        await addSupplier(formData);
        enqueueSnackbar('Supplier added successfully', { variant: 'success' });
      } else {
        await editSupplier(selectedSupplier.id, formData);
        enqueueSnackbar('Supplier updated successfully', { variant: 'success' });
      }
      setOpenDialog(false);
    } catch (error) {
      enqueueSnackbar(error.message || 'An error occurred', { variant: 'error' });
    }
  };

  // Handle create purchase order
  const handleCreatePO = (supplier) => {
    // Navigate to create PO page with supplier pre-selected
    navigate('/inventory/purchase-orders/new', { state: { supplierId: supplier.id } });
  };

  // Table columns
  const columns = [
    {
      id: 'name',
      label: 'Supplier',
      sortable: true,
      render: (value, row) => (
        <Box>
          <Typography variant="subtitle2">{value}</Typography>
          {row.contactName && (
            <Typography variant="body2" color="textSecondary">
              Contact: {row.contactName}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      id: 'email',
      label: 'Email',
      sortable: true,
    },
    {
      id: 'phone',
      label: 'Phone',
      sortable: true,
    },
    {
      id: 'city',
      label: 'Location',
      sortable: true,
      render: (value, row) => {
        if (!value && !row.country) return '-';
        return `${value || ''}, ${row.country || ''}`;
      },
    },
    {
      id: 'rating',
      label: 'Rating',
      sortable: true,
      render: (value) => <Rating value={value || 0} readOnly size="small" />,
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
                handleViewSupplier(row);
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
                handleEditSupplier(row);
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

  // Mock suppliers data for demonstration
  const mockSuppliers = [
    {
      id: 1,
      name: 'Heineken Distributor',
      contactName: 'John Smith',
      email: 'john@heinekendist.com',
      phone: '555-123-4567',
      address: '123 Beer St',
      city: 'Amsterdam',
      state: 'NH',
      zip: '1000 AA',
      country: 'Netherlands',
      website: 'https://heinekendistributor.com',
      paymentTerms: 'Net 30',
      rating: 4,
      notes: 'Primary beer supplier',
      totalSpent: 12500.75,
    },
    {
      id: 2,
      name: 'Premium Spirits Inc',
      contactName: 'Sarah Johnson',
      email: 'sarah@premiumspirits.com',
      phone: '555-987-6543',
      address: '456 Whiskey Ave',
      city: 'Louisville',
      state: 'KY',
      zip: '40202',
      country: 'USA',
      website: 'https://premiumspirits.com',
      paymentTerms: 'Net 45',
      rating: 5,
      notes: 'High quality spirits supplier',
      totalSpent: 28750.50,
    },
    {
      id: 3,
      name: 'Local Brewery Co',
      contactName: 'Mike Wilson',
      email: 'mike@localbrewery.com',
      phone: '555-456-7890',
      address: '789 Craft Blvd',
      city: 'Portland',
      state: 'OR',
      zip: '97201',
      country: 'USA',
      website: 'https://localbrewery.com',
      paymentTerms: 'COD',
      rating: 3,
      notes: 'Local craft beer supplier',
      totalSpent: 5200.25,
    },
  ];

  return (
    <Box>
      <Card>
        <CardHeader
          title="Suppliers"
          action={
            <Button
              color="primary"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddSupplier}
            >
              Add Supplier
            </Button>
          }
        />
        <Divider />
        <CardContent>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                placeholder="Search suppliers..."
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
                onClick={() => loadSuppliers()}
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
            data={mockSuppliers} // Replace with actual suppliers data
            loading={loading}
            error={error}
            onRowClick={handleViewSupplier}
            pagination={{
              paginate: true,
              page: pagination.page,
              rowsPerPage: pagination.limit,
              total: mockSuppliers.length, // Replace with actual total
              onPageChange: handlePageChange,
            }}
            rowKey="id"
            sx={{
              '& .MuiTableCell-root': {
                py: 1.5,
              },
            }}
          />
        </CardContent>
      </Card>

      {/* Add/Edit Supplier Dialog */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {dialogType === 'add' ? 'Add New Supplier' : 'Edit Supplier'}
        </DialogTitle>
        <DialogContent>
          <SupplierForm
            supplier={selectedSupplier}
            onSubmit={handleSubmitSupplier}
            onCancel={() => setOpenDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Supplier Detail Dialog */}
      <Dialog
        open={detailDialog}
        onClose={() => setDetailDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogContent>
          <SupplierDetail
            supplier={selectedSupplier}
            onClose={() => setDetailDialog(false)}
            onEdit={() => handleEditSupplier(selectedSupplier)}
            onCreatePO={() => handleCreatePO(selectedSupplier)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle>Delete Supplier</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "{selectedSupplier?.name}"? This action
            cannot be undone and may affect related purchase orders and products.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button
            onClick={confirmDeleteSupplier}
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SuppliersPage;
