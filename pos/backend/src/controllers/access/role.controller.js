const { pool } = require('../../db');
const { v4: uuidv4 } = require('uuid');
const { NotFoundError, ConflictError, ValidationError } = require('../../utils/errors');
const { auditLog } = require('../../services/audit.service');

class RoleController {
  /**
   * Create a new role
   * @param {Object} roleData - Role data
   * @param {string} userId - ID of the user creating the role
   * @returns {Promise<Object>} Created role
   */
  async createRole(roleData, userId) {
    const { name, description, permissions = [] } = roleData;
    const roleId = uuidv4();

    // Check if role with same name already exists
    const [existing] = await pool.query('SELECT id FROM roles WHERE name = ?', [name]);
    if (existing.length > 0) {
      throw new ConflictError(`Role with name "${name}" already exists`);
    }

    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Insert role
      await connection.query(
        'INSERT INTO roles (id, name, description) VALUES (?, ?, ?)',
        [roleId, name, description]
      );

      // Add permissions if any
      if (permissions.length > 0) {
        const permissionValues = permissions.map(permissionId => [roleId, permissionId]);
        await connection.query(
          'INSERT INTO role_permissions (role_id, permission_id) VALUES ?',
          [permissionValues]
        );
      }

      await connection.commit();

      // Log the action
      await auditLog({
        userId,
        action: 'CREATE',
        resourceType: 'ROLE',
        resourceId: roleId,
        metadata: { name }
      });

      return this.getRoleById(roleId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get role by ID with permissions
   * @param {string} roleId - Role ID
   * @returns {Promise<Object>} Role with permissions
   */
  async getRoleById(roleId) {
    const [roles] = await pool.query(
      `SELECT r.*, 
              GROUP_CONCAT(DISTINCT rp.permission_id) as permission_ids
       FROM roles r
       LEFT JOIN role_permissions rp ON r.id = rp.role_id
       WHERE r.id = ?
       GROUP BY r.id`,
      [roleId]
    );

    if (roles.length === 0) {
      throw new NotFoundError('Role', roleId);
    }

    const role = roles[0];
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: Boolean(role.is_system),
      createdAt: role.created_at,
      updatedAt: role.updated_at,
      permissions: role.permission_ids 
        ? role.permission_ids.split(',').filter(Boolean)
        : []
    };
  }

  /**
   * List all roles with pagination
   * @param {Object} options - Pagination and filtering options
   * @returns {Promise<{data: Array, total: number}>} List of roles and total count
   */
  async listRoles({ page = 1, limit = 10, search = '' } = {}) {
    const offset = (page - 1) * limit;
    const queryParams = [];
    let whereClause = '';

    if (search) {
      whereClause = 'WHERE name LIKE ?';
      queryParams.push(`%${search}%`);
    }

    // Get total count
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM roles ${whereClause}`,
      queryParams
    );
    const total = countResult[0].total;

    // Get paginated results
    const [roles] = await pool.query(
      `SELECT r.*, 
              GROUP_CONCAT(DISTINCT rp.permission_id) as permission_ids
       FROM roles r
       LEFT JOIN role_permissions rp ON r.id = rp.role_id
       ${whereClause}
       GROUP BY r.id
       ORDER BY r.name
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    );

    const formattedRoles = roles.map(role => ({
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: Boolean(role.is_system),
      createdAt: role.created_at,
      updatedAt: role.updated_at,
      permissions: role.permission_ids 
        ? role.permission_ids.split(',').filter(Boolean)
        : []
    }));

    return {
      data: formattedRoles,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Update a role
   * @param {string} roleId - Role ID
   * @param {Object} updateData - Updated role data
   * @param {string} userId - ID of the user updating the role
   * @returns {Promise<Object>} Updated role
   */
  async updateRole(roleId, updateData, userId) {
    const { name, description, permissions } = updateData;
    const role = await this.getRoleById(roleId);

    if (role.isSystem) {
      throw new ForbiddenError('Cannot modify system roles');
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Update role details if provided
      if (name || description) {
        await connection.query(
          'UPDATE roles SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE id = ?',
          [name, description, roleId]
        );
      }

      // Update permissions if provided
      if (Array.isArray(permissions)) {
        // Remove existing permissions
        await connection.query('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);

        // Add new permissions
        if (permissions.length > 0) {
          const permissionValues = permissions.map(permissionId => [roleId, permissionId]);
          await connection.query(
            'INSERT INTO role_permissions (role_id, permission_id) VALUES ?',
            [permissionValues]
          );
        }
      }

      await connection.commit();

      // Log the action
      await auditLog({
        userId,
        action: 'UPDATE',
        resourceType: 'ROLE',
        resourceId: roleId,
        metadata: { name: name || role.name, updatedFields: Object.keys(updateData) }
      });

      return this.getRoleById(roleId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Delete a role
   * @param {string} roleId - Role ID
   * @param {string} userId - ID of the user deleting the role
   * @returns {Promise<boolean>} True if deleted successfully
   */
  async deleteRole(roleId, userId) {
    const role = await this.getRoleById(roleId);

    if (role.isSystem) {
      throw new ForbiddenError('Cannot delete system roles');
    }

    // Check if any users are assigned to this role
    const [users] = await pool.query('SELECT COUNT(*) as count FROM users WHERE role_id = ?', [roleId]);
    if (users[0].count > 0) {
      throw new ConflictError('Cannot delete role that is assigned to users');
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Delete role permissions
      await connection.query('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);
      
      // Delete the role
      const [result] = await connection.query('DELETE FROM roles WHERE id = ?', [roleId]);
      
      if (result.affectedRows === 0) {
        throw new NotFoundError('Role', roleId);
      }

      await connection.commit();

      // Log the action
      await auditLog({
        userId,
        action: 'DELETE',
        resourceType: 'ROLE',
        resourceId: roleId,
        metadata: { name: role.name }
      });

      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get all available permissions
   * @returns {Promise<Array>} List of all permissions
   */
  async getAllPermissions() {
    const [permissions] = await pool.query(
      'SELECT * FROM permissions ORDER BY resource, action'
    );
    
    return permissions.map(p => ({
      id: p.id,
      resource: p.resource,
      action: p.action,
      description: p.description,
      createdAt: p.created_at
    }));
  }
}

module.exports = new RoleController();
