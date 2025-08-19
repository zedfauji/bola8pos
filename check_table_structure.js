const mysql = require('mysql2/promise');

async function checkTableStructure() {
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

    // Check if table_layouts exists
    const [tables] = await connection.execute(
      "SHOW TABLES LIKE 'table_layouts'"
    );

    if (tables.length === 0) {
      console.log('❌ table_layouts table does not exist');
      await connection.end();
      return;
    }

    // Get table structure
    const [columns] = await connection.execute('DESCRIBE table_layouts');
    console.log('\nTable structure:');
    console.table(columns);

    // Show sample data
    const [rows] = await connection.execute('SELECT * FROM table_layouts LIMIT 5');
    console.log('\nSample data:');
    console.table(rows);

    // Show create table statement
    const [createTable] = await connection.execute('SHOW CREATE TABLE table_layouts');
    console.log('\nCreate table statement:');
    console.log(createTable[0]['Create Table']);

    await connection.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkTableStructure();
