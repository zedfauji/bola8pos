const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: '../.env' });

async function fixRefreshTokensId() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'bola8pos',
    password: process.env.DB_PASSWORD || 'changeme',
    database: process.env.DB_NAME || 'bola8pos',
    multipleStatements: true
  });

  try {
    console.log('Connected to database. Fixing refresh_tokens table...');
    
    // First, check if we have any existing data
    const [rows] = await connection.execute('SELECT COUNT(*) as count FROM refresh_tokens');
    const hasData = rows[0].count > 0;
    
    if (hasData) {
      console.log(`Found ${rows[0].count} existing refresh tokens. Backing up table...`);
      
      const backupTableName = `refresh_tokens_backup_${Date.now()}`;
      
      // Create backup table
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS ${backupTableName} LIKE refresh_tokens;
      `);
      
      // Copy data to backup
      await connection.execute(`
        INSERT INTO ${backupTableName} SELECT * FROM refresh_tokens;
      `);
      
      console.log('Backup created. Updating existing records with UUIDs...');
      
      // Add a temporary column to store the new IDs
      await connection.execute(`
        ALTER TABLE refresh_tokens 
        ADD COLUMN new_id VARCHAR(36) AFTER id;
      `);
      
      // Generate UUIDs for existing records
      const [tokens] = await connection.execute('SELECT id FROM refresh_tokens');
      for (const token of tokens) {
        const newId = uuidv4();
        await connection.execute(
          'UPDATE refresh_tokens SET new_id = ? WHERE id = ?',
          [newId, token.id]
        );
      }
      
      // Drop the old primary key and old id column
      await connection.execute(`
        ALTER TABLE refresh_tokens 
        DROP PRIMARY KEY,
        DROP COLUMN id,
        CHANGE COLUMN new_id id VARCHAR(36) NOT NULL FIRST;
      `);
      
      // Add back primary key
      await connection.execute(`
        ALTER TABLE refresh_tokens 
        ADD PRIMARY KEY (id);
      `);
      
      console.log('Successfully updated existing records with UUIDs');
    } else {
      console.log('No existing data found. Modifying table structure...');
      
      // For empty table, we can just modify the column directly
      await connection.execute(`
        ALTER TABLE refresh_tokens 
        MODIFY COLUMN id VARCHAR(36) NOT NULL;
      `);
    }
    
    // Ensure the table has the correct structure - execute each ALTER TABLE separately
    console.log('Updating table structure...');
    
    // 1. Modify id column
    await connection.execute(`
      ALTER TABLE refresh_tokens 
      MODIFY COLUMN id VARCHAR(36) NOT NULL
    `);
    
    // 2. Modify user_id column
    await connection.execute(`
      ALTER TABLE refresh_tokens 
      MODIFY COLUMN user_id VARCHAR(36) NOT NULL
    `);
    
    // 3. Modify token column
    await connection.execute(`
      ALTER TABLE refresh_tokens 
      MODIFY COLUMN token VARCHAR(255) NOT NULL
    `);
    
    // 4. Modify created_at column
    await connection.execute(`
      ALTER TABLE refresh_tokens 
      MODIFY COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);
    
    // 5. Modify expires_at column
    await connection.execute(`
      ALTER TABLE refresh_tokens 
      MODIFY COLUMN expires_at TIMESTAMP NOT NULL
    `);
    
    // 6. Modify revoked column
    await connection.execute(`
      ALTER TABLE refresh_tokens 
      MODIFY COLUMN revoked BOOLEAN DEFAULT FALSE
    `);
    
    // 7. Add unique key if it doesn't exist
    try {
      await connection.execute(`
        CREATE UNIQUE INDEX token_unique ON refresh_tokens (token)
      `);
    } catch (error) {
      if (error.code !== 'ER_DUP_KEYNAME') {
        throw error; // Re-throw if it's not a duplicate key error
      }
      console.log('Unique key token_unique already exists');
    }
    
    // 8. Check if foreign key constraint exists
    const [fkCheck] = await connection.execute(`
      SELECT COUNT(*) as fk_exists
      FROM information_schema.TABLE_CONSTRAINTS 
      WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'refresh_tokens'
      AND CONSTRAINT_NAME = 'fk_refresh_tokens_user_id'
      AND CONSTRAINT_TYPE = 'FOREIGN KEY';
    `);
    
    if (fkCheck[0].fk_exists === 0) {
      console.log('Adding foreign key constraint...');
      try {
        await connection.execute(`
          ALTER TABLE refresh_tokens 
          ADD CONSTRAINT fk_refresh_tokens_user_id 
          FOREIGN KEY (user_id) REFERENCES users(id) 
          ON DELETE CASCADE
        `);
        console.log('Foreign key constraint added successfully');
      } catch (error) {
        console.error('Failed to add foreign key constraint:', error.message);
        console.log('This might be due to existing data that violates the constraint');
      }
    } else {
      console.log('Foreign key constraint already exists');
    }
    
    console.log('✅ refresh_tokens table structure updated successfully');
    
    // Drop existing procedure if it exists using query instead of execute
    await connection.query('DROP PROCEDURE IF EXISTS insert_refresh_token');
    
    // Create the stored procedure using query instead of execute
    await connection.query(`
      CREATE PROCEDURE insert_refresh_token(
        IN p_user_id VARCHAR(36),
        IN p_token VARCHAR(255),
        IN p_expires_at TIMESTAMP,
        IN p_user_agent TEXT,
        IN p_ip_address VARCHAR(45)
      )
      BEGIN
        DECLARE new_id VARCHAR(36);
        SET new_id = UUID();
        
        INSERT INTO refresh_tokens (
          id, 
          user_id, 
          token, 
          expires_at, 
          user_agent, 
          ip_address,
          created_at,
          revoked
        ) VALUES (
          new_id,
          p_user_id,
          p_token,
          p_expires_at,
          p_user_agent,
          p_ip_address,
          CURRENT_TIMESTAMP,
          FALSE
        );
        
        SELECT new_id as id;
      END
    `);
    
    console.log('✅ Created stored procedure for token insertion');
    
  } catch (error) {
    console.error('❌ Error fixing refresh_tokens table:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

// Run the fix
fixRefreshTokensId()
  .then(() => console.log('✅ Refresh tokens table fix completed successfully'))
  .catch(error => {
    console.error('❌ Error during refresh tokens table fix:', error);
    process.exit(1);
  });
