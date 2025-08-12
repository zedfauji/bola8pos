const BaseController = require('./base.controller');
const { productSchema, variantSchema } = require('../../validators/inventory.validator');

class ProductController extends BaseController {
  constructor() {
    super('products');
  }

  // Override create to handle validation
  async create(productData) {
    // Validate input
    const validatedData = productSchema.parse(productData);
    
    // Set default values
    const dataToInsert = {
      id: (productData && productData.id) ? productData.id : `prod_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
      ...validatedData,
      is_active: validatedData.is_active !== undefined ? validatedData.is_active : true,
      is_ingredient: validatedData.is_ingredient || false,
      is_composite: validatedData.is_composite || false,
      cost_price: validatedData.cost_price || 0,
      tax_rate: validatedData.tax_rate || 0,
      min_stock_level: validatedData.min_stock_level || 0
    };
    // DEBUG: Log the keys to ensure 'id' is present
    try { console.log('[DEBUG] product.create dataToInsert keys:', Object.keys(dataToInsert)); } catch {}
    
    return super.create(dataToInsert);
  }

  // Override update to handle validation
  async update(id, updates) {
    // Validate input
    const validatedUpdates = productSchema.partial().parse(updates);
    return super.update(id, validatedUpdates);
  }

  // Get products with their variants
  async findWithVariants(id = null, includeInactive = false) {
    let query = `
      SELECT 
        p.*, 
        v.id as variant_id,
        v.sku as variant_sku,
        v.barcode as variant_barcode,
        v.name as variant_name,
        v.unit_id as variant_unit_id,
        v.unit_quantity,
        v.cost_price as variant_cost_price,
        v.selling_price as variant_selling_price,
        v.is_default,
        v.created_at as variant_created_at,
        v.updated_at as variant_updated_at
      FROM products p
      LEFT JOIN product_variants v ON p.id = v.product_id
    `;
    
    const params = [];
    
    if (id) {
      query += ' WHERE p.id = ?';
      params.push(id);
    } else if (!includeInactive) {
      query += ' WHERE p.is_active = 1';
    }
    
    query += ' ORDER BY p.name, v.unit_quantity';
    
    const rows = await this.query(query, params);
    
    // Group variants by product
    const productsMap = new Map();
    
    for (const row of rows) {
      if (!productsMap.has(row.id)) {
        const { variant_id, variant_sku, variant_barcode, variant_name, variant_unit_id, unit_quantity, 
                variant_cost_price, variant_selling_price, is_default, variant_created_at, variant_updated_at, 
                ...product } = row;
                
        productsMap.set(row.id, {
          ...product,
          variants: []
        });
        
        if (variant_id) {
          productsMap.get(row.id).variants.push({
            id: variant_id,
            sku: variant_sku,
            barcode: variant_barcode,
            name: variant_name,
            unit_id: variant_unit_id,
            unit_quantity,
            cost_price: variant_cost_price,
            selling_price: variant_selling_price,
            is_default: Boolean(is_default),
            created_at: variant_created_at,
            updated_at: variant_updated_at
          });
        }
      } else if (row.variant_id) {
        productsMap.get(row.id).variants.push({
          id: row.variant_id,
          sku: row.variant_sku,
          barcode: row.variant_barcode,
          name: row.variant_name,
          unit_id: row.variant_unit_id,
          unit_quantity: row.unit_quantity,
          cost_price: row.variant_cost_price,
          selling_price: row.variant_selling_price,
          is_default: Boolean(row.is_default),
          created_at: row.variant_created_at,
          updated_at: row.variant_updated_at
        });
      }
    }
    
    return id ? productsMap.get(id) : Array.from(productsMap.values());
  }

  // Get product inventory across all locations
  async getInventory(productId) {
    const query = `
      SELECT 
        i.id,
        i.location_id,
        l.name as location_name,
        i.quantity,
        i.last_counted_at
      FROM inventory i
      JOIN locations l ON i.location_id = l.id
      WHERE i.product_id = ?
      ORDER BY l.name
    `;
    
    return this.query(query, [productId]);
  }

  // Add variant to product
  async addVariant(productId, variantData) {
    // Validate input
    const validatedData = variantSchema.parse({
      ...variantData,
      product_id: productId
    });
    
    // Check if product exists
    const product = await this.findById(productId);
    if (!product) {
      throw new Error('Product not found');
    }
    
    // Set default values
    const dataToInsert = {
      ...validatedData,
      is_default: validatedData.is_default || false
    };
    
    // If this is the first variant, make it default
    const variants = await this.query('SELECT id FROM product_variants WHERE product_id = ?', [productId]);
    if (variants.length === 0) {
      dataToInsert.is_default = true;
    } else if (dataToInsert.is_default) {
      // If setting as default, unset any existing default
      await this.query(
        'UPDATE product_variants SET is_default = 0 WHERE product_id = ?',
        [productId]
      );
    }
    
    // Insert variant
    const [result] = await this.query(
      'INSERT INTO product_variants SET ?',
      [dataToInsert]
    );
    
    // Get the full variant data
    const [variant] = await this.query(
      'SELECT * FROM product_variants WHERE id = ?',
      [result.insertId]
    );
    
    return variant;
  }

  // Update variant
  async updateVariant(variantId, updates) {
    // Validate input
    const validatedUpdates = variantSchema.partial().parse(updates);
    
    // If setting as default, unset any existing default for this product
    if (validatedUpdates.is_default) {
      const [variant] = await this.query(
        'SELECT product_id FROM product_variants WHERE id = ?',
        [variantId]
      );
      
      if (variant) {
        await this.query(
          'UPDATE product_variants SET is_default = 0 WHERE product_id = ? AND id != ?',
          [variant.product_id, variantId]
        );
      }
    }
    
    // Update variant
    await this.query(
      'UPDATE product_variants SET ? WHERE id = ?',
      [validatedUpdates, variantId]
    );
    
    // Return updated variant
    const [updated] = await this.query(
      'SELECT * FROM product_variants WHERE id = ?',
      [variantId]
    );
    
    return updated;
  }

  // Delete variant
  async deleteVariant(variantId) {
    // Check if this is the last variant
    const [variant] = await this.query(
      'SELECT * FROM product_variants WHERE id = ?',
      [variantId]
    );
    
    if (!variant) {
      throw new Error('Variant not found');
    }
    
    // Check if this is the default variant
    if (variant.is_default) {
      const variants = await this.query(
        'SELECT id FROM product_variants WHERE product_id = ? AND id != ?',
        [variant.product_id, variantId]
      );
      
      if (variants.length > 0) {
        // Set another variant as default
        await this.query(
          'UPDATE product_variants SET is_default = 1 WHERE id = ?',
          [variants[0].id]
        );
      }
    }
    
    // Delete the variant
    await this.query('DELETE FROM product_variants WHERE id = ?', [variantId]);
    
    return { id: variantId };
  }
}

module.exports = new ProductController();
