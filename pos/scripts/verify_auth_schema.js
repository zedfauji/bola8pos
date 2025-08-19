const { Sequelize } = require('sequelize');
require('dotenv').config({ path: '../.env' });

async function verifyAuthSchema() {
  console.log('Verifying authentication schema...');
  
  // Create a connection using the same config as the backend
  const sequelize = new Sequelize(
    process.env.DB_NAME || 'bola8pos',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || 'password',
    {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      dialect: 'mysql',
      logging: console.log,
      define: {
        timestamps: true,
        underscored: true,
      },
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    }
  );

  try {
    await sequelize.authenticate();
    console.log('Successfully connected to the database');
    
    // Check if users table exists and has required columns
    const [usersTable] = await sequelize.query(
      "SHOW TABLES LIKE 'users'"
    );
    
    if (usersTable.length === 0) {
      console.error('❌ Users table does not exist');
      return;
    }
    
    console.log('✅ Users table exists');
    
    // Check if admin user exists
    const [adminUser] = await sequelize.query(
      "SELECT * FROM users WHERE email = 'admin@billiardpos.com'"
    );
    
    if (adminUser.length === 0) {
      console.log('ℹ️ Admin user does not exist. Creating...');
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('password', 10);
      
      await sequelize.query(
        `INSERT INTO users (id, email, password, name, is_active) 
         VALUES ('admin', 'admin@billiardpos.com', ?, 'Administrator', 1)`,
        { replacements: [hashedPassword] }
      );
      console.log('✅ Created admin user with email: admin@billiardpos.com and password: password');
    } else {
      console.log('✅ Admin user exists');
    }
    
    // Check if refresh_tokens table exists
    const [refreshTokensTable] = await sequelize.query(
      "SHOW TABLES LIKE 'refresh_tokens'"
    );
    
    if (refreshTokensTable.length === 0) {
      console.log('ℹ️ Creating refresh_tokens table...');
      await sequelize.query(`
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
      console.log('✅ Created refresh_tokens table');
    } else {
      console.log('✅ refresh_tokens table exists');
    }
    
    // Verify token_blacklist table
    const [tokenBlacklistTable] = await sequelize.query(
      "SHOW TABLES LIKE 'token_blacklist'"
    );
    
    if (tokenBlacklistTable.length === 0) {
      console.log('ℹ️ Creating token_blacklist table...');
      await sequelize.query(`
        CREATE TABLE token_blacklist (
          id INT AUTO_INCREMENT PRIMARY KEY,
          token VARCHAR(255) NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX token_idx (token),
          INDEX expires_at_idx (expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log('✅ Created token_blacklist table');
    } else {
      console.log('✅ token_blacklist table exists');
    }
    
    console.log('\n✅ Authentication schema verification complete!');
    console.log('You can now try logging in with:');
    console.log('Email: admin@billiardpos.com');
    console.log('Password: password');
    
  } catch (error) {
    console.error('❌ Error verifying authentication schema:', error);
  } finally {
    await sequelize.close();
  }
}

verifyAuthSchema();
