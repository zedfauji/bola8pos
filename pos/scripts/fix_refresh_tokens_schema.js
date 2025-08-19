const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' });

async function fixRefreshTokensSchema() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'bola8pos',
    password: process.env.DB_PASSWORD || 'changeme',
    database: process.env.DB_NAME || 'bola8pos'
  });

  try {
    console.log('1. Checking current schema...');
    
    // Check if we need to add UUID() as default
    const [columns] = await connection.execute(
      `SHOW COLUMNS FROM refresh_tokens WHERE Field = 'id'`
    );
    
    const idColumn = columns[0];
    console.log('   Current id column:', JSON.stringify(idColumn, null, 2));
    
    if (idColumn.Default === null) {
      console.log('2. Adding UUID() as default for id column...');
      
      // First, drop the foreign key constraint if it exists
      console.log('   - Dropping foreign key constraints...');
      try {
        await connection.execute(
          `ALTER TABLE refresh_tokens DROP FOREIGN KEY fk_refresh_tokens_user_id`
        );
      } catch (error) {
        console.log('     Foreign key already dropped or does not exist');
      }
      
      try {
        await connection.execute(
          `ALTER TABLE refresh_tokens DROP FOREIGN KEY refresh_tokens_ibfk_1`
        );
      } catch (error) {
        console.log('     Foreign key already dropped or does not exist');
      }
      
      // Drop the unique index on token if it exists
      console.log('   - Dropping unique index on token...');
      try {
        await connection.execute(
          `ALTER TABLE refresh_tokens DROP INDEX unique_token`
        );
      } catch (error) {
        console.log('     Unique index already dropped or does not exist');
      }
      
      try {
        await connection.execute(
          `ALTER TABLE refresh_tokens DROP INDEX token_unique`
        );
      } catch (error) {
        console.log('     Unique index already dropped or does not exist');
      }
      
      // Drop the primary key
      console.log('   - Dropping primary key...');
      await connection.execute(
        `ALTER TABLE refresh_tokens DROP PRIMARY KEY`
      );
      
      // Add a temporary column to store the UUIDs
      console.log('   - Adding temporary column...');
      await connection.execute(
        `ALTER TABLE refresh_tokens ADD COLUMN temp_id VARCHAR(36) AFTER id`
      );
      
      // Generate UUIDs for existing rows
      console.log('   - Generating UUIDs for existing rows...');
      await connection.execute(
        `UPDATE refresh_tokens SET temp_id = UUID()`
      );
      
      // Drop the old id column
      console.log('   - Dropping old id column...');
      await connection.execute(
        `ALTER TABLE refresh_tokens DROP COLUMN id`
      );
      
      // Rename temp_id to id and make it primary key
      console.log('   - Creating new id column with UUID default...');
      await connection.execute(
        `ALTER TABLE refresh_tokens CHANGE COLUMN temp_id id VARCHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID())`
      );
      
      // Recreate the unique index on token
      console.log('   - Recreating unique index on token...');
      await connection.execute(
        `ALTER TABLE refresh_tokens ADD UNIQUE INDEX token_unique (token)`
      );
      
      // Recreate the foreign key
      console.log('   - Recreating foreign key...');
      await connection.execute(
        `ALTER TABLE refresh_tokens ADD CONSTRAINT fk_refresh_tokens_user_id 
         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`
      );
      
      console.log('✅ Schema updated successfully!');
    } else {
      console.log('✅ id column already has a default value');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code) console.error('   Error code:', error.code);
    if (error.sql) console.error('   SQL:', error.sql);
  } finally {
    await connection.end();
  }
}

fixRefreshTokensSchema().catch(console.error);
