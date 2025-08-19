#!/usr/bin/env node
/*
  Fix: Add `layout_id` column to `tables` to support relation with `table_layouts`.
  Schema: layout_id VARCHAR(36) NULL, indexed for joins.
*/
const mysql = require('mysql2/promise');

(async () => {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USER || 'bola8pos';
  const password = process.env.DB_PASSWORD || 'changeme';
  const database = process.env.DB_NAME || 'bola8pos';

  const pool = await mysql.createPool({ host, port, user, password, database, multipleStatements: true });

  try {
    console.log('[LAYOUT_ID FIX] Connecting to DB:', { host, port, database, user });
    await pool.query('USE `'+database+'`');

    const [cols] = await pool.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='tables' AND COLUMN_NAME='layout_id'",
      [database]
    );
    if (cols.length === 0) {
      console.log('[LAYOUT_ID FIX] Adding `layout_id` column to `tables`...');
      await pool.query("ALTER TABLE `tables` ADD COLUMN `layout_id` VARCHAR(36) NULL AFTER `notes`");
      try {
        await pool.query("CREATE INDEX `idx_tables_layout_id` ON `tables`(`layout_id`)");
      } catch (e) { console.warn('[LAYOUT_ID FIX] Index creation warning:', e.message); }
    } else {
      console.log('[LAYOUT_ID FIX] `layout_id` already exists — skipping add.');
    }

    console.log('[LAYOUT_ID FIX] Done.');
    process.exit(0);
  } catch (err) {
    console.error('[LAYOUT_ID FIX] Error:', err && err.message ? err.message : err);
    process.exit(1);
  } finally {
    pool.end();
  }
})();
