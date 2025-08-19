/**
 * Tests for responseHandler middleware
 */
const responseHandler = require('../../middleware/responseHandler');

describe('responseHandler middleware', () => {
  let req, res, next;
  
  beforeEach(() => {
    req = {
      originalUrl: '/api/test'
    };
    
    res = {
      statusCode: 200,
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      created: undefined,
      success: undefined,
      noContent: undefined
    };
    
    next = jest.fn();
  });
  
  test('should wrap response data with success format', () => {
    // Setup
    const testData = { name: 'test', value: 123 };
    
    // Execute
    responseHandler(req, res, next);
    res.json(testData);
    
    // Assert
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: testData,
      timestamp: expect.any(String),
      path: '/api/test'
    }));
    expect(next).toHaveBeenCalled();
  });
  
  test('should handle null data', () => {
    // Execute
    responseHandler(req, res, next);
    res.json(null);
    
    // Assert
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: null,
      timestamp: expect.any(String),
      path: '/api/test'
    }));
  });
  
  test('should not modify error responses (status >= 400)', () => {
    // Setup
    const errorData = { error: 'Test error' };
    res.statusCode = 400;
    
    // Execute
    responseHandler(req, res, next);
    res.json(errorData);
    
    // Assert
    expect(res.json).toHaveBeenCalledWith(errorData);
  });
  
  test('should not modify response if already formatted', () => {
    // Setup
    const formattedData = { 
      success: true, 
      data: { test: 'value' },
      timestamp: '2023-01-01T00:00:00.000Z'
    };
    
    // Execute
    responseHandler(req, res, next);
    res.json(formattedData);
    
    // Assert
    expect(res.json).toHaveBeenCalledWith(formattedData);
  });
  
  test('should handle pagination metadata', () => {
    // Setup
    const dataWithPagination = { 
      items: [1, 2, 3],
      pagination: {
        page: 1,
        limit: 10,
        total: 100
      }
    };
    
    // Execute
    responseHandler(req, res, next);
    res.json(dataWithPagination);
    
    // Assert
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: { items: [1, 2, 3] },
      pagination: {
        page: 1,
        limit: 10,
        total: 100
      },
      timestamp: expect.any(String),
      path: '/api/test'
    }));
  });
  
  test('should add success helper method', () => {
    // Execute
    responseHandler(req, res, next);
    
    // Assert
    expect(res.success).toBeDefined();
    
    // Test the helper
    res.success({ test: 'data' }, 'Success message');
    
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: { test: 'data' },
      message: 'Success message',
      timestamp: expect.any(String),
      path: '/api/test'
    }));
  });
  
  test('should add created helper method', () => {
    // Execute
    responseHandler(req, res, next);
    
    // Assert
    expect(res.created).toBeDefined();
    
    // Test the helper
    res.created({ id: 123 }, 'Resource created');
    
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: { id: 123 },
      message: 'Resource created',
      timestamp: expect.any(String),
      path: '/api/test'
    }));
  });
  
  test('should add noContent helper method', () => {
    // Execute
    responseHandler(req, res, next);
    
    // Assert
    expect(res.noContent).toBeDefined();
    
    // Test the helper
    res.noContent();
    
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.json).toHaveBeenCalledWith();
  });
});
