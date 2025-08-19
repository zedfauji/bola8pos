const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config();

const ADMIN_EMAIL = 'admin@billiardpos.com';
const NEW_NAME = 'Admin';
const NEW_PASSWORD = 'admin';

async function resetAdminCredentials() {
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
    
    // Update the admin credentials
    const [result] = await connection.execute(
      'UPDATE users SET name = ?, password = ? WHERE email = ?',
      [NEW_NAME, hashedPassword, ADMIN_EMAIL]
    );

    if (result.affectedRows === 0) {
      console.log('❌ No admin user found with email', ADMIN_EMAIL);
      return;
    }

    console.log('✅ Admin credentials updated successfully!');
    console.log('\n🔑 New Login Credentials:');
    console.log('========================');
    console.log(`Email:    ${ADMIN_EMAIL}`);
    console.log(`Name:     ${NEW_NAME}`);
    console.log(`Password: ${NEW_PASSWORD}`);
    console.log('========================');
    
  } catch (error) {
    console.error('Error updating admin credentials:', error);
  } finally {
    await connection.end();
  }
}

resetAdminCredentials();
