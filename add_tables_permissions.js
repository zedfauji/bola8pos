const mysql = require('mysql2/promise');

async function addTablesPermissions() {
  const config = {
    host: '127.0.0.1',
    port: 3306,
    user: 'bola8pos',
    password: 'changeme',
    database: 'bola8pos',
    multipleStatements: true
  };

  const connection = await mysql.createConnection(config);
  
  try {
    await connection.beginTransaction();
    
    console.log('Adding tables and layouts permissions...');
    
    // Add permissions for tables
    await connection.execute(`
      INSERT INTO permissions (id, resource, action, description) VALUES 
      ('perm_tables_read', 'tables', 'read', 'View tables'),
      ('perm_tables_create', 'tables', 'create', 'Create tables'),
      ('perm_tables_update', 'tables', 'update', 'Update tables'),
      ('perm_tables_delete', 'tables', 'delete', 'Delete tables'),
      ('perm_table_layouts_read', 'table-layouts', 'read', 'View table layouts'),
      ('perm_table_layouts_create', 'table-layouts', 'create', 'Create table layouts'),
      ('perm_table_layouts_update', 'table-layouts', 'update', 'Update table layouts'),
      ('perm_table_layouts_delete', 'table-layouts', 'delete', 'Delete table layouts')
      ON DUPLICATE KEY UPDATE 
        resource = VALUES(resource), 
        action = VALUES(action), 
        description = VALUES(description);
    `);
    
    // Assign all permissions to admin role
    await connection.execute(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT 'role_admin', id FROM permissions 
      WHERE id IN (
        'perm_tables_read', 'perm_tables_create', 'perm_tables_update', 'perm_tables_delete',
        'perm_table_layouts_read', 'perm_table_layouts_create', 'perm_table_layouts_update', 'perm_table_layouts_delete'
      )
      AND id NOT IN (SELECT permission_id FROM role_permissions WHERE role_id = 'role_admin');
    `);
    
    await connection.commit();
    console.log('Successfully added tables and layouts permissions to admin role');
    
  } catch (error) {
    await connection.rollback();
    console.error('Error adding permissions:');
    console.error(error);
    throw error;
  } finally {
    await connection.end();
  }
}

addTablesPermissions().catch(console.error);
