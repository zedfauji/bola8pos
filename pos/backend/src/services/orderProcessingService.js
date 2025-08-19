/**
 * Order Processing Service
 * Handles order operations with transaction support for inventory synchronization
 */
const { pool } = require('../db');
const { createError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Process a new order with inventory synchronization
 * @param {Object} orderData - Order data
 * @param {Array} orderData.items - Order items
 * @param {String} userId - User ID who created the order
 * @returns {Object} Created order with processed items
 */
async function createOrder(orderData, userId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    // 1. Create the order
    const [orderResult] = await conn.query(
      `INSERT INTO orders (
        user_id, table_id, status, notes, discount_amount, 
        discount_type, discount_reason, total_amount, payment_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        orderData.tableId || null,
        'pending',
        orderData.notes || '',
        orderData.discountAmount || 0,
        orderData.discountType || null,
        orderData.discountReason || null,
        orderData.totalAmount || 0,
        'unpaid'
      ]
    );
    
    const orderId = orderResult.insertId;
    
    // 2. Process each order item and check inventory
    for (const item of orderData.items) {
      // Check if this menu item has inventory mappings
      const [mappings] = await conn.query(
        `SELECT * FROM menu_item_product_map WHERE menu_item_id = ?`,
        [item.menuItemId]
      );
      
      // If no mappings, just add the item without inventory checks
      if (!mappings || mappings.length === 0) {
        await conn.query(
          `INSERT INTO order_items (
            order_id, menu_item_id, quantity, unit_price, 
            notes, discount_amount, total_amount
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            item.menuItemId,
            item.quantity,
            item.unitPrice,
            item.notes || '',
            item.discountAmount || 0,
            item.totalAmount
          ]
        );
        continue;
      }
      
      // Process each inventory mapping for this menu item
      for (const mapping of mappings) {
        const requiredQty = mapping.qty_per_item * item.quantity;
        
        // Check inventory availability
        const [inventoryItems] = await conn.query(
          `SELECT * FROM inventory 
           WHERE product_id = ? 
           AND (variant_id = ? OR (variant_id IS NULL AND ? IS NULL))
           AND location_id = ?
           FOR UPDATE`,
          [
            mapping.product_id,
            mapping.variant_id || null,
            mapping.variant_id || null,
            orderData.locationId || 1 // Default to main location if not specified
          ]
        );
        
        const inventoryItem = inventoryItems[0];
        
        // If no inventory record or insufficient stock
        if (!inventoryItem || parseFloat(inventoryItem.quantity) < requiredQty) {
          await conn.rollback();
          throw createError(400, `Insufficient inventory for product ID ${mapping.product_id}${mapping.variant_id ? `, variant ${mapping.variant_id}` : ''}`);
        }
      }
      
      // Add the order item after inventory check passes
      await conn.query(
        `INSERT INTO order_items (
          order_id, menu_item_id, quantity, unit_price, 
          notes, discount_amount, total_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          item.menuItemId,
          item.quantity,
          item.unitPrice,
          item.notes || '',
          item.discountAmount || 0,
          item.totalAmount
        ]
      );
    }
    
    // 3. Commit the transaction
    await conn.commit();
    
    // 4. Fetch the complete order with items
    const [order] = await pool.query(
      `SELECT * FROM orders WHERE id = ?`,
      [orderId]
    );
    
    const [orderItems] = await pool.query(
      `SELECT * FROM order_items WHERE order_id = ?`,
      [orderId]
    );
    
    return {
      ...order[0],
      items: orderItems
    };
  } catch (error) {
    await conn.rollback();
    logger.error('Error creating order with transaction:', error);
    throw error;
  } finally {
    conn.release();
  }
}

/**
 * Complete an order and update inventory
 * @param {Number} orderId - Order ID to complete
 * @param {String} userId - User ID who completed the order
 * @returns {Object} Updated order
 */
async function completeOrder(orderId, userId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    // 1. Get the order and its items
    const [orders] = await conn.query(
      `SELECT * FROM orders WHERE id = ? FOR UPDATE`,
      [orderId]
    );
    
    if (!orders || orders.length === 0) {
      throw createError(404, 'Order not found');
    }
    
    const order = orders[0];
    
    if (order.status === 'completed') {
      throw createError(400, 'Order already completed');
    }
    
    const [orderItems] = await conn.query(
      `SELECT oi.*, mi.name as item_name 
       FROM order_items oi
       JOIN menu_items mi ON oi.menu_item_id = mi.id
       WHERE oi.order_id = ?`,
      [orderId]
    );
    
    // 2. Update inventory for each item
    for (const item of orderItems) {
      // Get inventory mappings for this menu item
      const [mappings] = await conn.query(
        `SELECT * FROM menu_item_product_map WHERE menu_item_id = ?`,
        [item.menu_item_id]
      );
      
      // Skip if no inventory mappings
      if (!mappings || mappings.length === 0) {
        continue;
      }
      
      // Process each inventory mapping
      for (const mapping of mappings) {
        const deductQty = mapping.qty_per_item * item.quantity;
        
        // Update inventory
        const [updateResult] = await conn.query(
          `UPDATE inventory 
           SET quantity = quantity - ?, 
               last_updated_at = CURRENT_TIMESTAMP 
           WHERE product_id = ? 
           AND (variant_id = ? OR (variant_id IS NULL AND ? IS NULL))
           AND location_id = ?
           AND quantity >= ?`,
          [
            deductQty,
            mapping.product_id,
            mapping.variant_id || null,
            mapping.variant_id || null,
            order.location_id || 1, // Default to main location
            deductQty
          ]
        );
        
        if (updateResult.affectedRows === 0) {
          await conn.rollback();
          throw createError(400, `Insufficient inventory for product ID ${mapping.product_id}${mapping.variant_id ? `, variant ${mapping.variant_id}` : ''}`);
        }
        
        // Log inventory transaction
        await conn.query(
          `INSERT INTO inventory_transactions (
            transaction_type, reference_id, reference_type,
            product_id, variant_id, from_location_id,
            quantity, unit_cost, notes, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            'order_fulfillment',
            orderId,
            'order',
            mapping.product_id,
            mapping.variant_id || null,
            order.location_id || 1,
            deductQty,
            0, // TODO: Get actual cost
            `Order #${orderId} - ${item.item_name}`,
            userId
          ]
        );
      }
    }
    
    // 3. Update order status
    await conn.query(
      `UPDATE orders 
       SET status = 'completed', 
           completed_at = CURRENT_TIMESTAMP,
           completed_by = ?
       WHERE id = ?`,
      [userId, orderId]
    );
    
    // 4. Commit the transaction
    await conn.commit();
    
    // 5. Fetch the updated order
    const [updatedOrder] = await pool.query(
      `SELECT * FROM orders WHERE id = ?`,
      [orderId]
    );
    
    return updatedOrder[0];
  } catch (error) {
    await conn.rollback();
    logger.error('Error completing order with transaction:', error);
    throw error;
  } finally {
    conn.release();
  }
}

/**
 * Cancel an order and restore inventory if needed
 * @param {Number} orderId - Order ID to cancel
 * @param {String} userId - User ID who cancelled the order
 * @param {String} reason - Cancellation reason
 * @returns {Object} Updated order
 */
async function cancelOrder(orderId, userId, reason = '') {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    // 1. Get the order and its items
    const [orders] = await conn.query(
      `SELECT * FROM orders WHERE id = ? FOR UPDATE`,
      [orderId]
    );
    
    if (!orders || orders.length === 0) {
      throw createError(404, 'Order not found');
    }
    
    const order = orders[0];
    
    if (order.status === 'cancelled') {
      throw createError(400, 'Order already cancelled');
    }
    
    // Only restore inventory if the order was completed
    if (order.status === 'completed') {
      const [orderItems] = await conn.query(
        `SELECT oi.*, mi.name as item_name 
         FROM order_items oi
         JOIN menu_items mi ON oi.menu_item_id = mi.id
         WHERE oi.order_id = ?`,
        [orderId]
      );
      
      // Restore inventory for each item
      for (const item of orderItems) {
        // Get inventory mappings for this menu item
        const [mappings] = await conn.query(
          `SELECT * FROM menu_item_product_map WHERE menu_item_id = ?`,
          [item.menu_item_id]
        );
        
        // Skip if no inventory mappings
        if (!mappings || mappings.length === 0) {
          continue;
        }
        
        // Process each inventory mapping
        for (const mapping of mappings) {
          const restoreQty = mapping.qty_per_item * item.quantity;
          
          // Update inventory
          await conn.query(
            `UPDATE inventory 
             SET quantity = quantity + ?, 
                 last_updated_at = CURRENT_TIMESTAMP 
             WHERE product_id = ? 
             AND (variant_id = ? OR (variant_id IS NULL AND ? IS NULL))
             AND location_id = ?`,
            [
              restoreQty,
              mapping.product_id,
              mapping.variant_id || null,
              mapping.variant_id || null,
              order.location_id || 1 // Default to main location
            ]
          );
          
          // Log inventory transaction
          await conn.query(
            `INSERT INTO inventory_transactions (
              transaction_type, reference_id, reference_type,
              product_id, variant_id, to_location_id,
              quantity, unit_cost, notes, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              'order_cancellation',
              orderId,
              'order',
              mapping.product_id,
              mapping.variant_id || null,
              order.location_id || 1,
              restoreQty,
              0, // TODO: Get actual cost
              `Cancelled Order #${orderId} - ${item.item_name}`,
              userId
            ]
          );
        }
      }
    }
    
    // 2. Update order status
    await conn.query(
      `UPDATE orders 
       SET status = 'cancelled', 
           cancelled_at = CURRENT_TIMESTAMP,
           cancelled_by = ?,
           cancellation_reason = ?
       WHERE id = ?`,
      [userId, reason, orderId]
    );
    
    // 3. Commit the transaction
    await conn.commit();
    
    // 4. Fetch the updated order
    const [updatedOrder] = await pool.query(
      `SELECT * FROM orders WHERE id = ?`,
      [orderId]
    );
    
    return updatedOrder[0];
  } catch (error) {
    await conn.rollback();
    logger.error('Error cancelling order with transaction:', error);
    throw error;
  } finally {
    conn.release();
  }
}

module.exports = {
  createOrder,
  completeOrder,
  cancelOrder
};
