const mysql = require('mysql2/promise');

async function checkMigrations() {
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
    
    // Check if migrations table exists
    const [migrations] = await connection.execute(
      `SELECT * FROM information_schema.tables 
       WHERE table_schema = ? AND table_name = 'migrations'`,
      [config.database]
    );
    
    if (migrations.length === 0) {
      console.log('Migrations table does not exist. Running initial migrations...');
      
      // Create migrations table
      await connection.execute(`
        CREATE TABLE migrations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          batch INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('Created migrations table');
    }
    
    // Get applied migrations
    const [appliedMigrations] = await connection.execute(
      'SELECT name FROM migrations ORDER BY batch, name'
    );
    
    console.log('\nApplied migrations:');
    if (appliedMigrations.length > 0) {
      console.table(appliedMigrations);
    } else {
      console.log('No migrations have been applied yet.');
    }
    
    // Find all migration files in the migrations directory
    const fs = require('fs');
    const path = require('path');
    const migrationsDir = path.join(__dirname, 'pos', 'backend', 'src', 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    console.log('\nMigration files found:');
    console.table(migrationFiles);
    
    // Check for pending migrations
    const pendingMigrations = migrationFiles.filter(file => 
      !appliedMigrations.some(m => m.name === file)
    );
    
    if (pendingMigrations.length > 0) {
      console.log('\n⚠️  Pending migrations:');
      console.table(pendingMigrations);
      
      // Ask user if they want to run pending migrations
      console.log('\nWould you like to run the pending migrations? (y/n)');
      process.stdin.once('data', async (data) => {
        if (data.toString().trim().toLowerCase() === 'y') {
          await runPendingMigrations(connection, pendingMigrations, migrationsDir);
        } else {
          console.log('Migrations not run.');
          await connection.end();
          process.exit(0);
        }
      });
    } else {
      console.log('\n✅ All migrations are up to date.');
      await connection.end();
    }
  } catch (error) {
    console.error('Error checking migrations:');
    console.error(error.message);
    process.exit(1);
  }
}

async function runPendingMigrations(connection, pendingMigrations, migrationsDir) {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const currentBatch = await getCurrentBatch(connection) + 1;
    
    for (const migrationFile of pendingMigrations) {
      console.log(`\nRunning migration: ${migrationFile}`);
      
      const migrationPath = path.join(migrationsDir, migrationFile);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      await connection.beginTransaction();
      
      try {
        // Run the migration
        await connection.query(migrationSQL);
        
        // Record the migration
        await connection.execute(
          'INSERT INTO migrations (name, batch) VALUES (?, ?)',
          [migrationFile, currentBatch]
        );
        
        await connection.commit();
        console.log(`✅ Successfully applied migration: ${migrationFile}`);
      } catch (error) {
        await connection.rollback();
        console.error(`❌ Failed to apply migration ${migrationFile}:`, error.message);
        throw error;
      }
    }
    
    console.log('\n✅ All pending migrations have been applied successfully!');
  } catch (error) {
    console.error('Error running migrations:', error.message);
    throw error;
  } finally {
    await connection.end();
    process.exit(0);
  }
}

async function getCurrentBatch(connection) {
  const [result] = await connection.execute('SELECT MAX(batch) as max_batch FROM migrations');
  return result[0].max_batch || 0;
}

// Start the migration check
checkMigrations();
