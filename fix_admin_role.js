const mysql = require('mysql2/promise');

async function fixAdminRole() {
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
    
    // First, update the admin role name to 'admin' (lowercase)
    const [updateRoleResult] = await connection.execute(
      `UPDATE roles SET name = 'admin' WHERE id = 'role_admin'`
    );
    
    if (updateRoleResult.affectedRows > 0) {
      console.log('Successfully updated Administrator role name to "admin"');
      
      // Verify the update
      const [roles] = await connection.execute(
        'SELECT * FROM roles WHERE id = ?',
        ['role_admin']
      );
      
      console.log('\nUpdated role:');
      console.table(roles);
      
      console.log('\nAdmin user details:');
      const [users] = await connection.execute(
        'SELECT * FROM users WHERE email = ?',
        ['admin@billiardpos.com']
      );
      console.table(users);
      
      console.log('\n✅ Role update complete. The admin user should now have the correct permissions.');
      console.log('Try logging in again and accessing the tables endpoints.');
    } else {
      console.log('No role found to update');
    }
    
    await connection.end();
  } catch (error) {
    console.error('Error updating admin role:');
    console.error(error.message);
  }
}

fixAdminRole();
