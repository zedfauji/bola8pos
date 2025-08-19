const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

// Database configuration
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'bola8pos',
  password: process.env.DB_PASSWORD || 'changeme',
  database: process.env.DB_NAME || 'bola8pos',
  multipleStatements: true
};

// Enable console colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

const ADMIN_EMAIL = 'admin@billiardpos.com';
const NEW_PASSWORD = 'password';

async function resetAdminPassword() {
  let connection;
  try {
    console.log(colors.blue, '🔑 Starting admin password reset...', colors.reset);
    console.log(colors.blue, `📋 Target user: ${ADMIN_EMAIL}`, colors.reset);
    
    // Generate salt and hash the new password
    console.log(colors.blue, '🔒 Hashing new password...', colors.reset);
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(NEW_PASSWORD, salt);
    
    // Connect to the database
    console.log(colors.blue, `🔌 Connecting to database ${DB_CONFIG.database}@${DB_CONFIG.host}:${DB_CONFIG.port}...`, colors.reset);
    connection = await mysql.createConnection(DB_CONFIG);
    
    // First, check if the users table exists
    const [tables] = await connection.execute(
      "SHOW TABLES LIKE 'users'"
    );
    
    if (tables.length === 0) {
      throw new Error('The `users` table does not exist in the database');
    }
    
    // Ensure admin role exists
    const [roles] = await connection.execute(
      "SELECT id FROM roles WHERE name = 'Administrator' OR id = 'role_admin' LIMIT 1"
    );
    
    if (roles.length === 0) {
      throw new Error('Admin role not found. Please run database migrations first.');
    }
    
    const adminRoleId = roles[0].id;
    
    // Check if admin user exists
    const [users] = await connection.execute(
      'SELECT * FROM users WHERE email = ?',
      [ADMIN_EMAIL]
    );
    
    let result;
    if (users.length === 0) {
      // Create admin user if it doesn't exist (matching seed file format)
      console.log(colors.blue, '👤 Creating admin user...', colors.reset);
      [result] = await connection.execute(
        'INSERT INTO users (id, email, name, password, role_id, is_active) VALUES (?, ?, ?, ?, ?, ?)',
        ['admin', ADMIN_EMAIL, 'Administrator', hashedPassword, adminRoleId, true]
      );
    } else {
      // Update existing admin password and ensure role is set
      console.log(colors.blue, '🔄 Updating admin user...', colors.reset);
      [result] = await connection.execute(
        'UPDATE users SET password = ?, role_id = ?, is_active = TRUE WHERE email = ?',
        [hashedPassword, adminRoleId, ADMIN_EMAIL]
      );
      
      // If no rows were updated, the user might exist but with a different email case
      if (result.affectedRows === 0) {
        console.log(colors.yellow, '⚠️  No rows updated. Trying case-insensitive search...', colors.reset);
        [result] = await connection.execute(
          'UPDATE users SET password = ?, role_id = ?, is_active = TRUE WHERE LOWER(email) = LOWER(?)',
          [hashedPassword, adminRoleId, ADMIN_EMAIL]
        );
      }
    }
    
    if (result.affectedRows === 0) {
      console.warn(colors.yellow, `⚠️  Warning: No user found with email ${ADMIN_EMAIL}`, colors.reset);
      
      // Check if any users exist
      const [users] = await connection.execute('SELECT email FROM users LIMIT 1');
      if (users.length === 0) {
        console.warn(colors.yellow, 'ℹ️  No users found in the database', colors.reset);
      } else {
        console.log(colors.blue, `ℹ️  Found ${users.length} user(s) in the database`, colors.reset);
      }
    } else {
      console.log(colors.green, '✅ Password reset successful!', colors.reset);
      console.log(colors.blue, '🔑 New password (plaintext):', colors.reset, NEW_PASSWORD);
      console.log(colors.blue, '🔐 New password hash:', colors.reset, hashedPassword);
      console.log(colors.green, `🔄 Updated ${result.affectedRows} user(s)`, colors.reset);
    }
    
  } catch (error) {
    console.error(colors.red, '❌ Error resetting admin password:', error.message, colors.reset);
    
    // Provide more helpful error messages
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error(colors.red, '❌ Database authentication failed. Please check your database credentials:', colors.reset);
      console.error(colors.red, `   - Host: ${DB_CONFIG.host}`, colors.reset);
      console.error(colors.red, `   - User: ${DB_CONFIG.user}`, colors.reset);
      console.error(colors.red, '   - Make sure the database user has the correct permissions', colors.reset);
    } else if (error.code === 'ECONNREFUSED') {
      console.error(colors.red, '❌ Could not connect to the database server:', colors.reset);
      console.error(colors.red, `   - Make sure MySQL is running on ${DB_CONFIG.host}:${DB_CONFIG.port}`, colors.reset);
      console.error(colors.red, '   - Check if the MySQL service is started', colors.reset);
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error(colors.red, `❌ Database '${DB_CONFIG.database}' does not exist`, colors.reset);
      console.error(colors.red, '   - Create the database first: CREATE DATABASE ' + DB_CONFIG.database, colors.reset);
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log(colors.blue, '🔌 Database connection closed', colors.reset);
    }
  }
}

// Execute the password reset
resetAdminPassword().catch(console.error);
