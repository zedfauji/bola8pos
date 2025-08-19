/**
 * Script to add indexes to the users table
 * Run with: node src/scripts/add_user_indexes.js
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

async function addUserIndexes() {
  // Create connection pool
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'billiard_pos',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  try {
    console.log('Adding indexes to users table...');
    
    // Add index on email column
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);
    console.log('Added index on email column');
    
    // Add index on role column
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    `);
    console.log('Added index on role column');
    
    // Add index on is_active column
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
    `);
    console.log('Added index on is_active column');
    
    // Add index on last_login column
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login);
    `);
    console.log('Added index on last_login column');

    console.log('All indexes added successfully!');
  } catch (error) {
    console.error('Error adding indexes:', error);
  } finally {
    await pool.end();
  }
}

// Run the function
addUserIndexes()
  .then(() => {
    console.log('Script completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
  });
