const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

// Database configuration
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'bola8pos',
  password: process.env.DB_PASSWORD || 'changeme',
  database: process.env.DB_NAME || 'bola8pos',
  multipleStatements: true
};

async function setupTestTables() {
  let connection;
  try {
    console.log('🔌 Connecting to database...');
    connection = await mysql.createConnection(DB_CONFIG);
    
    // Create tables if they don't exist
    console.log('🔄 Setting up test tables...');
    
    // Create table_layouts table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS table_layouts (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT FALSE,
        floor_plan_image VARCHAR(255),
        width INT DEFAULT 1000,
        height INT DEFAULT 800,
        background_color VARCHAR(20) DEFAULT '#f5f5f5',
        grid_size INT DEFAULT 10,
        created_by VARCHAR(36) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    
    // Create tables table if it doesn't exist
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS tables (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        status ENUM('available', 'occupied', 'reserved', 'out_of_service') DEFAULT 'available',
        capacity INT DEFAULT 4,
        min_capacity INT DEFAULT 1,
        max_capacity INT DEFAULT 10,
        position_x INT DEFAULT 0,
        position_y INT DEFAULT 0,
        rotation INT DEFAULT 0,
        shape ENUM('rectangle', 'circle', 'oval', 'square') DEFAULT 'rectangle',
        width INT DEFAULT 100,
        height INT DEFAULT 100,
        radius INT DEFAULT 50,
        color VARCHAR(20) DEFAULT '#4CAF50',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    
    // Add layout_id to tables table if it doesn't exist
    await connection.execute(`
      ALTER TABLE tables 
      ADD COLUMN IF NOT EXISTS layout_id VARCHAR(36) 
      AFTER id,
      ADD CONSTRAINT fk_tables_layout 
      FOREIGN KEY (layout_id) 
      REFERENCES table_layouts(id) 
      ON DELETE SET NULL;
    `).catch(() => {}); // Ignore error if constraint already exists
    
    // Insert a default layout if none exists
    const [layouts] = await connection.execute('SELECT id FROM table_layouts LIMIT 1');
    if (layouts.length === 0) {
      console.log('➕ Adding default table layout...');
      await connection.execute(
        'INSERT INTO table_layouts (id, name, description, is_active, created_by) VALUES (?, ?, ?, ?, ?)',
        ['default-layout', 'Default Layout', 'Default table layout created by system', true, 'admin']
      );
      
      // Update existing tables to use the default layout
      await connection.execute(
        'UPDATE tables SET layout_id = ? WHERE layout_id IS NULL',
        ['default-layout']
      );
      
      console.log('✅ Default table layout created');
    }
    
    console.log('✅ Test tables setup completed successfully');
    
  } catch (error) {
    console.error('❌ Error setting up test tables:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the setup
setupTestTables()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  });
