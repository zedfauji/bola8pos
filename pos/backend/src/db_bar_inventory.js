const { pool } = require('./db');

/**
 * Initializes the bar inventory database schema
 * Should be called after the main database initialization
 */
async function initBarInventorySchema() {
  // Product categories (beer, wine, spirits, food, etc.)
  await pool.query(`CREATE TABLE IF NOT EXISTS product_categories (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_id VARCHAR(64) NULL,
    sort_order INT DEFAULT 0,
    active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES product_categories(id) ON DELETE SET NULL
  )`);


  // Units of measurement (bottle, can, liter, kg, etc.)
  await pool.query(`CREATE TABLE IF NOT EXISTS units (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(64) NOT NULL,
    symbol VARCHAR(16) NOT NULL,
    type ENUM('volume', 'weight', 'unit') NOT NULL,
    is_decimal TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Products (inventory items)
  await pool.query(`CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(64) PRIMARY KEY,
    sku VARCHAR(64) UNIQUE,
    barcode VARCHAR(128) UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id VARCHAR(64) NOT NULL,
    unit_id VARCHAR(32) NOT NULL,
    cost_price DECIMAL(10, 4) NOT NULL DEFAULT 0,
    selling_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 0,
    min_stock_level DECIMAL(10, 3) DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    is_ingredient TINYINT(1) DEFAULT 0,
    is_composite TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE RESTRICT,
    FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE RESTRICT
  )`);

  // Product variants (different sizes, colors, etc.)
  await pool.query(`CREATE TABLE IF NOT EXISTS product_variants (
    id VARCHAR(64) PRIMARY KEY,
    product_id VARCHAR(64) NOT NULL,
    sku VARCHAR(64) UNIQUE,
    barcode VARCHAR(128) UNIQUE,
    name VARCHAR(255) NOT NULL,
    unit_id VARCHAR(32) NOT NULL,
    unit_quantity DECIMAL(10, 3) NOT NULL DEFAULT 1,
    cost_price DECIMAL(10, 4) NOT NULL DEFAULT 0,
    selling_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    is_default TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE RESTRICT
  )`);

  // Map POS menu items to inventory products (optional per-item mapping)
  await pool.query(`CREATE TABLE IF NOT EXISTS menu_item_product_map (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    menu_item_id VARCHAR(64) NOT NULL,
    product_id VARCHAR(64) NOT NULL,
    variant_id VARCHAR(64) NULL,
    qty_per_item DECIMAL(10,3) NOT NULL DEFAULT 1,
    unit_id VARCHAR(32) NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL,
    FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL,
    INDEX idx_menu_item (menu_item_id)
  )`);

  // Product prices by location (for different bars/outlets)
  await pool.query(`CREATE TABLE IF NOT EXISTS product_prices (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    product_id VARCHAR(64) NOT NULL,
    variant_id VARCHAR(64),
    location_id VARCHAR(64) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    valid_from DATETIME DEFAULT CURRENT_TIMESTAMP,
    valid_to DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
    INDEX idx_product_variant_location (product_id, variant_id, location_id)
  )`);

  // Inventory locations (bar, kitchen, storage, etc.)
  await pool.query(`CREATE TABLE IF NOT EXISTS locations (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type ENUM('bar', 'kitchen', 'storage', 'other') NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);

  // Inventory counts by location
  await pool.query(`CREATE TABLE IF NOT EXISTS inventory (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    product_id VARCHAR(64) NOT NULL,
    variant_id VARCHAR(64),
    location_id VARCHAR(64) NOT NULL,
    quantity DECIMAL(10, 3) NOT NULL DEFAULT 0,
    last_counted_at DATETIME,
    last_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE,
    INDEX idx_inventory_pvl (product_id, variant_id, location_id)
  )`);

  // Inventory transactions (movements)
  await pool.query(`CREATE TABLE IF NOT EXISTS inventory_transactions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    transaction_type ENUM('purchase', 'sale', 'adjustment', 'transfer_in', 'transfer_out', 'waste', 'production') NOT NULL,
    reference_id VARCHAR(64),
    reference_type VARCHAR(64),
    product_id VARCHAR(64) NOT NULL,
    variant_id VARCHAR(64),
    from_location_id VARCHAR(64),
    to_location_id VARCHAR(64),
    quantity DECIMAL(10, 3) NOT NULL,
    unit_cost DECIMAL(10, 4) NOT NULL DEFAULT 0,
    total_cost DECIMAL(10, 4) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
    notes TEXT,
    created_by VARCHAR(64),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE RESTRICT,
    FOREIGN KEY (from_location_id) REFERENCES locations(id) ON DELETE SET NULL,
    FOREIGN KEY (to_location_id) REFERENCES locations(id) ON DELETE SET NULL
  )`);

  // Recipe/Bill of Materials (for composite items)
  await pool.query(`CREATE TABLE IF NOT EXISTS recipes (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    product_id VARCHAR(64) NOT NULL,
    variant_id VARCHAR(64),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    yield_quantity DECIMAL(10, 3) NOT NULL DEFAULT 1,
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE
  )`);

  // Recipe ingredients
  await pool.query(`CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    recipe_id BIGINT NOT NULL,
    ingredient_product_id VARCHAR(64) NOT NULL,
    ingredient_variant_id VARCHAR(64),
    quantity DECIMAL(10, 3) NOT NULL,
    unit_id VARCHAR(32) NOT NULL,
    notes TEXT,
    sort_order INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
    FOREIGN KEY (ingredient_product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (ingredient_variant_id) REFERENCES product_variants(id) ON DELETE SET NULL,
    FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE RESTRICT
  )`);

  // Supplier information
  await pool.query(`CREATE TABLE IF NOT EXISTS suppliers (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    tax_id VARCHAR(64),
    payment_terms VARCHAR(255),
    notes TEXT,
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);

  // Purchase orders
  await pool.query(`CREATE TABLE IF NOT EXISTS purchase_orders (
    id VARCHAR(64) PRIMARY KEY,
    po_number VARCHAR(64) NOT NULL UNIQUE,
    supplier_id VARCHAR(64) NOT NULL,
    order_date DATETIME NOT NULL,
    expected_delivery_date DATETIME,
    status ENUM('draft', 'pending', 'partially_received', 'completed', 'cancelled') NOT NULL DEFAULT 'draft',
    notes TEXT,
    created_by VARCHAR(64) NOT NULL,
    approved_by VARCHAR(64),
    approved_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT
  )`);

  // Purchase order history (status changes, notes)
  await pool.query(`CREATE TABLE IF NOT EXISTS purchase_order_history (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    po_id VARCHAR(64) NOT NULL,
    status ENUM('draft', 'pending', 'partially_received', 'completed', 'cancelled') NOT NULL,
    notes TEXT,
    created_by VARCHAR(64),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
  )`);

  // Purchase order items
  await pool.query(`CREATE TABLE IF NOT EXISTS purchase_order_items (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    po_id VARCHAR(64) NOT NULL,
    product_id VARCHAR(64) NOT NULL,
    variant_id VARCHAR(64),
    quantity_ordered DECIMAL(10, 3) NOT NULL,
    quantity_received DECIMAL(10, 3) DEFAULT 0,
    unit_cost DECIMAL(10, 4) NOT NULL,
    tax_rate DECIMAL(5, 2) DEFAULT 0,
    expected_delivery_date DATE,
    received_quantity DECIMAL(10, 3) DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL
  )`);

  // Seed initial data
  await seedInitialData();
}

async function seedInitialData() {
  // Seed units
  const units = [
    // Volume units
    ['ml', 'Milliliter', 'ml', 'volume', 1],
    ['l', 'Liter', 'L', 'volume', 1],
    ['cl', 'Centiliter', 'cL', 'volume', 1],
    ['floz', 'Fluid Ounce', 'fl oz', 'volume', 1],
    ['pt', 'Pint', 'pt', 'volume', 1],
    ['gal', 'Gallon', 'gal', 'volume', 1],
    
    // Weight units
    ['g', 'Gram', 'g', 'weight', 1],
    ['kg', 'Kilogram', 'kg', 'weight', 1],
    ['oz', 'Ounce', 'oz', 'weight', 1],
    ['lb', 'Pound', 'lb', 'weight', 1],
    
    // Count units
    ['ea', 'Each', 'ea', 'unit', 0],
    ['pkg', 'Package', 'pkg', 'unit', 0],
    ['cs', 'Case', 'cs', 'unit', 0],
    ['btl', 'Bottle', 'btl', 'unit', 0],
    ['can', 'Can', 'can', 'unit', 0]
  ];

  for (const [id, name, symbol, type, isDecimal] of units) {
    await pool.query(
      `INSERT IGNORE INTO units (id, name, symbol, type, is_decimal) VALUES (?,?,?,?,?)`,
      [id, name, symbol, type, isDecimal]
    );
  }

  // Seed product categories
  const categories = [
    ['beer', 'Beer', 'Beer and cider', null],
    ['wine', 'Wine', 'Wine and sparkling', null],
    ['spirits', 'Spirits', 'Hard alcohol', null],
    ['soft_drinks', 'Soft Drinks', 'Non-alcoholic beverages', null],
    ['snacks', 'Snacks', 'Bar snacks', null],
    
    // Subcategories
    ['bottled_beer', 'Bottled Beer', 'Bottled beer', 'beer'],
    ['draft_beer', 'Draft Beer', 'Draft beer', 'beer'],
    ['red_wine', 'Red Wine', 'Red wine', 'wine'],
    ['white_wine', 'White Wine', 'White wine', 'wine'],
    ['whiskey', 'Whiskey', 'Whiskey and bourbon', 'spirits'],
    ['vodka', 'Vodka', 'Vodka', 'spirits'],
    ['rum', 'Rum', 'Rum', 'spirits'],
    ['tequila', 'Tequila', 'Tequila and mezcal', 'spirits'],
    ['gin', 'Gin', 'Gin', 'spirits'],
    ['soda', 'Soda', 'Carbonated drinks', 'soft_drinks'],
    ['juice', 'Juice', 'Fruit juices', 'soft_drinks'],
    ['water', 'Water', 'Bottled water', 'soft_drinks']
  ];

  for (const [id, name, description, parentId] of categories) {
    await pool.query(
      `INSERT IGNORE INTO product_categories (id, name, description, parent_id) VALUES (?,?,?,?)`,
      [id, name, description, parentId]
    );
  }

  // Seed locations
  const locations = [
    ['main_bar', 'Main Bar', 'bar', 1],
    ['storage', 'Storage Room', 'storage', 1],
    ['kitchen', 'Kitchen', 'kitchen', 1],
    ['bar2', 'Poolside Bar', 'bar', 1]
  ];

  for (const [id, name, type, isActive] of locations) {
    await pool.query(
      `INSERT IGNORE INTO locations (id, name, type, is_active) VALUES (?,?,?,?)`,
      [id, name, type, isActive]
    );
  }

  console.log('Bar inventory database initialized');
}

module.exports = { initBarInventorySchema };
