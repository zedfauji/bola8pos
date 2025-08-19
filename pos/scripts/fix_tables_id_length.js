#!/usr/bin/env node
/*
  Fix tables.id length to support UUID (36 chars)
  - Reads DB_ env vars from process.env (load .env if present)
  - Alters `tables`.`id` to VARCHAR(36) NOT NULL PRIMARY KEY
  - Shows column definition before and after
*/
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

(function loadEnv() {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      console.log('[fix_tables_id_length] Loaded .env');
    }
  } catch (e) {
    console.warn('[fix_tables_id_length] Could not load .env:', e.message);
  }
})();

(async () => {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USER || 'bola8pos';
  const password = process.env.DB_PASSWORD || 'changeme';
  const database = process.env.DB_NAME || 'bola8pos';

  console.log(`[fix_tables_id_length] Connecting to ${user}@${host}:${port}/${database}`);
  const conn = await mysql.createConnection({ host, port, user, password, database });
  try {
    const [before] = await conn.query("SHOW COLUMNS FROM `tables` LIKE 'id'");
    console.log('[Before] tables.id:', before[0]);

    console.log('[Action] ALTER TABLE `tables` MODIFY `id` VARCHAR(36) NOT NULL');
    await conn.query('ALTER TABLE `tables` MODIFY `id` VARCHAR(36) NOT NULL');

    const [after] = await conn.query("SHOW COLUMNS FROM `tables` LIKE 'id'");
    console.log('[After] tables.id:', after[0]);

    console.log('[fix_tables_id_length] Success.');
  } catch (e) {
    console.error('[fix_tables_id_length] Error:', e);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
})();
