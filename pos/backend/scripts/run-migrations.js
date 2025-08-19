const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { pool } = require('../src/db');

const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);

async function runMigrations() {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Create migrations table if it doesn't exist
    await connection.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_migration (name)
      )
    `);
    
    // Get already executed migrations
    const [executedMigrations] = await connection.query('SELECT name FROM migrations');
    const executedMigrationNames = new Set(executedMigrations.map(m => m.name));
    
    // Read migration files
    const migrationsDir = path.join(__dirname, '..', 'src', 'migrations');
    const files = await readdir(migrationsDir);
    
    // Filter and sort migration files
    const migrationFiles = files
      .filter(file => file.endsWith('.sql') && !executedMigrationNames.has(file))
      .sort();
    
    if (migrationFiles.length === 0) {
      console.log('No new migrations to run.');
      return;
    }
    
    console.log(`Found ${migrationFiles.length} new migration(s) to run.`);
    
    // Execute each migration
    for (const file of migrationFiles) {
      console.log(`Running migration: ${file}...`);
      
      const filePath = path.join(migrationsDir, file);
      const sql = await readFile(filePath, 'utf8');
      
      // Split SQL file into individual statements
      const statements = sql
        .split(';')
        .map(statement => statement.trim())
        .filter(statement => statement.length > 0);
      
      // Execute each statement
      for (const statement of statements) {
        await connection.query(statement);
      }
      
      // Record migration as executed
      await connection.query('INSERT INTO migrations (name) VALUES (?)', [file]);
      console.log(`✓ ${file} completed successfully`);
    }
    
    await connection.commit();
    console.log('All migrations completed successfully!');
  } catch (error) {
    await connection.rollback();
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    connection.release();
    process.exit(0);
  }
}

runMigrations().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
