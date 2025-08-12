import React, { useState, useEffect } from 'react';
import {
  Box, Button, Card, CardContent, CardHeader, Divider, Grid,
  TextField, MenuItem, FormControlLabel, Switch, Typography,
  InputAdornment, FormHelperText, FormControl, InputLabel,
  Select, OutlinedInput, Chip, IconButton, Tooltip, Alert, Collapse
} from '@mui/material';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useSnackbar } from 'notistack';
import { useInventory } from '../../../hooks/useInventory';
import { HelpOutline as HelpIcon } from '@mui/icons-material';

const validationSchema = Yup.object({
  name: Yup.string().required('Product name is required'),
  sku: Yup.string().required('SKU is required'),
  barcode: Yup.string(),
  description: Yup.string(),
  category_id: Yup.string().required('Category is required'),
  unit: Yup.string().required('Unit is required'),
  cost_price: Yup.number().min(0, 'Must be positive').required('Cost price is required'),
  selling_price: Yup.number().min(0, 'Must be positive').required('Selling price is required'),
  tax_rate: Yup.number().min(0).max(100, 'Must be between 0-100'),
  reorder_point: Yup.number().min(0, 'Must be positive').integer(),
  is_active: Yup.boolean(),
  track_inventory: Yup.boolean(),
  has_variants: Yup.boolean(),
  variants: Yup.array().when('has_variants', {
    is: true,
    then: Yup.array().of(
      Yup.object({
        name: Yup.string().required('Variant name is required'),
        sku: Yup.string().required('Variant SKU is required'),
        barcode: Yup.string(),
        cost_price: Yup.number().min(0, 'Must be positive').required('Cost price is required'),
        selling_price: Yup.number().min(0, 'Must be positive').required('Selling price is required'),
        quantity: Yup.number().min(0, 'Must be positive').integer()
      })
    ).min(1, 'At least one variant is required')
  })
});

const ProductForm = ({ product, categories, onSubmit, onCancel }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [variantName, setVariantName] = useState('');
  const [variantSku, setVariantSku] = useState('');
  const [variantBarcode, setVariantBarcode] = useState('');
  const [variantCost, setVariantCost] = useState('');
  const [variantPrice, setVariantPrice] = useState('');
  const [variantQty, setVariantQty] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { units } = useInventory();

  const formik = useFormik({
    initialValues: {
      name: product?.name || '',
      sku: product?.sku || '',
      barcode: product?.barcode || '',
      description: product?.description || '',
      category_id: product?.category_id || '',
      unit: product?.unit || '',
      cost_price: product?.cost_price || 0,
      selling_price: product?.selling_price || 0,
      tax_rate: product?.tax_rate || 0,
      reorder_point: product?.reorder_point || 0,
      is_active: product?.is_active ?? true,
      track_inventory: product?.track_inventory ?? true,
      has_variants: product?.has_variants || false,
      variants: product?.variants || []
    },
    validationSchema,
    onSubmit: async (values) => {
      try {
        setLoading(true);
        setError('');
        await onSubmit(values);
      } catch (err) {
        setError(err.message || 'Failed to save product');
        enqueueSnackbar(error, { variant: 'error' });
      } finally {
        setLoading(false);
      }
    },
    enableReinitialize: true
  });

  const handleAddVariant = () => {
    if (!variantName || !variantSku) {
      enqueueSnackbar('Variant name and SKU are required', { variant: 'error' });
      return;
    }

    const newVariant = {
      name: variantName,
      sku: variantSku,
      barcode: variantBarcode,
      cost_price: parseFloat(variantCost) || 0,
      selling_price: parseFloat(variantPrice) || 0,
      quantity: parseInt(variantQty) || 0
    };

    formik.setFieldValue('variants', [...formik.values.variants, newVariant]);
    
    // Reset variant fields
    setVariantName('');
    setVariantSku('');
    setVariantBarcode('');
    setVariantCost('');
    setVariantPrice('');
    setVariantQty('');
  };

  const handleRemoveVariant = (index) => {
    const newVariants = [...formik.values.variants];
    newVariants.splice(index, 1);
    formik.setFieldValue('variants', newVariants);
  };

  return (
    <form onSubmit={formik.handleSubmit}>
      <Card>
        <CardHeader title="Product Information" />
        <CardContent>
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Product Name"
                name="name"
                value={formik.values.name}
                onChange={formik.handleChange}
                error={formik.touched.name && Boolean(formik.errors.name)}
                helperText={formik.touched.name && formik.errors.name}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="SKU"
                name="sku"
                value={formik.values.sku}
                onChange={formik.handleChange}
                error={formik.touched.sku && Boolean(formik.errors.sku)}
                helperText={formik.touched.sku && formik.errors.sku}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title="Stock Keeping Unit - Unique identifier for this product">
                        <HelpIcon fontSize="small" color="action" />
                      </Tooltip>
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  name="category_id"
                  value={formik.values.category_id}
                  onChange={formik.handleChange}
                  error={formik.touched.category_id && Boolean(formik.errors.category_id)}
                  label="Category"
                >
                  {categories.map((category) => (
                    <MenuItem key={category.id} value={category.id}>
                      {category.name}
                    </MenuItem>
                  ))}
                </Select>
                {formik.touched.category_id && formik.errors.category_id && (
                  <FormHelperText error>{formik.errors.category_id}</FormHelperText>
                )}
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Unit</InputLabel>
                <Select
                  name="unit"
                  value={formik.values.unit}
                  onChange={formik.handleChange}
                  error={formik.touched.unit && Boolean(formik.errors.unit)}
                  label="Unit"
                >
                  {units.map((unit) => (
                    <MenuItem key={unit} value={unit}>
                      {unit}
                    </MenuItem>
                  ))}
                </Select>
                {formik.touched.unit && formik.errors.unit && (
                  <FormHelperText error>{formik.errors.unit}</FormHelperText>
                )}
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                name="description"
                multiline
                rows={3}
                value={formik.values.description}
                onChange={formik.handleChange}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Barcode"
                name="barcode"
                value={formik.values.barcode}
                onChange={formik.handleChange}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formik.values.track_inventory}
                    onChange={formik.handleChange}
                    name="track_inventory"
                    color="primary"
                  />
                }
                label="Track Inventory"
              />
              <FormHelperText>
                Enable to track stock levels for this product
              </FormHelperText>
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formik.values.has_variants}
                    onChange={(e) => {
                      formik.setFieldValue('has_variants', e.target.checked);
                      if (!e.target.checked) {
                        formik.setFieldValue('variants', []);
                      }
                    }}
                    name="has_variants"
                    color="primary"
                  />
                }
                label="This product has variants (e.g., sizes, colors)"
              />
            </Grid>
            {formik.values.has_variants && (
              <Grid item xs={12}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Product Variants
                    </Typography>
                    <Grid container spacing={2} alignItems="flex-end">
                      <Grid item xs={12} sm={3}>
                        <TextField
                          fullWidth
                          label="Variant Name"
                          value={variantName}
                          onChange={(e) => setVariantName(e.target.value)}
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={12} sm={2}>
                        <TextField
                          fullWidth
                          label="Variant SKU"
                          value={variantSku}
                          onChange={(e) => setVariantSku(e.target.value)}
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={12} sm={2}>
                        <TextField
                          fullWidth
                          label="Barcode"
                          value={variantBarcode}
                          onChange={(e) => setVariantBarcode(e.target.value)}
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={12} sm={1.5}>
                        <TextField
                          fullWidth
                          label="Cost"
                          type="number"
                          value={variantCost}
                          onChange={(e) => setVariantCost(e.target.value)}
                          size="small"
                          InputProps={{
                            startAdornment: <InputAdornment position="start">$</InputAdornment>,
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={1.5}>
                        <TextField
                          fullWidth
                          label="Price"
                          type="number"
                          value={variantPrice}
                          onChange={(e) => setVariantPrice(e.target.value)}
                          size="small"
                          InputProps={{
                            startAdornment: <InputAdornment position="start">$</InputAdornment>,
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={1}>
                        <TextField
                          fullWidth
                          label="Qty"
                          type="number"
                          value={variantQty}
                          onChange={(e) => setVariantQty(e.target.value)}
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={12} sm={1}>
                        <Button
                          variant="outlined"
                          onClick={handleAddVariant}
                          fullWidth
                        >
                          Add
                        </Button>
                      </Grid>
                    </Grid>
                    {formik.values.variants.length > 0 && (
                      <Box mt={2}>
                        {formik.values.variants.map((variant, index) => (
                          <Chip
                            key={index}
                            label={`${variant.name} (${variant.sku}) - $${variant.selling_price}`}
                            onDelete={() => handleRemoveVariant(index)}
                            sx={{ m: 0.5 }}
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    )}
                    {formik.touched.variants && formik.errors.variants && (
                      <FormHelperText error>
                        {formik.errors.variants}
                      </FormHelperText>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            )}
            {!formik.values.has_variants && (
              <>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Cost Price"
                    name="cost_price"
                    type="number"
                    value={formik.values.cost_price}
                    onChange={formik.handleChange}
                    error={formik.touched.cost_price && Boolean(formik.errors.cost_price)}
                    helperText={formik.touched.cost_price && formik.errors.cost_price}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">$</InputAdornment>,
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Selling Price"
                    name="selling_price"
                    type="number"
                    value={formik.values.selling_price}
                    onChange={formik.handleChange}
                    error={formik.touched.selling_price && Boolean(formik.errors.selling_price)}
                    helperText={formik.touched.selling_price && formik.errors.selling_price}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">$</InputAdornment>,
                    }}
                  />
                </Grid>
              </>
            )}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Tax Rate"
                name="tax_rate"
                type="number"
                value={formik.values.tax_rate}
                onChange={formik.handleChange}
                error={formik.touched.tax_rate && Boolean(formik.errors.tax_rate)}
                helperText={formik.touched.tax_rate && formik.errors.tax_rate}
                InputProps={{
                  endAdornment: <InputAdornment position="end">%</InputAdornment>,
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Reorder Point"
                name="reorder_point"
                type="number"
                value={formik.values.reorder_point}
                onChange={formik.handleChange}
                error={formik.touched.reorder_point && Boolean(formik.errors.reorder_point)}
                helperText="Get notified when stock falls below this level"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formik.values.is_active}
                    onChange={formik.handleChange}
                    name="is_active"
                    color="primary"
                  />
                }
                label="Active"
              />
              <FormHelperText>
                Inactive products won't appear in sales or be available for purchase
              </FormHelperText>
            </Grid>
          </Grid>
        </CardContent>
        <Divider />
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            color="inherit"
            onClick={onCancel}
            sx={{ mr: 1 }}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            color="primary"
            variant="contained"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Product'}
          </Button>
        </Box>
      </Card>
    </form>
  );
};

export default ProductForm;
