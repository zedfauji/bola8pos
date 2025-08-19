const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkUsersSchema() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'bola8pos',
    password: 'changeme',
    database: 'bola8pos',
    port: 3306
  });

  try {
    // Check the structure of the users table
    const [columns] = await connection.execute('SHOW COLUMNS FROM users');
    console.log('\n📋 Users Table Columns:');
    console.table(columns);

    // Check the admin user record
    const [users] = await connection.execute("SELECT * FROM users WHERE email = 'admin@billiardpos.com'");
    console.log('\n👤 Admin User Record:');
    console.table(users);
    
  } catch (error) {
    console.error('Error checking users table:', error);
  } finally {
    await connection.end();
  }
}

checkUsersSchema();
