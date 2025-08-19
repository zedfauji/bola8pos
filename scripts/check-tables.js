const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'pos/backend/.env' });

async function checkTables() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'bola8pos',
    password: process.env.DB_PASSWORD || 'changeme',
    database: process.env.DB_NAME || 'bola8pos'
  });

  try {
    // Check if rate_limits table exists
    const [tables] = await connection.execute(
      "SHOW TABLES LIKE 'rate_limits'"
    );
    
    if (tables.length === 0) {
      console.log('rate_limits table does not exist');
    } else {
      console.log('rate_limits table exists, checking for login rate limits...');
      const [loginLimits] = await connection.execute(
        "SELECT * FROM rate_limits WHERE key_name LIKE '%login%'"
      );
      console.log(`Found ${loginLimits.length} login rate limit records`);
      
      if (loginLimits.length > 0) {
        console.log('Clearing login rate limits...');
        await connection.execute(
          "DELETE FROM rate_limits WHERE key_name LIKE '%login%'"
        );
        console.log('Login rate limits cleared');
      }
    }

    // Check for table_layouts and tables
    console.log('\nChecking for table layouts...');
    try {
      const [tableLayouts] = await connection.execute('SELECT * FROM table_layouts');
      console.log(`Found ${tableLayouts.length} table layouts`);
      
      if (tableLayouts.length > 0) {
        const [tables] = await connection.execute('SELECT * FROM tables');
        console.log(`Found ${tables.length} tables`);
        
        console.log('\nTable Layouts:');
        console.table(tableLayouts);
        
        console.log('\nActive Layout:');
        const [activeLayout] = await connection.execute(
          'SELECT * FROM table_layouts WHERE is_active = 1 LIMIT 1'
        );
        console.table(activeLayout);
        
        if (activeLayout.length > 0) {
          const [layoutTables] = await connection.execute(
            'SELECT * FROM tables WHERE layout_id = ?',
            [activeLayout[0].id]
          );
          console.log(`\nTables in active layout (${activeLayout[0].name}):`);
          console.table(layoutTables);
        }
      } else {
        console.log('No table layouts found. You need to create one in the admin interface.');
      }
    } catch (error) {
      console.error('Error querying table layouts:', error.message);
      console.log('Table layouts or tables table might not exist yet.');
    }
  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await connection.end();
  }
}

checkTables();
