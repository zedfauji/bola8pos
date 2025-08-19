const mysql = require('mysql2/promise');

async function addDeletedAtColumn() {
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

    // Add deleted_at column if it doesn't exist
    try {
      await connection.execute(`
        ALTER TABLE tables 
        ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL
        AFTER updated_at;
      `);
      console.log('✅ Added deleted_at column to tables table');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️  deleted_at column already exists');
      } else {
        throw error;
      }
    }

    // Also add deleted_at to table_layouts for consistency
    try {
      await connection.execute(`
        ALTER TABLE table_layouts 
        ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL
        AFTER updated_at;
      `);
      console.log('✅ Added deleted_at column to table_layouts table');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️  deleted_at column already exists in table_layouts');
      } else {
        throw error;
      }
    }

    // Verify the columns were added
    const [tablesColumns] = await connection.execute('DESCRIBE tables');
    const [layoutsColumns] = await connection.execute('DESCRIBE table_layouts');
    
    const hasDeletedAtInTables = tablesColumns.some(col => col.Field === 'deleted_at');
    const hasDeletedAtInLayouts = layoutsColumns.some(col => col.Field === 'deleted_at');
    
    if (hasDeletedAtInTables && hasDeletedAtInLayouts) {
      console.log('✅ Verified deleted_at columns exist in both tables');
      
      // Show the updated table structure
      const [tablesStructure] = await connection.execute('SHOW CREATE TABLE tables');
      console.log('\nTables table structure:');
      console.log(tablesStructure[0]['Create Table']);
      
      console.log('\n✅ Database schema updated successfully!');
      console.log('Try accessing the API endpoints again.');
    } else {
      console.log('❌ Missing columns:', 
        (!hasDeletedAtInTables ? 'tables.deleted_at' : '') + 
        (!hasDeletedAtInLayouts ? (hasDeletedAtInTables ? ', ' : '') + 'table_layouts.deleted_at' : '')
      );
    }
    
    await connection.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

addDeletedAtColumn();
