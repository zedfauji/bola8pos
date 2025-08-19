const BaseController = require('./base.controller');
const { inventoryAdjustmentSchema } = require('../../validators/inventory.validator');

class InventoryController extends BaseController {
  constructor() {
    super('inventory');
  }

  // Get current inventory for a location
  async getByLocation(locationId, includeInactive = false) {
    let query = `
      SELECT 
        i.*,
        p.name as product_name,
        p.sku as product_sku,
        p.barcode as product_barcode,
        p.cost_price as product_cost_price,
        p.selling_price as product_selling_price,
        p.is_active as product_active,
        p.is_ingredient as product_ingredient,
        p.is_composite as product_composite,
        pv.id as variant_id,
        pv.name as variant_name,
        pv.sku as variant_sku,
        pv.barcode as variant_barcode,
        pv.unit_quantity,
        pv.cost_price as variant_cost_price,
        pv.selling_price as variant_selling_price,
        pv.is_default,
        u.symbol as unit_symbol
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      LEFT JOIN product_variants pv ON i.variant_id = pv.id
      LEFT JOIN units u ON COALESCE(pv.unit_id, p.unit_id) = u.id
      WHERE i.location_id = ?
    `;
    
    const params = [locationId];
    
    if (!includeInactive) {
      query += ' AND p.is_active = 1';
    }
    
    query += ' ORDER BY p.name, pv.unit_quantity';
    
    return this.query(query, params);
  }

  // Get inventory for a specific product/variant at a location
  async getByProduct(productId, variantId = null, locationId = null) {
    let query = `
      SELECT 
        i.*,
        l.name as location_name,
        l.type as location_type,
        p.name as product_name,
        pv.name as variant_name,
        u.symbol as unit_symbol
      FROM inventory i
      JOIN locations l ON i.location_id = l.id
      JOIN products p ON i.product_id = p.id
      LEFT JOIN product_variants pv ON i.variant_id = pv.id
      LEFT JOIN units u ON COALESCE(pv.unit_id, p.unit_id) = u.id
      WHERE i.product_id = ?
    `;
    
    const params = [productId];
    
    if (variantId) {
      query += ' AND i.variant_id = ?';
      params.push(variantId);
    }
    
    if (locationId) {
      query += ' AND i.location_id = ?';
      params.push(locationId);
    }
    
    return this.query(query, params);
  }

  // Adjust inventory (add/remove stock)
  async adjustInventory(adjustmentData, userId) {
    // Validate input
    const { product_id, variant_id, location_id, quantity, reference_type, reference_id, notes } = 
      inventoryAdjustmentSchema.parse(adjustmentData);
    
    // Get current inventory
    let [inventory] = await this.query(
      'SELECT * FROM inventory WHERE product_id = ? AND location_id = ? AND (variant_id = ? OR (variant_id IS NULL AND ? IS NULL))',
      [product_id, location_id, variant_id || null, variant_id || null]
    );
    
    // Start transaction
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    
    try {
      let newQuantity = 0;
      
      if (inventory) {
        // Update existing inventory
        newQuantity = parseFloat(inventory.quantity) + parseFloat(quantity);
        if (newQuantity < 0) {
          throw new Error('Insufficient stock');
        }
        
        await conn.query(
          'UPDATE inventory SET quantity = ?, last_counted_at = CURRENT_TIMESTAMP WHERE id = ?',
          [newQuantity, inventory.id]
        );
      } else {
        // Create new inventory record if it doesn't exist
        if (quantity < 0) {
          throw new Error('Cannot have negative inventory');
        }
        
        newQuantity = quantity;
        
        await conn.query(
          'INSERT INTO inventory (product_id, variant_id, location_id, quantity, last_counted_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
          [product_id, variant_id || null, location_id, quantity]
        );
        
        inventory = { id: result.insertId };
      }
      
      // Log the transaction
      await conn.query(
        `INSERT INTO inventory_transactions (
          transaction_type, 
          reference_id, 
          reference_type, 
          product_id, 
          variant_id, 
          from_location_id, 
          to_location_id, 
          quantity, 
          unit_cost,
          notes,
          created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          quantity >= 0 ? 'adjustment_in' : 'adjustment_out',
          reference_id,
          reference_type,
          product_id,
          variant_id || null,
          quantity >= 0 ? null : location_id,
          quantity >= 0 ? location_id : null,
          Math.abs(quantity),
          0, // TODO: Get actual cost
          notes,
          userId
        ]
      );
      
      // Commit transaction
      await conn.commit();
      
      // Return updated inventory
      return this.queryOne(
        'SELECT * FROM inventory WHERE id = ?',
        [inventory.id]
      );
    } catch (error) {
      // Rollback on error
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  // Transfer inventory between locations
  async transferInventory(transferData, userId) {
    const { product_id, variant_id, from_location_id, to_location_id, quantity, notes } = transferData;
    
    if (from_location_id === to_location_id) {
      throw new Error('Source and destination locations cannot be the same');
    }
    
    // Start transaction
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    
    try {
      // Check source inventory
      const [sourceInventory] = await conn.query(
        'SELECT * FROM inventory WHERE product_id = ? AND location_id = ? AND (variant_id = ? OR (variant_id IS NULL AND ? IS NULL)) FOR UPDATE',
        [product_id, from_location_id, variant_id || null, variant_id || null]
      );
      
      if (!sourceInventory || parseFloat(sourceInventory.quantity) < quantity) {
        throw new Error('Insufficient stock in source location');
      }
      
      // Get or create destination inventory
      let [destInventory] = await conn.query(
        'SELECT * FROM inventory WHERE product_id = ? AND location_id = ? AND (variant_id = ? OR (variant_id IS NULL AND ? IS NULL)) FOR UPDATE',
        [product_id, to_location_id, variant_id || null, variant_id || null]
      );
      
      // Update source inventory
      await conn.query(
        'UPDATE inventory SET quantity = quantity - ? WHERE id = ?',
        [quantity, sourceInventory.id]
      );
      
      // Update or create destination inventory
      if (destInventory) {
        await conn.query(
          'UPDATE inventory SET quantity = quantity + ? WHERE id = ?',
          [quantity, destInventory.id]
        );
      } else {
        await conn.query(
          'INSERT INTO inventory (product_id, variant_id, location_id, quantity) VALUES (?, ?, ?, ?)',
          [product_id, variant_id || null, to_location_id, quantity]
        );
      }
      
      // Log the transfer
      await conn.query(
        `INSERT INTO inventory_transactions (
          transaction_type,
          product_id,
          variant_id,
          from_location_id,
          to_location_id,
          quantity,
          unit_cost,
          notes,
          created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'transfer',
          product_id,
          variant_id || null,
          from_location_id,
          to_location_id,
          quantity,
          0, // TODO: Get actual cost
          notes,
          userId
        ]
      );
      
      // Commit transaction
      await conn.commit();
      
      return {
        success: true,
        from_location: {
          id: from_location_id,
          new_quantity: parseFloat(sourceInventory.quantity) - parseFloat(quantity)
        },
        to_location: {
          id: to_location_id,
          new_quantity: destInventory 
            ? parseFloat(destInventory.quantity) + parseFloat(quantity)
            : parseFloat(quantity)
        }
      };
    } catch (error) {
      // Rollback on error
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  // Get inventory history for a product/variant
  async getHistory(productId, variantId = null, locationId = null, limit = 100, offset = 0) {
    let query = `
      SELECT 
        t.*,
        p.name as product_name,
        pv.name as variant_name,
        lf.name as from_location_name,
        lt.name as to_location_name
      FROM inventory_transactions t
      JOIN products p ON t.product_id = p.id
      LEFT JOIN product_variants pv ON t.variant_id = pv.id
      LEFT JOIN locations lf ON t.from_location_id = lf.id
      LEFT JOIN locations lt ON t.to_location_id = lt.id
      WHERE t.product_id = ?
    `;
    
    const params = [productId];
    
    if (variantId) {
      query += ' AND t.variant_id = ?';
      params.push(variantId);
    }
    
    if (locationId) {
      query += ' AND (t.from_location_id = ? OR t.to_location_id = ?)';
      params.push(locationId, locationId);
    }
    
    query += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    return this.query(query, params);
  }
  
  // Get low stock items across all locations
  async getLowStock(threshold = 10) {
    const query = `
      SELECT 
        i.*,
        p.name as product_name,
        p.sku as product_sku,
        p.min_stock_level,
        pv.name as variant_name,
        pv.sku as variant_sku,
        l.name as location_name,
        l.type as location_type,
        u.symbol as unit_symbol
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      LEFT JOIN product_variants pv ON i.variant_id = pv.id
      JOIN locations l ON i.location_id = l.id
      LEFT JOIN units u ON COALESCE(pv.unit_id, p.unit_id) = u.id
      WHERE i.quantity <= ?
        AND p.is_active = 1
      ORDER BY i.quantity / NULLIF(p.min_stock_level, 0) ASC, p.name
    `;
    
    return this.query(query, [threshold]);
  }
}

module.exports = new InventoryController();
