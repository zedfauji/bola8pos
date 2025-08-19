const mysql = require('mysql2/promise');
require('dotenv').config();

async function resetRateLimiter() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'billiard_pos',
    port: process.env.DB_PORT || 3306
  });

  try {
    // Clear rate limit records
    await connection.execute('DELETE FROM rate_limits WHERE key_name LIKE "%login%";');
    console.log('Rate limiter reset successfully');
  } catch (error) {
    console.error('Error resetting rate limiter:', error);
  } finally {
    await connection.end();
  }
}

resetRateLimiter();
