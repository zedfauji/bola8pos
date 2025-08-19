const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db');
const { auditLog } = require('../services/audit.service');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');
const RefreshToken = require('../models/RefreshToken');

/**
 * Generate access and refresh tokens for a user
 * Implements token rotation security pattern
 * @param {Object} user - User object
 * @param {string} previousToken - Previous refresh token (for rotation)
 * @param {string} familyId - Token family ID (for rotation)
 * @returns {Object} Access and refresh tokens
 */
async function generateTokens(user, previousToken = null, familyId = null) {
  // Create access token (15 minutes)
  const accessToken = jwt.sign(
    { 
      userId: user.id,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  // Create refresh token (7 days)
  const refreshToken = jwt.sign(
    { 
      userId: user.id,
      email: user.email,
      role: user.role,
      // Add jti (JWT ID) for uniqueness
      jti: uuidv4()
    },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' }
  );

  // Generate a new family ID if not provided
  if (!familyId) {
    familyId = uuidv4();
  }

  return { accessToken, refreshToken, familyId };
}

/**
 * Verify JWT token from request
 */
function verifyToken(token, isRefresh = false) {
  return jwt.verify(
    token, 
    isRefresh 
      ? process.env.REFRESH_TOKEN_SECRET || 'your-refresh-secret-key'
      : process.env.JWT_SECRET || 'your-secret-key'
  );
}

/**
 * Verify JWT token from Authorization header
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const allowDemo = process.env.ALLOW_DEMO_AUTH === 'true' || (process.env.NODE_ENV !== 'production');

    // Debug auth header
    console.log('Auth header received:', authHeader);

    // Accept Bearer, or fall back to demo user in non-production if allowed
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No valid auth header found. Auth header:', authHeader);
      if (allowDemo) {
        console.log('Using demo user due to missing/invalid auth header');
        // Minimal admin-like user with broad permissions for local/dev E2E smoke tests
        req.user = {
          id: 'demo-admin',
          email: 'admin@billiardpos.com',
          name: 'Demo Admin',
          role: 'admin',
          permissions: {
            '*': ['*']
          }
        };
        return next();
      }
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.split(' ')[1];
    console.log('Token extracted from header:', {
      tokenLength: token ? token.length : 0,
      tokenParts: token ? token.split('.').length : 0,
      firstChars: token ? token.substring(0, 10) + '...' : 'null',
      lastChars: token ? '...' + token.substring(token.length - 10) : 'null'
    });
    
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      console.log('Token verified successfully. Decoded payload:', decoded);
    } catch (tokenError) {
      console.error('Token verification failed:', tokenError.message);
      console.error('JWT_SECRET used:', process.env.JWT_SECRET ? '[SECRET PRESENT]' : 'default fallback');
      throw tokenError;
    }
    
    // Get user from database with role and permissions
    const [users] = await pool.query(
      `SELECT u.*, r.name as role_name, rp.permission_id, p.resource, p.action 
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN role_permissions rp ON r.id = rp.role_id
       LEFT JOIN permissions p ON rp.permission_id = p.id
       WHERE u.id = ? AND u.is_active = 1`,
      [decoded.userId]
    );

    if (!users.length) {
      throw new UnauthorizedError('User not found or inactive');
    }

    // Group permissions by resource
    const permissions = users.reduce((acc, row) => {
      if (row.permission_id) {
        if (!acc[row.resource]) {
          acc[row.resource] = [];
        }
        acc[row.resource].push(row.action);
      }
      return acc;
    }, {});

    // Attach user and permissions to request
    req.user = {
      id: users[0].id,
      email: users[0].email,
      name: users[0].name,
      role: users[0].role_name,
      permissions
    };

    // Log authentication
    await auditLog({
      userId: req.user.id,
      action: 'AUTHENTICATE',
      resourceType: 'AUTH',
      metadata: { ip: req.ip, userAgent: req.get('User-Agent') }
    });

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Role hierarchy definition
 * Higher index roles inherit permissions from lower index roles
 */
const ROLE_HIERARCHY = {
  'admin': 3,    // Highest level - can do everything
  'manager': 2,  // Can manage most things but not system settings
  'staff': 1,    // Basic access
  'guest': 0     // Minimal access
};

/**
 * Check if role has sufficient privileges based on hierarchy
 * @param {string} userRole - User's role
 * @param {string} requiredRole - Required role
 * @returns {boolean} True if user has sufficient privileges
 */
const hasRolePrivilege = (userRole, requiredRole) => {
  // If roles aren't in hierarchy, do direct comparison
  if (!(userRole in ROLE_HIERARCHY) || !(requiredRole in ROLE_HIERARCHY)) {
    return userRole === requiredRole;
  }
  
  // Check if user's role level is >= required role level
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
};

/**
 * Check if the user has the required role
 * @param {string|string[]} roles - Required role(s)
 * @param {boolean} [strict=false] - If true, requires exact role match without hierarchy
 * @returns {Function} Express middleware
 */
const hasRole = (roles, strict = false) => {
  return async (req, res, next) => {
    try {
      // Ensure user is authenticated first
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const requiredRoles = Array.isArray(roles) ? roles : [roles];
      const userRole = req.user.role;
      let hasAccess = false;

      if (strict) {
        // Strict mode: require exact role match
        hasAccess = requiredRoles.includes(userRole);
      } else {
        // Hierarchy mode: check if user's role has sufficient privileges
        hasAccess = requiredRoles.some(role => hasRolePrivilege(userRole, role));
      }

      if (!hasAccess) {
        // Log the role check failure
        await auditLog({
          userId: req.user.id,
          action: 'ROLE_CHECK_FAILED',
          resourceType: 'auth',
          metadata: {
            requiredRoles,
            userRole,
            strict,
            path: req.originalUrl,
            method: req.method
          }
        });

        throw new ForbiddenError(`Requires role: ${requiredRoles.join(' or ')}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Check if user has required permissions
 */
function checkPermission(resource, action) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const hasPermission = req.user.permissions[resource]?.includes(action) || 
                          req.user.permissions[resource]?.includes('*');
      
      if (!hasPermission) {
        await auditLog({
          userId: req.user.id,
          action: 'PERMISSION_DENIED',
          resourceType: resource.toUpperCase(),
          resourceId: req.params.id,
          metadata: { action, path: req.path }
        });
        throw new ForbiddenError('Insufficient permissions');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to require minimum role level
 * @param {string} minRole - Minimum role required (e.g., 'staff', 'manager', 'admin')
 * @returns {Function} Express middleware
 */
function requireMinRole(minRole) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }
      
      const userRole = req.user.role;
      
      // Check if user's role meets the minimum required level
      if (!hasRolePrivilege(userRole, minRole)) {
        await auditLog({
          userId: req.user.id,
          action: 'MIN_ROLE_CHECK_FAILED',
          resourceType: 'AUTH',
          metadata: { 
            requiredMinRole: minRole, 
            userRole,
            path: req.originalUrl,
            method: req.method
          }
        });
        throw new ForbiddenError(`Requires minimum role level: ${minRole}`);
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to enforce manager PIN verification for sensitive operations
 */
function requireManagerPin() {
  return async (req, res, next) => {
    try {
      // Skip PIN check for admin users
      if (req.user && req.user.role === 'admin') {
        return next();
      }
      
      // Check if user is a manager
      if (req.user && req.user.role === 'manager') {
        const { managerPin } = req.body;
        
        if (!managerPin) {
          throw new ForbiddenError('Manager PIN required for this operation');
        }
        
        // Get manager from database with stored PIN
        const [managers] = await pool.query(
          `SELECT pin FROM users WHERE id = ? AND role_id = (SELECT id FROM roles WHERE name = 'manager')`,
          [req.user.id]
        );
        
        if (!managers.length) {
          throw new ForbiddenError('User is not a manager');
        }
        
        const storedPin = managers[0].pin;
        
        // If no PIN is set or PIN doesn't match
        if (!storedPin || storedPin !== managerPin) {
          await auditLog({
            userId: req.user.id,
            action: 'MANAGER_PIN_FAILED',
            resourceType: 'AUTH',
            metadata: { path: req.path }
          });
          throw new ForbiddenError('Invalid manager PIN');
        }
        
        // PIN verified successfully
        await auditLog({
          userId: req.user.id,
          action: 'MANAGER_PIN_VERIFIED',
          resourceType: 'AUTH',
          metadata: { path: req.path }
        });
      } else {
        // Not a manager or admin
        throw new ForbiddenError('This operation requires manager privileges');
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  authenticate,
  checkPermission,
  hasRole,
  generateTokens,
  verifyToken,
  requireManagerPin,
  requireMinRole,
  ROLE_HIERARCHY
};
