/**
 * Tests for audit logger utility
 */
const { auditLog, getAuditLogs } = require('../../utils/auditLogger');
const { pool } = require('../../db');
const logger = require('../../utils/logger');

// Mock the database pool
jest.mock('../../db', () => ({
  pool: {
    query: jest.fn()
  }
}));

// Mock the logger
jest.mock('../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

describe('Audit Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('auditLog', () => {
    test('should insert audit log entry and return it', async () => {
      // Mock successful insert
      const mockInsertResult = { insertId: 123 };
      const mockLogEntry = {
        id: 123,
        action: 'user_login',
        user_id: 'user-123',
        resource_type: 'user',
        resource_id: 'user-123',
        metadata: '{"browser":"Chrome"}',
        ip_address: '127.0.0.1',
        created_at: '2023-01-01T00:00:00.000Z'
      };
      
      pool.query
        .mockResolvedValueOnce([mockInsertResult])
        .mockResolvedValueOnce([[mockLogEntry]]);
      
      const result = await auditLog({
        action: 'user_login',
        userId: 'user-123',
        resourceType: 'user',
        resourceId: 'user-123',
        metadata: { browser: 'Chrome' },
        ipAddress: '127.0.0.1'
      });
      
      // Verify insert query was called
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        [
          'user_login',
          'user-123',
          'user',
          'user-123',
          '{"browser":"Chrome"}',
          '127.0.0.1'
        ]
      );
      
      // Verify select query was called to get the inserted log
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM audit_logs WHERE id = ?',
        [123]
      );
      
      // Verify result
      expect(result).toEqual(mockLogEntry);
    });
    
    test('should use "system" as default IP if not provided', async () => {
      pool.query
        .mockResolvedValueOnce([{ insertId: 123 }])
        .mockResolvedValueOnce([[{ id: 123 }]]);
      
      await auditLog({
        action: 'system_event',
        userId: 'system',
        resourceType: 'config',
        resourceId: 'settings'
      });
      
      // Check that 'system' was used as the IP
      expect(pool.query).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining(['system'])
      );
    });
    
    test('should handle database errors gracefully', async () => {
      const dbError = new Error('Database connection failed');
      pool.query.mockRejectedValueOnce(dbError);
      
      const result = await auditLog({
        action: 'test_action',
        userId: 'user-123',
        resourceType: 'test',
        resourceId: '123'
      });
      
      // Should log the error
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to create audit log:',
        dbError
      );
      
      // Should return error info without failing
      expect(result).toEqual({
        success: false,
        error: 'Database connection failed'
      });
    });
  });
  
  describe('getAuditLogs', () => {
    test('should retrieve audit logs with pagination', async () => {
      const mockLogs = [
        { 
          id: 1, 
          action: 'user_login', 
          metadata: '{"browser":"Chrome"}',
          user_name: 'testuser'
        },
        { 
          id: 2, 
          action: 'order_created', 
          metadata: '{"orderId":123}',
          user_name: 'testuser'
        }
      ];
      
      const mockCount = [{ total: 2 }];
      
      pool.query
        .mockResolvedValueOnce([mockCount])
        .mockResolvedValueOnce([mockLogs]);
      
      const result = await getAuditLogs({
        action: 'user_login',
        page: 1,
        limit: 10
      });
      
      // Verify count query was called
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*) as total'),
        expect.arrayContaining(['user_login'])
      );
      
      // Verify select query was called
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT al.*, u.username as user_name'),
        expect.arrayContaining(['user_login', 10, 0])
      );
      
      // Verify result structure
      expect(result).toEqual({
        logs: [
          { 
            id: 1, 
            action: 'user_login', 
            metadata: { browser: 'Chrome' },
            user_name: 'testuser'
          },
          { 
            id: 2, 
            action: 'order_created', 
            metadata: { orderId: 123 },
            user_name: 'testuser'
          }
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          pages: 1
        }
      });
    });
    
    test('should apply all provided filters', async () => {
      pool.query
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[]]);
      
      const startDate = '2023-01-01';
      const endDate = '2023-01-31';
      
      await getAuditLogs({
        action: 'user_login',
        userId: 'user-123',
        resourceType: 'user',
        resourceId: 'user-123',
        startDate,
        endDate,
        page: 2,
        limit: 20
      });
      
      // Verify all filters were applied
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*) as total'),
        expect.arrayContaining([
          'user_login',
          'user-123',
          'user',
          'user-123',
          startDate,
          endDate
        ])
      );
      
      // Verify pagination
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY al.created_at DESC LIMIT ? OFFSET ?'),
        expect.arrayContaining([20, 20]) // page 2, limit 20 = offset 20
      );
    });
    
    test('should handle invalid JSON in metadata', async () => {
      const mockLogs = [
        { 
          id: 1, 
          action: 'test', 
          metadata: '{invalid-json}' // Invalid JSON
        }
      ];
      
      pool.query
        .mockResolvedValueOnce([[{ total: 1 }]])
        .mockResolvedValueOnce([mockLogs]);
      
      const result = await getAuditLogs({
        page: 1,
        limit: 10
      });
      
      // Should keep metadata as string if parsing fails
      expect(result.logs[0].metadata).toBe('{invalid-json}');
    });
    
    test('should handle database errors', async () => {
      const dbError = new Error('Query failed');
      pool.query.mockRejectedValueOnce(dbError);
      
      await expect(getAuditLogs({})).rejects.toThrow('Query failed');
      expect(logger.error).toHaveBeenCalledWith('Error getting audit logs:', dbError);
    });
  });
});
