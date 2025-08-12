const { pool } = require('../../db');

class BaseController {
  constructor(tableName) {
    this.tableName = tableName;
  }

  // Helper to handle database queries
  async query(sql, params = []) {
    const [rows] = await pool.query(sql, params);
    return rows;
  }

  // Helper to handle single result queries
  async queryOne(sql, params = []) {
    const [rows] = await pool.query(sql, params);
    return rows[0];
  }

  // Get all records with pagination
  async findAll(page = 1, limit = 50, where = '', params = []) {
    const offset = (page - 1) * limit;
    let query = `SELECT * FROM ${this.tableName}`;
    
    if (where) {
      query += ` WHERE ${where}`;
    }
    
    query += ` LIMIT ? OFFSET ?`;
    
    return this.query(query, [...params, limit, offset]);
  }

  // Find by ID
  async findById(id) {
    return this.queryOne(`SELECT * FROM ${this.tableName} WHERE id = ?`, [id]);
  }

  // Create new record
  async create(data) {
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);
    try { console.log(`[DEBUG] BaseController.create ${this.tableName}`, { keys: Object.keys(data), id: data && data.id }); } catch {}
    
    const [result] = await pool.query(
      `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders})`,
      values
    );
    // If caller provided an explicit id (e.g., VARCHAR PK), use it; otherwise use insertId
    const id = data.id !== undefined && data.id !== null ? data.id : result.insertId;
    return this.findById(id);
  }

  // Update record
  async update(id, data) {
    const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(data), id];
    
    await pool.query(
      `UPDATE ${this.tableName} SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );
    
    return this.findById(id);
  }

  // Delete record
  async delete(id) {
    await pool.query(`DELETE FROM ${this.tableName} WHERE id = ?`, [id]);
    return { id };
  }

  // Soft delete (if table has is_active field)
  async softDelete(id) {
    await pool.query(
      `UPDATE ${this.tableName} SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id]
    );
    return this.findById(id);
  }

  // Check if record exists
  async exists(id) {
    const result = await this.queryOne(
      `SELECT 1 FROM ${this.tableName} WHERE id = ?`,
      [id]
    );
    return !!result;
  }
}

module.exports = BaseController;
