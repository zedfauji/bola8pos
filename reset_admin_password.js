const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function resetAdminPassword() {
  const config = {
    host: '127.0.0.1',
    port: 3306,
    user: 'bola8pos',
    password: 'changeme',
    database: 'bola8pos'
  };

  const newPassword = 'Admin@123';
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  try {
    const connection = await mysql.createConnection(config);
    console.log('Connected to MySQL database');
    
    // Update the admin password
    const [result] = await connection.execute(
      'UPDATE users SET password = ?, is_active = TRUE WHERE email = ?',
      [hashedPassword, 'admin@billiardpos.com']
    );
    
    if (result.affectedRows > 0) {
      console.log(`Successfully updated admin password to: ${newPassword}`);
      console.log(`New password hash: ${hashedPassword}`);
    } else {
      console.log('No admin user found to update');
    }
    
    await connection.end();
  } catch (error) {
    console.error('Error resetting admin password:');
    console.error(error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('\nMake sure the MySQL server is running and the credentials are correct.');
    }
  }
}

resetAdminPassword();
