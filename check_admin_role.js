const mysql = require('mysql2/promise');

async function checkAdminRole() {
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
    
    // Get admin user's role
    const [users] = await connection.execute(
      `SELECT u.id, u.email, r.name as role_name, r.id as role_id 
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.email = ?`,
      ['admin@billiardpos.com']
    );
    
    if (users.length === 0) {
      console.log('Admin user not found');
      return;
    }
    
    const user = users[0];
    console.log('\nAdmin User Role:');
    console.log(`Email: ${user.email}`);
    console.log(`Role: ${user.role_name} (ID: ${user.role_id})`);
    
    // List all roles in the system
    const [roles] = await connection.execute('SELECT * FROM roles');
    console.log('\nAvailable Roles:');
    console.table(roles);
    
    await connection.end();
  } catch (error) {
    console.error('Error checking admin role:');
    console.error(error.message);
  }
}

checkAdminRole();
