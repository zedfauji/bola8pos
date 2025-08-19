const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env' });

async function setupDatabase() {
  // Root connection to create database and user
  const rootConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: 'root',
    password: process.env.DB_ROOT_PASSWORD || 'password',
  };

  const dbName = process.env.DB_NAME || 'bola8pos';
  const dbUser = process.env.DB_USER || 'bola8pos';
  const dbPassword = process.env.DB_PASSWORD || 'changeme';

  let connection;
  try {
    // Connect as root
    connection = await mysql.createConnection(rootConfig);
    console.log('Connected to MySQL server as root');

    // Create database if not exists
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`Database '${dbName}' created or already exists`);

    // Create user if not exists and grant privileges
    const [users] = await connection.query(
      `SELECT * FROM mysql.user WHERE User = ? AND Host = '%'`,
      [dbUser]
    );

    if (users.length === 0) {
      await connection.query(
        `CREATE USER ?@'%' IDENTIFIED BY ?`,
        [dbUser, dbPassword]
      );
      console.log(`Created user '${dbUser}'`);
    } else {
      console.log(`User '${dbUser}' already exists`);
    }

    // Grant privileges
    await connection.query(
      `GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO ?@'%'`,
      [dbUser]
    );
    await connection.query('FLUSH PRIVILEGES');
    console.log(`Granted all privileges on '${dbName}' to '${dbUser}'`);

    // Test the new user connection
    await connection.end();
    connection = await mysql.createConnection({
      host: rootConfig.host,
      port: rootConfig.port,
      user: dbUser,
      password: dbPassword,
      database: dbName,
    });
    console.log(`Successfully connected to database '${dbName}' as user '${dbUser}'`);
    
    return true;
  } catch (error) {
    console.error('Error setting up database:', error.message);
    return false;
  } finally {
    if (connection) await connection.end();
  }
}

// Run the setup
setupDatabase()
  .then((success) => {
    console.log(success ? 'Database setup completed successfully' : 'Database setup failed');
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
