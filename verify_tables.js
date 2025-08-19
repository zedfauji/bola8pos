const mysql = require('mysql2/promise');

async function verifyTables() {
  const config = {
    host: '127.0.0.1',
    port: 3306,
    user: 'bola8pos',
    password: 'changeme',
    database: 'bola8pos'
  };

  try {
    const connection = await mysql.createConnection(config);
    console.log('Connected to MySQL database');
    
    // Check if table_layouts exists
    const [tableLayouts] = await connection.execute(
      `SELECT * FROM information_schema.tables 
       WHERE table_schema = ? AND table_name = 'table_layouts'`,
      [config.database]
    );
    
    if (tableLayouts.length === 0) {
      console.log('❌ table_layouts table does not exist');
      
      // Check if we can create tables
      console.log('\nAttempting to create table_layouts table...');
      try {
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
        
        console.log('✅ Created table_layouts table');
        
        // Insert default layout
        await connection.execute(`
          INSERT INTO table_layouts (id, name, description, is_active, created_by)
          VALUES ('default-layout', 'Default Layout', 'Default table layout', TRUE, 'admin')
          ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;
        `);
        
        console.log('✅ Added default layout');
        
        // Add layout_id to tables if it doesn't exist
        await connection.execute(`
          ALTER TABLE tables 
          ADD COLUMN IF NOT EXISTS layout_id VARCHAR(36) AFTER id,
          ADD CONSTRAINT fk_tables_layout 
          FOREIGN KEY (layout_id) REFERENCES table_layouts(id) 
          ON DELETE SET NULL;
        `);
        
        console.log('✅ Added layout_id to tables table');
        
        // Update existing tables to use default layout
        await connection.execute(`
          UPDATE tables SET layout_id = 'default-layout' WHERE layout_id IS NULL;
        `);
        
        console.log('✅ Updated existing tables to use default layout');
        
      } catch (error) {
        console.error('❌ Error creating tables:');
        console.error(error.message);
      }
    } else {
      console.log('✅ table_layouts table exists');
    }
    
    // Verify tables structure
    console.log('\nTables structure:');
    const [tables] = await connection.execute(
      `SELECT table_name 
       FROM information_schema.tables 
       WHERE table_schema = ? AND table_name IN ('tables', 'table_blocks', 'table_layouts')`,
      [config.database]
    );
    
    for (const table of tables) {
      const [columns] = await connection.execute(
        `SELECT column_name, column_type, is_nullable, column_default, extra 
         FROM information_schema.columns 
         WHERE table_schema = ? AND table_name = ?`,
        [config.database, table.TABLE_NAME]
      );
      
      console.log(`\nTable: ${table.TABLE_NAME}`);
      console.table(columns);
    }
    
    // Check if we have any layouts
    const [layouts] = await connection.execute('SELECT * FROM table_layouts');
    console.log(`\nFound ${layouts.length} table layouts`);
    if (layouts.length > 0) {
      console.log('Layouts:', JSON.stringify(layouts, null, 2));
    }
    
    await connection.end();
  } catch (error) {
    console.error('Error verifying tables:');
    console.error(error.message);
  }
}

verifyTables();
