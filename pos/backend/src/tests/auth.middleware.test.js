const { expect } = require('chai');
const sinon = require('sinon');
const jwt = require('jsonwebtoken');
const { 
  authenticate, 
  checkPermission, 
  hasRole, 
  requireMinRole,
  ROLE_HIERARCHY
} = require('../middleware/auth.middleware');
const logger = require('../utils/logger');

describe('Auth Middleware', () => {
  let req, res, next;
  
  beforeEach(() => {
    req = {
      headers: {},
      cookies: {}
    };
    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub().returnsThis(),
      cookie: sinon.stub()
    };
    next = sinon.spy();
    sinon.stub(logger, 'info');
    sinon.stub(logger, 'error');
    sinon.stub(logger, 'warn');
    sinon.stub(logger, 'audit');
  });
  
  afterEach(() => {
    sinon.restore();
  });
  
  describe('authenticate', () => {
    it('should return 401 if no token is provided', () => {
      authenticate(req, res, next);
      expect(res.status.calledWith(401)).to.be.true;
      expect(res.json.calledWith(sinon.match({ message: 'Authentication required' }))).to.be.true;
      expect(next.called).to.be.false;
    });
    
    it('should call next if valid token is provided in Authorization header', () => {
      const token = 'valid.token.here';
      req.headers.authorization = `Bearer ${token}`;
      
      sinon.stub(jwt, 'verify').returns({ id: 1, email: 'test@example.com', role: 'admin' });
      
      authenticate(req, res, next);
      
      expect(req.user).to.deep.equal({ id: 1, email: 'test@example.com', role: 'admin' });
      expect(next.calledOnce).to.be.true;
      expect(res.status.called).to.be.false;
    });
    
    it('should return 401 if token verification fails', () => {
      const token = 'invalid.token.here';
      req.headers.authorization = `Bearer ${token}`;
      
      sinon.stub(jwt, 'verify').throws(new Error('Invalid token'));
      
      authenticate(req, res, next);
      
      expect(res.status.calledWith(401)).to.be.true;
      expect(res.json.calledWith(sinon.match({ message: 'Invalid token' }))).to.be.true;
      expect(next.called).to.be.false;
    });
  });
  
  describe('checkPermission', () => {
    it('should call next if user has required permission', () => {
      req.user = {
        permissions: ['read:products', 'write:products']
      };
      
      const middleware = checkPermission('read:products');
      middleware(req, res, next);
      
      expect(next.calledOnce).to.be.true;
      expect(res.status.called).to.be.false;
    });
    
    it('should return 403 if user does not have required permission', () => {
      req.user = {
        permissions: ['read:products']
      };
      
      const middleware = checkPermission('write:orders');
      middleware(req, res, next);
      
      expect(res.status.calledWith(403)).to.be.true;
      expect(res.json.calledWith(sinon.match({ message: 'Permission denied' }))).to.be.true;
      expect(next.called).to.be.false;
    });
  });
  
  describe('hasRole', () => {
    it('should call next if user has exact required role in strict mode', () => {
      req.user = { role: 'manager' };
      
      const middleware = hasRole('manager', true);
      middleware(req, res, next);
      
      expect(next.calledOnce).to.be.true;
      expect(res.status.called).to.be.false;
    });
    
    it('should return 403 if user does not have exact required role in strict mode', () => {
      req.user = { role: 'staff' };
      
      const middleware = hasRole('manager', true);
      middleware(req, res, next);
      
      expect(res.status.calledWith(403)).to.be.true;
      expect(res.json.calledWith(sinon.match({ message: 'Access denied' }))).to.be.true;
      expect(next.called).to.be.false;
    });
    
    it('should call next if user has higher role than required in non-strict mode', () => {
      req.user = { role: 'admin' };
      
      const middleware = hasRole('manager', false);
      middleware(req, res, next);
      
      expect(next.calledOnce).to.be.true;
      expect(res.status.called).to.be.false;
    });
    
    it('should return 403 if user has lower role than required in non-strict mode', () => {
      req.user = { role: 'staff' };
      
      const middleware = hasRole('manager', false);
      middleware(req, res, next);
      
      expect(res.status.calledWith(403)).to.be.true;
      expect(res.json.calledWith(sinon.match({ message: 'Access denied' }))).to.be.true;
      expect(next.called).to.be.false;
    });
  });
  
  describe('requireMinRole', () => {
    it('should call next if user has minimum required role', () => {
      req.user = { role: 'manager' };
      
      const middleware = requireMinRole('staff');
      middleware(req, res, next);
      
      expect(next.calledOnce).to.be.true;
      expect(res.status.called).to.be.false;
    });
    
    it('should return 403 if user does not have minimum required role', () => {
      req.user = { role: 'staff' };
      
      const middleware = requireMinRole('manager');
      middleware(req, res, next);
      
      expect(res.status.calledWith(403)).to.be.true;
      expect(res.json.calledWith(sinon.match({ message: 'Insufficient role privileges' }))).to.be.true;
      expect(next.called).to.be.false;
    });
    
    it('should call next if user has admin role regardless of required role', () => {
      req.user = { role: 'admin' };
      
      const middleware = requireMinRole('manager');
      middleware(req, res, next);
      
      expect(next.calledOnce).to.be.true;
      expect(res.status.called).to.be.false;
    });
  });
  
  describe('ROLE_HIERARCHY', () => {
    it('should define correct hierarchy levels', () => {
      expect(ROLE_HIERARCHY).to.deep.equal({
        'admin': 3,
        'manager': 2,
        'staff': 1,
        'guest': 0
      });
    });
  });
});
