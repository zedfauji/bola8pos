const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' });

async function fixRefreshTokensTable() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'bola8pos',
    password: process.env.DB_PASSWORD || 'changeme',
    database: process.env.DB_NAME || 'bola8pos',
    multipleStatements: true
  });

  try {
    console.log('Connected to database. Checking refresh_tokens table...');
    
    // Check if the table exists
    const [tables] = await connection.execute(
      "SHOW TABLES LIKE 'refresh_tokens'"
    );
    
    if (tables.length === 0) {
      console.log('Creating refresh_tokens table...');
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log('✓ Created refresh_tokens table');
    } else {
      console.log('✓ refresh_tokens table exists');
      
      // Check if the table has the correct structure
      const [columns] = await connection.execute('DESCRIBE refresh_tokens');
      console.log('Current columns:', columns);
      
      // Check if id column has auto_increment
      const idColumn = columns.find(col => col.Field === 'id');
      if (idColumn && !idColumn.Extra.includes('auto_increment')) {
        console.log('Fixing id column to be AUTO_INCREMENT...');
        await connection.execute(`
          ALTER TABLE refresh_tokens 
          MODIFY COLUMN id INT AUTO_INCREMENT PRIMARY KEY
        `);
        console.log('✓ Fixed id column to be AUTO_INCREMENT');
      }
      
      // Check if all required columns exist
      const requiredColumns = ['id', 'user_id', 'token', 'created_at', 'expires_at', 'revoked'];
      const existingColumns = columns.map(col => col.Field);
      const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
      
      if (missingColumns.length > 0) {
        console.log('Adding missing columns:', missingColumns);
        
        for (const column of missingColumns) {
          let columnDef = '';
          switch(column) {
            case 'id':
              columnDef = 'ADD COLUMN id INT AUTO_INCREMENT PRIMARY KEY FIRST';
              break;
            case 'user_id':
              columnDef = 'ADD COLUMN user_id VARCHAR(64) NOT NULL';
              break;
            case 'token':
              columnDef = 'ADD COLUMN token VARCHAR(255) NOT NULL';
              break;
            case 'created_at':
              columnDef = 'ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP';
              break;
            case 'expires_at':
              columnDef = 'ADD COLUMN expires_at TIMESTAMP NOT NULL';
              break;
            case 'revoked':
              columnDef = 'ADD COLUMN revoked BOOLEAN DEFAULT FALSE';
              break;
          }
          
          if (columnDef) {
            await connection.execute(`ALTER TABLE refresh_tokens ${columnDef}`);
            console.log(`✓ Added ${column} column`);
          }
        }
      }
      
      // Add foreign key if it doesn't exist
      const [fkCheck] = await connection.execute(`
        SELECT * FROM information_schema.KEY_COLUMN_USAGE 
        WHERE TABLE_NAME = 'refresh_tokens' 
        AND COLUMN_NAME = 'user_id' 
        AND REFERENCED_TABLE_NAME IS NOT NULL
      `);
      
      if (fkCheck.length === 0) {
        console.log('Adding foreign key constraint...');
        await connection.execute(`
          ALTER TABLE refresh_tokens
          ADD CONSTRAINT fk_refresh_tokens_user_id
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        `);
        console.log('✓ Added foreign key constraint');
      }
      
      // Add unique constraint on token if it doesn't exist
      const [uniqueCheck] = await connection.execute(`
        SELECT * FROM information_schema.TABLE_CONSTRAINTS 
        WHERE TABLE_NAME = 'refresh_tokens' 
        AND CONSTRAINT_TYPE = 'UNIQUE'
        AND CONSTRAINT_NAME = 'token_unique'
      `);
      
      if (uniqueCheck.length === 0) {
        console.log('Adding unique constraint on token...');
        await connection.execute(`
          ALTER TABLE refresh_tokens
          ADD CONSTRAINT token_unique UNIQUE (token)
        `);
        console.log('✓ Added unique constraint on token');
      }
    }
    
    console.log('\n✅ refresh_tokens table is properly configured');
    
  } catch (error) {
    console.error('❌ Error fixing refresh_tokens table:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

fixRefreshTokensTable().catch(console.error);
