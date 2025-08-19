const { pool } = require('../db');
const { v4: uuidv4 } = require('uuid');

// Cache of audit_logs table columns (names and types) to avoid repeated DESCRIBE
let auditColumnsCache = null;

async function getAuditColumns() {
  if (auditColumnsCache) return auditColumnsCache;
  try {
    const [rows] = await pool.query('DESCRIBE audit_logs');
    const set = new Set(rows.map(r => r.Field));
    const types = new Map(rows.map(r => [r.Field, String(r.Type || '')]));
    auditColumnsCache = { set, types };
  } catch (e) {
    // If DESCRIBE fails, use empty structures so inserts are skipped gracefully
    auditColumnsCache = { set: new Set(), types: new Map() };
  }
  return auditColumnsCache;
}

/**
 * Log an audit event
 * @param {Object} params
 * @param {string} params.userId - ID of the user performing the action
 * @param {string} params.action - Action performed (e.g., 'CREATE', 'UPDATE', 'DELETE', 'LOGIN')
 * @param {string} params.resourceType - Type of resource being acted upon (e.g., 'USER', 'ORDER')
 * @param {string} [params.resourceId] - ID of the resource being acted upon
 * @param {string} [params.ipAddress] - IP address of the client
 * @param {string} [params.userAgent] - User agent string
 * @param {Object} [params.metadata] - Additional metadata about the event
 * @returns {Promise<void>}
 */
async function auditLog({
  userId,
  action,
  resourceType,
  resourceId = null,
  ipAddress = null,
  userAgent = null,
  metadata = {}
}) {
  try {
    const { set: available, types } = await getAuditColumns();
    // Determine whether to include 'id' based on column type (UUID fits non-integer types)
    const idType = (types.get('id') || '').toLowerCase();
    const includeId = available.has('id') && !/int/.test(idType);

    // Define desired columns in preferred order (without id; added conditionally)
    const desired = ['user_id','action','resource_type','resource_id','ip_address','user_agent','metadata'];
    const cols = desired.filter(c => available.has(c));
    if (includeId) cols.unshift('id');
    if (cols.length === 0) {
      // Table missing or no usable columns; skip silently
      return;
    }
    const valuesMap = {
      user_id: userId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: JSON.stringify(metadata)
    };
    const placeholders = cols.map(() => '?').join(', ');
    const values = cols.map(c => (c === 'id' ? uuidv4() : valuesMap[c]));
    const sql = `INSERT INTO audit_logs (${cols.join(', ')}) VALUES (${placeholders})`;
    await pool.query(sql, values);
  } catch (error) {
    console.error('Failed to write audit log:', error);
    // Don't throw to avoid breaking the main operation
  }
}

/**
 * Get audit logs with pagination and filtering
 * @param {Object} options - Query options
 * @param {number} [options.limit=50] - Number of logs to return
 * @param {number} [options.offset=0] - Offset for pagination
 * @param {string} [options.userId] - Filter by user ID
 * @param {string} [options.action] - Filter by action
 * @param {string} [options.resourceType] - Filter by resource type
 * @param {string} [options.resourceId] - Filter by resource ID
 * @param {Date} [options.startDate] - Filter logs after this date
 * @param {Date} [options.endDate] - Filter logs before this date
 * @returns {Promise<Array>} - Array of audit logs
 */
async function getAuditLogs({
  limit = 50,
  offset = 0,
  userId,
  action,
  resourceType,
  resourceId,
  startDate,
  endDate
} = {}) {
  const queryParams = [];
  const whereClauses = [];

  // Build WHERE clause based on provided filters
  if (userId) {
    whereClauses.push('user_id = ?');
    queryParams.push(userId);
  }
  if (action) {
    whereClauses.push('action = ?');
    queryParams.push(action);
  }
  if (resourceType) {
    whereClauses.push('resource_type = ?');
    queryParams.push(resourceType);
  }
  if (resourceId) {
    whereClauses.push('resource_id = ?');
    queryParams.push(resourceId);
  }
  if (startDate) {
    whereClauses.push('created_at >= ?');
    queryParams.push(startDate);
  }
  if (endDate) {
    whereClauses.push('created_at <= ?');
    queryParams.push(endDate);
  }

  // Build the final query
  let query = 'SELECT * FROM audit_logs';
  if (whereClauses.length > 0) {
    query += ' WHERE ' + whereClauses.join(' AND ');
  }
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  queryParams.push(limit, offset);

  const [logs] = await pool.query(query, queryParams);
  
  // Parse metadata JSON
  return logs.map(log => ({
    ...log,
    metadata: log.metadata ? JSON.parse(log.metadata) : null
  }));
}

/**
 * Get the count of audit logs matching the filters
 * @param {Object} filters - Same as getAuditLogs
 * @returns {Promise<number>} - Total count of matching logs
 */
async function getAuditLogsCount(filters = {}) {
  const { userId, action, resourceType, resourceId, startDate, endDate } = filters;
  const queryParams = [];
  const whereClauses = [];

  if (userId) {
    whereClauses.push('user_id = ?');
    queryParams.push(userId);
  }
  if (action) {
    whereClauses.push('action = ?');
    queryParams.push(action);
  }
  if (resourceType) {
    whereClauses.push('resource_type = ?');
    queryParams.push(resourceType);
  }
  if (resourceId) {
    whereClauses.push('resource_id = ?');
    queryParams.push(resourceId);
  }
  if (startDate) {
    whereClauses.push('created_at >= ?');
    queryParams.push(startDate);
  }
  if (endDate) {
    whereClauses.push('created_at <= ?');
    queryParams.push(endDate);
  }

  let query = 'SELECT COUNT(*) as count FROM audit_logs';
  if (whereClauses.length > 0) {
    query += ' WHERE ' + whereClauses.join(' AND ');
  }

  const [result] = await pool.query(query, queryParams);
  return result[0].count;
}

module.exports = {
  auditLog,
  getAuditLogs,
  getAuditLogsCount
};
