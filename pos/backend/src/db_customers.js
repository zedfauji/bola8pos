/**
 * Customer Management Database Schema
 * Phase 8 Track A: Advanced POS Features
 */

const mysql = require('mysql2/promise');

/**
 * Initialize customer management tables
 */
async function initCustomerTables(db) {
  console.log('Initializing customer management tables...');

  // Customers table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS customers (
      id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
      customer_number VARCHAR(20) UNIQUE NOT NULL,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE,
      phone VARCHAR(20),
      date_of_birth DATE,
      membership_tier ENUM('bronze', 'silver', 'gold', 'platinum') DEFAULT 'bronze',
      loyalty_points INT DEFAULT 0,
      total_visits INT DEFAULT 0,
      total_spent DECIMAL(10,2) DEFAULT 0.00,
      notes TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_customer_number (customer_number),
      INDEX idx_email (email),
      INDEX idx_phone (phone),
      INDEX idx_membership_tier (membership_tier)
    )
  `);

  // Customer visits tracking
  await db.execute(`
    CREATE TABLE IF NOT EXISTS customer_visits (
      id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
      customer_id VARCHAR(36) NOT NULL,
      visit_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      table_id VARCHAR(50),
      duration_minutes INT,
      amount_spent DECIMAL(10,2) DEFAULT 0.00,
      points_earned INT DEFAULT 0,
      notes TEXT,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      INDEX idx_customer_visits (customer_id, visit_date),
      INDEX idx_visit_date (visit_date)
    )
  `);

  // Loyalty transactions
  await db.execute(`
    CREATE TABLE IF NOT EXISTS loyalty_transactions (
      id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
      customer_id VARCHAR(36) NOT NULL,
      transaction_type ENUM('earned', 'redeemed', 'expired', 'adjusted') NOT NULL,
      points INT NOT NULL,
      description TEXT,
      reference_id VARCHAR(36), -- bill_id, order_id, etc.
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      INDEX idx_loyalty_customer (customer_id, created_at),
      INDEX idx_loyalty_type (transaction_type)
    )
  `);

  // Customer preferences
  await db.execute(`
    CREATE TABLE IF NOT EXISTS customer_preferences (
      id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
      customer_id VARCHAR(36) NOT NULL,
      preference_key VARCHAR(100) NOT NULL,
      preference_value TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      UNIQUE KEY unique_customer_preference (customer_id, preference_key),
      INDEX idx_customer_prefs (customer_id)
    )
  `);

  console.log('Customer management tables initialized successfully');
}

/**
 * Seed initial customer data
 */
async function seedCustomers(db) {
  console.log('Seeding initial customer data...');

  // Check if customers already exist
  const [existing] = await db.execute('SELECT COUNT(*) as count FROM customers');
  if (existing[0].count > 0) {
    console.log('Customers already exist, skipping seed');
    return;
  }

  // Seed sample customers
  const customers = [
    {
      customer_number: 'CUST001',
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@email.com',
      phone: '+1-555-0101',
      membership_tier: 'gold',
      loyalty_points: 250,
      total_visits: 15,
      total_spent: 450.75
    },
    {
      customer_number: 'CUST002',
      first_name: 'Jane',
      last_name: 'Smith',
      email: 'jane.smith@email.com',
      phone: '+1-555-0102',
      membership_tier: 'silver',
      loyalty_points: 120,
      total_visits: 8,
      total_spent: 280.50
    },
    {
      customer_number: 'CUST003',
      first_name: 'Mike',
      last_name: 'Johnson',
      email: 'mike.j@email.com',
      phone: '+1-555-0103',
      membership_tier: 'bronze',
      loyalty_points: 45,
      total_visits: 3,
      total_spent: 125.25
    }
  ];

  for (const customer of customers) {
    await db.execute(`
      INSERT INTO customers (customer_number, first_name, last_name, email, phone, 
                           membership_tier, loyalty_points, total_visits, total_spent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      customer.customer_number, customer.first_name, customer.last_name,
      customer.email, customer.phone, customer.membership_tier,
      customer.loyalty_points, customer.total_visits, customer.total_spent
    ]);
  }

  console.log('Customer seed data inserted successfully');
}

module.exports = {
  initCustomerTables,
  seedCustomers
};
