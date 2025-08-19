require('dotenv').config({ path: './pos/backend/.env' });
const mysql = require('mysql2/promise');

async function checkTableLayouts() {
  try {
    // Create connection
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'billiard_pos'
    });

    console.log('Connected to database successfully');

    // Check table_layouts table
    console.log('\n--- Table Layouts ---');
    const [layouts] = await connection.execute('SELECT * FROM table_layouts');
    console.log(`Found ${layouts.length} table layouts:`);
    layouts.forEach(layout => {
      console.log(`ID: ${layout.id}, Name: ${layout.name}, Active: ${layout.is_active ? 'Yes' : 'No'}, Created: ${layout.created_at}`);
    });

    // Check active layout
    console.log('\n--- Active Layout ---');
    const [activeLayouts] = await connection.execute('SELECT * FROM table_layouts WHERE is_active = 1');
    if (activeLayouts.length === 0) {
      console.log('No active layout found!');
    } else {
      console.log(`Found ${activeLayouts.length} active layouts:`);
      activeLayouts.forEach(layout => {
        console.log(`ID: ${layout.id}, Name: ${layout.name}, Created: ${layout.created_at}`);
      });
    }

    // Check tables
    console.log('\n--- Tables ---');
    const [tables] = await connection.execute('SELECT * FROM tables');
    console.log(`Found ${tables.length} tables:`);
    if (tables.length > 0) {
      console.log('Sample tables:');
      tables.slice(0, 5).forEach(table => {
        console.log(`ID: ${table.id}, Name: ${table.name}, Layout ID: ${table.layout_id}, Position: (${table.position_x}, ${table.position_y})`);
      });
    }

    await connection.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkTableLayouts();
