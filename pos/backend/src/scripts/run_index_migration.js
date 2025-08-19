/**
 * Script to run the database index migration
 * Run with: node src/scripts/run_index_migration.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function runIndexMigration() {
  // Create connection pool
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'billiard_pos',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  try {
    console.log('Running database index migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/20240818_add_database_indexes.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    
    // Split the SQL statements
    const statements = migrationSql
      .split(';')
      .filter(statement => statement.trim() !== '')
      .map(statement => statement.trim() + ';');
    
    // Execute each statement
    for (const statement of statements) {
      try {
        console.log(`Executing: ${statement.substring(0, 80)}...`);
        await pool.query(statement);
        console.log('Statement executed successfully');
      } catch (error) {
        // If the error is about the index already existing, we can ignore it
        if (error.code === 'ER_DUP_KEYNAME') {
          console.log(`Index already exists: ${error.message}`);
        } else {
          console.error(`Error executing statement: ${error.message}`);
        }
      }
    }

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Error running migration:', error);
  } finally {
    await pool.end();
  }
}

// Run the function
runIndexMigration()
  .then(() => {
    console.log('Script completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
  });
