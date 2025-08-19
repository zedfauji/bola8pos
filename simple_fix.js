const mysql = require('mysql2/promise');

async function fix() {
  const config = {
    host: '127.0.0.1',
    port: 3306,
    user: 'bola8pos',
    password: 'changeme',
    database: 'bola8pos'
  };

  try {
    const connection = await mysql.createConnection(config);
    console.log('Connected to MySQL');

    // Add settings column
    await connection.execute(`
      ALTER TABLE table_layouts 
      ADD COLUMN settings JSON DEFAULT '{"showGrid": true, "snapToGrid": true, "showTableNumbers": true, "showStatus": true}'
    `);
    
    console.log('✅ Added settings column');
    
    // Show the updated table structure
    const [results] = await connection.execute('SHOW CREATE TABLE table_layouts');
    console.log('\nTable structure:');
    console.log(results[0]['Create Table']);
    
    await connection.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

fix();
