const BaseController = require('./base.controller');
const { purchaseOrderSchema } = require('../../validators/inventory.validator');
const inventoryController = require('./inventory.controller');
const { pool } = require('../../db');

class PurchaseOrderController extends BaseController {
  constructor() {
    super('purchase_orders');
  }

  // Create a new purchase order with items
  async createWithItems(orderData, userId) {
    // Validate input
    const { items, ...order } = purchaseOrderSchema.parse(orderData);
    
    // Start transaction
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    
    try {
      // Ensure we have an ID if table requires it (no default)
      const generatedId = order.id || `po_${Date.now()}`;
      // Normalize fields
      const po_number = order.po_number;
      const supplier_id = order.supplier_id;
      const order_date = order.order_date;
      const expected_delivery_date = order.expected_delivery_date || null;
      const notes = order.notes || null;
      const status = 'draft';

      // Create the purchase order with explicit columns
      await conn.query(
        `INSERT INTO purchase_orders 
          (id, po_number, supplier_id, order_date, expected_delivery_date, status, notes, created_by)
         VALUES (?,?,?,?,?,?,?,?)`,
        [
          generatedId,
          po_number,
          supplier_id,
          order_date,
          expected_delivery_date,
          status,
          notes,
          userId
        ]
      );

      const poId = generatedId;
      
      // Add items to the purchase order
      for (const item of items) {
        await conn.query(
          'INSERT INTO purchase_order_items (po_id, product_id, variant_id, quantity_ordered, unit_cost, tax_rate, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            poId,
            item.product_id,
            item.variant_id || null,
            item.quantity_ordered,
            item.unit_cost,
            item.tax_rate || 0,
            item.notes || ''
          ]
        );
      }
      
      // Commit transaction
      await conn.commit();
      
      // Return the complete purchase order
      return this.getByIdWithItems(poId);
    } catch (error) {
      // Rollback on error
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  // Get purchase order with items
  async getByIdWithItems(poId) {
    const [order] = await this.query(
      'SELECT * FROM purchase_orders WHERE id = ?',
      [poId]
    );
    
    if (!order) {
      return null;
    }
    
    const items = await this.query(
      `SELECT 
        poi.*,
        p.name as product_name,
        p.sku as product_sku,
        pv.name as variant_name,
        pv.sku as variant_sku
      FROM purchase_order_items poi
      JOIN products p ON poi.product_id = p.id
      LEFT JOIN product_variants pv ON poi.variant_id = pv.id
      WHERE poi.po_id = ?`,
      [poId]
    );
    
    return { ...order, items };
  }

  // Update purchase order status
  async updateStatus(poId, status, userId) {
    const validStatuses = ['draft', 'pending', 'partially_received', 'completed', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid status');
    }
    
    const [order] = await this.query(
      'SELECT * FROM purchase_orders WHERE id = ?',
      [poId]
    );
    
    if (!order) {
      throw new Error('Purchase order not found');
    }
    
    // Handle status transitions
    if (status === 'cancelled' && order.status === 'completed') {
      throw new Error('Cannot cancel a completed order');
    }
    
    // Update status
    await this.query(
      'UPDATE purchase_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, poId]
    );
    
    // Log the status change
    await this.query(
      'INSERT INTO purchase_order_history (po_id, status, notes, created_by) VALUES (?, ?, ?, ?)',
      [poId, status, `Status changed to ${status}`, userId]
    );
    
    return this.getByIdWithItems(poId);
  }

  // Receive items from a purchase order
  async receiveItems(poId, items, locationId, userId, notes = '') {
    // Start transaction
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    
    try {
      // Get the purchase order with items
      const po = await this.getByIdWithItems(poId);
      
      if (!po) {
        throw new Error('Purchase order not found');
      }
      
      if (po.status === 'cancelled') {
        throw new Error('Cannot receive items for a cancelled order');
      }
      
      // Process each item being received
      for (const receivedItem of items) {
        const poItem = po.items.find(item => item.id === receivedItem.po_item_id);
        
        if (!poItem) {
          throw new Error(`Item ${receivedItem.po_item_id} not found in purchase order`);
        }
        
        const quantityReceived = parseFloat(receivedItem.quantity_received);
        const quantityRemaining = parseFloat(poItem.quantity_ordered) - parseFloat(poItem.quantity_received || 0);
        
        if (quantityReceived > quantityRemaining) {
          throw new Error(`Cannot receive more than the remaining quantity for item ${poItem.id}`);
        }
        
        // Update the received quantity
        await conn.query(
          'UPDATE purchase_order_items SET quantity_received = COALESCE(quantity_received, 0) + ? WHERE id = ?',
          [quantityReceived, poItem.id]
        );
        
        // Add to inventory and log purchase transaction if location is provided
        if (locationId) {
          // Lock existing inventory row if any
          const [invRows] = await conn.query(
            `SELECT id, quantity FROM inventory
             WHERE product_id = ? AND location_id = ? AND (variant_id = ? OR (variant_id IS NULL AND ? IS NULL))
             FOR UPDATE`,
            [poItem.product_id, locationId, poItem.variant_id || null, poItem.variant_id || null]
          );
          if (invRows.length > 0) {
            await conn.query(
              `UPDATE inventory SET quantity = quantity + ?, last_counted_at = CURRENT_TIMESTAMP WHERE id = ?`,
              [quantityReceived, invRows[0].id]
            );
          } else {
            await conn.query(
              `INSERT INTO inventory (product_id, variant_id, location_id, quantity, last_counted_at)
               VALUES (?,?,?,?, CURRENT_TIMESTAMP)`,
              [poItem.product_id, poItem.variant_id || null, locationId, quantityReceived]
            );
          }
          // Log purchase transaction with unit cost
          await conn.query(
            `INSERT INTO inventory_transactions (
               transaction_type, reference_id, reference_type, product_id, variant_id,
               from_location_id, to_location_id, quantity, unit_cost, notes, created_by
             ) VALUES ('purchase', ?, 'purchase_order', ?, ?, NULL, ?, ?, ?, ?, ?)`,
            [poId, poItem.product_id, poItem.variant_id || null, locationId, quantityReceived, poItem.unit_cost || 0, `PO receive #${poId}`, userId]
          );
          // Optionally update product last cost
          if (poItem.unit_cost && poItem.unit_cost > 0) {
            await conn.query(`UPDATE products SET cost_price = ? WHERE id = ?`, [poItem.unit_cost, poItem.product_id]);
          }
        }
      }
      
      // Update PO status based on received quantities
      const [result] = await conn.query(
        `SELECT 
          COUNT(*) as total_items,
          SUM(IF(quantity_ordered <= quantity_received, 1, 0)) as completed_items,
          SUM(IF(quantity_received > 0 AND quantity_received < quantity_ordered, 1, 0)) as partial_items
        FROM purchase_order_items 
        WHERE po_id = ?`,
        [poId]
      );
      
      let newStatus = po.status;
      
      if (result[0].completed_items === result[0].total_items) {
        newStatus = 'completed';
      } else if (result[0].completed_items > 0 || result[0].partial_items > 0) {
        newStatus = 'partially_received';
      }
      
      if (newStatus !== po.status) {
        await conn.query(
          'UPDATE purchase_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [newStatus, poId]
        );
        
        // Log the status change
        await conn.query(
          'INSERT INTO purchase_order_history (po_id, status, notes, created_by) VALUES (?, ?, ?, ?)',
          [poId, newStatus, 'Status updated after receiving items', userId]
        );
      }
      
      // Commit transaction
      await conn.commit();
      
      // Return the updated purchase order
      return this.getByIdWithItems(poId);
    } catch (error) {
      // Rollback on error
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  // Get purchase orders by status
  async getByStatus(status, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    
    let whereClause = '';
    const params = [];
    
    if (status) {
      whereClause = 'WHERE status = ?';
      params.push(status);
    }
    
    const [orders] = await this.query(
      `SELECT * FROM purchase_orders 
       ${whereClause}
       ORDER BY order_date DESC, id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    
    // Get item counts for each order
    for (const order of orders) {
      const [itemCount] = await this.query(
        'SELECT COUNT(*) as count FROM purchase_order_items WHERE po_id = ?',
        [order.id]
      );
      order.item_count = itemCount.count;
    }
    
    return orders;
  }

  // Get purchase order history
  async getHistory(poId) {
    return this.query(
      'SELECT * FROM purchase_order_history WHERE po_id = ? ORDER BY created_at DESC',
      [poId]
    );
  }

  // Get purchase orders by supplier
  async getBySupplier(supplierId, status = null, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE supplier_id = ?';
    const params = [supplierId];
    
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    
    return this.query(
      `SELECT * FROM purchase_orders 
       ${whereClause}
       ORDER BY order_date DESC, id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
  }
}

module.exports = new PurchaseOrderController();
