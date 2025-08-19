const mysql = require('mysql2/promise');
require('dotenv').config();

async function addCreatedByColumn() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT) || 3306
  });

  try {
    console.log('Adding created_by column to table_layouts...');
    
    // Check if the column already exists
    const [rows] = await connection.execute(`
      SELECT * FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' 
      AND TABLE_NAME = 'table_layouts' 
      AND COLUMN_NAME = 'created_by'
    `);

    if (rows.length === 0) {
      // Add the created_by column if it doesn't exist
      console.log('Adding created_by column to table_layouts...');
      await connection.execute(`
        ALTER TABLE table_layouts 
        ADD COLUMN created_by VARCHAR(36) NOT NULL COMMENT 'ID of the user who created this layout' AFTER settings
      `);
      console.log('Successfully added created_by column to table_layouts');
    } else {
      console.log('created_by column already exists in table_layouts');
    }
    
    console.log('Successfully added created_by column to table_layouts');
    
    // Set a default value for existing records
    await connection.execute(`
      UPDATE table_layouts 
      SET created_by = '00000000-0000-0000-0000-000000000000' 
      WHERE created_by IS NULL OR created_by = ''
    `);
    
    console.log('Set default created_by for existing records');
    
  } catch (error) {
    console.error('Error adding created_by column:', error);
  } finally {
    await connection.end();
  }
}

addCreatedByColumn();
