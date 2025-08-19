const mysql = require('mysql2/promise');

async function checkTablesStructure() {
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

    // Check tables table structure
    const [columns] = await connection.execute('DESCRIBE tables');
    console.log('\nTables table structure:');
    console.table(columns);

    // Show sample data
    const [rows] = await connection.execute('SELECT * FROM tables LIMIT 5');
    console.log('\nSample data from tables:');
    console.table(rows);

    // Show create table statement
    const [createTable] = await connection.execute('SHOW CREATE TABLE tables');
    console.log('\nCreate table statement for tables:');
    console.log(createTable[0]['Create Table']);

    await connection.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkTablesStructure();
