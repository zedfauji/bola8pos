/**
 * Tests for error handling utilities
 */
const { 
  createError, 
  ValidationError, 
  NotFoundError, 
  AuthError,
  ForbiddenError,
  ConflictError,
  errorHandler 
} = require('../../utils/errors');

describe('Error utilities', () => {
  describe('createError function', () => {
    test('should create an error with status code and message', () => {
      const error = createError(400, 'Bad request');
      
      expect(error).toBeInstanceOf(Error);
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Bad request');
    });
    
    test('should include details if provided', () => {
      const details = { field: 'username', issue: 'required' };
      const error = createError(400, 'Bad request', details);
      
      expect(error.details).toEqual(details);
    });
  });
  
  describe('Custom error classes', () => {
    test('ValidationError should have correct properties', () => {
      const error = new ValidationError('Invalid input');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Invalid input');
      expect(error.type).toBe('ValidationError');
    });
    
    test('ValidationError should handle details', () => {
      const details = { field: 'email', issue: 'invalid format' };
      const error = new ValidationError('Invalid input', details);
      
      expect(error.details).toEqual(details);
    });
    
    test('NotFoundError should have correct properties', () => {
      const error = new NotFoundError('User', 123);
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('User with ID 123 not found');
      expect(error.type).toBe('NotFoundError');
    });
    
    test('AuthError should have correct properties', () => {
      const error = new AuthError('Invalid credentials');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AuthError);
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Invalid credentials');
      expect(error.type).toBe('AuthError');
    });
    
    test('ForbiddenError should have correct properties', () => {
      const error = new ForbiddenError('Insufficient permissions');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ForbiddenError);
      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('Insufficient permissions');
      expect(error.type).toBe('ForbiddenError');
    });
    
    test('ConflictError should have correct properties', () => {
      const error = new ConflictError('Resource already exists');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ConflictError);
      expect(error.statusCode).toBe(409);
      expect(error.message).toBe('Resource already exists');
      expect(error.type).toBe('ConflictError');
    });
  });
  
  describe('errorHandler middleware', () => {
    let req, res, next;
    
    beforeEach(() => {
      req = {
        originalUrl: '/api/test'
      };
      
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
      };
      
      next = jest.fn();
    });
    
    test('should handle ValidationError', () => {
      const error = new ValidationError('Invalid input');
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: {
          type: 'ValidationError',
          message: 'Invalid input',
          statusCode: 400
        },
        timestamp: expect.any(String),
        path: '/api/test'
      }));
    });
    
    test('should handle NotFoundError', () => {
      const error = new NotFoundError('User', 123);
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: {
          type: 'NotFoundError',
          message: 'User with ID 123 not found',
          statusCode: 404
        },
        timestamp: expect.any(String),
        path: '/api/test'
      }));
    });
    
    test('should handle JWT errors', () => {
      const error = new Error('jwt expired');
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: {
          type: 'AuthError',
          message: 'Authentication token expired',
          statusCode: 401
        },
        timestamp: expect.any(String),
        path: '/api/test'
      }));
    });
    
    test('should handle database errors', () => {
      const error = new Error('ER_DUP_ENTRY: Duplicate entry');
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: {
          type: 'DatabaseError',
          message: 'Database constraint violation: Duplicate entry',
          statusCode: 409
        },
        timestamp: expect.any(String),
        path: '/api/test'
      }));
    });
    
    test('should handle generic errors', () => {
      const error = new Error('Something went wrong');
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: {
          type: 'ServerError',
          message: 'Something went wrong',
          statusCode: 500
        },
        timestamp: expect.any(String),
        path: '/api/test'
      }));
    });
    
    test('should include error details if available', () => {
      const details = { field: 'email', issue: 'invalid format' };
      const error = new ValidationError('Invalid input', details);
      
      errorHandler(error, req, res, next);
      
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          details: details
        })
      }));
    });
  });
});
