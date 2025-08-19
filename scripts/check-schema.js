const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'pos/backend/.env' });

async function checkSchema() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'bola8pos',
    password: process.env.DB_PASSWORD || 'changeme',
    database: process.env.DB_NAME || 'bola8pos'
  });

  try {
    // Check table_layouts schema
    console.log('Table Layouts Schema:');
    const [layoutColumns] = await connection.execute(
      'DESCRIBE table_layouts'
    );
    console.table(layoutColumns);

    // Check tables schema
    console.log('\nTables Schema:');
    const [tableColumns] = await connection.execute(
      'DESCRIBE tables'
    );
    console.table(tableColumns);

  } catch (error) {
    console.error('Error checking schema:', error);
  } finally {
    await connection.end();
  }
}

checkSchema().catch(console.error);
