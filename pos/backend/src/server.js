require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');
const { db, initSchema, pool } = require('./db');
const { initBarInventorySchema } = require('./db_bar_inventory');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const { errorHandler, UnauthorizedError, ForbiddenError } = require('./utils/errors');
const { apiLimiter, authLimiter, loginLimiter, publicApiLimiter, sensitiveOpLimiter, reportingLimiter } = require('./middleware/rateLimiter');
const responseHandler = require('./middleware/responseHandler');
const swaggerDocs = require('./config/swagger');
const InventoryAlertService = require('./services/inventoryAlertService');
const inventoryAlerts = require('./utils/inventoryAlerts');

const app = express();

// When behind a proxy/HTTPS terminator, enable trust proxy so req.secure is accurate
app.set('trust proxy', 1);

// Create HTTP or HTTPS server based on environment
let server;
let isHttps = false; // Force HTTP mode for consistency

if (isHttps) {
  try {
    const certDir = path.join(__dirname, '..', 'certs');
    const privateKey = fs.readFileSync(path.join(certDir, 'key.pem'), 'utf8');
    const certificate = fs.readFileSync(path.join(certDir, 'cert.pem'), 'utf8');
    const credentials = { key: privateKey, cert: certificate };
    
    server = https.createServer(credentials, app);
    console.log('HTTPS server created with self-signed certificate');
  } catch (error) {
    console.warn('Failed to create HTTPS server, falling back to HTTP. Run "npm run generate-cert" first.');
    console.warn(error.message);
    isHttps = false;
    server = http.createServer(app);
  }
} else {
  server = http.createServer(app);
}

// Build allowed origins (env + common local hosts)
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const allowedOrigins = new Set([
  FRONTEND_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

const io = new Server(server, { 
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin
      if (!origin) return callback(null, true);
      
      // Check if origin is in allowed list
      if (allowedOrigins.has(origin)) {
        return callback(null, true);
      }
      
      callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
  }
});

// Initialize inventory alert service with Socket.io
const inventoryAlertService = new InventoryAlertService(io);

// Initialize inventory alerts utility with the service
inventoryAlerts.initializeAlerts(inventoryAlertService);

// Schedule periodic low stock checks (every 30 minutes)
inventoryAlertService.schedulePeriodicChecks(30);

// Determine port: CLI flag (--port/-p or positional), then ENV, then default 3001
function resolvePort() {
  const argv = process.argv.slice(2);
  let cliPort = undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--port' || a === '-p') {
      const next = argv[i + 1];
      if (next && !next.startsWith('-') && !isNaN(Number(next))) {
        cliPort = Number(next);
        break;
      }
    }
    const m = /^--port=(\d+)$/.exec(a);
    if (m) {
      cliPort = Number(m[1]);
      break;
    }
    // Allow bare numeric positional arg
    if (!a.startsWith('-') && !isNaN(Number(a))) {
      cliPort = Number(a);
      // continue scanning in case a later explicit flag overrides; keep first numeric by default
    }
  }
  return Number(process.env.PORT) || cliPort || 3001;
}
const PORT = resolvePort();

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list
    if (allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    
    // For development, log rejected origins
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`CORS blocked request from origin: ${origin}`);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['set-cookie']
}));

// Apply general rate limiting to all routes as a baseline protection
app.use(apiLimiter);

// More aggressive rate limiting for auth routes
app.use('/api/access/auth', authLimiter);

// Specific login endpoint rate limiting
app.use('/api/access/auth/login', loginLimiter);

// Public API rate limiting
app.use('/api/public', publicApiLimiter);

// Rate limiting for sensitive operations
app.use('/api/admin', sensitiveOpLimiter);
app.use('/api/settings', sensitiveOpLimiter);

// Rate limiting for reporting endpoints
app.use('/api/reports', reportingLimiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Apply response standardization middleware
app.use(responseHandler);

// Initialize Swagger documentation early so it's public (before auth middleware)
if (process.env.NODE_ENV !== 'production') {
  swaggerDocs(app, PORT);
}

// Database setup (MySQL): initialize schema then run lightweight column migrations
async function ensureTableMigrations() {
  // Ensure consistent DB and table collations to avoid "Illegal mix of collations"
  try {
    const dbName = process.env.DB_NAME || 'bola8pos';
    // Use a single connection and temporarily disable FK checks during conversion
    const conn = await pool.getConnection();
    try {
      await conn.query('SET FOREIGN_KEY_CHECKS=0');
      await conn.query(`ALTER DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      const tablesToConvert = [
        'users','roles','role_permissions','permissions',
        'orders','order_items','bills','tables','menu_items',
        'audit_logs','reservations','inventory','inventory_transactions',
        'menu_item_product_map','cash_movements','shifts'
      ];
      for (const t of tablesToConvert) {
        try {
          // Convert all columns + table default to utf8mb4/utf8mb4_unicode_ci
          await conn.query(`ALTER TABLE \`${t}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
          await conn.query(`ALTER TABLE \`${t}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        } catch (e) {
          if (!/doesn't exist|unknown table/i.test(e.message)) console.warn(`convert ${t}:`, e.message);
        }
      }
    } finally {
      try { await pool.query('SET FOREIGN_KEY_CHECKS=1'); } catch {}
      try { /* ensure release even if FK enable fails */ } finally { conn.release(); }
    }
  } catch (e) {
    if (!/denied|unknown database/i.test(e.message)) console.warn('alter database collation:', e.message);
  }

  // Add lifecycle/tender columns if they don't exist (MySQL 8 supports IF NOT EXISTS)
  try {
    await pool.query(`ALTER TABLE tables ADD COLUMN IF NOT EXISTS cleaning_until DATETIME NULL`);
  } catch (e) { if (!/Duplicate column|exists/i.test(e.message)) console.warn('tables.cleaning_until:', e.message); }
  try {
    await pool.query(`ALTER TABLE tables ADD COLUMN IF NOT EXISTS paused TINYINT(1) DEFAULT 0`);
  } catch (e) { if (!/Duplicate column|exists/i.test(e.message)) console.warn('tables.paused:', e.message); }
  try {
    await pool.query(`ALTER TABLE tables ADD COLUMN IF NOT EXISTS limit_end DATETIME NULL`);
  } catch (e) { if (!/Duplicate column|exists/i.test(e.message)) console.warn('tables.limit_end:', e.message); }
  try {
    await pool.query(`ALTER TABLE bills ADD COLUMN IF NOT EXISTS tender_cash DECIMAL(10,2) DEFAULT 0`);
  } catch (e) { if (!/Duplicate column|exists/i.test(e.message)) console.warn('bills.tender_cash:', e.message); }
  try {
    await pool.query(`ALTER TABLE bills ADD COLUMN IF NOT EXISTS tender_card DECIMAL(10,2) DEFAULT 0`);
  } catch (e) { if (!/Duplicate column|exists/i.test(e.message)) console.warn('bills.tender_card:', e.message); }

  // Reservations: add check-in audit columns if missing
  try {
    await pool.query(`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS checked_in_at DATETIME NULL`);
  } catch (e) { if (!/Duplicate column|exists/i.test(e.message)) console.warn('reservations.checked_in_at:', e.message); }
  try {
    await pool.query(`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS checked_in_by VARCHAR(100) NULL`);
  } catch (e) { if (!/Duplicate column|exists/i.test(e.message)) console.warn('reservations.checked_in_by:', e.message); }
  // Phase 7: shifts & cash_movements
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS shifts (
      id VARCHAR(64) PRIMARY KEY,
      terminal_id VARCHAR(64) NULL,
      opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME NULL,
      opened_by VARCHAR(64) NULL,
      closed_by VARCHAR(64) NULL,
      start_cash DECIMAL(10,2) NOT NULL DEFAULT 0,
      end_cash_counted DECIMAL(10,2) NULL,
      expected_cash DECIMAL(10,2) NULL,
      over_short DECIMAL(10,2) NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);
  } catch (e) { console.warn('shifts table:', e.message); }
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS cash_movements (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      shift_id VARCHAR(64) NOT NULL,
      type ENUM('drop','payout','adjustment') NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      reason VARCHAR(255),
      created_by VARCHAR(64),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE,
      INDEX idx_shift (shift_id)
    )`);
  } catch (e) { console.warn('cash_movements table:', e.message); }
}

// Run SQL file migrations from `src/migrations/` once (idempotent)
async function runSqlMigrations() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_migration (name)
      )
    `);
    const [executed] = await conn.query('SELECT name FROM migrations');
    const executedNames = new Set(executed.map(r => r.name));
    const migrationsDir = path.join(__dirname, 'migrations');
    let files = [];
    try {
      files = await fs.promises.readdir(migrationsDir);
    } catch (e) {
      console.warn('Migrations dir missing:', migrationsDir);
      files = [];
    }
    const toRun = files.filter(f => f.endsWith('.sql') && !executedNames.has(f)).sort();
    if (toRun.length === 0) {
      await conn.commit();
      return;
    }
    for (const file of toRun) {
      const sql = await fs.promises.readFile(path.join(migrationsDir, file), 'utf8');
      const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
      for (const stmt of statements) {
        await conn.query(stmt);
      }
      await conn.query('INSERT INTO migrations (name) VALUES (?)', [file]);
      console.log(`[migrate] ✓ ${file}`);
    }
    await conn.commit();
    console.log('[migrate] All migrations applied');
  } catch (e) {
    await conn.rollback();
    console.error('[migrate] Failed:', e.message);
  } finally {
    conn.release();
  }
}

initSchema()
  .then(async () => {
    if (typeof initBarInventorySchema === 'function') {
      await initBarInventorySchema();
    }
    await runSqlMigrations();
    await ensureTableMigrations();
  })
  .catch(err => {
    console.error('DB init failed:', err);
  });

// Seeding is handled in db.initSchema()

// Import routes
const accessRoutes = require('./routes/access');
const tablesRouter = require('./routes/tables');
const menuRouter = require('./routes/menu');
const ordersRouter = require('./routes/orders');
const inventoryRouter = require('./routes/inventory/index');
const reportsRouter = require('./routes/reports');
const settingsRouter = require('./routes/settings');
const hardwareRoutes = require('./routes/hardware');
const customersRouter = require('./routes/customers');
const reservationsRouter = require('./routes/reservations');

// Authentication middleware
const { authenticate } = require('./middleware/auth.middleware');
const testRoutes = require('./routes/test.routes');

// Public routes (no authentication required)
app.use('/api/access', accessRoutes);
app.use('/api/test', testRoutes);

// Health endpoint - no authentication required
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Serve favicon.ico before authentication
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Protected routes (require authentication)
app.use(authenticate);

// API routes
// Mount tablesRouter at '/api' so its internal paths like '/tables' and '/table-layouts'
// resolve to '/api/tables' and '/api/table-layouts' respectively.
app.use('/api', tablesRouter);
app.use('/api/menu', menuRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/hardware', hardwareRoutes);
app.use('/api/customers', customersRouter);
app.use('/api/reservations', reservationsRouter);

// Global error handler (must be after all other middleware/routes)
app.use((err, req, res, next) => {
  const status = err.statusCode || err.status || 500;
  const isAuthErr =
    status === 401 ||
    status === 403 ||
    err instanceof UnauthorizedError ||
    err instanceof ForbiddenError;

  if (isAuthErr) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`AuthError ${status}: ${err.message} ${req.method} ${req.originalUrl}`);
    }
  } else {
    console.error('API Error:', err && err.stack ? err.stack : err);
  }

  return errorHandler(err, req, res, next);
});

// Helper: write audit log
function writeAudit({ action, entityType = null, entityId = null, tableId = null, details = null, userId = null, role = null, ip = null }, cb) {
  const dstr = details ? JSON.stringify(details) : null;
  db.run(
    `INSERT INTO audit_logs (action, entity_type, entity_id, table_id, details, user_id, role, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [action, entityType, entityId, tableId, dstr, userId, role, ip],
    function (err) {
      if (cb) cb(err, this?.lastID);
    }
  );
}

// Admin: verify manager pin (demo)
app.post('/api/admin/verify-pin', (req, res) => {
  const { pin, accessCode } = req.body || {};
  const effective = String(accessCode || '').trim() || '1234';
  const ok = String(pin || '') === effective || String(pin || '') === '1234';
  return res.json({ ok, role: ok ? 'manager' : null });
});

// Inventory API is now fully implemented in routes/inventory/index.js

// ---------------------------
// Phase 7: Shift Management
// ---------------------------
function toSql(dt) {
  if (!dt) return null;
  if (typeof dt === 'string') return dt; // already in 'YYYY-MM-DD HH:MM:SS'
  const d = new Date(dt);
  const pad = (n) => String(n).padStart(2, '0');
  const s = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return s; // local time, matches MySQL CURRENT_TIMESTAMP timezone
}

async function getActiveShift() {
  const [rows] = await pool.query(`SELECT * FROM shifts WHERE closed_at IS NULL ORDER BY opened_at DESC LIMIT 1`);
  return rows && rows[0] ? rows[0] : null;
}

async function getShiftById(id) {
  const [rows] = await pool.query(`SELECT * FROM shifts WHERE id = ?`, [id]);
  return rows && rows[0] ? rows[0] : null;
}

async function getCashSalesTotal(from, to) {
  // Cash portion using tender_cash when available; otherwise payment_method='cash'
  const [r1] = await pool.query(
    `SELECT 
       COALESCE(SUM(CASE WHEN COALESCE(tender_cash,0) > 0 THEN tender_cash 
                         WHEN LOWER(payment_method) = 'cash' THEN total ELSE 0 END),0) AS cash_total
     FROM bills
     WHERE created_at BETWEEN ? AND ?`, [from, to]
  );
  return Number(r1 && r1[0] ? r1[0].cash_total : 0);
}

async function getMovementSums(shiftId) {
  const [rows] = await pool.query(`SELECT type, COALESCE(SUM(amount),0) as amt FROM cash_movements WHERE shift_id = ? GROUP BY type`, [shiftId]);
  const sums = { drop: 0, payout: 0, adjustment: 0 };
  for (const r of rows || []) sums[r.type] = Number(r.amt || 0);
  return sums;
}

async function computeShiftExpected(shift) {
  const from = typeof shift.opened_at === 'string' ? shift.opened_at : toSql(shift.opened_at);
  const to = typeof shift.closed_at === 'string' ? shift.closed_at : toSql(shift.closed_at || new Date());
  const cashSales = await getCashSalesTotal(from, to);
  const { drop, payout, adjustment } = await getMovementSums(shift.id);
  const expected = Number(shift.start_cash || 0) + cashSales - drop - payout + adjustment;
  return { cashSales, drop, payout, adjustment, expected };
}

// Open a shift
app.post('/api/shifts/open', async (req, res) => {
  try {
    const { start_cash = 0, notes = '', terminal_id = null, user_id = null } = req.body || {};
    const active = await getActiveShift();
    if (active) return res.status(400).json({ error: 'A shift is already open' });
    const id = 'shift_' + Date.now();
    // Use NOW() to avoid timezone mismatches vs MySQL CURRENT_TIMESTAMP
    await pool.query(`INSERT INTO shifts (id, terminal_id, opened_at, opened_by, start_cash, notes) VALUES (?, ?, NOW(), ?, ?, ?)`,
      [id, terminal_id, user_id, start_cash, notes]);
    writeAudit({ action: 'shift-open', entityType: 'shift', entityId: id, details: { start_cash, terminal_id }, userId: user_id });
    const shift = await getShiftById(id);
    res.json(shift);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Active shift
app.get('/api/shifts/active', async (_req, res) => {
  try {
    const active = await getActiveShift();
    if (!active) return res.json(null);
    const computed = await computeShiftExpected(active);
    res.json({ ...active, ...computed });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Add cash movement
app.post('/api/shifts/:id/movement', async (req, res) => {
  try {
    const { id } = req.params;
    const { type, amount, reason = '', user_id = null } = req.body || {};
    if (!['drop','payout','adjustment'].includes(String(type))) return res.status(400).json({ error: 'Invalid type' });
    const amt = Number(amount);
    if (!(amt > 0)) return res.status(400).json({ error: 'amount must be > 0' });
    const shift = await getShiftById(id);
    if (!shift || shift.closed_at) return res.status(400).json({ error: 'Shift not found or already closed' });
    await pool.query(`INSERT INTO cash_movements (shift_id, type, amount, reason, created_by) VALUES (?,?,?,?,?)`, [id, type, amt, reason, user_id]);
    writeAudit({ action: 'cash-movement', entityType: 'shift', entityId: id, details: { type, amount: amt, reason }, userId: user_id });
    const computed = await computeShiftExpected(shift);
    res.json({ ok: true, ...computed });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Close shift
app.post('/api/shifts/:id/close', async (req, res) => {
  try {
    const { id } = req.params;
    const { end_cash_counted = 0, notes = '', user_id = null } = req.body || {};
    const shift = await getShiftById(id);
    if (!shift || shift.closed_at) return res.status(400).json({ error: 'Shift not found or already closed' });
    const closed_at = new Date();
    const computed = await computeShiftExpected({ ...shift, closed_at });
    const over_short = Number(end_cash_counted) - computed.expected;
    await pool.query(`UPDATE shifts SET closed_at = ?, closed_by = ?, end_cash_counted = ?, expected_cash = ?, over_short = ?, notes = CONCAT(COALESCE(notes,''), ?) WHERE id = ?`,
      [toSql(closed_at), user_id, end_cash_counted, computed.expected, over_short, notes ? ('\n' + notes) : '', id]);
    writeAudit({ action: 'shift-close', entityType: 'shift', entityId: id, details: { end_cash_counted, expected_cash: computed.expected, over_short }, userId: user_id });
    const updated = await getShiftById(id);
    res.json({ ...updated, ...computed, over_short });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Shift summary
app.get('/api/shifts/:id/summary', async (req, res) => {
  try {
    const { id } = req.params;
    const shift = await getShiftById(id);
    if (!shift) return res.status(404).json({ error: 'Not found' });
    const { cashSales, drop, payout, adjustment, expected } = await computeShiftExpected(shift);
    res.json({
      shift,
      cash_sales: cashSales,
      drops_total: drop,
      payouts_total: payout,
      adjustments_total: adjustment,
      expected_cash: expected,
      over_short: shift.end_cash_counted != null ? (Number(shift.end_cash_counted) - expected) : null
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Shift history
app.get('/api/shifts/history', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '20', 10) || 20, 100);
    const [rows] = await pool.query(`SELECT * FROM shifts ORDER BY opened_at DESC LIMIT ?`, [limit]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Admin: list audit logs
app.get('/api/admin/audit', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '100', 10) || 100, 500);
  db.all(`SELECT * FROM audit_logs ORDER BY ts DESC LIMIT ?`, [limit], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const mapped = rows.map(r => ({ ...r, details: r.details ? JSON.parse(r.details) : null }));
    return res.json(mapped);
  });
});

// Reports: shift summary between from/to (ms epoch or ISO)
app.get('/api/reports/shift', async (req, res) => {
  try {
    const fromQ = req.query.from;
    const toQ = req.query.to;
    const fromIso = fromQ ? new Date(Number(fromQ) || String(fromQ)).toISOString().slice(0, 19).replace('T', ' ') : null;
    const toIso = toQ ? new Date(Number(toQ) || String(toQ)).toISOString().slice(0, 19).replace('T', ' ') : null;

    // If not provided, default to last 24 hours
    const now = new Date();
    const fallbackTo = now.toISOString().slice(0,19).replace('T',' ');
    const fallbackFrom = new Date(now.getTime() - 24*60*60*1000).toISOString().slice(0,19).replace('T',' ');
    const from = fromIso || fallbackFrom;
    const to = toIso || fallbackTo;

    const [ordersRows, billsRows, voidRows, compRows] = await Promise.all([
      new Promise((resolve, reject) => db.all(`SELECT COUNT(*) as cnt, COALESCE(SUM(total),0) as sum FROM orders WHERE order_time BETWEEN ? AND ?`, [from, to], (e,r)=> e?reject(e):resolve(r))),
      new Promise((resolve, reject) => db.all(`SELECT COUNT(*) as cnt, COALESCE(SUM(total),0) as sum FROM bills WHERE created_at BETWEEN ? AND ?`, [from, to], (e,r)=> e?reject(e):resolve(r))),
      new Promise((resolve, reject) => db.all(`SELECT COUNT(*) as cnt FROM audit_logs WHERE action = 'void-item' AND ts BETWEEN ? AND ?`, [from, to], (e,r)=> e?reject(e):resolve(r))),
      new Promise((resolve, reject) => db.all(`SELECT COUNT(*) as cnt FROM audit_logs WHERE action = 'comp-item' AND ts BETWEEN ? AND ?`, [from, to], (e,r)=> e?reject(e):resolve(r))),
    ]);

    // Payment method breakdown using tender columns for splits
    const payRows = await new Promise((resolve, reject) => {
      const sql = `
        SELECT 'cash' as method,
               SUM(CASE WHEN LOWER(payment_method) = 'cash' THEN total ELSE COALESCE(tender_cash,0) END) as sum,
               SUM(CASE WHEN (LOWER(payment_method) = 'cash' AND total > 0) OR (COALESCE(tender_cash,0) > 0) THEN 1 ELSE 0 END) as cnt
        FROM bills
        WHERE created_at BETWEEN ? AND ?
        UNION ALL
        SELECT 'card' as method,
               SUM(CASE WHEN LOWER(payment_method) = 'card' THEN total ELSE COALESCE(tender_card,0) END) as sum,
               SUM(CASE WHEN (LOWER(payment_method) = 'card' AND total > 0) OR (COALESCE(tender_card,0) > 0) THEN 1 ELSE 0 END) as cnt
        FROM bills
        WHERE created_at BETWEEN ? AND ?`;
      db.all(sql, [from, to, from, to], (err, rows) => err ? reject(err) : resolve(rows));
    });

    // Station throughput via category → station mapping
    const stationRows = await new Promise((resolve, reject) => {
      const sql = `
        SELECT station,
               COUNT(DISTINCT o.id) as orders,
               COALESCE(SUM(oi.quantity),0) as items_count,
               COALESCE(SUM(oi.item_total),0) as items_total
        FROM (
          SELECT o.id,
                 CASE 
                   WHEN LOWER(mi.category) IN ('food','foods','kitchen','meal','meals','cocktail','cocktails') THEN 'kitchen'
                   WHEN LOWER(mi.category) IN ('drink','drinks','beer','beers','bar','wine','wines') THEN 'bar'
                   ELSE 'other'
                 END as station
          FROM orders o
          JOIN order_items oi ON oi.order_id = o.id
          LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
          WHERE o.order_time BETWEEN ? AND ?
        ) ox
        JOIN orders o ON o.id = ox.id
        JOIN order_items oi ON oi.order_id = o.id
        LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
        WHERE o.order_time BETWEEN ? AND ?
          AND (
            (ox.station = 'kitchen' AND LOWER(mi.category) IN ('food','foods','kitchen','meal','meals','cocktail','cocktails')) OR
            (ox.station = 'bar' AND LOWER(mi.category) IN ('drink','drinks','beer','beers','bar','wine','wines')) OR
            (ox.station = 'other' AND NOT (LOWER(mi.category) IN ('food','foods','kitchen','meal','meals','cocktails','cocktail','drink','drinks','beer','beers','bar','wine','wines')))
          )
        GROUP BY station
        ORDER BY items_total DESC`;
      db.all(sql, [from, to, from, to], (err, rows) => err ? reject(err) : resolve(rows));
    });

    // Hourly buckets for orders_total and bills_total (MySQL)
    const bucketsRows = await new Promise((resolve, reject) => {
      const sql = `
        WITH ord AS (
          SELECT DATE_FORMAT(order_time, '%Y-%m-%d %H:00:00') as bucket, COALESCE(SUM(total),0) as orders_total
          FROM orders
          WHERE order_time BETWEEN ? AND ?
          GROUP BY bucket
        ), bil AS (
          SELECT DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00') as bucket, COALESCE(SUM(total),0) as bills_total
          FROM bills
          WHERE created_at BETWEEN ? AND ?
          GROUP BY bucket
        )
        SELECT ord.bucket as bucket, ord.orders_total, COALESCE(bil.bills_total,0) as bills_total
        FROM ord
        LEFT JOIN bil ON ord.bucket = bil.bucket
        UNION ALL
        SELECT bil.bucket as bucket, 0 as orders_total, bil.bills_total
        FROM bil
        LEFT JOIN ord ON bil.bucket = ord.bucket
        WHERE ord.bucket IS NULL
        ORDER BY bucket ASC`;
      db.all(sql, [from, to, from, to], (err, rows) => err ? reject(err) : resolve(rows));
    });

    // Hourly payment by method
    const payHourly = await new Promise((resolve, reject) => {
      const sql = `
        WITH base AS (
          SELECT DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00') as bucket,
                 LOWER(payment_method) as method,
                 total,
                 COALESCE(tender_cash,0) as tender_cash,
                 COALESCE(tender_card,0) as tender_card
          FROM bills
          WHERE created_at BETWEEN ? AND ?
        )
        SELECT bucket, 'cash' as method,
               SUM(CASE WHEN method = 'cash' THEN total ELSE tender_cash END) as sum,
               SUM(CASE WHEN (method = 'cash' AND total > 0) OR (tender_cash > 0) THEN 1 ELSE 0 END) as cnt
        FROM base GROUP BY bucket
        UNION ALL
        SELECT bucket, 'card' as method,
               SUM(CASE WHEN method = 'card' THEN total ELSE tender_card END) as sum,
               SUM(CASE WHEN (method = 'card' AND total > 0) OR (tender_card > 0) THEN 1 ELSE 0 END) as cnt
        FROM base GROUP BY bucket
        ORDER BY bucket ASC`;
      db.all(sql, [from, to], (err, rows) => err ? reject(err) : resolve(rows));
    });

    // COGS from inventory transactions (sale movements)
    const cogsRow = await new Promise((resolve, reject) => {
      const sql = `SELECT COALESCE(SUM(total_cost),0) as cogs_total
                   FROM inventory_transactions
                   WHERE transaction_type = 'sale' AND created_at BETWEEN ? AND ?`;
      db.all(sql, [from, to], (err, rows) => err ? reject(err) : resolve(rows && rows[0] ? rows[0] : { cogs_total: 0 }));
    });

    // Top items by sales
    const topItems = await new Promise((resolve, reject) => {
      const sql = `
        SELECT mi.name as item, COALESCE(SUM(oi.quantity),0) as qty, COALESCE(SUM(oi.item_total),0) as total
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
        WHERE o.order_time BETWEEN ? AND ?
        GROUP BY mi.name
        ORDER BY total DESC
        LIMIT 10`;
      db.all(sql, [from, to], (err, rows) => err ? reject(err) : resolve(rows || []));
    });

    // Top categories by sales
    const topCategories = await new Promise((resolve, reject) => {
      const sql = `
        SELECT COALESCE(LOWER(mi.category),'uncategorized') as category,
               COALESCE(SUM(oi.quantity),0) as qty,
               COALESCE(SUM(oi.item_total),0) as total
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
        WHERE o.order_time BETWEEN ? AND ?
        GROUP BY COALESCE(LOWER(mi.category),'uncategorized')
        ORDER BY total DESC
        LIMIT 10`;
      db.all(sql, [from, to], (err, rows) => err ? reject(err) : resolve(rows || []));
    });

    // Compute anomalies from buckets (simple z-score on bills_total)
    const bks = Array.isArray(bucketsRows) ? bucketsRows.filter(b => typeof b.bills_total === 'number') : [];
    let anomalies = [];
    if (bks.length > 1) {
      const values = bks.map(b => Number(b.bills_total || 0));
      const mean = values.reduce((a,b)=>a+b,0) / values.length;
      const variance = values.reduce((a,b)=>a+Math.pow(b-mean,2),0) / values.length;
      const std = Math.sqrt(variance);
      anomalies = bks
        .map(b => ({ bucket: b.bucket, bills_total: Number(b.bills_total||0), z: std ? (Number(b.bills_total||0)-mean)/std : 0 }))
        .filter(x => x.z >= 2.0)
        .sort((a,b) => b.z - a.z)
        .slice(0, 3);
    }

    const orders_count = ordersRows?.[0]?.cnt || 0;
    const orders_total = Number(ordersRows?.[0]?.sum || 0);
    const bills_count = billsRows?.[0]?.cnt || 0;
    const bills_total = Number(billsRows?.[0]?.sum || 0);
    const void_count = voidRows?.[0]?.cnt || 0;
    const comp_count = compRows?.[0]?.cnt || 0;
    const cogs_total = Number(cogsRow?.cogs_total || 0);
    const gross_margin = Number(bills_total - cogs_total);
    const gross_margin_pct = bills_total > 0 ? +(gross_margin / bills_total * 100).toFixed(2) : 0;

    return res.json({
      window: { from, to },
      orders_count, orders_total,
      bills_count, bills_total,
      void_count, comp_count,
      payments_by_method: payRows,
      station_throughput: stationRows,
      buckets: bucketsRows,
      payments_by_method_hourly: payHourly,
      cogs_total,
      gross_margin,
      gross_margin_pct,
      top_items: topItems,
      top_categories: topCategories,
      anomalies,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Helper: decrement inventory for a table's open orders using mapping table
async function applyInventoryForTable(tableId, userId = null) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Aggregate sold quantities per mapped product for open orders on the table
    const [rows] = await conn.query(
      `SELECT 
         oi.menu_item_id,
         SUM(oi.quantity) AS qty_sold,
         map.product_id,
         map.variant_id,
         COALESCE(map.qty_per_item, 1) AS qty_per_item
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN menu_item_product_map map ON map.menu_item_id = oi.menu_item_id
       WHERE o.table_id = ? AND (o.status IS NULL OR LOWER(o.status) NOT IN ('completed','cancelled'))
       GROUP BY oi.menu_item_id, map.product_id, map.variant_id, map.qty_per_item`,
      [tableId]
    );

    // Default issue location
    const issueLocation = 'main_bar';

    for (const r of rows) {
      if (!r.product_id) continue; // skip if no mapping
      const totalQty = Number(r.qty_sold || 0) * Number(r.qty_per_item || 1);
      if (!(totalQty > 0)) continue;

      // Fetch existing inventory row FOR UPDATE
      const [invRows] = await conn.query(
        `SELECT id, quantity FROM inventory
         WHERE product_id = ? AND location_id = ? AND (variant_id = ? OR (variant_id IS NULL AND ? IS NULL))
         FOR UPDATE`,
        [r.product_id, issueLocation, r.variant_id || null, r.variant_id || null]
      );
      if (invRows.length > 0) {
        await conn.query(
          `UPDATE inventory SET quantity = quantity - ? WHERE id = ?`,
          [totalQty, invRows[0].id]
        );
      } else {
        await conn.query(
          `INSERT INTO inventory (product_id, variant_id, location_id, quantity)
           VALUES (?, ?, ?, ?)`,
          [r.product_id, r.variant_id || null, issueLocation, -totalQty]
        );
      }

      // Log inventory transaction
      await conn.query(
        `INSERT INTO inventory_transactions (
           transaction_type, reference_id, reference_type, product_id, variant_id,
           from_location_id, to_location_id, quantity, unit_cost, notes, created_by
         ) VALUES ('sale', ?, 'bill', ?, ?, ?, NULL, ?, 0, ?, ?)`,
        [tableId, r.product_id, r.variant_id || null, issueLocation, totalQty, `Sale from table ${tableId}`, userId]
      );
    }

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

// Tables: list
app.get('/api/tables', (_req, res) => {
  const sql = `SELECT * FROM tables ORDER BY id ASC`;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// Tables: update selected fields
app.put('/api/tables/:id', (req, res) => {
  const { id } = req.params;
  const allowed = new Set(['name','status','start_time','elapsed_time','current_bill','rate','paused','notes','services','limit_end','cleaning_until','updated_at']);
  const body = req.body || {};
  const fields = Object.keys(body).filter(k => allowed.has(k));
  if (fields.length === 0) return res.status(400).json({ error: 'No updatable fields provided' });
  const setClause = fields.map(k => `${k} = ?`).join(', ');
  const values = fields.map(k => body[k]);
  const sql = `UPDATE tables SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
  db.run(sql, [...values, id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    try { io.emit('tables:updated', { id, changes: body }); } catch {}
    res.json({ ok: true, id, changes: this.changes });
  });
});

// Manager-protected table actions
app.post('/api/tables/:id/finalize-bill', (req, res) => {
  const { id } = req.params;
  const { reason = '', managerPin = '', accessCode } = req.body || {};
  const effective = String(accessCode || '').trim() || '1234';
  const mPin = String(managerPin || '').trim();
  const ok = mPin === effective || mPin === '1234' || effective === '1234';
  if (!ok) return res.status(403).json({ error: 'Invalid manager PIN or access code' });

  // Example: mark status and write audit
  db.run(`UPDATE tables SET status = 'settling' WHERE id = ?`, [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    writeAudit({
      action: 'finalize-bill',
      entityType: 'table',
      entityId: id,
      tableId: id,
      details: { reason },
      role: 'manager',
      ip: req.ip,
    });
    res.json({ ok: true });
  });
});

app.post('/api/tables/:id/end-session', (req, res) => {
  const { id } = req.params;
  const { reason = '', managerPin = '', accessCode } = req.body || {};
  const effective = String(accessCode || '').trim() || '1234';
  const ok = String(managerPin || '') === effective || String(managerPin || '') === '1234';
  if (!ok) return res.status(403).json({ error: 'Invalid manager PIN' });

  db.run(`UPDATE tables SET status = 'available' WHERE id = ?`, [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    writeAudit({
      action: 'end-session',
      entityType: 'table',
      entityId: id,
      tableId: id,
      details: { reason },
      role: 'manager',
      ip: req.ip,
    });
    res.json({ ok: true });
  });
});

// Table lifecycle endpoints
app.post('/api/tables/:id/start', (req, res) => {
  const { id } = req.params;
  const { rate = 0, limited = false, minutes = 0, services = 0 } = req.body || {};
  const now = Date.now();
  const limitEndMs = limited ? now + (Number(minutes) || 0) * 60 * 1000 : null;
  const startIso = new Date(now).toISOString().slice(0,19).replace('T',' ');
  const limitEndIso = limitEndMs ? new Date(limitEndMs).toISOString().slice(0,19).replace('T',' ') : null;
  db.run(
    `UPDATE tables SET status = 'occupied', start_time = ?, elapsed_time = 0, hourly_rate = ?, current_bill = COALESCE(current_bill,0) + ?, limit_end = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [startIso, Number(rate) || 0, Number(services) || 0, limitEndIso, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      writeAudit({ action: 'start-session', entityType: 'table', entityId: id, tableId: id, details: { rate, limited, minutes, services }, role: 'operator', ip: req.ip });
      db.get('SELECT * FROM tables WHERE id = ?', [id], (e, row) => {
        if (e) return res.status(500).json({ error: e.message });
        res.json(row);
      });
    }
  );
});

app.post('/api/tables/:id/pause', (req, res) => {
  const { id } = req.params;
  db.run(`UPDATE tables SET paused = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    writeAudit({ action: 'pause-session', entityType: 'table', entityId: id, tableId: id, role: 'operator', ip: req.ip });
    res.json({ ok: true });
  });
});

app.post('/api/tables/:id/resume', (req, res) => {
  const { id } = req.params;
  db.run(`UPDATE tables SET paused = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    writeAudit({ action: 'resume-session', entityType: 'table', entityId: id, tableId: id, role: 'operator', ip: req.ip });
    res.json({ ok: true });
  });
});

app.post('/api/tables/:id/cleaning', (req, res) => {
  const { id } = req.params;
  const { minutes = 5 } = req.body || {};
  const untilMs = Date.now() + (Number(minutes) || 5) * 60 * 1000;
  const untilIso = new Date(untilMs).toISOString().slice(0,19).replace('T',' ');
  db.run(`UPDATE tables SET cleaning_until = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [untilIso, id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    writeAudit({ action: 'cleaning-set', entityType: 'table', entityId: id, tableId: id, details: { minutes }, role: 'operator', ip: req.ip });
    res.json({ ok: true, cleaning_until: untilIso });
  });
});

app.post('/api/tables', (req, res) => {
  const { id, name, type, status = 'available', capacity = 4, hourly_rate = 0 } = req.body || {};
  if (!id || !name || !type) {
    return res.status(400).json({ error: 'id, name, and type are required' });
  }
  db.run(
    `INSERT INTO tables (id, name, type, status, capacity, hourly_rate) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, name, type, status, capacity, hourly_rate],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get('SELECT * FROM tables WHERE id = ?', [id], (e, row) => {
        if (e) return res.status(500).json({ error: e.message });
        res.status(201).json(row);
      });
    }
  );
});

// Tables routes
app.get('/api/tables', (req, res) => {
  db.all('SELECT * FROM tables ORDER BY type, id', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Orders: manager actions — void/comp line
app.post('/api/orders/void-line', (req, res) => {
  const { tableId = null, line = {}, reason = '', managerPin = '', accessCode } = req.body || {};
  const effective = String(accessCode || '').trim() || '1234';
  const ok = String(managerPin || '') === effective || String(managerPin || '') === '1234';
  if (!ok) return res.status(403).json({ error: 'Invalid manager PIN' });

  writeAudit({
    action: 'void-item',
    entityType: 'order-line',
    entityId: line?.itemId || line?.id || null,
    tableId,
    details: { reason, line },
    role: 'manager',
    ip: req.ip,
  });
  return res.json({ ok: true });
});

// Admin Settings: key-value JSON by key
app.get('/api/settings/:key', (req, res) => {
  const { key } = req.params;
  db.get(`SELECT svalue FROM settings WHERE skey = ?`, [key], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    let value = null;
    try { value = row && row.svalue ? (typeof row.svalue === 'string' ? JSON.parse(row.svalue) : row.svalue) : null; } catch { value = row?.svalue || null; }
    res.json({ key, value });
  });
});

app.put('/api/settings/:key', (req, res) => {
  const { key } = req.params;
  const { value = null } = req.body || {};
  const json = JSON.stringify(value ?? null);
  db.run(`INSERT INTO settings (skey, svalue) VALUES (?, ?) ON DUPLICATE KEY UPDATE svalue = VALUES(svalue), updated_at = CURRENT_TIMESTAMP`, [key, json], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ key, value });
  });
});

// Printer Groups CRUD
app.get('/api/printer-groups', (req, res) => {
  db.all(`SELECT * FROM printer_groups ORDER BY name`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/printer-groups', (req, res) => {
  const { id, name, description = '', active = 1 } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  const gid = id || ('pg_' + Date.now());
  db.run(`INSERT INTO printer_groups (id, name, description, active) VALUES (?,?,?,?)`, [gid, name, description, active ? 1 : 0], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    db.get(`SELECT * FROM printer_groups WHERE id = ?`, [gid], (e, row) => {
      if (e) return res.status(500).json({ error: e.message });
      res.status(201).json(row);
    });
  });
});

app.put('/api/printer-groups/:id', (req, res) => {
  const { id } = req.params;
  const { name, description, active } = req.body || {};
  const fields = [], params = [];
  if (name !== undefined) { fields.push('name = ?'); params.push(name); }
  if (description !== undefined) { fields.push('description = ?'); params.push(description); }
  if (active !== undefined) { fields.push('active = ?'); params.push(active ? 1 : 0); }
  if (fields.length === 0) return res.status(400).json({ error: 'no fields to update' });
  const sql = `UPDATE printer_groups SET ${fields.join(', ')} WHERE id = ?`;
  params.push(id);
  db.run(sql, params, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    db.get(`SELECT * FROM printer_groups WHERE id = ?`, [id], (e, row) => {
      if (e) return res.status(500).json({ error: e.message });
      res.json(row);
    });
  });
});

app.delete('/api/printer-groups/:id', (req, res) => {
  const { id } = req.params;
  db.run(`DELETE FROM printer_groups WHERE id = ?`, [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true, deleted: this.changes || 0 });
  });
});

// Printers CRUD
app.get('/api/printers', (req, res) => {
  db.all(`SELECT * FROM printers ORDER BY name`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/printers', (req, res) => {
  const { id, group_id, name, driver = 'web', connection_url, width_mm = 80, copies = 1, header = null, footer = null, active = 1 } = req.body || {};
  if (!group_id || !name || !driver || !connection_url) return res.status(400).json({ error: 'group_id, name, driver, connection_url are required' });
  const pid = id || ('prn_' + Date.now());
  db.run(`INSERT INTO printers (id, group_id, name, driver, connection_url, width_mm, copies, header, footer, active) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [pid, group_id, name, String(driver).toLowerCase(), connection_url, Number(width_mm)||80, Number(copies)||1, header, footer, active?1:0],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get(`SELECT * FROM printers WHERE id = ?`, [pid], (e, row) => {
        if (e) return res.status(500).json({ error: e.message });
        res.status(201).json(row);
      });
    }
  );
});

app.put('/api/printers/:id', (req, res) => {
  const { id } = req.params;
  const { group_id, name, driver, connection_url, width_mm, copies, header, footer, active } = req.body || {};
  const fields = [], params = [];
  if (group_id !== undefined) { fields.push('group_id = ?'); params.push(group_id); }
  if (name !== undefined) { fields.push('name = ?'); params.push(name); }
  if (driver !== undefined) { fields.push('driver = ?'); params.push(String(driver).toLowerCase()); }
  if (connection_url !== undefined) { fields.push('connection_url = ?'); params.push(connection_url); }
  if (width_mm !== undefined) { fields.push('width_mm = ?'); params.push(Number(width_mm)); }
  if (copies !== undefined) { fields.push('copies = ?'); params.push(Number(copies)); }
  if (header !== undefined) { fields.push('header = ?'); params.push(header); }
  if (footer !== undefined) { fields.push('footer = ?'); params.push(footer); }
  if (active !== undefined) { fields.push('active = ?'); params.push(active?1:0); }
  if (fields.length === 0) return res.status(400).json({ error: 'no fields to update' });
  const sql = `UPDATE printers SET ${fields.join(', ')} WHERE id = ?`;
  params.push(id);
  db.run(sql, params, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    db.get(`SELECT * FROM printers WHERE id = ?`, [id], (e, row) => {
      if (e) return res.status(500).json({ error: e.message });
      res.json(row);
    });
  });
});

app.delete('/api/printers/:id', (req, res) => {
  const { id } = req.params;
  db.run(`DELETE FROM printers WHERE id = ?`, [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true, deleted: this.changes || 0 });
  });
});

// Print Routes CRUD
app.get('/api/print-routes', (req, res) => {
  db.all(`SELECT * FROM print_routes ORDER BY category`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/print-routes', (req, res) => {
  const { id, category, group_id } = req.body || {};
  if (!category || !group_id) return res.status(400).json({ error: 'category and group_id are required' });
  const rid = id || ('route_' + Date.now());
  db.run(`INSERT INTO print_routes (id, category, group_id) VALUES (?,?,?)`, [rid, String(category).toLowerCase(), group_id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    db.get(`SELECT * FROM print_routes WHERE id = ?`, [rid], (e, row) => {
      if (e) return res.status(500).json({ error: e.message });
      res.status(201).json(row);
    });
  });
});

app.put('/api/print-routes/:id', (req, res) => {
  const { id } = req.params;
  const { category, group_id } = req.body || {};
  const fields = [], params = [];
  if (category !== undefined) { fields.push('category = ?'); params.push(String(category).toLowerCase()); }
  if (group_id !== undefined) { fields.push('group_id = ?'); params.push(group_id); }
  if (fields.length === 0) return res.status(400).json({ error: 'no fields to update' });
  const sql = `UPDATE print_routes SET ${fields.join(', ')} WHERE id = ?`;
  params.push(id);
  db.run(sql, params, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    db.get(`SELECT * FROM print_routes WHERE id = ?`, [id], (e, row) => {
      if (e) return res.status(500).json({ error: e.message });
      res.json(row);
    });
  });
});

app.delete('/api/print-routes/:id', (req, res) => {
  const { id } = req.params;
  db.run(`DELETE FROM print_routes WHERE id = ?`, [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true, deleted: this.changes || 0 });
  });
});

// Discounts CRUD
app.get('/api/discounts', (req, res) => {
  const onlyActive = String(req.query.active || '').toLowerCase();
  const sql = onlyActive === '1' || onlyActive === 'true'
    ? 'SELECT * FROM discounts WHERE active = 1 ORDER BY created_at DESC'
    : 'SELECT * FROM discounts ORDER BY created_at DESC';
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/discounts', (req, res) => {
  const { id, name, kind, scope, value, active = 1 } = req.body || {};
  if (!name || !kind || !scope || !Number.isFinite(Number(value))) {
    return res.status(400).json({ error: 'name, kind, scope, value are required' });
  }
  const did = id || ('disc_' + Date.now());
  db.run(
    `INSERT INTO discounts (id, name, kind, scope, value, active) VALUES (?,?,?,?,?,?)`,
    [did, name, String(kind).toLowerCase(), String(scope).toLowerCase(), Number(value), active ? 1 : 0],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get('SELECT * FROM discounts WHERE id = ?', [did], (e, row) => {
        if (e) return res.status(500).json({ error: e.message });
        res.status(201).json(row);
      });
    }
  );
});

app.put('/api/discounts/:id', (req, res) => {
  const { id } = req.params;
  const { name, kind, scope, value, active } = req.body || {};
  const fields = [];
  const params = [];
  if (name !== undefined) { fields.push('name = ?'); params.push(name); }
  if (kind !== undefined) { fields.push('kind = ?'); params.push(String(kind).toLowerCase()); }
  if (scope !== undefined) { fields.push('scope = ?'); params.push(String(scope).toLowerCase()); }
  if (value !== undefined) { fields.push('value = ?'); params.push(Number(value)); }
  if (active !== undefined) { fields.push('active = ?'); params.push(active ? 1 : 0); }
  if (fields.length === 0) return res.status(400).json({ error: 'no fields to update' });
  const sql = `UPDATE discounts SET ${fields.join(', ')} WHERE id = ?`;
  params.push(id);
  db.run(sql, params, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    db.get('SELECT * FROM discounts WHERE id = ?', [id], (e, row) => {
      if (e) return res.status(500).json({ error: e.message });
      res.json(row);
    });
  });
});

app.delete('/api/discounts/:id', (req, res) => {
  const { id } = req.params;
  db.run(`DELETE FROM discounts WHERE id = ?`, [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true, deleted: this.changes || 0 });
  });
});

app.post('/api/orders/comp-line', (req, res) => {
  const { tableId = null, line = {}, reason = '', managerPin = '', accessCode } = req.body || {};
  const effective = String(accessCode || '').trim() || '1234';
  const ok = String(managerPin || '') === effective || String(managerPin || '') === '1234';
  if (!ok) return res.status(403).json({ error: 'Invalid manager PIN' });

  writeAudit({
    action: 'comp-item',
    entityType: 'order-line',
    entityId: line?.itemId || line?.id || null,
    tableId,
    details: { reason, line },
    role: 'manager',
    ip: req.ip,
  });
  return res.json({ ok: true });
});

app.put('/api/tables/:id', (req, res) => {
  const { id } = req.params;
  const { status, start_time, elapsed_time, current_bill } = req.body;
  
  db.run(`UPDATE tables SET status = ?, start_time = ?, elapsed_time = ?, current_bill = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?`, [status, start_time, elapsed_time, current_bill, id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Table updated successfully', changes: this.changes });
  });
});

// Menu items routes
app.get('/api/menu', (req, res) => {
  const { category } = req.query;
  let query = 'SELECT * FROM menu_items';
  let params = [];
  
  if (category) {
    query += ' WHERE category = ?';
    params.push(category);
  }
  
  query += ' ORDER BY category, name';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Orders routes
app.get('/api/orders', (req, res) => {
  const { status, table_id } = req.query;
  let query = `SELECT o.*, t.name as table_name 
               FROM orders o 
               JOIN tables t ON o.table_id = t.id`;
  let params = [];
  let conditions = [];
  
  if (status) {
    conditions.push('o.status = ?');
    params.push(status);
  }
  
  if (table_id) {
    conditions.push('o.table_id = ?');
    params.push(table_id);
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  query += ' ORDER BY o.order_time DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Get order items for each order
    const promises = rows.map(order => {
      return new Promise((resolve, reject) => {
        db.all(`SELECT oi.*, mi.name, mi.category 
                FROM order_items oi 
                JOIN menu_items mi ON oi.menu_item_id = mi.id 
                WHERE oi.order_id = ?`, [order.id], (err, items) => {
          if (err) reject(err);
          else {
            order.items = items.map(item => ({
              ...item,
              customizations: item.customizations ? JSON.parse(item.customizations) : []
            }));
            resolve(order);
          }
        });
      });
    });
    
    Promise.all(promises)
      .then(ordersWithItems => res.json(ordersWithItems))
      .catch(err => res.status(500).json({ error: err.message }));
  });
});

app.post('/api/orders', (req, res) => {
  const { table_id, items: rawItems, notes, priority = 'normal' } = req.body || {};
  if (!table_id) return res.status(400).json({ error: 'table_id is required' });
  const items = Array.isArray(rawItems) ? rawItems.map(it => ({
    id: it.id,
    quantity: Math.max(1, parseInt(it.quantity ?? it.qty ?? 1, 10) || 1),
    price: Number.isFinite(+it.price) ? +it.price : 0,
    customizations: Array.isArray(it.customizations) ? it.customizations : [],
    prep_time: Math.max(1, parseInt(it.prep_time ?? 10, 10) || 10),
  })) : [];
  if (items.length === 0) return res.status(400).json({ error: 'items array is required' });
  const orderId = 'ORD' + Date.now();
  const estimatedTime = items.length ? Math.max(...items.map(item => item.prep_time || 10)) : 10;
  let total = items.reduce((sum, item) => sum + ((Number.isFinite(item.price) ? item.price : 0) * item.quantity), 0);
  if (!Number.isFinite(total)) total = 0;
  
  db.run(`INSERT INTO orders (id, table_id, estimated_time, priority, notes, total) 
          VALUES (?, ?, ?, ?, ?, ?)`, [orderId, table_id, estimatedTime, priority, notes, total], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Insert order items
    const itemPromises = items.map(item => {
      return new Promise((resolve, reject) => {
        const customizations = JSON.stringify(item.customizations || []);
        const itemTotal = (Number.isFinite(item.price) ? item.price : 0) * item.quantity;
        
        db.run(`INSERT INTO order_items (order_id, menu_item_id, quantity, customizations, item_total) 
                VALUES (?, ?, ?, ?, ?)`, [orderId, item.id, item.quantity, customizations, itemTotal], function(err) {
          if (err) reject(err);
          else resolve();
        });
      });
    });
    
    Promise.all(itemPromises)
      .then(() => {
        try {
          io.emit('order:created', { order: { id: orderId, table: table_id, kitchenStatus: 'pending', items: items.map(i => ({ id: i.id, qty: i.quantity })) , createdAt: Date.now() } });
        } catch {}
        res.json({ id: orderId, message: 'Order created successfully' });
      })
      .catch(err => res.status(500).json({ error: err.message }));
  });
});

app.put('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  db.run('UPDATE orders SET status = ? WHERE id = ?', [status, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    try { io.emit('order:status_changed', { id, status }); } catch {}
    res.json({ message: 'Order updated successfully', changes: this.changes });
  });
});

// Preferred status endpoint used by frontend
app.post('/api/orders/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ error: 'status is required' });
  db.run('UPDATE orders SET status = ? WHERE id = ?', [status, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    try { io.emit('order:status_changed', { id, status }); } catch {}
    res.json({ ok: true, id, status });
  });
});

// Recall endpoint: mark back to pending
app.post('/api/orders/:id/recall', (req, res) => {
  const { id } = req.params;
  db.run('UPDATE orders SET status = ? WHERE id = ?', ['pending', id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    try { io.emit('order:recalled', { id }); } catch {}
    res.json({ ok: true, id });
  });
});

// Aggregate open items by table (for PaymentPage)
app.get('/api/orders/by-table/:tableId', (req, res) => {
  const { tableId } = req.params;
  // Consider any order not explicitly marked completed as open
  const sql = `
    SELECT 
      oi.menu_item_id AS id,
      COALESCE(mi.name, oi.menu_item_id) AS name,
      COALESCE(mi.category, '') AS category,
      SUM(oi.quantity) AS qty,
      SUM(oi.item_total) AS total
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
    WHERE o.table_id = ? AND (o.status IS NULL OR o.status <> 'completed')
    GROUP BY oi.menu_item_id, mi.name, mi.category
    ORDER BY name ASC
  `;
  db.all(sql, [tableId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const items = rows.map(r => ({ id: r.id, name: r.name, category: r.category, qty: r.qty, total: r.total }));
    const grand = rows.reduce((s, r) => s + (Number(r.total) || 0), 0);
    res.json({ table: tableId, items, total: grand });
  });
});

// Mark all orders for a table as completed
app.post('/api/orders/complete-by-table', (req, res) => {
  const { table } = req.body || {};
  if (!table) return res.status(400).json({ error: 'table is required' });
  db.run(`UPDATE orders SET status = 'completed' WHERE table_id = ? AND (status IS NULL OR status <> 'completed')`, [table], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    try { io.emit('order:completed', { table }); } catch {}
    res.json({ message: 'Orders marked completed', changes: this.changes });
  });
});

// Accept payment (stub for inventory/loyalty hooks)
app.post('/api/orders/pay', (req, res) => {
  // items: [{ id, qty }], table, memberId (optional)
  // This stub acknowledges the request; real implementation can adjust inventory/loyalty.
  res.json({ ok: true });
});

// Bills routes
app.post('/api/bills', (req, res) => {
  const { table_id, subtotal, tax, tip, total, payment_method } = req.body;
  const billId = 'BILL' + Date.now();
  
  db.run(`INSERT INTO bills (id, table_id, subtotal, tax, tip, total, payment_method, payment_status) 
          VALUES (?, ?, ?, ?, ?, ?, ?, 'completed')`, 
          [billId, table_id, subtotal, tax, tip, total, payment_method], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Reset table
    db.run(`UPDATE tables SET status = 'available', start_time = NULL, elapsed_time = 0, current_bill = 0 
            WHERE id = ?`, [table_id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      res.json({ id: billId, message: 'Bill processed successfully' });
    });
  });
});

// KDS - Kitchen Display System
app.get('/api/orders/kds', async (req, res) => {
  try {
    // Get all orders with their items that are not completed or cancelled
    const orders = await new Promise((resolve, reject) => {
      db.all(
        `SELECT 
          o.id, 
          o.table_id,
          t.name as table_name,
          o.status,
          o.order_time as created_at,
          o.notes,
          oi.id as item_id,
          oi.menu_item_id,
          oi.quantity,
          oi.customizations,
          oi.item_total,
          mi.name as item_name,
          mi.category as item_category,
          mi.prep_time
        FROM orders o
        LEFT JOIN tables t ON o.table_id = t.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
        WHERE o.status NOT IN ('completed', 'cancelled')
        ORDER BY o.order_time DESC, oi.id ASC`,
        (err, rows) => {
          if (err) {
            console.error('Database error in KDS query:', err);
            reject(err);
          } else {
            // Group order items by order
            const ordersMap = new Map();
            (rows || []).forEach(row => {
              if (!ordersMap.has(row.id)) {
                ordersMap.set(row.id, {
                  id: row.id,
                  tableId: row.table_id,
                  tableName: row.table_name || `Table ${row.table_id}`,
                  status: row.status || 'pending',
                  orderTime: row.created_at,
                  notes: row.notes || '',
                  items: []
                });
              }
              
              // Add item if it exists (LEFT JOIN might return null)
              if (row.item_id) {
                ordersMap.get(row.id).items.push({
                  id: row.item_id,
                  menuItemId: row.menu_item_id,
                  name: row.item_name,
                  category: row.item_category,
                  quantity: row.quantity,
                  customizations: row.customizations ? JSON.parse(row.customizations) : null,
                  total: row.item_total,
                  prepTime: row.prep_time
                });
              }
            });
            
            resolve(Array.from(ordersMap.values()));
          }
        }
      );
    });

    res.json({ 
      success: true,
      orders: orders || [] 
    });
  } catch (error) {
    console.error('KDS fetch error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch KDS orders',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Reports
function parseWindow(req) {
  const { window = 'today' } = req.query || {};
  let start, end = new Date().toISOString();
  
  if (window === 'today') {
    start = new Date();
    start.setHours(0, 0, 0, 0);
    start = start.toISOString();
  } else if (window === 'week') {
    start = new Date();
    start.setDate(start.getDate() - 7);
    start = start.toISOString();
  } else if (window === 'month') {
    start = new Date();
    start.setMonth(start.getMonth() - 1);
    start = start.toISOString();
  } else if (window === 'all') {
    start = new Date(0).toISOString();
  } else {
    // Custom date range
    start = req.query.start || new Date(0).toISOString();
    end = req.query.end || new Date().toISOString();
  }
  
  return { start, end };
}

function runAll(db, queries) {
  return Promise.all(queries.map(q => new Promise((resolve, reject) => {
    db.all(q.sql, q.params || [], (err, rows) => err ? reject(err) : resolve(rows));
  })));
}

app.get('/api/reports/shift', async (req, res) => {
  try {
    const { start, end } = parseWindow(req);
    const fromIso = new Date(start).toISOString().slice(0,19).replace('T',' ');
    const toIso = new Date(end).toISOString().slice(0,19).replace('T',' ');

    const [ordersRows, billsRows, voidRows, compRows] = await runAll(db, [
      { sql: `SELECT COUNT(*) as cnt, COALESCE(SUM(total),0) as sum FROM orders WHERE order_time BETWEEN ? AND ?`, params: [fromIso, toIso] },
      { sql: `SELECT COUNT(*) as cnt, COALESCE(SUM(total),0) as sum FROM bills WHERE created_at BETWEEN ? AND ?`, params: [fromIso, toIso] },
      { sql: `SELECT COUNT(*) as cnt FROM audit_logs WHERE action = 'void-item' AND ts BETWEEN ? AND ?`, params: [fromIso, toIso] },
      { sql: `SELECT COUNT(*) as cnt FROM audit_logs WHERE action = 'comp-item' AND ts BETWEEN ? AND ?`, params: [fromIso, toIso] },
    ]);

    // Payment method breakdown
    // Payment method breakdown using tender columns for splits
    const payRows = await new Promise((resolve, reject) => {
      const sql = `
        SELECT 'cash' as method,
               SUM(CASE WHEN LOWER(payment_method) = 'cash' THEN total ELSE COALESCE(tender_cash,0) END) as sum,
               SUM(CASE WHEN (LOWER(payment_method) = 'cash' AND total > 0) OR (COALESCE(tender_cash,0) > 0) THEN 1 ELSE 0 END) as cnt
        FROM bills
        WHERE created_at BETWEEN ? AND ?
        UNION ALL
        SELECT 'card' as method,
               SUM(CASE WHEN LOWER(payment_method) = 'card' THEN total ELSE COALESCE(tender_card,0) END) as sum,
               SUM(CASE WHEN (LOWER(payment_method) = 'card' AND total > 0) OR (COALESCE(tender_card,0) > 0) THEN 1 ELSE 0 END) as cnt
        FROM bills
        WHERE created_at BETWEEN ? AND ?`;
      db.all(sql, [fromIso, toIso, fromIso, toIso], (err, rows) => err ? reject(err) : resolve(rows));
    });

    // Station throughput via category → station mapping
    const stationRows = await new Promise((resolve, reject) => {
      const sql = `
        SELECT station,
               COUNT(DISTINCT o.id) as orders,
               COALESCE(SUM(oi.quantity),0) as items_count,
               COALESCE(SUM(oi.item_total),0) as items_total
        FROM (
          SELECT o.id,
                 CASE 
                   WHEN LOWER(mi.category) IN ('food','foods','kitchen','meal','meals','cocktail','cocktails') THEN 'kitchen'
                   WHEN LOWER(mi.category) IN ('drink','drinks','beer','beers','bar','wine','wines') THEN 'bar'
                   ELSE 'other'
                 END as station
          FROM orders o
          JOIN order_items oi ON oi.order_id = o.id
          LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
          WHERE o.order_time BETWEEN ? AND ?
        ) ox
        JOIN orders o ON o.id = ox.id
        JOIN order_items oi ON oi.order_id = o.id
        LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
        WHERE o.order_time BETWEEN ? AND ?
          AND (
            (ox.station = 'kitchen' AND LOWER(mi.category) IN ('food','foods','kitchen','meal','meals','cocktail','cocktails')) OR
            (ox.station = 'bar' AND LOWER(mi.category) IN ('drink','drinks','beer','beers','bar','wine','wines')) OR
            (ox.station = 'other' AND NOT (LOWER(mi.category) IN ('food','foods','kitchen','meal','meals','cocktails','cocktail','drink','drinks','beer','beers','bar','wine','wines')))
          )
        GROUP BY station
        ORDER BY items_total DESC`;
      db.all(sql, [fromIso, toIso, fromIso, toIso], (err, rows) => err ? reject(err) : resolve(rows));
    });

    // Hourly buckets for orders_total and bills_total (MySQL)
    const bucketsRows = await new Promise((resolve, reject) => {
      const sql = `
        WITH ord AS (
          SELECT DATE_FORMAT(order_time, '%Y-%m-%d %H:00:00') as bucket, COALESCE(SUM(total),0) as orders_total
          FROM orders
          WHERE order_time BETWEEN ? AND ?
          GROUP BY bucket
        ), bil AS (
          SELECT DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00') as bucket, COALESCE(SUM(total),0) as bills_total
          FROM bills
          WHERE created_at BETWEEN ? AND ?
          GROUP BY bucket
        )
        SELECT ord.bucket as bucket, ord.orders_total, COALESCE(bil.bills_total,0) as bills_total
        FROM ord
        LEFT JOIN bil ON ord.bucket = bil.bucket
        UNION ALL
        SELECT bil.bucket as bucket, 0 as orders_total, bil.bills_total
        FROM bil
        LEFT JOIN ord ON bil.bucket = ord.bucket
        WHERE ord.bucket IS NULL
        ORDER BY bucket ASC`;
      db.all(sql, [fromIso, toIso, fromIso, toIso], (err, rows) => err ? reject(err) : resolve(rows));
    });

    // Hourly payment by method
    const payHourly = await new Promise((resolve, reject) => {
      const sql = `
        WITH base AS (
          SELECT DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00') as bucket,
                 LOWER(payment_method) as method,
                 total,
                 COALESCE(tender_cash,0) as tender_cash,
                 COALESCE(tender_card,0) as tender_card
          FROM bills
          WHERE created_at BETWEEN ? AND ?
        )
        SELECT bucket, 'cash' as method,
               SUM(CASE WHEN method = 'cash' THEN total ELSE tender_cash END) as sum,
               SUM(CASE WHEN (method = 'cash' AND total > 0) OR (tender_cash > 0) THEN 1 ELSE 0 END) as cnt
        FROM base GROUP BY bucket
        UNION ALL
        SELECT bucket, 'card' as method,
               SUM(CASE WHEN method = 'card' THEN total ELSE tender_card END) as sum,
               SUM(CASE WHEN (method = 'card' AND total > 0) OR (tender_card > 0) THEN 1 ELSE 0 END) as cnt
        FROM base GROUP BY bucket
        ORDER BY bucket ASC`;
      db.all(sql, [fromIso, toIso], (err, rows) => err ? reject(err) : resolve(rows));
    });

    // COGS from inventory transactions (sale movements)
    const cogsRow = await new Promise((resolve, reject) => {
      const sql = `SELECT COALESCE(SUM(total_cost),0) as cogs_total
                   FROM inventory_transactions
                   WHERE transaction_type = 'sale' AND created_at BETWEEN ? AND ?`;
      db.all(sql, [fromIso, toIso], (err, rows) => err ? reject(err) : resolve(rows && rows[0] ? rows[0] : { cogs_total: 0 }));
    });

    // Top items by sales
    const topItems = await new Promise((resolve, reject) => {
      const sql = `
        SELECT mi.name as item, COALESCE(SUM(oi.quantity),0) as qty, COALESCE(SUM(oi.item_total),0) as total
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
        WHERE o.order_time BETWEEN ? AND ?
        GROUP BY mi.name
        ORDER BY total DESC
        LIMIT 10`;
      db.all(sql, [fromIso, toIso], (err, rows) => err ? reject(err) : resolve(rows || []));
    });

    // Top categories by sales
    const topCategories = await new Promise((resolve, reject) => {
      const sql = `
        SELECT COALESCE(LOWER(mi.category),'uncategorized') as category,
               COALESCE(SUM(oi.quantity),0) as qty,
               COALESCE(SUM(oi.item_total),0) as total
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
        WHERE o.order_time BETWEEN ? AND ?
        GROUP BY COALESCE(LOWER(mi.category),'uncategorized')
        ORDER BY total DESC
        LIMIT 10`;
      db.all(sql, [fromIso, toIso], (err, rows) => err ? reject(err) : resolve(rows || []));
    });

    const orders_count = ordersRows?.[0]?.cnt || 0;
    const orders_total = Number(ordersRows?.[0]?.sum || 0);
    const bills_count = billsRows?.[0]?.cnt || 0;
    const bills_total = Number(billsRows?.[0]?.sum || 0);
    const void_count = voidRows?.[0]?.cnt || 0;
    const comp_count = compRows?.[0]?.cnt || 0;

    // Compute anomalies from buckets (simple z-score on bills_total)
    const bks = Array.isArray(bucketsRows) ? bucketsRows.filter(b => typeof b.bills_total === 'number') : [];
    let anomalies = [];
    if (bks.length > 1) {
      const values = bks.map(b => Number(b.bills_total || 0));
      const mean = values.reduce((a,b)=>a+b,0) / values.length;
      const variance = values.reduce((a,b)=>a+Math.pow(b-mean,2),0) / values.length;
      const std = Math.sqrt(variance);
      anomalies = bks
        .map(b => ({ bucket: b.bucket, bills_total: Number(b.bills_total||0), z: std ? (Number(b.bills_total||0)-mean)/std : 0 }))
        .filter(x => x.z >= 2.0) // spikes > 2σ
        .sort((a,b) => b.z - a.z)
        .slice(0, 3);
    }

    const cogs_total = Number(cogsRow?.cogs_total || 0);
    const gross_margin = Number(bills_total - cogs_total);
    const gross_margin_pct = bills_total > 0 ? +(gross_margin / bills_total * 100).toFixed(2) : 0;

    return res.json({
      window: { from: fromIso, to: toIso },
      orders_count, orders_total,
      bills_count, bills_total,
      void_count, comp_count,
      payments_by_method: payRows,
      station_throughput: stationRows,
      buckets: bucketsRows,
      payments_by_method_hourly: payHourly,
      cogs_total,
      gross_margin,
      gross_margin_pct,
      top_items: topItems,
      top_categories: topCategories,
      anomalies,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.get('/api/reports/today', async (req, res) => {
  try {
    const { start, end } = parseWindow({ query: { window: 'today' } });
    const fromIso = new Date(start).toISOString().slice(0,19).replace('T',' ');
    const toIso = new Date(end).toISOString().slice(0,19).replace('T',' ');
    const [ordersRows, billsRows, voidRows, compRows] = await runAll(db, [
      { sql: `SELECT COUNT(*) as cnt, COALESCE(SUM(total),0) as sum FROM orders WHERE order_time BETWEEN ? AND ?`, params: [fromIso, toIso] },
      { sql: `SELECT COUNT(*) as cnt, COALESCE(SUM(total),0) as sum FROM bills WHERE created_at BETWEEN ? AND ?`, params: [fromIso, toIso] },
      { sql: `SELECT COUNT(*) as cnt FROM audit_logs WHERE action = 'void-item' AND ts BETWEEN ? AND ?`, params: [fromIso, toIso] },
      { sql: `SELECT COUNT(*) as cnt FROM audit_logs WHERE action = 'comp-item' AND ts BETWEEN ? AND ?`, params: [fromIso, toIso] },
    ]);

    // Payment method breakdown
    const payRows = await new Promise((resolve, reject) => {
      const sql = `
        SELECT 'cash' as method,
               SUM(CASE WHEN LOWER(payment_method) = 'cash' THEN total ELSE COALESCE(tender_cash,0) END) as sum,
               SUM(CASE WHEN (LOWER(payment_method) = 'cash' AND total > 0) OR (COALESCE(tender_cash,0) > 0) THEN 1 ELSE 0 END) as cnt
        FROM bills
        WHERE created_at BETWEEN ? AND ?
        UNION ALL
        SELECT 'card' as method,
               SUM(CASE WHEN LOWER(payment_method) = 'card' THEN total ELSE COALESCE(tender_card,0) END) as sum,
               SUM(CASE WHEN (LOWER(payment_method) = 'card' AND total > 0) OR (COALESCE(tender_card,0) > 0) THEN 1 ELSE 0 END) as cnt
        FROM bills
        WHERE created_at BETWEEN ? AND ?
        ORDER BY method ASC`;
      db.all(sql, [fromIso, toIso, fromIso, toIso], (err, rows) => err ? reject(err) : resolve(rows));
    });

    // Station throughput via category → station mapping
    const stationRows = await new Promise((resolve, reject) => {
      const sql = `
        SELECT station,
               COUNT(DISTINCT o.id) as orders,
               COALESCE(SUM(oi.quantity),0) as items_count,
               COALESCE(SUM(oi.item_total),0) as items_total
        FROM (
          SELECT o.id,
                 CASE 
                   WHEN LOWER(mi.category) IN ('food','foods','kitchen','meal','meals','cocktail','cocktails') THEN 'kitchen'
                   WHEN LOWER(mi.category) IN ('drink','drinks','beer','beers','bar','wine','wines') THEN 'bar'
                   ELSE 'other'
                 END as station
          FROM orders o
          JOIN order_items oi ON oi.order_id = o.id
          LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
          WHERE o.order_time BETWEEN ? AND ?
        ) ox
        JOIN orders o ON o.id = ox.id
        JOIN order_items oi ON oi.order_id = o.id
        LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
        WHERE o.order_time BETWEEN ? AND ?
          AND (
            (ox.station = 'kitchen' AND LOWER(mi.category) IN ('food','foods','kitchen','meal','meals','cocktail','cocktails')) OR
            (ox.station = 'bar' AND LOWER(mi.category) IN ('drink','drinks','beer','beers','bar','wine','wines')) OR
            (ox.station = 'other' AND NOT (LOWER(mi.category) IN ('food','foods','kitchen','meal','meals','cocktails','cocktail','drink','drinks','beer','beers','bar','wine','wines')))
          )
        GROUP BY station
        ORDER BY items_total DESC`;
      db.all(sql, [fromIso, toIso, fromIso, toIso], (err, rows) => err ? reject(err) : resolve(rows));
    });

    // Hourly buckets for orders_total and bills_total
    const bucketsRows = await new Promise((resolve, reject) => {
      const sql = `
        WITH ord AS (
          SELECT DATE_FORMAT(order_time, '%Y-%m-%d %H:00:00') as bucket, COALESCE(SUM(total),0) as orders_total
          FROM orders
          WHERE order_time BETWEEN ? AND ?
          GROUP BY bucket
        ), bil AS (
          SELECT DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00') as bucket, COALESCE(SUM(total),0) as bills_total
          FROM bills
          WHERE created_at BETWEEN ? AND ?
          GROUP BY bucket
        )
        SELECT ord.bucket as bucket, ord.orders_total, COALESCE(bil.bills_total,0) as bills_total
        FROM ord
        LEFT JOIN bil ON ord.bucket = bil.bucket
        UNION ALL
        SELECT bil.bucket as bucket, 0 as orders_total, bil.bills_total
        FROM bil
        LEFT JOIN ord ON bil.bucket = ord.bucket
        WHERE ord.bucket IS NULL
        ORDER BY bucket ASC`;
      db.all(sql, [fromIso, toIso, fromIso, toIso], (err, rows) => err ? reject(err) : resolve(rows));
    });

    // Hourly payment by method (cash/card)
    const payHourly = await new Promise((resolve, reject) => {
      const sql = `
        WITH base AS (
          SELECT DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00') as bucket,
                 LOWER(payment_method) as method,
                 total,
                 COALESCE(tender_cash,0) as tender_cash,
                 COALESCE(tender_card,0) as tender_card
          FROM bills
          WHERE created_at BETWEEN ? AND ?
        )
        SELECT bucket, 'cash' as method,
               SUM(CASE WHEN method = 'cash' THEN total ELSE tender_cash END) as sum,
               SUM(CASE WHEN (method = 'cash' AND total > 0) OR (tender_cash > 0) THEN 1 ELSE 0 END) as cnt
        FROM base GROUP BY bucket
        UNION ALL
        SELECT bucket, 'card' as method,
               SUM(CASE WHEN method = 'card' THEN total ELSE tender_card END) as sum,
               SUM(CASE WHEN (method = 'card' AND total > 0) OR (tender_card > 0) THEN 1 ELSE 0 END) as cnt
        FROM base GROUP BY bucket
        ORDER BY bucket ASC`;
      db.all(sql, [fromIso, toIso], (err, rows) => err ? reject(err) : resolve(rows));
    });

    // COGS from inventory transactions (sale movements)
    const cogsRow = await new Promise((resolve, reject) => {
      const sql = `SELECT COALESCE(SUM(total_cost),0) as cogs_total
                   FROM inventory_transactions
                   WHERE transaction_type = 'sale' AND created_at BETWEEN ? AND ?`;
      db.all(sql, [fromIso, toIso], (err, rows) => err ? reject(err) : resolve(rows && rows[0] ? rows[0] : { cogs_total: 0 }));
    });

    // Top items by sales
    const topItems = await new Promise((resolve, reject) => {
      const sql = `
        SELECT mi.name as item, COALESCE(SUM(oi.quantity),0) as qty, COALESCE(SUM(oi.item_total),0) as total
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
        WHERE o.order_time BETWEEN ? AND ?
        GROUP BY mi.name
        ORDER BY total DESC
        LIMIT 10`;
      db.all(sql, [fromIso, toIso], (err, rows) => err ? reject(err) : resolve(rows || []));
    });

    // Top categories by sales
    const topCategories = await new Promise((resolve, reject) => {
      const sql = `
        SELECT COALESCE(LOWER(mi.category),'uncategorized') as category,
               COALESCE(SUM(oi.quantity),0) as qty,
               COALESCE(SUM(oi.item_total),0) as total
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
        WHERE o.order_time BETWEEN ? AND ?
        GROUP BY COALESCE(LOWER(mi.category),'uncategorized')
        ORDER BY total DESC
        LIMIT 10`;
      db.all(sql, [fromIso, toIso], (err, rows) => err ? reject(err) : resolve(rows || []));
    });

    // Compute anomalies from buckets (simple z-score on bills_total)
    const bks = Array.isArray(bucketsRows) ? bucketsRows.filter(b => typeof b.bills_total === 'number') : [];
    let anomalies = [];
    if (bks.length > 1) {
      const values = bks.map(b => Number(b.bills_total || 0));
      const mean = values.reduce((a,b)=>a+b,0) / values.length;
      const variance = values.reduce((a,b)=>a+Math.pow(b-mean,2),0) / values.length;
      const std = Math.sqrt(variance);
      anomalies = bks
        .map(b => ({ bucket: b.bucket, bills_total: Number(b.bills_total||0), z: std ? (Number(b.bills_total||0)-mean)/std : 0 }))
        .filter(x => x.z >= 2.0)
        .sort((a,b) => b.z - a.z)
        .slice(0, 3);
    }

    const orders_count = ordersRows?.[0]?.cnt || 0;
    const orders_total = Number(ordersRows?.[0]?.sum || 0);
    const bills_count = billsRows?.[0]?.cnt || 0;
    const bills_total = Number(billsRows?.[0]?.sum || 0);
    const void_count = voidRows?.[0]?.cnt || 0;
    const comp_count = compRows?.[0]?.cnt || 0;

    const cogs_total = Number(cogsRow?.cogs_total || 0);
    const gross_margin = Number(bills_total - cogs_total);
    const gross_margin_pct = bills_total > 0 ? +(gross_margin / bills_total * 100).toFixed(2) : 0;

    return res.json({
      window: { from: fromIso, to: toIso },
      orders_count, orders_total,
      bills_count, bills_total,
      void_count, comp_count,
      payments_by_method: payRows,
      station_throughput: stationRows,
      buckets: bucketsRows,
      payments_by_method_hourly: payHourly,
      cogs_total,
      gross_margin,
      gross_margin_pct,
      top_items: topItems,
      top_categories: topCategories,
      anomalies
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// Bills: list pending bills aggregated by table from open orders
app.get('/api/bills/pending', async (req, res) => {
  try {
    // Source from tables, include any table in 'occupied' or 'settling'.
    // Compute itemSubtotal only from open orders (pending/in-progress).
    const sql = `
      SELECT 
        t.id AS table_id,
        COALESCE(
          SUM(CASE WHEN (o.status IS NULL OR LOWER(o.status) NOT IN ('completed','cancelled')) THEN oi.item_total ELSE NULL END),
          SUM(CASE WHEN (o.status IS NULL OR LOWER(o.status) NOT IN ('completed','cancelled')) THEN o.total ELSE NULL END),
          0
        ) AS itemSubtotal,
        MIN(CASE WHEN (o.status IS NULL OR LOWER(o.status) NOT IN ('completed','cancelled')) THEN o.order_time ELSE NULL END) AS created_at,
        t.start_time AS t_start_time,
        t.status AS t_status,
        COALESCE(t.paused,0) AS t_paused,
        COALESCE(t.hourly_rate,0) AS t_rate,
        COALESCE(t.current_bill,0) AS t_services,
        t.limit_end AS t_limit_end
      FROM tables t
      LEFT JOIN orders o ON o.table_id = t.id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      GROUP BY t.id
      HAVING LOWER(t.status) = 'settling' OR COALESCE(
        SUM(CASE WHEN (o.status IS NULL OR LOWER(o.status) NOT IN ('completed','cancelled')) THEN oi.item_total ELSE NULL END),
        SUM(CASE WHEN (o.status IS NULL OR LOWER(o.status) NOT IN ('completed','cancelled')) THEN o.total ELSE NULL END),
        0
      ) > 0
      ORDER BY (created_at IS NULL) ASC, created_at ASC`;
    db.all(sql, [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const nowMs = Date.now();
      const shaped = rows.map(r => {
        // Time charge calculation (for occupied/settling & running timer)
        let timeCharge = 0;
        try {
          const status = String(r.t_status || '').toLowerCase();
          const isActive = status === 'occupied' || status === 'settling';
          const paused = Number(r.t_paused || 0) === 1;
          const rate = Number(r.t_rate || 0);
          const startMs = r.t_start_time ? Date.parse(r.t_start_time) : NaN;
          const limitEndMs = r.t_limit_end ? Date.parse(r.t_limit_end) : null;
          if (isActive && !paused && rate > 0 && !isNaN(startMs)) {
            const end = limitEndMs ? Math.min(nowMs, limitEndMs) : nowMs;
            const elapsedMs = Math.max(0, end - startMs);
            const hours = elapsedMs / (1000 * 60 * 60);
            timeCharge = +(rate * hours).toFixed(2);
          }
        } catch {}
        const servicesCharge = Number(r.t_services || 0);
        return {
          table_id: r.table_id,
          itemSubtotal: Number(r.itemSubtotal || 0),
          timeCharge,
          servicesCharge,
          createdAt: r.created_at,
          limitEnd: r.t_limit_end || null,
        };
      });
      res.json({ bills: shaped });
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Bills: pay and close by table (creates bill record, completes orders, frees table)
app.post('/api/bills/pay-by-table', async (req, res) => {
  try {
    const { table_id, payment_method = 'cash', tip = 0, discount_total = 0, tender_cash = 0, tender_card = 0 } = req.body || {};
    if (!table_id) return res.status(400).json({ error: 'table_id is required' });
    const getAgg = () => new Promise((resolve, reject) => {
      const sql = `
        SELECT COALESCE(SUM(oi.item_total),0) AS subtotal
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        WHERE o.table_id = ? AND (o.status IS NULL OR LOWER(o.status) NOT IN ('completed','cancelled'))`;
      db.all(sql, [table_id], (err, rows) => err ? reject(err) : resolve(rows?.[0]?.subtotal || 0));
    });
    const subtotalRaw = await getAgg();
    const subtotal = Number(subtotalRaw || 0);
    const disc = Math.max(0, Number(discount_total || 0));
    const taxedBase = Math.max(0, subtotal - disc);
    const tax = +(taxedBase * 0.08).toFixed(2);
    const tipNum = +Number(tip || 0).toFixed(2);
    const total = +(taxedBase + tax + tipNum).toFixed(2);

    // Create bill id
    const billId = `bill_${Date.now()}_${Math.floor(Math.random()*1e6)}`;
    const cashAmt = Number(tender_cash || 0);
    const cardAmt = Number(tender_card || 0);
    const pm = String(payment_method || '').toLowerCase();
    const finalCash = pm === 'cash' ? total : (pm === 'split' ? cashAmt : 0);
    const finalCard = pm === 'card' ? total : (pm === 'split' ? cardAmt : 0);
    await new Promise((resolve, reject) => {
      const sql = `INSERT INTO bills (id, table_id, subtotal, tax, tip, total, payment_method, payment_status, tender_cash, tender_card)
                   VALUES (?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?)`;
      db.run(sql, [billId, table_id, taxedBase, tax, tipNum, total, pm, finalCash, finalCard], (err) => err ? reject(err) : resolve());
    });

    // Decrement inventory for sold items mapped from menu items before closing orders
    try {
      await applyInventoryForTable(table_id, 'system');
    } catch (invErr) {
      console.warn('Inventory decrement failed:', invErr.message);
      // Continue bill flow even if inventory fails, but log it
    }

    // Mark orders completed
    await new Promise((resolve, reject) => {
      db.run(`UPDATE orders SET status = 'completed' WHERE table_id = ? AND LOWER(status) IN ('pending','in-progress')`, [table_id], (err) => err ? reject(err) : resolve());
    });

    // Free the table if exists
    await new Promise((resolve) => {
      db.run(`UPDATE tables SET status = 'available', current_bill = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [table_id], () => resolve());
    });

    // Audit log
    await new Promise((resolve) => {
      db.run(`INSERT INTO audit_logs (action, entity_type, entity_id, table_id, details) VALUES ('bill-paid','bill', ?, ?, ?)`,
        [billId, table_id, JSON.stringify({ payment_method: pm, tip: tipNum, discount_total: disc, total, tender_cash: finalCash, tender_card: finalCard })], () => resolve());
    });

    res.json({ ok: true, bill_id: billId, table_id, subtotal: taxedBase, tax, tip: tipNum, total, tender_cash: finalCash, tender_card: finalCard, payment_method: pm });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Initialize Socket.io service
const socketService = require('./services/socketService');
socketService.initialize(server);

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on ${isHttps ? 'HTTPS' : 'HTTP'}://localhost:${PORT}`);
  if (isHttps) {
    console.log('Note: Using self-signed certificate. You may need to accept the security exception in your browser.');
  }
});

module.exports = app;
