/**
 * Hardware Integration Database Schema
 * Phase 8 Track B: Hardware Integration
 */

const mysql = require('mysql2/promise');

/**
 * Initialize hardware integration tables
 */
async function initHardwareTables(db) {
  console.log('Initializing hardware integration tables...');

  // Hardware devices registry
  await db.execute(`
    CREATE TABLE IF NOT EXISTS hardware_devices (
      id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
      device_type ENUM('printer', 'payment_terminal', 'kds_display', 'rfid_reader', 'scanner') NOT NULL,
      device_name VARCHAR(100) NOT NULL,
      device_model VARCHAR(100),
      connection_type ENUM('usb', 'network', 'bluetooth', 'serial') NOT NULL,
      connection_string TEXT NOT NULL, -- IP:port, COM port, USB path, etc.
      device_config JSON, -- Device-specific configuration
      is_enabled BOOLEAN DEFAULT true,
      is_online BOOLEAN DEFAULT false,
      last_ping TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_device_type (device_type),
      INDEX idx_device_enabled (is_enabled, is_online)
    )
  `);

  // Print jobs queue
  await db.execute(`
    CREATE TABLE IF NOT EXISTS print_jobs (
      id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
      printer_id VARCHAR(36) NOT NULL,
      job_type ENUM('receipt', 'kitchen_ticket', 'bar_ticket', 'report', 'label') NOT NULL,
      priority INT DEFAULT 5, -- 1=highest, 10=lowest
      content TEXT NOT NULL, -- Raw print content (ESC/POS, etc.)
      metadata JSON, -- Additional job info (copies, width, etc.)
      status ENUM('pending', 'printing', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
      attempts INT DEFAULT 0,
      max_attempts INT DEFAULT 3,
      error_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      started_at TIMESTAMP NULL,
      completed_at TIMESTAMP NULL,
      FOREIGN KEY (printer_id) REFERENCES hardware_devices(id) ON DELETE CASCADE,
      INDEX idx_print_queue (printer_id, status, priority, created_at),
      INDEX idx_print_status (status, created_at)
    )
  `);

  // Payment terminal transactions
  await db.execute(`
    CREATE TABLE IF NOT EXISTS payment_transactions (
      id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
      terminal_id VARCHAR(36) NOT NULL,
      bill_id VARCHAR(36),
      transaction_type ENUM('sale', 'refund', 'void', 'preauth', 'completion') NOT NULL,
      payment_method ENUM('card', 'contactless', 'mobile_pay', 'chip', 'swipe') NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      currency_code VARCHAR(3) DEFAULT 'USD',
      card_type VARCHAR(20), -- Visa, MC, Amex, etc.
      last_four VARCHAR(4), -- Last 4 digits
      auth_code VARCHAR(20),
      reference_number VARCHAR(50),
      batch_number VARCHAR(20),
      terminal_response JSON, -- Full terminal response
      status ENUM('pending', 'approved', 'declined', 'error', 'cancelled') NOT NULL,
      error_code VARCHAR(10),
      error_message TEXT,
      processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (terminal_id) REFERENCES hardware_devices(id) ON DELETE CASCADE,
      INDEX idx_payment_terminal (terminal_id, processed_at),
      INDEX idx_payment_bill (bill_id),
      INDEX idx_payment_status (status, processed_at)
    )
  `);

  // RFID/NFC authentication
  await db.execute(`
    CREATE TABLE IF NOT EXISTS rfid_cards (
      id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
      card_uid VARCHAR(50) UNIQUE NOT NULL, -- Unique card identifier
      card_type ENUM('employee', 'customer', 'manager', 'admin') NOT NULL,
      linked_id VARCHAR(36), -- employee_id, customer_id, etc.
      linked_table VARCHAR(50), -- employees, customers, etc.
      is_active BOOLEAN DEFAULT true,
      access_level INT DEFAULT 1, -- 1=basic, 5=admin
      valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      valid_until TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_card_uid (card_uid),
      INDEX idx_card_linked (linked_table, linked_id),
      INDEX idx_card_active (is_active, card_type)
    )
  `);

  // RFID access log
  await db.execute(`
    CREATE TABLE IF NOT EXISTS rfid_access_log (
      id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
      card_id VARCHAR(36),
      card_uid VARCHAR(50) NOT NULL,
      reader_id VARCHAR(36),
      access_type ENUM('login', 'logout', 'action', 'denied') NOT NULL,
      action_description TEXT,
      ip_address VARCHAR(45),
      user_agent TEXT,
      success BOOLEAN NOT NULL,
      error_message TEXT,
      accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (card_id) REFERENCES rfid_cards(id) ON DELETE SET NULL,
      FOREIGN KEY (reader_id) REFERENCES hardware_devices(id) ON DELETE SET NULL,
      INDEX idx_access_card (card_id, accessed_at),
      INDEX idx_access_reader (reader_id, accessed_at),
      INDEX idx_access_time (accessed_at)
    )
  `);

  // KDS display assignments
  await db.execute(`
    CREATE TABLE IF NOT EXISTS kds_assignments (
      id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
      display_id VARCHAR(36) NOT NULL,
      station_type ENUM('kitchen', 'bar', 'expo', 'prep') NOT NULL,
      menu_categories JSON, -- Array of categories to show
      display_config JSON, -- Screen layout, colors, etc.
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (display_id) REFERENCES hardware_devices(id) ON DELETE CASCADE,
      INDEX idx_kds_station (station_type, is_active),
      INDEX idx_kds_display (display_id)
    )
  `);

  console.log('Hardware integration tables initialized successfully');
}

/**
 * Seed initial hardware devices
 */
async function seedHardware(db) {
  console.log('Seeding initial hardware devices...');

  // Check if devices already exist
  const [existing] = await db.execute('SELECT COUNT(*) as count FROM hardware_devices');
  if (existing[0].count > 0) {
    console.log('Hardware devices already exist, skipping seed');
    return;
  }

  // Seed sample hardware devices
  const devices = [
    {
      device_type: 'printer',
      device_name: 'Kitchen Receipt Printer',
      device_model: 'Epson TM-T88VI',
      connection_type: 'network',
      connection_string: '192.168.1.100:9100',
      device_config: JSON.stringify({
        width: 80,
        copies: 1,
        cut_type: 'partial',
        encoding: 'utf8'
      })
    },
    {
      device_type: 'printer',
      device_name: 'Bar Receipt Printer',
      device_model: 'Star TSP143III',
      connection_type: 'usb',
      connection_string: '/dev/usb/lp0',
      device_config: JSON.stringify({
        width: 58,
        copies: 1,
        cut_type: 'full',
        encoding: 'utf8'
      })
    },
    {
      device_type: 'payment_terminal',
      device_name: 'Main Payment Terminal',
      device_model: 'Ingenico iCT250',
      connection_type: 'network',
      connection_string: '192.168.1.200:8080',
      device_config: JSON.stringify({
        merchant_id: 'DEMO_MERCHANT',
        terminal_id: 'TERM001',
        timeout: 30,
        currency: 'USD'
      })
    },
    {
      device_type: 'kds_display',
      device_name: 'Kitchen Display 1',
      device_model: 'Generic LCD 24"',
      connection_type: 'network',
      connection_string: '192.168.1.150:3000',
      device_config: JSON.stringify({
        resolution: '1920x1080',
        orientation: 'landscape',
        brightness: 80
      })
    },
    {
      device_type: 'rfid_reader',
      device_name: 'Staff Access Reader',
      device_model: 'ACR122U NFC Reader',
      connection_type: 'usb',
      connection_string: 'USB\\VID_072F&PID_2200',
      device_config: JSON.stringify({
        read_interval: 500,
        auto_poll: true,
        supported_types: ['MIFARE', 'NTAG']
      })
    }
  ];

  for (const device of devices) {
    await db.execute(`
      INSERT INTO hardware_devices (device_type, device_name, device_model, 
                                   connection_type, connection_string, device_config)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      device.device_type, device.device_name, device.device_model,
      device.connection_type, device.connection_string, device.device_config
    ]);
  }

  console.log('Hardware seed data inserted successfully');
}

module.exports = {
  initHardwareTables,
  seedHardware
};
