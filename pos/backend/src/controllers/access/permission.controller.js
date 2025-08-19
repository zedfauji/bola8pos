const { pool } = require('../../db');
const { v4: uuidv4 } = require('uuid');
const { NotFoundError, ConflictError } = require('../../utils/errors');
const { auditLog } = require('../../services/audit.service');

class PermissionController {
  /**
   * Create a new permission
   * @param {Object} permissionData - Permission data
   * @param {string} userId - ID of the user creating the permission
   * @returns {Promise<Object>} Created permission
   */
  async createPermission(permissionData, userId) {
    const { resource, action, description } = permissionData;
    const permissionId = uuidv4();

    // Check if permission with same resource and action already exists
    const [existing] = await pool.query(
      'SELECT id FROM permissions WHERE resource = ? AND action = ?',
      [resource, action]
    );

    if (existing.length > 0) {
      throw new ConflictError(`Permission for resource "${resource}" and action "${action}" already exists`);
    }

    // Insert permission
    await pool.query(
      'INSERT INTO permissions (id, resource, action, description) VALUES (?, ?, ?, ?)',
      [permissionId, resource, action, description]
    );

    // Log the action
    await auditLog({
      userId,
      action: 'CREATE',
      resourceType: 'PERMISSION',
      resourceId: permissionId,
      metadata: { resource, action }
    });

    return this.getPermissionById(permissionId);
  }

  /**
   * Get permission by ID
   * @param {string} permissionId - Permission ID
   * @returns {Promise<Object>} Permission details
   */
  async getPermissionById(permissionId) {
    const [permissions] = await pool.query(
      'SELECT * FROM permissions WHERE id = ?',
      [permissionId]
    );

    if (permissions.length === 0) {
      throw new NotFoundError('Permission', permissionId);
    }

    const perm = permissions[0];
    return {
      id: perm.id,
      resource: perm.resource,
      action: perm.action,
      description: perm.description,
      createdAt: perm.created_at
    };
  }

  /**
   * List permissions with pagination and filtering
   * @param {Object} options - Query options
   * @returns {Promise<{data: Array, total: number}>} List of permissions and total count
   */
  async listPermissions({ 
    page = 1, 
    limit = 50,
    resource = null,
    action = null,
    search = ''
  } = {}) {
    const offset = (page - 1) * limit;
    const queryParams = [];
    let whereClauses = [];

    if (resource) {
      whereClauses.push('resource = ?');
      queryParams.push(resource);
    }

    if (action) {
      whereClauses.push('action = ?');
      queryParams.push(action);
    }

    if (search) {
      whereClauses.push('(resource LIKE ? OR action LIKE ? OR description LIKE ?)');
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    const whereClause = whereClauses.length > 0 
      ? `WHERE ${whereClauses.join(' AND ')}` 
      : '';

    // Get total count
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM permissions ${whereClause}`,
      queryParams
    );
    const total = countResult[0].total;

    // Get paginated results
    const [permissions] = await pool.query(
      `SELECT * FROM permissions 
       ${whereClause}
       ORDER BY resource, action
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    );

    const formattedPermissions = permissions.map(perm => ({
      id: perm.id,
      resource: perm.resource,
      action: perm.action,
      description: perm.description,
      createdAt: perm.created_at
    }));

    return {
      data: formattedPermissions,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Delete a permission
   * @param {string} permissionId - Permission ID
   * @param {string} userId - ID of the user deleting the permission
   * @returns {Promise<boolean>} True if deleted successfully
   */
  async deletePermission(permissionId, userId) {
    const permission = await this.getPermissionById(permissionId);
    
    // Check if permission is assigned to any roles
    const [roles] = await pool.query(
      'SELECT COUNT(*) as count FROM role_permissions WHERE permission_id = ?',
      [permissionId]
    );
    
    if (roles[0].count > 0) {
      throw new ConflictError('Cannot delete permission that is assigned to roles');
    }

    const [result] = await pool.query(
      'DELETE FROM permissions WHERE id = ?',
      [permissionId]
    );

    if (result.affectedRows === 0) {
      throw new NotFoundError('Permission', permissionId);
    }

    // Log the action
    await auditLog({
      userId,
      action: 'DELETE',
      resourceType: 'PERMISSION',
      resourceId: permissionId,
      metadata: { 
        resource: permission.resource, 
        action: permission.action 
      }
    });

    return true;
  }

  /**
   * Get all unique resource names
   * @returns {Promise<Array>} List of unique resource names
   */
  async getResourceList() {
    const [resources] = await pool.query(
      'SELECT DISTINCT resource FROM permissions ORDER BY resource'
    );
    return resources.map(r => r.resource);
  }

  /**
   * Get all unique action names
   * @returns {Promise<Array>} List of unique action names
   */
  async getActionList() {
    const [actions] = await pool.query(
      'SELECT DISTINCT action FROM permissions ORDER BY action'
    );
    return actions.map(a => a.action);
  }
}

module.exports = new PermissionController();
