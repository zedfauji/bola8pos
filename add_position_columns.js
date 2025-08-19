const mysql = require('mysql2/promise');

async function addPositionColumns() {
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

    // Add position_x column if it doesn't exist
    try {
      await connection.execute(`
        ALTER TABLE tables 
        ADD COLUMN position_x INT DEFAULT 0;
      `);
      console.log('✅ Added position_x column');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️  position_x column already exists');
      } else {
        throw error;
      }
    }

    // Add position_y column if it doesn't exist
    try {
      await connection.execute(`
        ALTER TABLE tables 
        ADD COLUMN position_y INT DEFAULT 0;
      `);
      console.log('✅ Added position_y column');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️  position_y column already exists');
      } else {
        throw error;
      }
    }

    // Verify the columns were added
    const [columns] = await connection.execute('DESCRIBE tables');
    const hasPositionX = columns.some(col => col.Field === 'position_x');
    const hasPositionY = columns.some(col => col.Field === 'position_y');
    
    if (hasPositionX && hasPositionY) {
      console.log('✅ Verified position columns exist');
      
      // Show a sample of the updated data
      const [results] = await connection.execute('SELECT id, name, position_x, position_y FROM tables LIMIT 1');
      console.log('\nSample table data with position columns:');
      console.table(results);
      
      console.log('\n✅ Database schema updated successfully!');
      console.log('Try accessing the API endpoints again.');
    } else {
      console.log('❌ Missing columns:', 
        (!hasPositionX ? 'position_x' : '') + 
        (!hasPositionY ? (hasPositionX ? ', ' : '') + 'position_y' : '')
      );
    }
    
    await connection.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

addPositionColumns();
