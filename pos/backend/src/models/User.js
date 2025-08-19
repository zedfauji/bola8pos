/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: The user's unique identifier
 *         email:
 *           type: string
 *           format: email
 *           description: The user's email address
 *         name:
 *           type: string
 *           description: The user's full name
 *         role:
 *           type: string
 *           description: The user's role (e.g., 'admin', 'manager', 'staff')
 *         isActive:
 *           type: boolean
 *           description: Whether the user account is active
 *         lastLogin:
 *           type: string
 *           format: date-time
 *           description: Timestamp of the user's last login
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the user was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the user was last updated
 *         permissions:
 *           type: object
 *           additionalProperties:
 *             type: array
 *             items:
 *               type: string
 *           description: Object mapping resource names to arrays of allowed actions
 *       example:
 *         id: 5f8d0f3d2e1c9a0b8c7d6e5f
 *         email: admin@example.com
 *         name: Admin User
 *         role: admin
 *         isActive: true
 *         lastLogin: '2023-05-15T10:30:00Z'
 *         createdAt: '2023-01-01T00:00:00Z'
 *         updatedAt: '2023-05-10T15:30:00Z'
 *         permissions:
 *           users: ['create', 'read', 'update', 'delete']
 *           roles: ['read', 'update']
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     CreateUserRequest:
 *       type: object
 *       required:
 *         - email
 *         - name
 *         - password
 *         - role
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: The user's email address
 *         name:
 *           type: string
 *           description: The user's full name
 *         password:
 *           type: string
 *           format: password
 *           minLength: 8
 *           description: The user's password (min 8 characters)
 *         role:
 *           type: string
 *           enum: [admin, manager, staff, cashier]
 *           description: The user's role
 *         isActive:
 *           type: boolean
 *           default: true
 *           description: Whether the user account is active
 *
 *     UpdateUserRequest:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: The user's full name
 *         email:
 *           type: string
 *           format: email
 *           description: The user's email address
 *         password:
 *           type: string
 *           format: password
 *           minLength: 8
 *           description: The user's new password (min 8 characters, optional)
 *         role:
 *           type: string
 *           enum: [admin, manager, staff, cashier]
 *           description: The user's role
 *         isActive:
 *           type: boolean
 *           description: Whether the user account is active
 *
 *     UserListResponse:
 *       type: object
 *       properties:
 *         users:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/User'
 *         total:
 *           type: integer
 *           description: Total number of users
 *         page:
 *           type: integer
 *           description: Current page number
 *         limit:
 *           type: integer
 *           description: Number of items per page
 */

/**
 * User model for the application.
 * This module handles all database operations related to users.
 */
class User {
  /**
   * Find a user by ID
   * @param {string} id - User ID
   * @returns {Promise<Object>} User object
   */
  static async findById(id) {
    const [rows] = await pool.query(
      'SELECT id, email, name, role, is_active as isActive, last_login as lastLogin, created_at as createdAt, updated_at as updatedAt FROM users WHERE id = ?',
      [id]
    );
    return rows[0];
  }

  /**
   * Find a user by email
   * @param {string} email - User email
   * @returns {Promise<Object>} User object
   */
  static async findByEmail(email) {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    return rows[0];
  }

  /**
   * Create a new user
   * @param {Object} userData - User data
   * @returns {Promise<Object>} Created user object
   */
  static async create(userData) {
    const { email, name, password, role, isActive = true } = userData;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const [result] = await pool.query(
      'INSERT INTO users (email, name, password, role, is_active) VALUES (?, ?, ?, ?, ?)',
      [email, name, hashedPassword, role, isActive]
    );
    
    return this.findById(result.insertId);
  }

  /**
   * Update a user
   * @param {string} id - User ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated user object
   */
  static async update(id, updates) {
    const { name, email, password, role, isActive } = updates;
    const fields = [];
    const values = [];
    
    if (name !== undefined) {
      fields.push('name = ?');
      values.push(name);
    }
    
    if (email !== undefined) {
      fields.push('email = ?');
      values.push(email);
    }
    
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      fields.push('password = ?');
      values.push(hashedPassword);
    }
    
    if (role !== undefined) {
      fields.push('role = ?');
      values.push(role);
    }
    
    if (isActive !== undefined) {
      fields.push('is_active = ?');
      values.push(isActive);
    }
    
    if (fields.length === 0) {
      return this.findById(id);
    }
    
    values.push(id);
    
    await pool.query(
      `UPDATE users SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );
    
    return this.findById(id);
  }

  /**
   * Delete a user
   * @param {string} id - User ID
   * @returns {Promise<boolean>} Success status
   */
  static async delete(id) {
    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  /**
   * List users with pagination
   * @param {Object} options - Pagination options
   * @param {number} options.page - Page number (1-based)
   * @param {number} options.limit - Number of items per page
   * @returns {Promise<Object>} Paginated list of users
   */
  static async list({ page = 1, limit = 10 } = {}) {
    const offset = (page - 1) * limit;
    
    const [users] = await pool.query(
      'SELECT id, email, name, role, is_active as isActive, last_login as lastLogin, created_at as createdAt, updated_at as updatedAt FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
    
    const [[{ total }]] = await pool.query('SELECT COUNT(*) as total FROM users');
    
    return {
      users,
      total: parseInt(total),
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Update user's last login timestamp
   * @param {string} id - User ID
   * @returns {Promise<void>}
   */
  static async updateLastLogin(id) {
    await pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );
  }
}

module.exports = User;
