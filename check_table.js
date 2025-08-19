const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkTable() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT) || 3306
  });

  try {
    // Check table structure
    const [columns] = await connection.execute(`
      SHOW COLUMNS FROM table_layouts
    `);
    
    console.log('Table columns:');
    console.table(columns);
    
    // Check data
    const [rows] = await connection.execute(`
      SELECT id, name, created_by, created_at, updated_at 
      FROM table_layouts 
      LIMIT 5
    `);
    
    console.log('\nSample data:');
    console.table(rows);
    
  } catch (error) {
    console.error('Error checking table:', error);
  } finally {
    await connection.end();
  }
}

checkTable();
