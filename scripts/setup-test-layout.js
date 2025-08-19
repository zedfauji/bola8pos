const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'pos/backend/.env' });

async function setupTestLayout() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'bola8pos',
    password: process.env.DB_PASSWORD || 'changeme',
    database: process.env.DB_NAME || 'bola8pos'
  });

  try {
    // Start transaction
    await connection.beginTransaction();

    // Check if default layout exists
    const [layouts] = await connection.execute(
      "SELECT * FROM table_layouts WHERE name = 'default-layout'"
    );

    let layoutId;
    
    if (layouts.length === 0) {
      // Create default layout
      const [result] = await connection.execute(
        `INSERT INTO table_layouts 
        (id, name, description, width, height, background_color, grid_size, is_active, created_by, settings)
        VALUES (?, ?, ?, 2000, 1500, '#f5f5f5', 10, 1, 'admin', ?)`,
        [
          'default-layout',
          'default-layout',
          'Default layout with test tables',
          JSON.stringify({ showGrid: true, snapToGrid: true, showTableNumbers: true, showStatus: true })
        ]
      );
      layoutId = result.insertId;
      console.log('Created default layout with ID:', layoutId);
    } else {
      layoutId = layouts[0].id;
      console.log('Using existing default layout with ID:', layoutId);
      
      // Make sure it's active
      await connection.execute(
        'UPDATE table_layouts SET is_active = 1 WHERE id = ?',
        [layoutId]
      );
    }

    // Check if we have any tables
    const [tables] = await connection.execute(
      'SELECT * FROM tables WHERE layout_id = ?',
      [layoutId]
    );

    if (tables.length === 0) {
      console.log('No tables found, creating test tables...');
      
      // Create some test tables
      const testTables = [
        { 
          id: 'table-1', 
          name: 'Table 1', 
          position_x: 100, 
          position_y: 100, 
          width: 200, 
          height: 100, 
          capacity: 4, 
          type: 'table', 
          status: 'available',
          settings: JSON.stringify({ color: '#4a90e2', showLabel: true })
        },
        { 
          id: 'table-2', 
          name: 'Table 2', 
          position_x: 400, 
          position_y: 100, 
          width: 200, 
          height: 100, 
          capacity: 4, 
          type: 'table', 
          status: 'available',
          settings: JSON.stringify({ color: '#4a90e2', showLabel: true })
        },
        { 
          id: 'booth-1', 
          name: 'Booth 1', 
          position_x: 100, 
          position_y: 300, 
          width: 300, 
          height: 150, 
          capacity: 6, 
          type: 'booth', 
          status: 'available',
          settings: JSON.stringify({ color: '#50e3c2', showLabel: true })
        },
        { 
          id: 'bar-1', 
          name: 'Bar 1', 
          position_x: 100, 
          position_y: 500, 
          width: 600, 
          height: 100, 
          capacity: 8, 
          type: 'bar', 
          status: 'available',
          settings: JSON.stringify({ color: '#f5a623', showLabel: true })
        }
      ];

      for (const table of testTables) {
        await connection.execute(
          `INSERT INTO tables 
          (id, name, layout_id, position_x, position_y, width, height, capacity, type, status, created_by, updated_by, settings)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin', 'admin', ?)`,
          [
            table.id,
            table.name,
            layoutId,
            table.position_x,
            table.position_y,
            table.width,
            table.height,
            table.capacity,
            table.type,
            table.status,
            table.settings
          ]
        );
      }
      
      console.log('Created test tables');
    } else {
      console.log(`Found ${tables.length} tables in layout`);
    }

    // Commit transaction
    await connection.commit();
    console.log('Test layout setup completed successfully');
    
  } catch (error) {
    // Rollback on error
    await connection.rollback();
    console.error('Error setting up test layout:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

setupTestLayout().catch(console.error);
