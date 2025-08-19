const mysql = require('mysql2/promise');

async function checkMigrationsTable() {
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
    console.log('Connected to MySQL database');
    
    // Check migrations table structure
    const [columns] = await connection.execute(
      `SELECT column_name, column_type, is_nullable, column_default, extra 
       FROM information_schema.columns 
       WHERE table_schema = ? AND table_name = 'migrations'`,
      [config.database]
    );
    
    console.log('\nMigrations table structure:');
    console.table(columns);
    
    // Show existing migrations
    const [migrations] = await connection.execute('SELECT * FROM migrations');
    console.log('\nExisting migrations:');
    console.table(migrations);
    
    await connection.end();
  } catch (error) {
    console.error('Error checking migrations table:');
    console.error(error.message);
  }
}

checkMigrationsTable();
