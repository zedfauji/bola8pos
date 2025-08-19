const mysql = require('mysql2/promise');

async function inspectDatabase() {
  const config = {
    host: '127.0.0.1',
    port: 3306,
    user: 'bola8pos',
    password: 'changeme',
    database: 'bola8pos',
  };

  try {
    // Connect to MySQL without specifying a database first
    const connection = await mysql.createConnection({
      ...config,
      database: undefined, // Don't specify database initially
    });

    console.log('Connected to MySQL server');

    // Check if database exists
    const [dbs] = await connection.query(
      `SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?`,
      [config.database]
    );

    if (dbs.length === 0) {
      console.log(`Database '${config.database}' does not exist yet.`);
      console.log('The application will create it automatically on first run.');
      await connection.end();
      return;
    }

    console.log(`\nDatabase '${config.database}' exists.`);
    
    // Connect to the specific database
    await connection.changeUser({ database: config.database });
    
    // Get list of tables
    const [tables] = await connection.query('SHOW TABLES');
    console.log(`\nFound ${tables.length} tables in the database:`);
    
    const tableNames = tables.map(t => Object.values(t)[0]);
    console.log(tableNames.join(', '));
    
    // Check for important tables
    const importantTables = ['users', 'tables', 'menu_items', 'orders', 'order_items', 'bills'];
    const missingTables = importantTables.filter(t => !tableNames.includes(t));
    
    if (missingTables.length > 0) {
      console.log('\n⚠️  Missing important tables:', missingTables.join(', '));
      console.log('The application will create these tables automatically on first run.');
    } else {
      console.log('\n✅ All important tables exist.');
    }
    
    // Check for users
    try {
      const [users] = await connection.query('SELECT COUNT(*) as count FROM users');
      console.log(`\nFound ${users[0].count} users in the database.`);
    } catch (e) {
      console.log('\nℹ️  Users table exists but could not query it. It might be empty or have a different structure.');
    }
    
    await connection.end();
    
  } catch (error) {
    console.error('Error inspecting database:');
    console.error(error.message);
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n⚠️  Access denied. Please check your database credentials in the .env file.');
      console.log('Current connection settings:');
      console.log(`- Host: ${config.host}`);
      console.log(`- Port: ${config.port}`);
      console.log(`- User: ${config.user}`);
      console.log(`- Database: ${config.database}`);
      console.log('\nPlease ensure the MySQL user has proper permissions.');
    }
  }
}

// Run the inspection
inspectDatabase().then(() => {
  console.log('\nInspection complete.');  
  process.exit(0);
}).catch(err => {
  console.error('Inspection failed:', err);
  process.exit(1);
});
