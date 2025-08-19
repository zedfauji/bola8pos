/**
 * Reservations and Booking Database Schema
 * Phase 8 Track A: Advanced POS Features
 */

const mysql = require('mysql2/promise');

/**
 * Initialize reservations tables
 */
async function initReservationTables(db) {
  console.log('Initializing reservations tables...');

  // Table reservations
  await db.execute(`
    CREATE TABLE IF NOT EXISTS reservations (
      id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
      reservation_number VARCHAR(20) UNIQUE NOT NULL,
      customer_id VARCHAR(36),
      customer_name VARCHAR(200) NOT NULL, -- For walk-ins without customer record
      customer_phone VARCHAR(20),
      customer_email VARCHAR(255),
      table_id VARCHAR(50) NOT NULL,
      party_size INT NOT NULL DEFAULT 1,
      reservation_date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      duration_minutes INT NOT NULL,
      status ENUM('confirmed', 'checked_in', 'seated', 'completed', 'cancelled', 'no_show') DEFAULT 'confirmed',
      special_requests TEXT,
      notes TEXT,
      deposit_amount DECIMAL(10,2) DEFAULT 0.00,
      deposit_paid BOOLEAN DEFAULT false,
      created_by VARCHAR(100), -- Staff member who created
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
      INDEX idx_reservation_date (reservation_date, start_time),
      INDEX idx_reservation_table (table_id, reservation_date),
      INDEX idx_reservation_customer (customer_id),
      INDEX idx_reservation_status (status, reservation_date)
    )
  `);

  // Reservation conflicts tracking
  await db.execute(`
    CREATE TABLE IF NOT EXISTS reservation_conflicts (
      id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
      reservation_id VARCHAR(36) NOT NULL,
      conflict_type ENUM('overlap', 'double_booking', 'maintenance', 'blocked') NOT NULL,
      conflict_description TEXT,
      resolved BOOLEAN DEFAULT false,
      resolved_by VARCHAR(100),
      resolved_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
      INDEX idx_conflict_reservation (reservation_id),
      INDEX idx_conflict_resolved (resolved, created_at)
    )
  `);

  // Table availability blocks (maintenance, events, etc.)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS table_blocks (
      id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
      table_id VARCHAR(50) NOT NULL,
      block_type ENUM('maintenance', 'private_event', 'staff_break', 'cleaning', 'repair') NOT NULL,
      start_datetime TIMESTAMP NOT NULL,
      end_datetime TIMESTAMP NOT NULL,
      reason TEXT,
      created_by VARCHAR(100),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_table_blocks (table_id, start_datetime, end_datetime),
      INDEX idx_block_active (is_active, start_datetime)
    )
  `);

  // Reservation history/changes
  await db.execute(`
    CREATE TABLE IF NOT EXISTS reservation_history (
      id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
      reservation_id VARCHAR(36) NOT NULL,
      change_type ENUM('created', 'modified', 'cancelled', 'checked_in', 'seated', 'completed') NOT NULL,
      old_values JSON,
      new_values JSON,
      changed_by VARCHAR(100),
      change_reason TEXT,
      changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
      INDEX idx_history_reservation (reservation_id, changed_at),
      INDEX idx_history_type (change_type, changed_at)
    )
  `);

  console.log('Reservations tables initialized successfully');
}

/**
 * Seed initial reservation data
 */
async function seedReservations(db) {
  console.log('Seeding initial reservation data...');

  // Check if reservations already exist
  const [existing] = await db.execute('SELECT COUNT(*) as count FROM reservations');
  if (existing[0].count > 0) {
    console.log('Reservations already exist, skipping seed');
    return;
  }

  // Get tomorrow's date for sample reservations
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  // Seed sample reservations
  const reservations = [
    {
      reservation_number: 'RES001',
      customer_name: 'John Doe',
      customer_phone: '+1-555-0101',
      customer_email: 'john.doe@email.com',
      table_id: 'B1',
      party_size: 4,
      reservation_date: tomorrowStr,
      start_time: '18:00:00',
      end_time: '20:00:00',
      duration_minutes: 120,
      special_requests: 'Birthday celebration',
      deposit_amount: 0.00,
      deposit_paid: false,
      created_by: 'Manager'
    },
    {
      reservation_number: 'RES002',
      customer_name: 'Jane Smith',
      customer_phone: '+1-555-0102',
      customer_email: 'jane.smith@email.com',
      table_id: 'B2',
      party_size: 2,
      reservation_date: tomorrowStr,
      start_time: '19:30:00',
      end_time: '21:30:00',
      duration_minutes: 120,
      special_requests: 'Quiet table preferred',
      deposit_amount: 0.00,
      deposit_paid: false,
      created_by: 'Staff'
    },
    {
      reservation_number: 'RES003',
      customer_name: 'Mike Johnson',
      customer_phone: '+1-555-0103',
      customer_email: 'mike.j@email.com',
      table_id: 'T1',
      party_size: 6,
      reservation_date: tomorrowStr,
      start_time: '17:00:00',
      end_time: '19:00:00',
      duration_minutes: 120,
      special_requests: 'Corporate event',
      deposit_amount: 50.00,
      deposit_paid: true,
      created_by: 'Manager'
    }
  ];

  for (const reservation of reservations) {
    await db.execute(`
      INSERT INTO reservations (reservation_number, customer_name, customer_phone, customer_email,
                               table_id, party_size, reservation_date, start_time, end_time, 
                               duration_minutes, special_requests, deposit_amount, deposit_paid, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      reservation.reservation_number, reservation.customer_name, reservation.customer_phone,
      reservation.customer_email, reservation.table_id, reservation.party_size,
      reservation.reservation_date, reservation.start_time, reservation.end_time,
      reservation.duration_minutes, reservation.special_requests,
      reservation.deposit_amount, reservation.deposit_paid, reservation.created_by
    ]);
  }

  console.log('Reservation seed data inserted successfully');
}

module.exports = {
  initReservationTables,
  seedReservations
};
