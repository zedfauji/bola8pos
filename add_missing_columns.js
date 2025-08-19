const mysql = require('mysql2/promise');

async function addMissingColumns() {
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

    // Add each column separately to handle any that already exist
    const columnsToAdd = [
      'position_x INT DEFAULT 0',
      'position_y INT DEFAULT 0',
      'width INT DEFAULT 200',
      'height INT DEFAULT 100',
      'rotation INT DEFAULT 0',
      'layout_id VARCHAR(36) DEFAULT \'default-layout\'',
      'z_index INT DEFAULT 0',
      'is_locked TINYINT(1) DEFAULT 0',
      'settings JSON',  // No default value for JSON in MySQL 5.7
      'created_by VARCHAR(36) DEFAULT \'admin\'',
      'updated_by VARCHAR(36) DEFAULT \'admin\''
    ];

    for (const columnDef of columnsToAdd) {
      const [colName] = columnDef.split(' ');
      try {
        await connection.execute(`
          ALTER TABLE tables 
          ADD COLUMN ${columnDef}
        `);
        console.log(`✅ Added column: ${colName}`);
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log(`ℹ️  Column already exists: ${colName}`);
        } else {
          throw error;
        }
      }
    }

    // Add foreign key constraint if it doesn't exist
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

    // Update existing tables to use the default layout and set default settings
    await connection.execute(`
      UPDATE tables 
      SET 
        layout_id = 'default-layout',
        settings = '{"showLabel": true, "color": "#4a90e2"}'
      WHERE layout_id IS NULL OR layout_id = '' OR settings IS NULL;
    `);
    
    console.log('✅ Updated existing tables with default layout and settings');
    
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
    
    await connection.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

addMissingColumns();
