const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' });

async function fixAuthTables() {
  // Get database connection from environment variables or use defaults
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'bola8pos',
    port: process.env.DB_PORT || 3306,
    multipleStatements: true
  };

  const connection = await mysql.createConnection(dbConfig);

  try {
    console.log('Connected to database. Checking auth tables...');

    // Create refresh_tokens table if it doesn't exist or fix its structure
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
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
    console.log('✓ refresh_tokens table verified/created');

    // Create token_blacklist table if it doesn't exist
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS token_blacklist (
        id INT AUTO_INCREMENT PRIMARY KEY,
        token VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX token_idx (token),
        INDEX expires_at_idx (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✓ token_blacklist table verified/created');

    // Verify users table has required columns
    await connection.execute(`
      ALTER TABLE users 
      MODIFY COLUMN id VARCHAR(64) NOT NULL,
      MODIFY COLUMN email VARCHAR(255) NOT NULL,
      MODIFY COLUMN password VARCHAR(255) NOT NULL,
      MODIFY COLUMN name VARCHAR(255) NOT NULL,
      MODIFY COLUMN is_active BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS role_id VARCHAR(64) NULL,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      ADD UNIQUE INDEX IF NOT EXISTS email_unique (email);
    `);
    console.log('✓ users table verified/updated');

    // Create roles table if it doesn't exist
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS roles (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY name_unique (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✓ roles table verified/created');

    // Create permissions table if it doesn't exist
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS permissions (
        id VARCHAR(64) PRIMARY KEY,
        resource VARCHAR(100) NOT NULL,
        action VARCHAR(50) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY resource_action_unique (resource, action)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✓ permissions table verified/created');

    // Create role_permissions table if it doesn't exist
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id VARCHAR(64) NOT NULL,
        permission_id VARCHAR(64) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (role_id, permission_id),
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
        FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✓ role_permissions table verified/created');

    // Ensure admin role exists
    const [adminRole] = await connection.execute(
      'SELECT id FROM roles WHERE name = ?',
      ['Administrator']
    );

    let adminRoleId = adminRole.length > 0 ? adminRole[0].id : null;

    if (!adminRoleId) {
      // Create admin role
      adminRoleId = 'role_admin';
      await connection.execute(
        'INSERT INTO roles (id, name, description) VALUES (?, ?, ?)',
        [adminRoleId, 'Administrator', 'System administrator with full access']
      );
      console.log('✓ Created Administrator role');
    }

    // Ensure admin user exists
    const [adminUser] = await connection.execute(
      'SELECT id FROM users WHERE email = ?',
      ['admin@billiardpos.com']
    );

    if (adminUser.length === 0) {
      // Create admin user with hashed password 'password'
      const hashedPassword = await bcrypt.hash('password', 10);
      await connection.execute(
        'INSERT INTO users (id, email, password, name, role_id, is_active) VALUES (?, ?, ?, ?, ?, ?)',
        ['admin', 'admin@billiardpos.com', hashedPassword, 'Administrator', adminRoleId, true]
      );
      console.log('✓ Created admin user with email: admin@billiardpos.com and password: password');
    } else {
      // Update existing admin user to ensure it has the correct role and is active
      await connection.execute(
        'UPDATE users SET role_id = ?, is_active = TRUE WHERE email = ?',
        [adminRoleId, 'admin@billiardpos.com']
      );
      console.log('✓ Verified admin user exists and is active');
    }

    console.log('\n✅ Authentication tables verified and ready to use!');
    console.log('You can now log in with:');
    console.log('Email: admin@billiardpos.com');
    console.log('Password: password');

  } catch (error) {
    console.error('❌ Error setting up authentication tables:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

// Handle bcrypt dependency
async function main() {
  try {
    // Try to use the existing bcrypt if available
    const bcrypt = require('bcrypt');
    await fixAuthTables();
  } catch (e) {
    console.log('bcrypt not found, using bcryptjs instead...');
    // Fall back to bcryptjs if bcrypt is not available
    global.bcrypt = require('bcryptjs');
    await fixAuthTables();
  }
}

main().catch(console.error);
