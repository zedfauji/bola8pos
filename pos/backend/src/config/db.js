const mysql = require('mysql2/promise');
require('dotenv').config();

// Create a connection pool
// Log the database connection parameters for debugging (without password)
console.log(`Connecting to database: ${process.env.DB_NAME} on ${process.env.DB_HOST} as ${process.env.DB_USER}`);

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost', 
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'billiardpos',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
});

// Test the connection
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('Successfully connected to the database');
    
    // Test a simple query to verify connection is working
    const [result] = await connection.query('SELECT 1 as test');
    console.log('Database query test successful:', result);
    
    connection.release();
    return true;
  } catch (error) {
    console.error('Error connecting to the database:', error);
    console.error('Database connection parameters: host=' + process.env.DB_HOST + 
                 ', user=' + process.env.DB_USER + 
                 ', database=' + process.env.DB_NAME);
    return false;
  }
}

// Export the pool and test function
module.exports = {
  pool,
  testConnection,
  // Export a getter for the pool to maintain backward compatibility
  getPool: () => pool
};
