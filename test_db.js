const mysql = require('mysql2/promise');

async function testConnection() {
  const config = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'bola8pos',
  };

  try {
    // First, try to connect without specifying a database
    const connection = await mysql.createConnection({
      ...config,
      database: undefined, // Don't specify database initially
    });

    console.log('Successfully connected to MySQL server');

    // Check if database exists
    const [rows] = await connection.query(
      `SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?`,
      [config.database]
    );

    if (rows.length === 0) {
      console.log(`Database '${config.database}' does not exist. Creating...`);
      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\``);
      console.log(`Database '${config.database}' created successfully`);
    } else {
      console.log(`Database '${config.database}' exists`);
    }

    // Now connect to the specific database
    await connection.changeUser({ database: config.database });
    console.log(`Successfully connected to database '${config.database}'`);

    // Check if users table exists
    const [tables] = await connection.query(
      `SHOW TABLES LIKE 'users'`
    );

    if (tables.length === 0) {
      console.log('Users table does not exist. The database needs to be initialized.');
      console.log('Please run the server to initialize the database schema.');
    } else {
      console.log('Users table exists. Database appears to be properly initialized.');
    }

    await connection.end();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    console.error('Please check your MySQL server and credentials');
    return false;
  }
}

testConnection().then(success => {
  process.exit(success ? 0 : 1);
});
