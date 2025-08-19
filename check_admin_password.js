const mysql = require('mysql2/promise');

async function checkAdminPassword() {
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
    
    const [rows] = await connection.execute(
      'SELECT id, email, password, is_active, role_id FROM users WHERE email = ?',
      ['admin@billiardpos.com']
    );
    
    if (rows.length === 0) {
      console.log('No admin user found');
    } else {
      const user = rows[0];
      console.log('Admin user found:');
      console.log(`Email: ${user.email}`);
      console.log(`Is Active: ${user.is_active ? 'Yes' : 'No'}`);
      console.log(`Password Hash: ${user.password}`);
      console.log(`Role ID: ${user.role_id}`);
    }
    
    await connection.end();
  } catch (error) {
    console.error('Error checking admin password:');
    console.error(error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('\nMake sure the MySQL server is running and the credentials are correct.');
    }
  }
}

checkAdminPassword();
