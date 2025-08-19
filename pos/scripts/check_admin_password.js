const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkAdminPassword() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'bola8pos',
    password: process.env.DB_PASSWORD || 'changeme',
    database: process.env.DB_NAME || 'billiard_pos',
    port: process.env.DB_PORT || 3306
  });

  try {
    // Check admin user
    const [users] = await connection.execute(
      'SELECT id, email, password, role FROM users WHERE email = ?', 
      ['admin@billiardpos.com']
    );

    if (users.length === 0) {
      console.log('❌ No admin user found with email admin@billiardpos.com');
      return;
    }

    const admin = users[0];
    console.log('\n🔍 Admin User Details:');
    console.log(`ID: ${admin.id}`);
    console.log(`Email: ${admin.email}`);
    console.log(`Role: ${admin.role}`);
    console.log(`Password Hash: ${admin.password}`);
    console.log('\n✅ Check completed');
    
    // Check if password needs reset
    console.log('\nTo reset the admin password, you can run:');
    console.log('node scripts/reset_admin_password.js');
    
  } catch (error) {
    console.error('Error checking admin user:', error);
  } finally {
    await connection.end();
  }
}

checkAdminPassword();
