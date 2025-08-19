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
  FormControl,
  InputLabel,
  Select,
  FormHelperText,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import {
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Refresh as RefreshIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  SwapHoriz as SwapHorizIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { useInventoryContext } from '../../../contexts/InventoryContext';
import DataTable from '../../../components/inventory/DataTable';

// Movement Form Component
const MovementForm = ({ onSubmit, onCancel, products, locations, suppliers }) => {
  const [formData, setFormData] = useState({
    type: 'in',
    productId: '',
    quantity: 1,
    reason: 'purchase',
    notes: '',
    locationId: '',
    supplierId: '',
    date: new Date(),
    unitCost: 0,
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

  const handleDateChange = (date) => {
    setFormData((prev) => ({ ...prev, date }));
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.productId) newErrors.productId = 'Product is required';
    if (!formData.quantity || formData.quantity <= 0) newErrors.quantity = 'Valid quantity is required';
    if (!formData.locationId) newErrors.locationId = 'Location is required';
    if (formData.type === 'in' && formData.reason === 'purchase' && !formData.supplierId) {
      newErrors.supplierId = 'Supplier is required for purchases';
    }
    if (formData.type === 'in' && formData.unitCost <= 0) {
      newErrors.unitCost = 'Valid unit cost is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  // Dynamically show/hide fields based on movement type
  const showSupplierField = formData.type === 'in' && formData.reason === 'purchase';
  const showUnitCostField = formData.type === 'in';

  return (
    <form onSubmit={handleSubmit}>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth required error={!!errors.type}>
            <InputLabel>Movement Type</InputLabel>
            <Select
              name="type"
              value={formData.type}
              onChange={handleChange}
              label="Movement Type"
            >
              <MenuItem value="in">Stock In</MenuItem>
              <MenuItem value="out">Stock Out</MenuItem>
              <MenuItem value="adjustment">Adjustment</MenuItem>
              <MenuItem value="transfer">Transfer</MenuItem>
            </Select>
            {errors.type && <FormHelperText>{errors.type}</FormHelperText>}
          </FormControl>
        </Grid>
        
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth required error={!!errors.reason}>
            <InputLabel>Reason</InputLabel>
            <Select
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              label="Reason"
            >
              {formData.type === 'in' && (
                <>
                  <MenuItem value="purchase">Purchase</MenuItem>
                  <MenuItem value="return">Customer Return</MenuItem>
                  <MenuItem value="correction">Correction</MenuItem>
                </>
              )}
              {formData.type === 'out' && (
                <>
                  <MenuItem value="sale">Sale</MenuItem>
                  <MenuItem value="wastage">Wastage</MenuItem>
                  <MenuItem value="return">Return to Supplier</MenuItem>
                  <MenuItem value="correction">Correction</MenuItem>
                </>
              )}
              {formData.type === 'adjustment' && (
                <>
                  <MenuItem value="count">Inventory Count</MenuItem>
                  <MenuItem value="correction">Correction</MenuItem>
                </>
              )}
              {formData.type === 'transfer' && (
                <MenuItem value="transfer">Location Transfer</MenuItem>
              )}
            </Select>
            {errors.reason && <FormHelperText>{errors.reason}</FormHelperText>}
          </FormControl>
        </Grid>
        
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth required error={!!errors.productId}>
            <InputLabel>Product</InputLabel>
            <Select
              name="productId"
              value={formData.productId}
              onChange={handleChange}
              label="Product"
            >
              {products.map((product) => (
                <MenuItem key={product.id} value={product.id}>
                  {product.name}
                </MenuItem>
              ))}
            </Select>
            {errors.productId && <FormHelperText>{errors.productId}</FormHelperText>}
          </FormControl>
        </Grid>
        
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            required
            label="Quantity"
            name="quantity"
            type="number"
            value={formData.quantity}
            onChange={handleChange}
            error={!!errors.quantity}
            helperText={errors.quantity}
            InputProps={{
              inputProps: { min: 1 }
            }}
          />
        </Grid>
        
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth required error={!!errors.locationId}>
            <InputLabel>Location</InputLabel>
            <Select
              name="locationId"
              value={formData.locationId}
              onChange={handleChange}
              label="Location"
            >
              {locations.map((location) => (
                <MenuItem key={location.id} value={location.id}>
                  {location.name}
                </MenuItem>
              ))}
            </Select>
            {errors.locationId && <FormHelperText>{errors.locationId}</FormHelperText>}
          </FormControl>
        </Grid>
        
        {formData.type === 'transfer' && (
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth required error={!!errors.toLocationId}>
              <InputLabel>To Location</InputLabel>
              <Select
                name="toLocationId"
                value={formData.toLocationId || ''}
                onChange={handleChange}
                label="To Location"
              >
                {locations
                  .filter(loc => loc.id !== formData.locationId)
                  .map((location) => (
                    <MenuItem key={location.id} value={location.id}>
                      {location.name}
                    </MenuItem>
                  ))}
              </Select>
              {errors.toLocationId && <FormHelperText>{errors.toLocationId}</FormHelperText>}
            </FormControl>
          </Grid>
        )}
        
        {showSupplierField && (
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth required={showSupplierField} error={!!errors.supplierId}>
              <InputLabel>Supplier</InputLabel>
              <Select
                name="supplierId"
                value={formData.supplierId}
                onChange={handleChange}
                label="Supplier"
              >
                {suppliers.map((supplier) => (
                  <MenuItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </MenuItem>
                ))}
              </Select>
              {errors.supplierId && <FormHelperText>{errors.supplierId}</FormHelperText>}
            </FormControl>
          </Grid>
        )}
        
        {showUnitCostField && (
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              required={showUnitCostField}
              label="Unit Cost"
              name="unitCost"
              type="number"
              value={formData.unitCost}
              onChange={handleChange}
              error={!!errors.unitCost}
              helperText={errors.unitCost}
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
                inputProps: { min: 0, step: 0.01 }
              }}
            />
          </Grid>
        )}
        
        <Grid item xs={12} sm={6}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Date"
              value={formData.date}
              onChange={handleDateChange}
              renderInput={(params) => (
                <TextField {...params} fullWidth required />
              )}
            />
          </LocalizationProvider>
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
              Submit
            </Button>
          </Box>
        </Grid>
      </Grid>
    </form>
  );
};

const MovementsPage = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { 
    inventory, 
    products, 
    locations, 
    suppliers, 
    loadProducts, 
    loadLocations, 
    loadSuppliers,
    adjustInventory,
    transferInventory
  } = useInventoryContext();
  
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateRange, setDateRange] = useState({
    start: null,
    end: null,
  });
  const [pagination, setPagination] = useState({
    page: 0,
    limit: 10,
    total: 0,
  });

  // Fetch initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        await Promise.all([
          loadProducts(),
          loadLocations(),
          loadSuppliers(),
          fetchMovements(),
        ]);
      } catch (err) {
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchInitialData();
  }, [loadProducts, loadLocations, loadSuppliers]);

  // Fetch movements
  const fetchMovements = useCallback(async (params = {}) => {
    try {
      setLoading(true);
      
      // In a real implementation, this would be an API call
      // For now, we'll use mock data
      const mockMovements = [
        {
          id: 1,
          type: 'in',
          reason: 'purchase',
          productId: 1,
          productName: 'Heineken Beer',
          quantity: 24,
          locationId: 1,
          locationName: 'Main Bar',
          supplierId: 1,
          supplierName: 'Heineken Distributor',
          unitCost: 1.25,
          totalCost: 30.00,
          date: new Date(2023, 5, 15),
          notes: 'Regular monthly order',
          createdBy: 'John Manager',
          createdAt: new Date(2023, 5, 15),
        },
        {
          id: 2,
          type: 'out',
          reason: 'sale',
          productId: 1,
          productName: 'Heineken Beer',
          quantity: 12,
          locationId: 1,
          locationName: 'Main Bar',
          date: new Date(2023, 5, 16),
          notes: 'Weekend sales',
          createdBy: 'System',
          createdAt: new Date(2023, 5, 16),
        },
        {
          id: 3,
          type: 'adjustment',
          reason: 'count',
          productId: 2,
          productName: 'Jack Daniels Whiskey',
          quantity: -2,
          locationId: 1,
          locationName: 'Main Bar',
          date: new Date(2023, 5, 17),
          notes: 'Inventory count adjustment',
          createdBy: 'Sarah Bartender',
          createdAt: new Date(2023, 5, 17),
        },
        {
          id: 4,
          type: 'transfer',
          reason: 'transfer',
          productId: 3,
          productName: 'Tequila',
          quantity: 5,
          locationId: 1,
          locationName: 'Main Bar',
          toLocationId: 2,
          toLocationName: 'Storage',
          date: new Date(2023, 5, 18),
          notes: 'Moving excess stock to storage',
          createdBy: 'John Manager',
          createdAt: new Date(2023, 5, 18),
        },
      ];
      
      // Apply filters
      let filteredMovements = [...mockMovements];
      
      if (searchTerm) {
        filteredMovements = filteredMovements.filter(
          (m) => 
            m.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.notes.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      
      if (typeFilter !== 'all') {
        filteredMovements = filteredMovements.filter(m => m.type === typeFilter);
      }
      
      if (dateRange.start) {
        filteredMovements = filteredMovements.filter(
          m => new Date(m.date) >= new Date(dateRange.start)
        );
      }
      
      if (dateRange.end) {
        filteredMovements = filteredMovements.filter(
          m => new Date(m.date) <= new Date(dateRange.end)
        );
      }
      
      // Apply pagination
      const startIndex = pagination.page * pagination.limit;
      const paginatedMovements = filteredMovements.slice(
        startIndex,
        startIndex + pagination.limit
      );
      
      setMovements(paginatedMovements);
      setPagination(prev => ({
        ...prev,
        total: filteredMovements.length,
      }));
      
    } catch (err) {
      setError(err.message || 'Failed to fetch movements');
      console.error('Error fetching movements:', err);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, searchTerm, typeFilter, dateRange]);

  // Handle search
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setPagination(prev => ({ ...prev, page: 0 })); // Reset to first page
    fetchMovements({ search: e.target.value, type: typeFilter });
  };

  // Handle type filter change
  const handleTypeFilterChange = (e) => {
    setTypeFilter(e.target.value);
    setPagination(prev => ({ ...prev, page: 0 })); // Reset to first page
    fetchMovements({ search: searchTerm, type: e.target.value });
  };

  // Handle date range change
  const handleDateRangeChange = (field, value) => {
    setDateRange(prev => ({ ...prev, [field]: value }));
    setPagination(prev => ({ ...prev, page: 0 })); // Reset to first page
    fetchMovements();
  };

  // Handle pagination
  const handlePageChange = (newPage, rowsPerPage) => {
    setPagination(prev => ({
      ...prev,
      page: newPage,
      limit: rowsPerPage,
    }));
    fetchMovements();
  };

  // Handle add movement
  const handleAddMovement = () => {
    setOpenDialog(true);
  };

  // Handle form submission
  const handleSubmitMovement = async (formData) => {
    try {
      setLoading(true);
      
      // Process based on movement type
      if (formData.type === 'transfer') {
        await transferInventory({
          productId: formData.productId,
          fromLocationId: formData.locationId,
          toLocationId: formData.toLocationId,
          quantity: formData.quantity,
          notes: formData.notes,
          date: formData.date,
        });
      } else {
        await adjustInventory({
          productId: formData.productId,
          locationId: formData.locationId,
          quantity: formData.type === 'out' ? -formData.quantity : formData.quantity,
          reason: formData.reason,
          notes: formData.notes,
          date: formData.date,
          unitCost: formData.unitCost,
          supplierId: formData.supplierId,
        });
      }
      
      enqueueSnackbar('Inventory movement recorded successfully', { variant: 'success' });
      setOpenDialog(false);
      fetchMovements();
    } catch (error) {
      enqueueSnackbar(error.message || 'Failed to record movement', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Table columns
  const columns = [
    {
      id: 'date',
      label: 'Date',
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      id: 'type',
      label: 'Type',
      sortable: true,
      render: (value) => {
        let color;
        let label;
        
        switch (value) {
          case 'in':
            color = 'success';
            label = 'Stock In';
            break;
          case 'out':
            color = 'error';
            label = 'Stock Out';
            break;
          case 'adjustment':
            color = 'warning';
            label = 'Adjustment';
            break;
          case 'transfer':
            color = 'info';
            label = 'Transfer';
            break;
          default:
            color = 'default';
            label = value;
        }
        
        return <Chip label={label} color={color} size="small" />;
      },
    },
    {
      id: 'productName',
      label: 'Product',
      sortable: true,
    },
    {
      id: 'quantity',
      label: 'Quantity',
      align: 'right',
      sortable: true,
      render: (value, row) => {
        const isNegative = value < 0 || row.type === 'out';
        const displayValue = Math.abs(value);
        
        return (
          <Typography
            color={isNegative ? 'error.main' : 'success.main'}
            sx={{ fontWeight: 'bold' }}
          >
            {isNegative ? '-' : '+'}{displayValue}
          </Typography>
        );
      },
    },
    {
      id: 'locationName',
      label: 'Location',
      sortable: true,
      render: (value, row) => {
        if (row.type === 'transfer') {
          return (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {value} <SwapHorizIcon sx={{ mx: 0.5 }} /> {row.toLocationName}
            </Box>
          );
        }
        return value;
      },
    },
    {
      id: 'reason',
      label: 'Reason',
      sortable: true,
      render: (value) => {
        return value.charAt(0).toUpperCase() + value.slice(1);
      },
    },
    {
      id: 'notes',
      label: 'Notes',
      sortable: false,
      render: (value) => {
        if (!value) return '-';
        return value.length > 30 ? `${value.substring(0, 30)}...` : value;
      },
    },
    {
      id: 'createdBy',
      label: 'Created By',
      sortable: true,
    },
  ];

  return (
    <Box>
      <Card>
        <CardHeader
          title="Inventory Movements"
          action={
            <Button
              color="primary"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddMovement}
            >
              Record Movement
            </Button>
          }
        />
        <Divider />
        <CardContent>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search movements..."
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
                label="Type"
                value={typeFilter}
                onChange={handleTypeFilterChange}
              >
                <MenuItem value="all">All Types</MenuItem>
                <MenuItem value="in">Stock In</MenuItem>
                <MenuItem value="out">Stock Out</MenuItem>
                <MenuItem value="adjustment">Adjustment</MenuItem>
                <MenuItem value="transfer">Transfer</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="From Date"
                  value={dateRange.start}
                  onChange={(date) => handleDateRangeChange('start', date)}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="To Date"
                  value={dateRange.end}
                  onChange={(date) => handleDateRangeChange('end', date)}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => fetchMovements()}
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
            data={movements}
            loading={loading}
            error={error}
            pagination={{
              paginate: true,
              page: pagination.page,
              rowsPerPage: pagination.limit,
              total: pagination.total,
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

      {/* Add Movement Dialog */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Record Inventory Movement</DialogTitle>
        <DialogContent>
          <MovementForm
            onSubmit={handleSubmitMovement}
            onCancel={() => setOpenDialog(false)}
            products={products || []}
            locations={locations || []}
            suppliers={suppliers || []}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default MovementsPage;
