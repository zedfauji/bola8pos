const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'pos/backend/.env' });

async function fixTablePositions() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'bola8pos',
    password: process.env.DB_PASSWORD || 'changeme',
    database: process.env.DB_NAME || 'bola8pos'
  });

  try {
    await connection.beginTransaction();

    // Get the default layout
    const [layouts] = await connection.execute(
      "SELECT * FROM table_layouts WHERE id = 'default-layout'"
    );

    if (layouts.length === 0) {
      console.log('Default layout not found');
      return;
    }

    const layout = layouts[0];
    console.log(`Updating tables for layout: ${layout.name} (${layout.id})`);

    // Get all tables for this layout
    const [tables] = await connection.execute(
      'SELECT * FROM tables WHERE layout_id = ?',
      [layout.id]
    );

    console.log(`Found ${tables.length} tables to update`);

    // Update positions for each table
    let x = 100;
    let y = 100;
    const spacing = 150;
    const tablesPerRow = 4;
    let count = 0;

    for (const table of tables) {
      // Skip if already positioned
      if (table.position_x !== 0 || table.position_y !== 0) {
        console.log(`Skipping table ${table.id} (already positioned at ${table.position_x},${table.position_y})`);
        continue;
      }

      // Calculate position
      const row = Math.floor(count / tablesPerRow);
      const col = count % tablesPerRow;
      const posX = x + (col * spacing);
      const posY = y + (row * spacing);

      // Update table position
      await connection.execute(
        'UPDATE tables SET position_x = ?, position_y = ? WHERE id = ?',
        [posX, posY, table.id]
      );

      console.log(`Updated table ${table.id} position to (${posX}, ${posY})`);
      count++;
    }

    await connection.commit();
    console.log('Successfully updated table positions');

  } catch (error) {
    await connection.rollback();
    console.error('Error updating table positions:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

fixTablePositions().catch(console.error);
