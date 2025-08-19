const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' });

async function checkRefreshTokensSchema() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'bola8pos',
    password: process.env.DB_PASSWORD || 'changeme',
    database: process.env.DB_NAME || 'bola8pos'
  });

  try {
    console.log('Checking refresh_tokens table structure...');
    
    // Get table structure
    const [columns] = await connection.execute('DESCRIBE refresh_tokens');
    console.log('Current columns in refresh_tokens table:');
    console.table(columns);
    
    // Check for auto_increment on id
    const idColumn = columns.find(col => col.Field === 'id');
    if (idColumn) {
      console.log('\nid column details:');
      console.table([idColumn]);
      
      if (!idColumn.Extra.includes('auto_increment')) {
        console.log('\n⚠️ id column does not have AUTO_INCREMENT');
      }
    } else {
      console.log('\n❌ id column does not exist in refresh_tokens table');
    }
    
    // Check for required columns
    const requiredColumns = ['id', 'user_id', 'token', 'created_at', 'expires_at', 'revoked'];
    const missingColumns = requiredColumns.filter(col => !columns.some(c => c.Field === col));
    
    if (missingColumns.length > 0) {
      console.log('\n❌ Missing required columns:', missingColumns);
    } else {
      console.log('\n✅ All required columns exist');
    }
    
    // Check indexes
    const [indexes] = await connection.execute('SHOW INDEX FROM refresh_tokens');
    console.log('\nIndexes on refresh_tokens table:');
    console.table(indexes);
    
    // Check foreign key constraints
    const [fkInfo] = await connection.execute(`
      SELECT * FROM information_schema.KEY_COLUMN_USAGE 
      WHERE TABLE_NAME = 'refresh_tokens' 
      AND REFERENCED_TABLE_NAME IS NOT NULL
    `);
    
    console.log('\nForeign key constraints:');
    if (fkInfo.length > 0) {
      console.table(fkInfo);
    } else {
      console.log('No foreign key constraints found');
    }
    
  } catch (error) {
    console.error('Error checking refresh_tokens schema:', error);
  } finally {
    await connection.end();
  }
}

checkRefreshTokensSchema().catch(console.error);
