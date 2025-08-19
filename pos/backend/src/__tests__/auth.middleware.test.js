const request = require('supertest');
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { authenticate, checkPermission, hasRole } = require('../middleware/auth.middleware');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');

// Mock the database pool
jest.mock('../db', () => ({
  pool: {
    query: jest.fn()
  }
}));

describe('Authentication Middleware', () => {
  let app;
  let server;
  let token;
  const secret = 'test-secret';
  
  beforeAll(() => {
    // Set up test app
    app = express();
    app.use(express.json());
    
    // Test route that requires authentication
    app.get('/protected', authenticate, (req, res) => {
      res.json({ message: 'Protected route', user: req.user });
    });
    
    // Test route that requires specific permission
    app.get('/admin', 
      authenticate, 
      checkPermission('admin', 'read'), 
      (req, res) => {
        res.json({ message: 'Admin route' });
      }
    );
    
    // Test route that requires specific role
    app.get('/manager', 
      authenticate, 
      hasRole(['manager', 'admin']), 
      (req, res) => {
        res.json({ message: 'Manager route' });
      }
    );
    
    // Error handler
    app.use((err, req, res, next) => {
      res.status(err.statusCode || 500).json({
        error: err.name,
        message: err.message,
        ...(err.details && { details: err.details })
      });
    });
    
    server = createServer(app);
    const io = new Server(server);
    
    // Generate a test token
    token = jwt.sign(
      { 
        userId: 'test-user',
        role: 'admin',
        permissions: { admin: ['read', 'write'] }
      },
      secret,
      { expiresIn: '1h' }
    );
    
    // Mock database responses
    pool.query.mockImplementation((sql, params) => {
      if (sql.includes('SELECT * FROM users')) {
        return Promise.resolve([[
          {
            id: 'test-user',
            email: 'test@example.com',
            name: 'Test User',
            role_id: 'admin-role',
            is_active: 1
          }
        ]]);
      }
      if (sql.includes('SELECT r.*, p.resource, p.action')) {
        return Promise.resolve([[
          { resource: 'admin', action: 'read' },
          { resource: 'admin', action: 'write' }
        ]]);
      }
      return Promise.resolve([[]]);
    });
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  afterAll(async () => {
    await new Promise(resolve => server.close(resolve));
  });
  
  describe('authenticate middleware', () => {
    it('should allow access with a valid token', async () => {
      const response = await request(server)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Protected route');
      expect(response.body.user).toHaveProperty('id', 'test-user');
    });
    
    it('should deny access without a token', async () => {
      const response = await request(server)
        .get('/protected');
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Unauthorized');
    });
    
    it('should deny access with an invalid token', async () => {
      const response = await request(server)
        .get('/protected')
        .set('Authorization', 'Bearer invalid-token');
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Unauthorized');
    });
  });
  
  describe('checkPermission middleware', () => {
    it('should allow access with the correct permission', async () => {
      const response = await request(server)
        .get('/admin')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Admin route');
    });
    
    it('should deny access without the required permission', async () => {
      // Mock user without admin:read permission
      const userToken = jwt.sign(
        { 
          userId: 'test-user',
          role: 'user',
          permissions: { user: ['read'] }
        },
        secret,
        { expiresIn: '1h' }
      );
      
      const response = await request(server)
        .get('/admin')
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'Forbidden');
    });
  });
  
  describe('hasRole middleware', () => {
    it('should allow access with the correct role', async () => {
      const managerToken = jwt.sign(
        { 
          userId: 'test-manager',
          role: 'manager',
          permissions: {}
        },
        secret,
        { expiresIn: '1h' }
      );
      
      const response = await request(server)
        .get('/manager')
        .set('Authorization', `Bearer ${managerToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Manager route');
    });
    
    it('should deny access without the required role', async () => {
      const userToken = jwt.sign(
        { 
          userId: 'test-user',
          role: 'user',
          permissions: {}
        },
        secret,
        { expiresIn: '1h' }
      );
      
      const response = await request(server)
        .get('/manager')
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'Forbidden');
    });
  });
});
