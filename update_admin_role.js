const mysql = require('mysql2/promise');

async function updateAdminRole() {
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
    
    // Update the admin role ID to 'admin' (lowercase)
    const [updateResult] = await connection.execute(
      `UPDATE users SET role_id = 'admin' WHERE email = ?`,
      ['admin@billiardpos.com']
    );
    
    if (updateResult.affectedRows > 0) {
      console.log('Successfully updated admin role to "admin"');
      
      // Verify the update
      const [users] = await connection.execute(
        'SELECT email, role_id FROM users WHERE email = ?',
        ['admin@billiardpos.com']
      );
      
      console.log('\nUpdated admin user:');
      console.table(users);
    } else {
      console.log('No admin user found to update');
    }
    
    await connection.end();
  } catch (error) {
    console.error('Error updating admin role:');
    console.error(error.message);
  }
}

updateAdminRole();
