/**
 * Audit Logger Utility
 * Provides standardized audit logging functionality
 */
const { pool } = require('../db');
const logger = require('./logger');

/**
 * Log an audit event to the database
 * @param {Object} options - Audit log options
 * @param {String} options.action - Action performed (e.g., 'user_login', 'order_created')
 * @param {String} options.userId - ID of the user who performed the action
 * @param {String} options.resourceType - Type of resource affected (e.g., 'user', 'order')
 * @param {String|Number} options.resourceId - ID of the resource affected
 * @param {Object} options.metadata - Additional metadata about the action
 * @param {String} options.ipAddress - IP address of the user (optional)
 * @returns {Promise<Object>} Created audit log entry
 */
async function auditLog({
  action,
  userId,
  resourceType,
  resourceId,
  metadata = {},
  ipAddress = null
}) {
  try {
    // Get IP address from request if available
    const ip = ipAddress || 'system';
    
    // Insert audit log entry
    const [result] = await pool.query(
      `INSERT INTO audit_logs (
        action, user_id, resource_type, resource_id, 
        metadata, ip_address, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        action,
        userId,
        resourceType,
        resourceId,
        JSON.stringify(metadata),
        ip
      ]
    );
    
    // Return created audit log entry
    const [logs] = await pool.query(
      'SELECT * FROM audit_logs WHERE id = ?',
      [result.insertId]
    );
    
    return logs[0];
  } catch (error) {
    // Log error but don't fail the main operation
    logger.error('Failed to create audit log:', error);
    
    // Return minimal info to indicate failure
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get audit logs with filtering and pagination
 * @param {Object} options - Query options
 * @param {String} options.action - Filter by action
 * @param {String} options.userId - Filter by user ID
 * @param {String} options.resourceType - Filter by resource type
 * @param {String|Number} options.resourceId - Filter by resource ID
 * @param {Date} options.startDate - Filter by start date
 * @param {Date} options.endDate - Filter by end date
 * @param {Number} options.page - Page number for pagination
 * @param {Number} options.limit - Number of records per page
 * @returns {Promise<Object>} Audit logs with pagination info
 */
async function getAuditLogs({
  action,
  userId,
  resourceType,
  resourceId,
  startDate,
  endDate,
  page = 1,
  limit = 20
}) {
  try {
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT al.*, u.username as user_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    
    // Apply filters
    if (action) {
      query += ` AND al.action = ?`;
      params.push(action);
    }
    
    if (userId) {
      query += ` AND al.user_id = ?`;
      params.push(userId);
    }
    
    if (resourceType) {
      query += ` AND al.resource_type = ?`;
      params.push(resourceType);
    }
    
    if (resourceId) {
      query += ` AND al.resource_id = ?`;
      params.push(resourceId);
    }
    
    if (startDate) {
      query += ` AND al.created_at >= ?`;
      params.push(startDate);
    }
    
    if (endDate) {
      query += ` AND al.created_at <= ?`;
      params.push(endDate);
    }
    
    // Count total records for pagination
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM audit_logs al WHERE 1=1` + 
      query.substring(query.indexOf('WHERE 1=1') + 9, query.indexOf('LEFT JOIN users u')),
      params
    );
    
    const total = countResult[0].total;
    
    // Add pagination
    query += ` ORDER BY al.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);
    
    // Execute query
    const [logs] = await pool.query(query, params);
    
    // Parse metadata JSON
    logs.forEach(log => {
      if (log.metadata) {
        try {
          log.metadata = JSON.parse(log.metadata);
        } catch (e) {
          // Keep as string if parsing fails
        }
      }
    });
    
    // Return paginated response
    return {
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error('Error getting audit logs:', error);
    throw error;
  }
}

module.exports = {
  auditLog,
  getAuditLogs
};
