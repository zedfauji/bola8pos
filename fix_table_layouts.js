const mysql = require('mysql2/promise');

async function fixTableLayouts() {
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
    
    // Check if settings column exists
    const [columns] = await connection.execute(
      `SHOW COLUMNS FROM table_layouts LIKE 'settings'`
    );
    
    if (columns.length === 0) {
      // Add settings column if it doesn't exist
      await connection.execute(`
        ALTER TABLE table_layouts 
        ADD COLUMN settings JSON 
        DEFAULT '{\"showGrid\": true, \"snapToGrid\": true, \"showTableNumbers\": true, \"showStatus\": true}' 
        AFTER grid_size;
      `);
      
      console.log('✅ Added settings column to table_layouts');
      
      // Update existing layouts with default settings
      await connection.execute(`
        UPDATE table_layouts 
        SET settings = '{\"showGrid\": true, \"snapToGrid\": true, \"showTableNumbers\": true, \"showStatus\": true}'
        WHERE settings IS NULL;
      `);
      
      console.log('✅ Updated existing layouts with default settings');
    } else {
      console.log('ℹ️  settings column already exists');
    }
    
    console.log('✅ Updated existing layouts with default settings');
    
    // Verify the changes
    const [results] = await connection.execute('DESCRIBE table_layouts');
    console.log('\nTable structure after changes:');
    console.table(results.map(r => ({
      Field: r.Field,
      Type: r.Type,
      Null: r.Null,
      Key: r.Key,
      Default: r.Default,
      Extra: r.Extra
    })));
    
    // Show current layouts
    const [layouts] = await connection.execute('SELECT id, name, settings FROM table_layouts');
    console.log('\nCurrent layouts:');
    console.table(layouts);
    
    await connection.end();
    
    console.log('\n✅ Database schema updated successfully!');
    console.log('Try accessing the API endpoints again.');
  } catch (error) {
    console.error('Error fixing table_layouts:');
    console.error(error.message);
  }
}

fixTableLayouts();
