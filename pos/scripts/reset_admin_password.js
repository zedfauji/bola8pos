const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config();

const NEW_PASSWORD = 'password';

async function resetAdminPassword() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'bola8pos',
    password: 'changeme',
    database: 'bola8pos',
    port: 3306
  });

  try {
    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(NEW_PASSWORD, salt);
    
    // Update the admin password
    const [result] = await connection.execute(
      'UPDATE users SET password = ? WHERE email = ?',
      [hashedPassword, 'admin@billiardpos.com']
    );

    if (result.affectedRows === 0) {
      console.log('❌ No admin user found with email admin@billiardpos.com');
      return;
    }

    console.log('✅ Admin password reset successfully!');
    console.log(`New password: ${NEW_PASSWORD}`);
    
  } catch (error) {
    console.error('Error resetting admin password:', error);
  } finally {
    await connection.end();
  }
}

resetAdminPassword();
