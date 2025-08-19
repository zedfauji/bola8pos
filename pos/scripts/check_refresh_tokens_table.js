const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkTable() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'bola8pos',
    port: process.env.DB_PORT || 3306
  });

  try {
    // Check if table exists
    const [tables] = await connection.execute(
      "SHOW TABLES LIKE 'refresh_tokens'"
    );
    
    if (tables.length === 0) {
      console.log('refresh_tokens table does not exist. Creating it...');
      await connection.execute(`
        CREATE TABLE refresh_tokens (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL,
          token VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP NOT NULL,
          revoked BOOLEAN DEFAULT FALSE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE KEY token_unique (token)
        )
      `);
      console.log('Created refresh_tokens table');
    } else {
      console.log('refresh_tokens table exists. Checking structure...');
      const [columns] = await connection.execute('DESCRIBE refresh_tokens');
      console.log('Current columns:', columns);
    }

    // Check if there are any tokens for the admin user
    const [tokens] = await connection.execute(
      'SELECT * FROM refresh_tokens LIMIT 5'
    );
    console.log('Sample tokens:', tokens);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

checkTable();
