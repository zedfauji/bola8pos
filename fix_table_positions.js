const mysql = require('mysql2/promise');

async function fixTablePositions() {
  const config = {
    host: '127.0.0.1',
    port: 3306,
    user: 'bola8pos',
    password: 'changeme',
    database: 'bola8pos',
    multipleStatements: true
  };

  try {
    const connection = await mysql.createConnection(config);
    console.log('Connected to MySQL');

    // Add position columns if they don't exist
    await connection.execute(`
      ALTER TABLE tables 
      ADD COLUMN IF NOT EXISTS position_x INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS position_y INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS width INT DEFAULT 200,
      ADD COLUMN IF NOT EXISTS height INT DEFAULT 100,
      ADD COLUMN IF NOT EXISTS rotation INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS layout_id VARCHAR(36) DEFAULT 'default-layout',
      ADD COLUMN IF NOT EXISTS z_index INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS is_locked TINYINT(1) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS settings JSON DEFAULT '{"showLabel": true, "color": "#4a90e2"}',
      ADD COLUMN IF NOT EXISTS created_by VARCHAR(36) DEFAULT 'admin',
      ADD COLUMN IF NOT EXISTS updated_by VARCHAR(36) DEFAULT 'admin';
    `);

    console.log('✅ Added position and layout columns to tables');

    // Add foreign key constraint for layout_id
    try {
      await connection.execute(`
        ALTER TABLE tables 
        ADD CONSTRAINT fk_table_layout
        FOREIGN KEY (layout_id) 
        REFERENCES table_layouts(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE;
      `);
      console.log('✅ Added foreign key constraint for layout_id');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME' || error.code === 'ER_CANT_CREATE_TABLE') {
        console.log('ℹ️  Foreign key constraint already exists');
      } else {
        throw error;
      }
    }

    // Verify the columns were added
    const [columns] = await connection.execute('DESCRIBE tables');
    const addedColumns = [
      'position_x', 'position_y', 'width', 'height', 'rotation', 
      'layout_id', 'z_index', 'is_locked', 'settings', 'created_by', 'updated_by'
    ];
    
    const missingColumns = addedColumns.filter(col => 
      !columns.some(c => c.Field === col)
    );

    if (missingColumns.length === 0) {
      console.log('✅ Verified all columns exist in tables table');
      
      // Update existing tables to use the default layout
      await connection.execute(`
        UPDATE tables 
        SET layout_id = 'default-layout'
        WHERE layout_id IS NULL OR layout_id = '';
      `);
      
      console.log('✅ Updated existing tables with default layout');
      
      // Show the updated table structure
      const [results] = await connection.execute('SELECT * FROM tables LIMIT 1');
      console.log('\nSample table data with new columns:');
      console.table([{
        id: results[0].id,
        name: results[0].name,
        position_x: results[0].position_x || 0,
        position_y: results[0].position_y || 0,
        width: results[0].width || 200,
        height: results[0].height || 100,
        layout_id: results[0].layout_id || 'default-layout'
      }]);
      
      console.log('\n✅ Database schema updated successfully!');
      console.log('Try accessing the API endpoints again.');
    } else {
      console.log('❌ Missing columns:', missingColumns.join(', '));
    }
    
    await connection.end();
  } catch (error) {
    console.error('Error:', error.message);
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️  Some columns already exist');
      console.log('Try accessing the API endpoints again.');
    }
  }
}

fixTablePositions();
