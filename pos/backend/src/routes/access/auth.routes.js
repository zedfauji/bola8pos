const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool } = require('../../config/db');
const { UnauthorizedError, BadRequestError } = require('../../utils/errors');
const { authenticate, generateTokens } = require('../../middleware/auth.middleware');

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('name').trim().notEmpty(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new BadRequestError('Validation failed', errors.array());
      }

      const { email, password, name } = req.body;

      // Check if user already exists
      const [existingUser] = await pool.query(
        'SELECT id FROM users WHERE email = ?',
        [email]
      );

      if (existingUser.length > 0) {
        throw new BadRequestError('Email already in use');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const [result] = await pool.query(
        'INSERT INTO users (email, password, name) VALUES (?, ?, ?)',
        [email, hashedPassword, name]
      );

      // Get the newly created user
      const [user] = await pool.query('SELECT * FROM users WHERE id = ?', [
        result.insertId,
      ]);

      res.status(201).json({
        message: 'User registered successfully',
        user: user[0],
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login successful
 *         headers:
 *           Set-Cookie:
 *             schema:
 *               type: string
 *               example: refreshToken=abc123; HttpOnly; Path=/; SameSite=Strict
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').exists()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new BadRequestError('Validation failed', errors.array());
      }

      const { email, password } = req.body;

      // Find user by email
      const [users] = await pool.query(
        'SELECT u.*, r.name as role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.email = ?',
        [email]
      );

      if (users.length === 0) {
        throw new UnauthorizedError('Invalid credentials');
      }

      const user = users[0];

      // Check if password is correct
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedError('Invalid credentials');
      }

      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(user);

      // Generate UUID for the refresh token ID
      const { v4: uuidv4 } = require('uuid');
      const tokenId = uuidv4();
      
      // Store refresh token in database with explicit ID
      await pool.query(
        'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))',
        [tokenId, user.id, refreshToken]
      );

      // Set refresh token in HTTP-only cookie
      const isProduction = process.env.NODE_ENV === 'production';
      const isHttps = process.env.HTTPS === 'true';
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        // Only use secure flag if HTTPS is enabled or in production
        secure: isProduction || isHttps,
        sameSite: 'lax', // Use 'lax' for HTTP local development
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
        ...(isProduction && { domain: '.billiardpos.com' }), // Set domain in production
      });

      // Build permissions map for the user's role
      const [permRows] = await pool.query(
        `SELECT p.resource, p.action
         FROM role_permissions rp
         JOIN permissions p ON rp.permission_id = p.id
         WHERE rp.role_id = ?`,
        [user.role_id]
      );

      const permissions = permRows.reduce((acc, row) => {
        if (!acc[row.resource]) acc[row.resource] = [];
        acc[row.resource].push(row.action);
        return acc;
      }, {});

      // Return access token and enriched user data (without password)
      const { password: _, ...userDataRaw } = user;
      const userData = {
        ...userDataRaw,
        role: user.role_name, // normalize for frontend
        permissions,
      };
      res.json({
        accessToken,
        user: userData,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/auth/refresh-token:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     description: Get a new access token using a refresh token
 *     parameters:
 *       - in: cookie
 *         name: refreshToken
 *         schema:
 *           type: string
 *         description: Refresh token stored in HTTP-only cookie
 *     responses:
 *       200:
 *         description: New access token generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                   description: New JWT access token
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized - Invalid or expired refresh token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/refresh-token', async (req, res, next) => {
  try {
    // Enable CORS for credentials
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,UPDATE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept');
    
    // Check for refresh token in cookies first
    let refreshToken = req.cookies && req.cookies.refreshToken;
    
    // If not in cookies, check body or header (for development)
    if (!refreshToken) {
      refreshToken = (req.body && req.body.refreshToken) || req.get('x-refresh-token') || null;
      if (process.env.NODE_ENV === 'development' && refreshToken) {
        console.warn('[auth] Using refresh token from body/header (cookie missing). Consider aligning hosts or enabling HTTPS for cookies.');
      } else if (!refreshToken) {
        return res.status(401).json({ message: 'Refresh token is required' });
      }
    }
    
    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token is required' });
    }

    // Verify refresh token
    const [tokens] = await pool.query(
      `SELECT rt.*, u.email, u.name, r.name as role_name 
       FROM refresh_tokens rt
       JOIN users u ON rt.user_id = u.id
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE rt.token = ? AND rt.revoked = FALSE AND rt.expires_at > NOW()`,
      [refreshToken]
    );

    if (tokens.length === 0) {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }

    const tokenData = tokens[0];
    // Fetch permissions for this user via role
    const [permRows] = await pool.query(
      `SELECT p.resource, p.action
       FROM users u
       LEFT JOIN role_permissions rp ON u.role_id = rp.role_id
       LEFT JOIN permissions p ON rp.permission_id = p.id
       WHERE u.id = ?`,
      [tokenData.user_id]
    );
    const permissions = permRows.reduce((acc, row) => {
      if (!row || !row.resource) return acc;
      if (!acc[row.resource]) acc[row.resource] = [];
      acc[row.resource].push(row.action);
      return acc;
    }, {});

    const user = {
      id: tokenData.user_id,
      email: tokenData.email,
      name: tokenData.name,
      role: tokenData.role_name,
      permissions,
    };

    // Generate new access token
    const { accessToken } = generateTokens(user);

    // Return new access token and user data
    res.json({
      accessToken,
      user,
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    next(new UnauthorizedError('Could not refresh token'));
  }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *         headers:
 *           Set-Cookie:
 *             schema:
 *               type: string
 *               example: refreshToken=; HttpOnly; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      // Add token to blacklist
      await pool.query(
        'INSERT INTO token_blacklist (token, expires_at) VALUES (?, DATE_ADD(NOW(), INTERVAL 24 HOUR))',
        [token]
      );
    }

    // Clear refresh token cookie (must match attributes used when setting it)
    const isProduction = process.env.NODE_ENV === 'production';
    const isHttps = process.env.HTTPS === 'true';
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: isProduction || isHttps,
      sameSite: 'lax', // Use 'lax' for HTTP local development
      path: '/',
      ...(process.env.NODE_ENV === 'production' && {
        domain: '.billiardpos.com',
      }),
    });

    res.json({ message: 'Logout successful' });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const [users] = await pool.query(
      'SELECT id, email, name, role_id, created_at, updated_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      throw new UnauthorizedError('User not found');
    }

    res.json(users[0]);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
