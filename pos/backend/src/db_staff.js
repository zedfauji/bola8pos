/**
 * Staff Management Database Schema
 * Phase 8 Track A: Advanced POS Features
 */

const mysql = require('mysql2/promise');

/**
 * Initialize staff management tables
 */
async function initStaffTables(db) {
  console.log('Initializing staff management tables...');

  // Employees table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS employees (
      id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
      employee_number VARCHAR(20) UNIQUE NOT NULL,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE,
      phone VARCHAR(20),
      role ENUM('cashier', 'server', 'bartender', 'cook', 'manager', 'admin') NOT NULL,
      department ENUM('front_of_house', 'kitchen', 'bar', 'management', 'admin') NOT NULL,
      hourly_rate DECIMAL(8,2),
      hire_date DATE,
      is_active BOOLEAN DEFAULT true,
      pin_code VARCHAR(10), -- For POS access
      access_level INT DEFAULT 1, -- 1=basic, 5=admin
      permissions JSON, -- Detailed permissions
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_employee_number (employee_number),
      INDEX idx_employee_role (role, is_active),
      INDEX idx_employee_department (department, is_active)
    )
  `);

  // Employee schedules
  await db.execute(`
    CREATE TABLE IF NOT EXISTS employee_schedules (
      id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
      employee_id VARCHAR(36) NOT NULL,
      schedule_date DATE NOT NULL,
      shift_start TIME NOT NULL,
      shift_end TIME NOT NULL,
      break_minutes INT DEFAULT 30,
      position VARCHAR(50), -- Specific position for this shift
      status ENUM('scheduled', 'confirmed', 'called_off', 'no_show', 'completed') DEFAULT 'scheduled',
      notes TEXT,
      created_by VARCHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      INDEX idx_schedule_employee (employee_id, schedule_date),
      INDEX idx_schedule_date (schedule_date, shift_start),
      INDEX idx_schedule_status (status, schedule_date)
    )
  `);

  // Time clock entries
  await db.execute(`
    CREATE TABLE IF NOT EXISTS time_clock (
      id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
      employee_id VARCHAR(36) NOT NULL,
      clock_type ENUM('clock_in', 'clock_out', 'break_start', 'break_end') NOT NULL,
      clock_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      location VARCHAR(100), -- Terminal/location where clocked
      ip_address VARCHAR(45),
      notes TEXT,
      is_manual BOOLEAN DEFAULT false, -- Manager adjustment
      adjusted_by VARCHAR(36), -- Manager who made adjustment
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      INDEX idx_timeclock_employee (employee_id, clock_time),
      INDEX idx_timeclock_type (clock_type, clock_time)
    )
  `);

  // Employee performance tracking
  await db.execute(`
    CREATE TABLE IF NOT EXISTS employee_performance (
      id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
      employee_id VARCHAR(36) NOT NULL,
      performance_date DATE NOT NULL,
      shift_duration_minutes INT,
      tables_served INT DEFAULT 0,
      orders_taken INT DEFAULT 0,
      sales_total DECIMAL(10,2) DEFAULT 0.00,
      tips_total DECIMAL(10,2) DEFAULT 0.00,
      customer_rating DECIMAL(3,2), -- Average rating for the day
      performance_notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      INDEX idx_performance_employee (employee_id, performance_date),
      INDEX idx_performance_date (performance_date)
    )
  `);

  // Employee training records
  await db.execute(`
    CREATE TABLE IF NOT EXISTS employee_training (
      id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
      employee_id VARCHAR(36) NOT NULL,
      training_type VARCHAR(100) NOT NULL,
      training_description TEXT,
      completed_date DATE,
      expiry_date DATE,
      certification_number VARCHAR(50),
      trainer_name VARCHAR(100),
      status ENUM('scheduled', 'in_progress', 'completed', 'expired', 'cancelled') DEFAULT 'scheduled',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      INDEX idx_training_employee (employee_id, completed_date),
      INDEX idx_training_status (status, expiry_date)
    )
  `);

  console.log('Staff management tables initialized successfully');
}

/**
 * Seed initial staff data
 */
async function seedStaff(db) {
  console.log('Seeding initial staff data...');

  // Check if employees already exist
  const [existing] = await db.execute('SELECT COUNT(*) as count FROM employees');
  if (existing[0].count > 0) {
    console.log('Employees already exist, skipping seed');
    return;
  }

  // Seed sample employees
  const employees = [
    {
      employee_number: 'EMP001',
      first_name: 'Alice',
      last_name: 'Manager',
      email: 'alice.manager@billiardpos.com',
      phone: '+1-555-1001',
      role: 'manager',
      department: 'management',
      hourly_rate: 25.00,
      hire_date: '2024-01-15',
      pin_code: '1234',
      access_level: 4,
      permissions: JSON.stringify({
        can_void: true,
        can_comp: true,
        can_refund: true,
        can_access_reports: true,
        can_manage_staff: true,
        can_open_close_shift: true
      })
    },
    {
      employee_number: 'EMP002',
      first_name: 'Bob',
      last_name: 'Cashier',
      email: 'bob.cashier@billiardpos.com',
      phone: '+1-555-1002',
      role: 'cashier',
      department: 'front_of_house',
      hourly_rate: 16.00,
      hire_date: '2024-03-01',
      pin_code: '2345',
      access_level: 2,
      permissions: JSON.stringify({
        can_void: false,
        can_comp: false,
        can_refund: false,
        can_access_reports: false,
        can_process_payments: true,
        can_open_tables: true
      })
    },
    {
      employee_number: 'EMP003',
      first_name: 'Carol',
      last_name: 'Server',
      email: 'carol.server@billiardpos.com',
      phone: '+1-555-1003',
      role: 'server',
      department: 'front_of_house',
      hourly_rate: 14.50,
      hire_date: '2024-02-15',
      pin_code: '3456',
      access_level: 2,
      permissions: JSON.stringify({
        can_void: false,
        can_comp: false,
        can_take_orders: true,
        can_modify_orders: true,
        can_access_kds: true
      })
    },
    {
      employee_number: 'EMP004',
      first_name: 'Dave',
      last_name: 'Bartender',
      email: 'dave.bartender@billiardpos.com',
      phone: '+1-555-1004',
      role: 'bartender',
      department: 'bar',
      hourly_rate: 18.00,
      hire_date: '2024-01-20',
      pin_code: '4567',
      access_level: 2,
      permissions: JSON.stringify({
        can_access_bar_kds: true,
        can_manage_inventory: true,
        can_create_cocktails: true,
        can_process_bar_payments: true
      })
    },
    {
      employee_number: 'EMP005',
      first_name: 'Eva',
      last_name: 'Cook',
      email: 'eva.cook@billiardpos.com',
      phone: '+1-555-1005',
      role: 'cook',
      department: 'kitchen',
      hourly_rate: 17.00,
      hire_date: '2024-02-01',
      pin_code: '5678',
      access_level: 2,
      permissions: JSON.stringify({
        can_access_kitchen_kds: true,
        can_update_order_status: true,
        can_mark_items_unavailable: true
      })
    }
  ];

  for (const employee of employees) {
    await db.execute(`
      INSERT INTO employees (employee_number, first_name, last_name, email, phone, 
                           role, department, hourly_rate, hire_date, pin_code, 
                           access_level, permissions)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      employee.employee_number, employee.first_name, employee.last_name,
      employee.email, employee.phone, employee.role, employee.department,
      employee.hourly_rate, employee.hire_date, employee.pin_code,
      employee.access_level, employee.permissions
    ]);
  }

  console.log('Staff seed data inserted successfully');
}

module.exports = {
  initStaffTables,
  seedStaff
};
