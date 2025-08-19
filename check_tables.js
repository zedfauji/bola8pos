const mysql = require('mysql2/promise');

async function checkTables() {
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
    
    // List all tables
    const [tables] = await connection.execute(
      `SELECT table_name 
       FROM information_schema.tables 
       WHERE table_schema = ?`, 
      [config.database]
    );
    
    console.log('\nTables in database:');
    console.table(tables.map(t => t.TABLE_NAME));
    
    // Check if table_layouts exists
    const [tableLayouts] = await connection.execute(
      `SELECT * FROM information_schema.tables 
       WHERE table_schema = ? AND table_name = 'table_layouts'`,
      [config.database]
    );
    
    if (tableLayouts.length === 0) {
      console.log('\n⚠️  table_layouts table does not exist!');
      console.log('This table is required for the tables/table-layouts functionality.');
    } else {
      console.log('\n✅ table_layouts table exists');
    }
    
    await connection.end();
  } catch (error) {
    console.error('Error checking tables:');
    console.error(error.message);
  }
}

checkTables();
