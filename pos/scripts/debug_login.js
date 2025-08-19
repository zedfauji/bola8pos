const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' });

async function debugLogin() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'bola8pos',
    password: process.env.DB_PASSWORD || 'changeme',
    database: process.env.DB_NAME || 'bola8pos'
  });

  try {
    console.log('1. Checking database connection...');
    await connection.ping();
    console.log('✅ Database connection successful');

    console.log('\n2. Checking admin user...');
    const [users] = await connection.execute(
      'SELECT * FROM users WHERE email = ?', 
      ['admin@billiardpos.com']
    );

    if (users.length === 0) {
      console.log('❌ Admin user not found');
      return;
    }

    const admin = users[0];
    console.log('✅ Admin user found');
    console.log('   ID:', admin.id);
    console.log('   Email:', admin.email);
    console.log('   Role ID:', admin.role_id);
    console.log('   Is Active:', admin.is_active);

    console.log('\n3. Verifying password...');
    const isPasswordValid = await bcrypt.compare('password', admin.password);
    console.log('   Password valid:', isPasswordValid);

    if (!isPasswordValid) {
      console.log('❌ Invalid password');
      return;
    }

    console.log('\n4. Checking user role...');
    const [roles] = await connection.execute(
      'SELECT * FROM roles WHERE id = ?',
      [admin.role_id]
    );

    if (roles.length === 0) {
      console.log('❌ Role not found');
      return;
    }

    console.log('✅ Role found:', roles[0].name);

    console.log('\n5. Checking JWT secret...');
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret === 'your-secret-key') {
      console.log('❌ JWT_SECRET is not properly set in .env');
      return;
    }
    console.log('✅ JWT_SECRET is set');

    console.log('\n6. Testing token generation...');
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { userId: admin.id, email: admin.email, role: roles[0].name },
      jwtSecret,
      { expiresIn: '15m' }
    );
    console.log('✅ Token generated successfully');

    console.log('\n7. Verifying token...');
    const decoded = jwt.verify(token, jwtSecret);
    console.log('✅ Token verified successfully');
    console.log('   Decoded token:', JSON.stringify(decoded, null, 2));

    console.log('\n✅ Login flow test completed successfully!');

  } catch (error) {
    console.error('❌ Error during debug:', error.message);
    if (error.code) console.error('   Error code:', error.code);
    if (error.sql) console.error('   SQL:', error.sql);
  } finally {
    await connection.end();
  }
}

debugLogin().catch(console.error);
