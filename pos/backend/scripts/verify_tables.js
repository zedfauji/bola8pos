const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'bola8pos',
  password: process.env.DB_PASSWORD || 'changeme',
  database: process.env.DB_NAME || 'bola8pos',
  port: process.env.DB_PORT || 3306,
  multipleStatements: true
};

async function verifyDatabase() {
  let connection;
  try {
    // Create connection
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected to MySQL database');

    // Check if tables exist
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME IN ('table_layouts', 'tables', 'table_blocks')
    `, [dbConfig.database]);

    const existingTables = tables.map(t => t.TABLE_NAME);
    console.log('Existing tables:', existingTables);

    // Check if migrations table exists
    const [migrations] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'migrations'
    `, [dbConfig.database]);

    if (migrations.length === 0) {
      console.log('Creating migrations table...');
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS migrations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log('Created migrations table');
    }

    // Run the table layouts migration
    const migrationName = '20250816_create_table_layouts.sql';
    const [existingMigration] = await connection.execute(
      'SELECT id FROM migrations WHERE name = ?',
      [migrationName]
    );

    if (existingMigration.length === 0) {
      console.log('Running table layouts migration...');
      // This is a simplified version of the migration
      await connection.execute(`
        -- Create table_layouts table
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
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          settings JSON,
          deleted_at TIMESTAMP NULL DEFAULT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        -- Create table_blocks table
        CREATE TABLE IF NOT EXISTS table_blocks (
          id VARCHAR(64) PRIMARY KEY,
          table_id VARCHAR(64) NOT NULL,
          block_type VARCHAR(50) NOT NULL,
          position_x INT DEFAULT 0,
          position_y INT DEFAULT 0,
          width INT DEFAULT 100,
          height INT DEFAULT 100,
          rotation INT DEFAULT 0,
          z_index INT DEFAULT 1,
          settings JSON,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          layout_id VARCHAR(36),
          x INT DEFAULT 0,
          y INT DEFAULT 0,
          FOREIGN KEY (layout_id) REFERENCES table_layouts(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        -- Add layout_id to tables table if it doesn't exist
        ALTER TABLE tables 
        ADD COLUMN IF NOT EXISTS layout_id VARCHAR(36) AFTER id,
        ADD CONSTRAINT fk_tables_layout 
        FOREIGN KEY (layout_id) REFERENCES table_layouts(id) ON DELETE SET NULL;

        -- Insert default layout
        INSERT IGNORE INTO table_layouts (
          id, name, description, is_active, created_by, settings
        ) VALUES (
          'default-layout', 
          'Default Layout', 
          'Default table layout created by system', 
          TRUE, 
          'admin',
          '{"showGrid":true,"snapToGrid":true,"showTableNumbers":true,"showStatus":true}'
        );

        -- Record the migration
        INSERT INTO migrations (name) VALUES (?);
      `, [migrationName]);

      console.log('Migration completed successfully');
    } else {
      console.log('Migration already applied');
    }

    // Verify default layout exists
    const [layouts] = await connection.execute('SELECT * FROM table_layouts');
    console.log(`Found ${layouts.length} layouts in database`);

    if (layouts.length === 0) {
      console.log('Creating default layout...');
      await connection.execute(
        'INSERT INTO table_layouts (id, name, description, is_active, created_by) VALUES (?, ?, ?, ?, ?)',
        ['default-layout', 'Default Layout', 'Default layout created by system', true, 'admin']
      );
      console.log('Created default layout');
    }

    // Verify tables have layout_id
    const [tablesWithoutLayout] = await connection.execute(
      'SELECT COUNT(*) as count FROM tables WHERE layout_id IS NULL'
    );

    if (tablesWithoutLayout[0].count > 0) {
      console.log(`Found ${tablesWithoutLayout[0].count} tables without layout_id, updating...`);
      await connection.execute(
        'UPDATE tables SET layout_id = ? WHERE layout_id IS NULL',
        ['default-layout']
      );
      console.log('Updated tables with default layout');
    }

    console.log('Database verification completed successfully');

  } catch (error) {
    console.error('Error verifying database:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

// Run the verification
verifyDatabase().catch(console.error);
