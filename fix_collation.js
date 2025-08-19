const mysql = require('mysql2/promise');

async function fixCollation() {
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
    console.log('Connected to MySQL');

    // Check current collation of the database
    const [dbInfo] = await connection.execute(
      "SELECT DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME " +
      "FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = 'bola8pos'"
    );
    console.log('\nDatabase collation:', dbInfo[0].DEFAULT_COLLATION_NAME);

    // Check tables collation
    const [tables] = await connection.execute(
      "SELECT TABLE_NAME, TABLE_COLLATION " +
      "FROM information_schema.TABLES " +
      "WHERE TABLE_SCHEMA = 'bola8pos' AND TABLE_NAME IN ('tables', 'table_layouts')"
    );
    console.log('\nTables collation:');
    console.table(tables);

    // Fix collation for tables
    console.log('\nFixing collation...');
    
    // Convert all tables to use utf8mb4_unicode_ci
    await connection.execute(`
      ALTER TABLE tables 
      CONVERT TO CHARACTER SET utf8mb4 
      COLLATE utf8mb4_unicode_ci;
    `);
    
    await connection.execute(`
      ALTER TABLE table_layouts 
      CONVERT TO CHARACTER SET utf8mb4 
      COLLATE utf8mb4_unicode_ci;
    `);
    
    // Fix foreign key constraints
    try {
      // Drop the foreign key constraint if it exists
      await connection.execute(`
        ALTER TABLE tables 
        DROP FOREIGN KEY IF EXISTS fk_table_layout;
      `);
      
      // Re-add the foreign key with the correct collation
      await connection.execute(`
        ALTER TABLE tables 
        ADD CONSTRAINT fk_table_layout
        FOREIGN KEY (layout_id) 
        REFERENCES table_layouts(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE;
      `);
      console.log('✅ Fixed foreign key constraints');
    } catch (error) {
      console.error('Error fixing foreign key:', error.message);
    }

    console.log('✅ Collation fixed for all tables');
    
    // Verify the changes
    const [updatedTables] = await connection.execute(
      "SELECT TABLE_NAME, TABLE_COLLATION " +
      "FROM information_schema.TABLES " +
      "WHERE TABLE_SCHEMA = 'bola8pos' AND TABLE_NAME IN ('tables', 'table_layouts')"
    );
    
    console.log('\nUpdated tables collation:');
    console.table(updatedTables);
    
    console.log('\n✅ Database collation fixed successfully!');
    console.log('Try accessing the API endpoints again.');
    
    await connection.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

fixCollation();
