/**
 * Order Controller
 * Handles order-related operations with transaction support
 */
const orderService = require('../services/orderProcessingService');
const { ValidationError, NotFoundError } = require('../utils/errors');
const logger = require('../utils/logger');
const { pool } = require('../db');
const { auditLog } = require('../utils/auditLogger');
const socketService = require('../services/socketService');

/**
 * Create a new order with inventory validation
 */
async function createOrder(req, res, next) {
  try {
    // Validate request body
    if (!req.body.items || !Array.isArray(req.body.items) || req.body.items.length === 0) {
      throw new ValidationError('Order must contain at least one item');
    }
    
    // Process the order with transaction support
    const order = await orderService.createOrder(req.body, req.user.id);
    
    // Log the action
    await auditLog({
      action: 'order_created',
      userId: req.user.id,
      resourceType: 'order',
      resourceId: order.id,
      metadata: {
        tableId: order.table_id,
        itemCount: order.items.length,
        totalAmount: order.total_amount
      }
    });
    
    // Emit real-time events
    socketService.emitToAll('order:created', {
      id: order.id,
      tableId: order.table_id,
      status: order.status,
      totalAmount: order.total_amount,
      createdAt: order.created_at
    });
    
    // Emit to specific room if table is assigned
    if (order.table_id) {
      socketService.emitToRoom(`table:${order.table_id}`, 'table:order:created', {
        orderId: order.id,
        tableId: order.table_id
      });
    }
    
    // Return success response
    return res.created(order, 'Order created successfully');
  } catch (error) {
    logger.error('Error creating order:', error);
    next(error);
  }
}

/**
 * Complete an order and update inventory
 */
async function completeOrder(req, res, next) {
  try {
    const orderId = parseInt(req.params.id);
    if (isNaN(orderId)) {
      throw new ValidationError('Invalid order ID');
    }
    
    // Complete the order with transaction support
    const order = await orderService.completeOrder(orderId, req.user.id);
    
    // Log the action
    await auditLog({
      action: 'order_completed',
      userId: req.user.id,
      resourceType: 'order',
      resourceId: order.id,
      metadata: {
        tableId: order.table_id,
        totalAmount: order.total_amount
      }
    });
    
    // Emit real-time events
    socketService.emitToAll('order:completed', {
      id: order.id,
      tableId: order.table_id,
      status: order.status,
      totalAmount: order.total_amount,
      completedAt: order.completed_at
    });
    
    // Emit to specific room if table is assigned
    if (order.table_id) {
      socketService.emitToRoom(`table:${order.table_id}`, 'table:order:completed', {
        orderId: order.id,
        tableId: order.table_id
      });
    }
    
    // Return success response
    return res.success(order, 'Order completed successfully');
  } catch (error) {
    logger.error('Error completing order:', error);
    next(error);
  }
}

/**
 * Cancel an order and restore inventory if needed
 */
async function cancelOrder(req, res, next) {
  try {
    const orderId = parseInt(req.params.id);
    if (isNaN(orderId)) {
      throw new ValidationError('Invalid order ID');
    }
    
    // Validate reason if required by policy
    const { reason } = req.body;
    if (!reason || reason.trim().length === 0) {
      throw new ValidationError('Cancellation reason is required');
    }
    
    // Cancel the order with transaction support
    const order = await orderService.cancelOrder(orderId, req.user.id, reason);
    
    // Log the action
    await auditLog({
      action: 'order_cancelled',
      userId: req.user.id,
      resourceType: 'order',
      resourceId: order.id,
      metadata: {
        reason,
        tableId: order.table_id,
        totalAmount: order.total_amount
      }
    });
    
    // Emit real-time events
    socketService.emitToAll('order:cancelled', {
      id: order.id,
      tableId: order.table_id,
      status: order.status,
      totalAmount: order.total_amount,
      cancelledAt: order.cancelled_at,
      reason: reason
    });
    
    // Emit to specific room if table is assigned
    if (order.table_id) {
      socketService.emitToRoom(`table:${order.table_id}`, 'table:order:cancelled', {
        orderId: order.id,
        tableId: order.table_id,
        reason: reason
      });
    }
    
    // Return success response
    return res.success(order, 'Order cancelled successfully');
  } catch (error) {
    logger.error('Error cancelling order:', error);
    next(error);
  }
}

/**
 * Get order by ID
 */
async function getOrderById(req, res, next) {
  try {
    const orderId = parseInt(req.params.id);
    if (isNaN(orderId)) {
      throw new ValidationError('Invalid order ID');
    }
    
    // Get order from database
    const [orders] = await pool.query(
      `SELECT * FROM orders WHERE id = ?`,
      [orderId]
    );
    
    if (!orders || orders.length === 0) {
      throw new NotFoundError('Order', orderId);
    }
    
    const order = orders[0];
    
    // Get order items
    const [orderItems] = await pool.query(
      `SELECT oi.*, mi.name as item_name 
       FROM order_items oi
       JOIN menu_items mi ON oi.menu_item_id = mi.id
       WHERE oi.order_id = ?`,
      [orderId]
    );
    
    order.items = orderItems;
    
    // Return success response
    return res.success(order);
  } catch (error) {
    logger.error('Error getting order:', error);
    next(error);
  }
}

/**
 * List orders with pagination and filters
 */
async function listOrders(req, res, next) {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      startDate, 
      endDate, 
      tableId,
      userId
    } = req.query;
    
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT o.*, u.username as created_by_name, 
             cu.username as completed_by_name,
             ca.username as cancelled_by_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN users cu ON o.completed_by = cu.id
      LEFT JOIN users ca ON o.cancelled_by = ca.id
      WHERE 1=1
    `;
    
    const params = [];
    
    // Apply filters
    if (status) {
      query += ` AND o.status = ?`;
      params.push(status);
    }
    
    if (startDate) {
      query += ` AND o.created_at >= ?`;
      params.push(startDate);
    }
    
    if (endDate) {
      query += ` AND o.created_at <= ?`;
      params.push(endDate);
    }
    
    if (tableId) {
      query += ` AND o.table_id = ?`;
      params.push(tableId);
    }
    
    if (userId) {
      query += ` AND o.user_id = ?`;
      params.push(userId);
    }
    
    // Count total records for pagination
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM orders o WHERE 1=1` + 
      query.substring(query.indexOf('WHERE 1=1') + 9),
      params
    );
    
    const total = countResult[0].total;
    
    // Add pagination
    query += ` ORDER BY o.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);
    
    // Execute query
    const [orders] = await pool.query(query, params);
    
    // Return paginated response
    return res.success({
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error listing orders:', error);
    next(error);
  }
}

module.exports = {
  createOrder,
  completeOrder,
  cancelOrder,
  getOrderById,
  listOrders
};
