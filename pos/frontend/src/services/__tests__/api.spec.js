import { vi, describe, test, expect, beforeEach } from 'vitest';
import api from '../api';

// Mock the global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock environment variables
const mockEnv = {
  VITE_API_URL: 'http://localhost:3000',
};

// Mock response helper
const createMockResponse = (data, ok = true) => ({
  ok,
  json: async () => data,
  text: async () => JSON.stringify(data),
});

describe('API Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('Table Operations', () => {
    test('getTables makes GET request to /api/tables', async () => {
      const mockData = [{ id: 1, name: 'Table 1' }];
      mockFetch.mockResolvedValueOnce(createMockResponse(mockData));

      const result = await api.getTables();
      
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/tables',
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
        })
      );
      expect(result).toEqual(mockData);
    });

    test('startTable makes POST request to /api/tables/:id/start', async () => {
      const tableId = 1;
      mockFetch.mockResolvedValueOnce(createMockResponse({ success: true }));

      await api.startTable(tableId);
      
      expect(mockFetch).toHaveBeenCalledWith(
        `http://localhost:3001/api/tables/${tableId}/start`,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    test('stopTable makes POST request to /api/tables/:id/stop', async () => {
      const tableId = 1;
      mockFetch.mockResolvedValueOnce(createMockResponse({ success: true }));

      await api.stopTable(tableId);
      
      expect(mockFetch).toHaveBeenCalledWith(
        `http://localhost:3001/api/tables/${tableId}/stop`,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });
  });

  describe('Order Operations', () => {
    test('createOrder makes POST request with order data', async () => {
      const orderData = { items: [{ id: 1, quantity: 2 }], tableId: 1 };
      mockFetch.mockResolvedValueOnce(createMockResponse({ id: 'order-123', ...orderData }));

      const result = await api.createOrder(orderData);
      
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/orders',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            ...orderData,
            accessCode: '1234'  // Added by the API service
          }),
        })
      );
      expect(result).toEqual(expect.objectContaining({ id: 'order-123', ...orderData }));
    });

    test('updateOrderStatus updates order status', async () => {
      const orderId = 'order-123';
      const status = 'preparing';
      mockFetch.mockResolvedValueOnce(createMockResponse({ success: true }));

      await api.updateOrderStatus(orderId, status);
      
      expect(mockFetch).toHaveBeenCalledWith(
        `http://localhost:3001/api/orders/${orderId}/status`,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status,
            accessCode: '1234'
          })
        })
      );
    });
  });

  describe('Error Handling', () => {
    test('throws error when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({}),
      });

      await expect(api.getTables()).rejects.toThrow('HTTP error 500');
    });
  });

  describe('Inventory Operations', () => {
    test('moveEvent makes POST request with movement data', async () => {
      const movementData = {
        type: 'sale',
        items: [{ sku: 'ITEM-001', quantity: 2 }],
        tableId: 1,
      };
      
      mockFetch.mockResolvedValueOnce(createMockResponse({ success: true }));

      await api.moveEvent(movementData);
      
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/moves/move',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            ...movementData,
            accessCode: '1234'  // Added by the API service
          })
        })
      );
    });
  });
});
