const mysql = require('mysql2/promise');

// Phase 8 Track A: Advanced POS Features
const { initCustomerTables, seedCustomers } = require('./db_customers');
const { initReservationTables, seedReservations } = require('./db_reservations');
const { initStaffTables, seedStaff } = require('./db_staff');
// Phase 8 Track B: Hardware Integration
const { initHardwareTables, seedHardware } = require('./db_hardware');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'bola8pos',
  password: process.env.DB_PASSWORD || 'changeme',
  database: process.env.DB_NAME || 'bola8pos',
  waitForConnections: true,
  connectionLimit: 25,
  queueLimit: 0,
  dateStrings: true,
});

// Ensure session uses consistent utf8mb4 charset and collation
(async () => {
  try {
    await pool.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
    await pool.query("SET collation_connection = 'utf8mb4_unicode_ci'");
  } catch (e) {
    console.warn('Collation session setup failed:', e.message);
  }
})();

// Lightweight shim to mimic sqlite3 callbacks used in server.js
function normalizeArgs(params, cb) {
  if (typeof params === 'function') {
    return { params: [], cb: params };
  }
  return { params: params || [], cb };
}

const db = {
  run(sql, params = [], cb) {
    const { params: p, cb: fn } = normalizeArgs(params, cb);
    pool.query(sql, p)
      .then(() => fn && fn())
      .catch((err) => fn && fn(err));
  },
  all(sql, params = [], cb) {
    const { params: p, cb: fn } = normalizeArgs(params, cb);
    pool.query(sql, p)
      .then(([rows]) => fn && fn(null, rows))
      .catch((err) => fn && fn(err));
  },
  get(sql, params = [], cb) {
    const { params: p, cb: fn } = normalizeArgs(params, cb);
    pool.query(sql, p)
      .then(([rows]) => fn && fn(null, rows && rows[0]))
      .catch((err) => fn && fn(err));
  },
};

async function initSchema() {
  // Create database if not exists (requires privilege); otherwise assume created
  await pool.query('CREATE DATABASE IF NOT EXISTS `'+(process.env.DB_NAME || 'bola8pos')+'`');
  await pool.query('USE `'+(process.env.DB_NAME || 'bola8pos')+'`');

  // Tables
  await pool.query(`CREATE TABLE IF NOT EXISTS tables (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(32) NOT NULL,
    status VARCHAR(32) DEFAULT 'available',
    capacity INT,
    hourly_rate DECIMAL(10,2) DEFAULT 0,
    start_time DATETIME NULL,
    elapsed_time INT DEFAULT 0,
    current_bill DECIMAL(10,2) DEFAULT 0,
    cleaning_until DATETIME NULL,
    paused TINYINT(1) DEFAULT 0,
    limit_end DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS discounts (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    kind VARCHAR(32) NOT NULL, -- percent|fixed
    scope VARCHAR(32) NOT NULL, -- items|time|total
    value DECIMAL(10,2) NOT NULL,
    active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Admin Settings tables
  await pool.query(`CREATE TABLE IF NOT EXISTS settings (
    skey VARCHAR(191) PRIMARY KEY,
    svalue JSON NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS printer_groups (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(255),
    active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS printers (
    id VARCHAR(64) PRIMARY KEY,
    group_id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    driver VARCHAR(64) NOT NULL, -- escpos, ipp, web
    connection_url VARCHAR(255) NOT NULL,
    width_mm INT DEFAULT 80,
    copies INT DEFAULT 1,
    header TEXT,
    footer TEXT,
    active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX (group_id)
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS print_routes (
    id VARCHAR(64) PRIMARY KEY,
    category VARCHAR(64) NOT NULL, -- e.g., beers, food, cocktails, combos
    group_id VARCHAR(64) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_cat (category)
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(36),
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_logs_user (user_id),
    INDEX idx_audit_logs_resource (resource_type, resource_id),
    INDEX idx_audit_logs_created (created_at)
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS menu_items (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(64) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    description TEXT,
    image VARCHAR(255),
    customizable TINYINT(1) DEFAULT 0,
    prep_time INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(64) PRIMARY KEY,
    table_id VARCHAR(32) NOT NULL,
    status VARCHAR(32) DEFAULT 'pending',
    order_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    estimated_time INT,
    priority VARCHAR(32) DEFAULT 'normal',
    notes TEXT,
    total DECIMAL(10,2) DEFAULT 0
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS order_items (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_id VARCHAR(64) NOT NULL,
    menu_item_id VARCHAR(64) NOT NULL,
    quantity INT NOT NULL,
    customizations TEXT,
    item_total DECIMAL(10,2) NOT NULL
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS bills (
    id VARCHAR(64) PRIMARY KEY,
    table_id VARCHAR(32) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    tax DECIMAL(10,2) NOT NULL,
    tip DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(32),
    payment_status VARCHAR(32) DEFAULT 'pending',
    tender_cash DECIMAL(10,2) DEFAULT 0,
    tender_card DECIMAL(10,2) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Seed initial data (INSERT IGNORE to be idempotent)
  const tables = [
    ...Array.from({ length: 5 }, (_, i) => [
      `B${i + 1}`, `Billiard Table ${i + 1}`, 'billiard', 'available', 4, 15.00
    ]),
    ...Array.from({ length: 10 }, (_, i) => [
      `T${i + 1}`, `Bar Table ${i + 1}`, 'bar', 'available', Math.floor(Math.random() * 3) + 4, 0
    ])
  ];
  for (const [id, name, type, status, capacity, hourlyRate] of tables) {
    await pool.query(
      `INSERT IGNORE INTO tables (id, name, type, status, capacity, hourly_rate) VALUES (?,?,?,?,?,?)`,
      [id, name, type, status, capacity, hourlyRate]
    );
  }

  const menuItems = [
    ['beer1', 'Corona Extra', 'beers', 6.50, 'Mexican lager beer', '🍺', 0, 2],
    ['beer2', 'Budweiser', 'beers', 5.50, 'American lager', '🍺', 0, 2],
    ['beer3', 'Heineken', 'beers', 6.00, 'Dutch premium lager', '🍺', 0, 2],
    ['beer4', 'Stella Artois', 'beers', 6.50, 'Belgian pilsner', '🍺', 0, 2],
    ['beer5', 'Guinness', 'beers', 7.00, 'Irish dry stout', '🍺', 0, 3],
    ['beer6', 'Blue Moon', 'beers', 6.00, 'Belgian-style wheat beer', '🍺', 0, 2],
    ['beer7', 'Modelo Especial', 'beers', 6.00, 'Mexican pilsner-style lager', '🍺', 0, 2],
    ['beer8', 'Coors Light', 'beers', 5.00, 'American light lager', '🍺', 0, 2],
    ['beer9', 'Miller Lite', 'beers', 5.00, 'American light lager', '🍺', 0, 2],
    ['beer10', 'IPA Craft', 'beers', 7.50, 'India Pale Ale', '🍺', 0, 3],
    ['food1', 'Buffalo Wings', 'food', 12.99, '10 pieces with buffalo sauce', '🍗', 0, 15],
    ['food2', 'Boneless Wings', 'food', 11.99, '10 pieces boneless with sauce', '🍗', 0, 12],
    ['food3', 'French Fries', 'food', 8.99, 'Crispy golden fries', '🍟', 0, 10],
    ['food4', 'Loaded Nachos', 'food', 14.99, 'Tortilla chips with cheese, jalapeños', '🧀', 0, 12],
    ['food5', 'Mozzarella Sticks', 'food', 9.99, '8 pieces with marinara sauce', '🧀', 0, 8],
    ['food6', 'Onion Rings', 'food', 8.99, 'Beer-battered onion rings', '🧅', 0, 10],
    ['food7', 'Chicken Quesadilla', 'food', 13.99, 'Grilled chicken with cheese', '🌯', 0, 18],
    ['food8', 'Sliders', 'food', 15.99, '3 mini burgers with fries', '🍔', 0, 20],
    ['food9', 'Jalapeño Poppers', 'food', 10.99, '8 pieces with cream cheese', '🌶️', 0, 12],
    ['food10', 'Potato Skins', 'food', 11.99, '6 pieces with bacon and cheese', '🥔', 0, 15],
    ['cocktail1', 'Margarita', 'cocktails', 11.99, 'Tequila, lime, triple sec', '🍹', 1, 5],
    ['cocktail2', 'Mojito', 'cocktails', 10.99, 'Rum, mint, lime, soda', '🍹', 1, 4],
  ];
  for (const { id, name, category, price, description, image, customizable, prepTime } of menuItems) {
    await pool.query(
      `INSERT IGNORE INTO menu_items (id, name, category, price, description, image, customizable, prep_time) VALUES (?,?,?,?,?,?,?,?)`,
      [id, name, category, price, description, image, customizable, prepTime]
    );
  }

  // Seed some discounts
  const seedDiscounts = [
    ['disc10', '10% Off', 'percent', 'total', 10.0, 1],
    ['disc5', '5 Off', 'fixed', 'total', 5.0, 1],
  ];
  for (const [id, name, kind, scope, value, active] of seedDiscounts) {
    await pool.query(
      `INSERT IGNORE INTO discounts (id, name, kind, scope, value, active) VALUES (?,?,?,?,?,?)`,
      [id, name, kind, scope, value, active]
    );
  }

  // Seed default printer groups
  const pgSeeds = [
    ['kitchen', 'Kitchen', 'Main kitchen printers', 1],
    ['bar', 'Barra', 'Bar printers', 1],
  ];
  for (const [id, name, description, active] of pgSeeds) {
    await pool.query(
      `INSERT IGNORE INTO printer_groups (id, name, description, active) VALUES (?,?,?,?)`,
      [id, name, description, active]
    );
  }

  // Phase 8 Track A: Advanced POS Features
  console.log('Initializing Phase 8 Track A: Advanced POS Features...');
  await initCustomerTables(pool);
  await seedCustomers(pool);
  await initReservationTables(pool);
  await seedReservations(pool);
  await initStaffTables(pool);
  await seedStaff(pool);

  // Phase 8 Track B: Hardware Integration
  console.log('Initializing Phase 8 Track B: Hardware Integration...');
  await initHardwareTables(pool);
  await seedHardware(pool);

  console.log('Phase 8 database initialization complete!');
}

module.exports = { pool, db, initSchema };
