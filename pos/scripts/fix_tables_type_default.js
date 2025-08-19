#!/usr/bin/env node
/*
  Fix: Ensure `tables.type` has a DEFAULT value to avoid MySQL error
  "Field 'type' doesn't have a default value" when inserting tables.

  This script alters the `tables` table to set a default for the `type` column,
  matching the expected domain ('billiard' by default).
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
    console.log('[TYPE DEFAULT FIX] Connecting to DB:', { host, port, database, user });
    await pool.query('USE `'+database+'`');

    // Check existing column definition
    const [rows] = await pool.query(
      "SELECT COLUMN_DEFAULT, IS_NULLABLE, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'tables' AND COLUMN_NAME = 'type'",
      [database]
    );
    const info = rows && rows[0];
    console.log('[TYPE DEFAULT FIX] Current type column:', info);

    console.log('[TYPE DEFAULT FIX] Altering `tables.type` to have DEFAULT \"billiard\" and NOT NULL...');
    await pool.query("ALTER TABLE `tables` MODIFY COLUMN `type` VARCHAR(32) NOT NULL DEFAULT 'billiard'");

    const [after] = await pool.query(
      "SELECT COLUMN_DEFAULT, IS_NULLABLE, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'tables' AND COLUMN_NAME = 'type'",
      [database]
    );
    console.log('[TYPE DEFAULT FIX] Updated type column:', after && after[0]);

    console.log('[TYPE DEFAULT FIX] Success.');
    process.exit(0);
  } catch (err) {
    console.error('[TYPE DEFAULT FIX] Error:', err && err.message ? err.message : err);
    process.exit(1);
  } finally {
    pool.end();
  }
})();
