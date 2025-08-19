/**
 * Tests for Order Processing Service
 */
const orderService = require('../../services/orderProcessingService');
const { pool } = require('../../db');
const { createError } = require('../../utils/errors');

// Mock the database pool
jest.mock('../../db', () => {
  const mockConnection = {
    beginTransaction: jest.fn().mockResolvedValue(),
    commit: jest.fn().mockResolvedValue(),
    rollback: jest.fn().mockResolvedValue(),
    query: jest.fn(),
    release: jest.fn()
  };
  
  return {
    pool: {
      getConnection: jest.fn().mockResolvedValue(mockConnection),
      query: jest.fn()
    }
  };
});

// Mock the error utilities
jest.mock('../../utils/errors', () => ({
  createError: jest.fn((code, message) => {
    const error = new Error(message);
    error.statusCode = code;
    return error;
  })
}));

// Mock the logger
jest.mock('../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

describe('Order Processing Service', () => {
  let mockConnection;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnection = pool.getConnection();
  });
  
  describe('createOrder', () => {
    const userId = 'user-123';
    const orderData = {
      tableId: 5,
      notes: 'Test order',
      discountAmount: 10,
      discountType: 'percentage',
      discountReason: 'Loyalty discount',
      totalAmount: 100,
      items: [
        {
          menuItemId: 1,
          quantity: 2,
          unitPrice: 25,
          notes: 'No onions',
          discountAmount: 0,
          totalAmount: 50
        },
        {
          menuItemId: 2,
          quantity: 1,
          unitPrice: 50,
          notes: '',
          discountAmount: 0,
          totalAmount: 50
        }
      ]
    };
    
    test('should create an order with transaction support', async () => {
      // Mock database responses
      mockConnection.query
        // Insert order
        .mockResolvedValueOnce([[{ insertId: 123 }]])
        // Check mappings for first item
        .mockResolvedValueOnce([[
          { product_id: 101, variant_id: 201, qty_per_item: 1 }
        ]])
        // Check inventory for first item
        .mockResolvedValueOnce([[
          { product_id: 101, variant_id: 201, quantity: 10 }
        ]])
        // Insert first order item
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        // Check mappings for second item
        .mockResolvedValueOnce([[
          { product_id: 102, variant_id: null, qty_per_item: 2 }
        ]])
        // Check inventory for second item
        .mockResolvedValueOnce([[
          { product_id: 102, variant_id: null, quantity: 5 }
        ]])
        // Insert second order item
        .mockResolvedValueOnce([{ affectedRows: 1 }]);
      
      // Mock pool query for fetching order after commit
      pool.query
        .mockResolvedValueOnce([[{ id: 123, status: 'pending' }]])
        .mockResolvedValueOnce([[
          { id: 1, order_id: 123, menu_item_id: 1 },
          { id: 2, order_id: 123, menu_item_id: 2 }
        ]]);
      
      const result = await orderService.createOrder(orderData, userId);
      
      // Verify transaction was started
      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      
      // Verify order was inserted
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO orders'),
        expect.arrayContaining([userId, 5, 'pending'])
      );
      
      // Verify inventory was checked
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM inventory'),
        expect.arrayContaining([101, 201, 201])
      );
      
      // Verify transaction was committed
      expect(mockConnection.commit).toHaveBeenCalled();
      
      // Verify connection was released
      expect(mockConnection.release).toHaveBeenCalled();
      
      // Verify result structure
      expect(result).toEqual({
        id: 123,
        status: 'pending',
        items: [
          { id: 1, order_id: 123, menu_item_id: 1 },
          { id: 2, order_id: 123, menu_item_id: 2 }
        ]
      });
    });
    
    test('should roll back transaction if inventory check fails', async () => {
      // Mock database responses
      mockConnection.query
        // Insert order
        .mockResolvedValueOnce([[{ insertId: 123 }]])
        // Check mappings for first item
        .mockResolvedValueOnce([[
          { product_id: 101, variant_id: 201, qty_per_item: 1 }
        ]])
        // Check inventory - insufficient quantity
        .mockResolvedValueOnce([[
          { product_id: 101, variant_id: 201, quantity: 0 }
        ]]);
      
      await expect(orderService.createOrder(orderData, userId))
        .rejects
        .toThrow('Insufficient inventory');
      
      // Verify transaction was rolled back
      expect(mockConnection.rollback).toHaveBeenCalled();
      
      // Verify connection was released
      expect(mockConnection.release).toHaveBeenCalled();
    });
    
    test('should handle items without inventory mappings', async () => {
      // Mock database responses for an item without inventory mappings
      mockConnection.query
        // Insert order
        .mockResolvedValueOnce([[{ insertId: 123 }]])
        // Check mappings for item - empty result
        .mockResolvedValueOnce([[]])
        // Insert order item
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        // Check mappings for second item
        .mockResolvedValueOnce([[]])
        // Insert second order item
        .mockResolvedValueOnce([{ affectedRows: 1 }]);
      
      // Mock pool query for fetching order after commit
      pool.query
        .mockResolvedValueOnce([[{ id: 123, status: 'pending' }]])
        .mockResolvedValueOnce([[
          { id: 1, order_id: 123, menu_item_id: 1 },
          { id: 2, order_id: 123, menu_item_id: 2 }
        ]]);
      
      await orderService.createOrder(orderData, userId);
      
      // Verify transaction was committed
      expect(mockConnection.commit).toHaveBeenCalled();
      
      // Verify no inventory checks were performed
      expect(mockConnection.query).not.toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM inventory'),
        expect.anything()
      );
    });
  });
  
  describe('completeOrder', () => {
    const orderId = 123;
    const userId = 'user-123';
    
    test('should complete an order and update inventory', async () => {
      // Mock database responses
      mockConnection.query
        // Get order
        .mockResolvedValueOnce([[
          { id: 123, status: 'pending', location_id: 1 }
        ]])
        // Get order items
        .mockResolvedValueOnce([[
          { menu_item_id: 1, quantity: 2, item_name: 'Burger' },
          { menu_item_id: 2, quantity: 1, item_name: 'Fries' }
        ]])
        // Get mappings for first item
        .mockResolvedValueOnce([[
          { product_id: 101, variant_id: 201, qty_per_item: 1 }
        ]])
        // Update inventory for first item
        .mockResolvedValueOnce([[{ affectedRows: 1 }]])
        // Log inventory transaction for first item
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        // Get mappings for second item
        .mockResolvedValueOnce([[
          { product_id: 102, variant_id: null, qty_per_item: 2 }
        ]])
        // Update inventory for second item
        .mockResolvedValueOnce([[{ affectedRows: 1 }]])
        // Log inventory transaction for second item
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        // Update order status
        .mockResolvedValueOnce([[{ affectedRows: 1 }]]);
      
      // Mock pool query for fetching updated order
      pool.query
        .mockResolvedValueOnce([[
          { id: 123, status: 'completed', completed_at: '2023-01-01T00:00:00.000Z' }
        ]]);
      
      const result = await orderService.completeOrder(orderId, userId);
      
      // Verify transaction was started
      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      
      // Verify order was fetched with FOR UPDATE
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM orders WHERE id = ? FOR UPDATE'),
        [orderId]
      );
      
      // Verify inventory was updated
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE inventory'),
        expect.arrayContaining([1, 101, 201, 201, 1, 1])
      );
      
      // Verify inventory transaction was logged
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO inventory_transactions'),
        expect.arrayContaining(['order_fulfillment', orderId, 'order', 101])
      );
      
      // Verify order status was updated
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE orders SET status = \'completed\''),
        expect.arrayContaining([userId, orderId])
      );
      
      // Verify transaction was committed
      expect(mockConnection.commit).toHaveBeenCalled();
      
      // Verify result
      expect(result).toEqual({
        id: 123,
        status: 'completed',
        completed_at: '2023-01-01T00:00:00.000Z'
      });
    });
    
    test('should throw error if order not found', async () => {
      // Mock empty result for order query
      mockConnection.query.mockResolvedValueOnce([[]]);
      
      await expect(orderService.completeOrder(orderId, userId))
        .rejects
        .toThrow('Order not found');
      
      // Verify transaction was rolled back
      expect(mockConnection.rollback).toHaveBeenCalled();
    });
    
    test('should throw error if order already completed', async () => {
      // Mock already completed order
      mockConnection.query.mockResolvedValueOnce([[
        { id: 123, status: 'completed' }
      ]]);
      
      await expect(orderService.completeOrder(orderId, userId))
        .rejects
        .toThrow('Order already completed');
      
      // Verify transaction was rolled back
      expect(mockConnection.rollback).toHaveBeenCalled();
    });
    
    test('should throw error if insufficient inventory', async () => {
      // Mock database responses
      mockConnection.query
        // Get order
        .mockResolvedValueOnce([[
          { id: 123, status: 'pending', location_id: 1 }
        ]])
        // Get order items
        .mockResolvedValueOnce([[
          { menu_item_id: 1, quantity: 2, item_name: 'Burger' }
        ]])
        // Get mappings for item
        .mockResolvedValueOnce([[
          { product_id: 101, variant_id: 201, qty_per_item: 1 }
        ]])
        // Update inventory - no rows affected (insufficient quantity)
        .mockResolvedValueOnce([[{ affectedRows: 0 }]]);
      
      await expect(orderService.completeOrder(orderId, userId))
        .rejects
        .toThrow('Insufficient inventory');
      
      // Verify transaction was rolled back
      expect(mockConnection.rollback).toHaveBeenCalled();
    });
  });
  
  describe('cancelOrder', () => {
    const orderId = 123;
    const userId = 'user-123';
    const reason = 'Customer request';
    
    test('should cancel a pending order without inventory restoration', async () => {
      // Mock database responses
      mockConnection.query
        // Get order - pending status
        .mockResolvedValueOnce([[
          { id: 123, status: 'pending', location_id: 1 }
        ]])
        // Update order status
        .mockResolvedValueOnce([[{ affectedRows: 1 }]]);
      
      // Mock pool query for fetching updated order
      pool.query
        .mockResolvedValueOnce([[
          { id: 123, status: 'cancelled', cancelled_at: '2023-01-01T00:00:00.000Z' }
        ]]);
      
      const result = await orderService.cancelOrder(orderId, userId, reason);
      
      // Verify transaction was started
      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      
      // Verify order status was updated
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE orders SET status = \'cancelled\''),
        expect.arrayContaining([userId, reason, orderId])
      );
      
      // Verify no inventory operations were performed
      expect(mockConnection.query).not.toHaveBeenCalledWith(
        expect.stringContaining('UPDATE inventory'),
        expect.anything()
      );
      
      // Verify transaction was committed
      expect(mockConnection.commit).toHaveBeenCalled();
      
      // Verify result
      expect(result).toEqual({
        id: 123,
        status: 'cancelled',
        cancelled_at: '2023-01-01T00:00:00.000Z'
      });
    });
    
    test('should cancel a completed order and restore inventory', async () => {
      // Mock database responses
      mockConnection.query
        // Get order - completed status
        .mockResolvedValueOnce([[
          { id: 123, status: 'completed', location_id: 1 }
        ]])
        // Get order items
        .mockResolvedValueOnce([[
          { menu_item_id: 1, quantity: 2, item_name: 'Burger' }
        ]])
        // Get mappings for item
        .mockResolvedValueOnce([[
          { product_id: 101, variant_id: 201, qty_per_item: 1 }
        ]])
        // Update inventory to restore quantity
        .mockResolvedValueOnce([[{ affectedRows: 1 }]])
        // Log inventory transaction
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        // Update order status
        .mockResolvedValueOnce([[{ affectedRows: 1 }]]);
      
      // Mock pool query for fetching updated order
      pool.query
        .mockResolvedValueOnce([[
          { id: 123, status: 'cancelled', cancelled_at: '2023-01-01T00:00:00.000Z' }
        ]]);
      
      const result = await orderService.cancelOrder(orderId, userId, reason);
      
      // Verify inventory was restored
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE inventory SET quantity = quantity + ?'),
        expect.arrayContaining([2, 101, 201, 201, 1])
      );
      
      // Verify inventory transaction was logged
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO inventory_transactions'),
        expect.arrayContaining(['order_cancellation', orderId, 'order', 101])
      );
      
      // Verify transaction was committed
      expect(mockConnection.commit).toHaveBeenCalled();
      
      // Verify result
      expect(result).toEqual({
        id: 123,
        status: 'cancelled',
        cancelled_at: '2023-01-01T00:00:00.000Z'
      });
    });
    
    test('should throw error if order already cancelled', async () => {
      // Mock already cancelled order
      mockConnection.query.mockResolvedValueOnce([[
        { id: 123, status: 'cancelled' }
      ]]);
      
      await expect(orderService.cancelOrder(orderId, userId, reason))
        .rejects
        .toThrow('Order already cancelled');
      
      // Verify transaction was rolled back
      expect(mockConnection.rollback).toHaveBeenCalled();
    });
  });
});
