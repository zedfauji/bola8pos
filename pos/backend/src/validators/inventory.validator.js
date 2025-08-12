const { z } = require('zod');

// Product validators
const productSchema = z.object({
  sku: z.string().optional(),
  barcode: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  category_id: z.string().min(1, 'Category ID is required'),
  unit_id: z.string().min(1, 'Unit ID is required'),
  cost_price: z.number().min(0, 'Cost price must be positive').optional(),
  selling_price: z.number().min(0, 'Selling price must be positive'),
  tax_rate: z.number().min(0).max(100, 'Tax rate must be between 0 and 100').optional(),
  min_stock_level: z.number().min(0).optional(),
  is_active: z.boolean().optional(),
  is_ingredient: z.boolean().optional(),
  is_composite: z.boolean().optional()
});

// Product variant validators
const variantSchema = z.object({
  product_id: z.string().min(1, 'Product ID is required'),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  unit_id: z.string().min(1, 'Unit ID is required'),
  unit_quantity: z.number().positive('Unit quantity must be positive'),
  cost_price: z.number().min(0, 'Cost price must be positive').optional(),
  selling_price: z.number().min(0, 'Selling price must be positive'),
  is_default: z.boolean().optional()
});

// Inventory adjustment validators
const inventoryAdjustmentSchema = z.object({
  product_id: z.string().min(1, 'Product ID is required'),
  variant_id: z.string().optional(),
  location_id: z.string().min(1, 'Location ID is required'),
  quantity: z.number().refine(q => q !== 0, 'Quantity cannot be zero'),
  reference_type: z.string().optional(),
  reference_id: z.string().optional(),
  notes: z.string().optional()
});

// Helper: accept MySQL DATETIME 'YYYY-MM-DD HH:MM:SS' or ISO or Date
const mysqlDateTimeString = z.string().regex(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);

// Purchase order validators
const purchaseOrderSchema = z.object({
  po_number: z.string().min(1, 'PO number is required'),
  supplier_id: z.string().min(1, 'Supplier ID is required'),
  order_date: z.union([z.string().min(1), z.date()]),
  expected_delivery_date: z.union([z.string().min(1), z.date()]).optional(),
  status: z.enum(['draft', 'pending', 'partially_received', 'completed', 'cancelled']).optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    product_id: z.string().min(1, 'Product ID is required'),
    variant_id: z.string().optional(),
    quantity_ordered: z.number().positive('Quantity must be positive'),
    unit_cost: z.number().min(0, 'Unit cost must be positive'),
    tax_rate: z.number().min(0).max(100, 'Tax rate must be between 0 and 100').optional(),
    expected_delivery_date: z.union([z.string().min(1), z.date()]).optional(),
    notes: z.string().optional()
  })).min(1, 'At least one item is required')
});

// Category validators
const categorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  parent_id: z.string().optional(),
  sort_order: z.number().int().optional(),
  active: z.boolean().optional()
});

// Location validators
const locationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['bar', 'kitchen', 'storage', 'other']),
  is_active: z.boolean().optional()
});

// Supplier validators
const supplierSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  contact_person: z.string().optional(),
  email: z.string().email('Invalid email').optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  tax_id: z.string().optional(),
  payment_terms: z.string().optional(),
  notes: z.string().optional(),
  is_active: z.boolean().optional()
});

module.exports = {
  productSchema,
  variantSchema,
  inventoryAdjustmentSchema,
  purchaseOrderSchema,
  categorySchema,
  locationSchema,
  supplierSchema
};
