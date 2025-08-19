const mysql = require('mysql2/promise');

async function checkUserPermissions() {
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
    
    // Get admin user details
    const [users] = await connection.execute(
      `SELECT u.id, u.email, u.role_id, r.name as role_name 
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.email = ?`,
      ['admin@billiardpos.com']
    );
    
    if (users.length === 0) {
      console.log('Admin user not found');
      return;
    }
    
    const user = users[0];
    console.log('\nUser Details:');
    console.log(`Email: ${user.email}`);
    console.log(`Role: ${user.role_name} (${user.role_id})`);
    
    // Get role permissions
    const [permissions] = await connection.execute(
      `SELECT p.id, p.resource, p.action, p.description 
       FROM role_permissions rp
       JOIN permissions p ON rp.permission_id = p.id
       WHERE rp.role_id = ?`,
      [user.role_id]
    );
    
    console.log('\nRole Permissions:');
    if (permissions.length === 0) {
      console.log('No permissions found for this role');
    } else {
      console.table(permissions);
    }
    
    // Check for tables-related permissions
    const tablesPermissions = permissions.filter(p => 
      p.resource === 'tables' || p.resource === 'table-layouts'
    );
    
    console.log('\nTables and Layouts Permissions:');
    if (tablesPermissions.length === 0) {
      console.log('No tables or layouts permissions found for this role');
    } else {
      console.table(tablesPermissions);
    }
    
    await connection.end();
  } catch (error) {
    console.error('Error checking user permissions:');
    console.error(error.message);
  }
}

checkUserPermissions();
