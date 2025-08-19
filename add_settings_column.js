const mysql = require('mysql2/promise');

async function addSettingsColumn() {
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

    // Add settings column with a default value
    await connection.execute(`
      ALTER TABLE table_layouts 
      ADD COLUMN settings JSON 
      DEFAULT ('{"showGrid": true, "snapToGrid": true, "showTableNumbers": true, "showStatus": true}');
    `);
    
    console.log('✅ Added settings column to table_layouts');
    
    // Verify the column was added
    const [columns] = await connection.execute('DESCRIBE table_layouts');
    const hasSettings = columns.some(col => col.Field === 'settings');
    
    if (hasSettings) {
      console.log('✅ Verified settings column exists');
      
      // Show the updated table structure
      const [results] = await connection.execute('SELECT * FROM table_layouts');
      console.log('\nCurrent data:');
      console.table(results);
      
      console.log('\n✅ Database schema updated successfully!');
      console.log('Try accessing the API endpoints again.');
    } else {
      console.log('❌ Failed to add settings column');
    }
    
    await connection.end();
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️  settings column already exists');
      console.log('Try accessing the API endpoints again.');
    } else {
      console.error('Error:', error.message);
    }
  }
}

addSettingsColumn();
