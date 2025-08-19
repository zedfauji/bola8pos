/*
  Seed minimal tables: delete all existing tables/sessions and create
  exactly 2 billiard and 2 bar tables on the active layout with
  non-overlapping positions.
*/

const path = require('path');
// Load root .env to ensure DB_* vars are available even when running from backend/
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { sequelize, Table, TableLayout, TableSession } = require('../src/models');
const { v4: uuidv4 } = require('uuid');

async function ensureActiveLayout(transaction) {
  // Try active first
  let layout = await TableLayout.findOne({ where: { isActive: true }, transaction });
  if (layout) return layout;

  // Then any layout
  layout = await TableLayout.findOne({ transaction });
  if (layout) {
    // Mark it active
    layout.isActive = true;
    await layout.save({ transaction });
    return layout;
  }

  // Create a new default layout if none exist
  const newLayout = await TableLayout.create(
    {
      id: uuidv4(),
      name: 'Default Layout',
      description: 'Auto-created by seed-minimal-tables',
      width: 1200,
      height: 800,
      gridSize: 10,
      isActive: true,
      created_by: process.env.SEED_CREATED_BY || 'seed-script',
      settings: {
        showGrid: true,
        snapToGrid: true,
        showTableNumbers: true,
        showStatus: true,
      },
    },
    { transaction }
  );
  return newLayout;
}

async function purgeAllTables(transaction) {
  const qi = sequelize.getQueryInterface();
  let existing = [];
  try {
    existing = await qi.showAllTables();
  } catch (_e) {
    existing = [];
  }
  const normalize = (t) => (typeof t === 'string' ? t : t?.tableName || t?.name || '').toLowerCase();
  const names = existing.map(normalize);
  const has = (n) => names.includes(n.toLowerCase());

  // Remove sessions first (to satisfy FK) if the table exists
  if (has('table_sessions')) {
    await TableSession.destroy({ where: {}, force: true, truncate: false, transaction });
  }
  // Then tables if exists
  if (has('tables')) {
    await Table.destroy({ where: {}, force: true, truncate: false, transaction });
  }
}

async function seedTables(layoutId, transaction) {
  // Match frontend Table.jsx fixed sizes to avoid mismatch
  const sizes = {
    billiard: { width: 180, height: 90 },
    bar: { width: 80, height: 80 },
  };

  // Chosen positions with ~20px buffer to avoid overlap
  const tables = [
    { name: 'Billiard 1', type: 'billiard', x: 100, y: 100, rotation: 0 },
    { name: 'Billiard 2', type: 'billiard', x: 320, y: 100, rotation: 0 },
    { name: 'Bar 1',      type: 'bar',      x: 100, y: 260, rotation: 0 },
    { name: 'Bar 2',      type: 'bar',      x: 220, y: 260, rotation: 0 },
  ];

  for (const t of tables) {
    const dim = sizes[t.type];
    await Table.create(
      {
        id: uuidv4(),
        name: t.name,
        type: t.type,
        status: 'available',
        capacity: t.type === 'billiard' ? 4 : 4,
        positionX: t.x,
        positionY: t.y,
        rotation: t.rotation,
        width: dim.width,
        height: dim.height,
        notes: null,
        layoutId,
        isActive: true,
      },
      { transaction }
    );
  }
}

async function main() {
  console.log('🔌 Connecting to database...');
  await sequelize.authenticate();
  console.log('✅ Database connection OK');

  const transaction = await sequelize.transaction();
  try {
    console.log('📐 Ensuring active layout...');
    const layout = await ensureActiveLayout(transaction);
    console.log(`🗺️ Using layout: ${layout.id} (${layout.name})`);

    console.log('🧹 Purging existing tables and sessions...');
    await purgeAllTables(transaction);

    console.log('🧱 Seeding exactly 2 billiard and 2 bar tables with safe spacing...');
    await seedTables(layout.id, transaction);

    await transaction.commit();
    console.log('🎉 Seed complete.');
  } catch (err) {
    console.error('💥 Seed failed:', err?.message || err);
    if (!transaction.finished) {
      await transaction.rollback();
    }
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  main();
}
