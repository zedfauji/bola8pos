const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const config = {
    host: '127.0.0.1',
    port: 3306,
    user: 'bola8pos',
    password: 'changeme',
    database: 'bola8pos',
    multipleStatements: true
  };

  try {
    const connection = await mysql.createConnection(config);
    console.log('Connected to MySQL database');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'pos', 'backend', 'src', 'migrations', '20250816_create_table_layouts.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Run the migration
    console.log('Running migration...');
    await connection.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    
    // Verify the table was created
    const [tables] = await connection.execute(
      `SELECT table_name 
       FROM information_schema.tables 
       WHERE table_schema = ? AND table_name = 'table_layouts'`,
      [config.database]
    );
    
    if (tables.length > 0) {
      console.log('✅ table_layouts table exists');
      
      // Check if default layout was created
      const [layouts] = await connection.execute('SELECT * FROM table_layouts');
      console.log(`✅ Found ${layouts.length} table layouts`);
      
      if (layouts.length > 0) {
        console.log('Layouts:', JSON.stringify(layouts, null, 2));
      }
    } else {
      console.log('❌ table_layouts table was not created');
    }
    
    await connection.end();
  } catch (error) {
    console.error('Error running migration:');
    console.error(error.message);
  }
}

runMigration();
