/**
 * Staff Management API Routes
 * Phase 8 Track A: Advanced POS Features
 */

const express = require('express');
const { pool } = require('../db');
const router = express.Router();

// GET /api/staff/employees - List all employees
router.get('/employees', async (req, res) => {
  try {
    const { role, department, active = 'true', search = '' } = req.query;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (role) {
      whereClause += ' AND role = ?';
      params.push(role);
    }
    
    if (department) {
      whereClause += ' AND department = ?';
      params.push(department);
    }
    
    if (active !== 'all') {
      whereClause += ' AND is_active = ?';
      params.push(active === 'true');
    }
    
    if (search) {
      whereClause += ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR employee_number LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }
    
    const [employees] = await pool.execute(`
      SELECT id, employee_number, first_name, last_name, email, phone, role, 
             department, hourly_rate, hire_date, is_active, access_level, created_at
      FROM employees 
      ${whereClause}
      ORDER BY department, role, last_name
    `, params);
    
    res.json({ employees });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

// GET /api/staff/employees/:id - Get employee by ID with details
router.get('/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [employees] = await pool.execute(`
      SELECT * FROM employees WHERE id = ?
    `, [id]);
    
    if (employees.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    // Get recent schedules
    const [schedules] = await pool.execute(`
      SELECT * FROM employee_schedules 
      WHERE employee_id = ? AND schedule_date >= CURDATE() - INTERVAL 30 DAY
      ORDER BY schedule_date DESC
    `, [id]);
    
    // Get recent time clock entries
    const [timeEntries] = await pool.execute(`
      SELECT * FROM time_clock 
      WHERE employee_id = ? 
      ORDER BY clock_time DESC 
      LIMIT 20
    `, [id]);
    
    // Get performance data
    const [performance] = await pool.execute(`
      SELECT * FROM employee_performance 
      WHERE employee_id = ? 
      ORDER BY performance_date DESC 
      LIMIT 10
    `, [id]);
    
    // Get training records
    const [training] = await pool.execute(`
      SELECT * FROM employee_training 
      WHERE employee_id = ? 
      ORDER BY completed_date DESC
    `, [id]);
    
    const employee = employees[0];
    employee.recent_schedules = schedules;
    employee.recent_time_entries = timeEntries;
    employee.performance_history = performance;
    employee.training_records = training;
    
    // Parse permissions JSON
    if (employee.permissions) {
      try {
        employee.permissions = JSON.parse(employee.permissions);
      } catch (e) {
        employee.permissions = {};
      }
    }
    
    res.json(employee);
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({ error: 'Failed to fetch employee' });
  }
});

// POST /api/staff/employees - Create new employee
router.post('/employees', async (req, res) => {
  try {
    const {
      first_name, last_name, email, phone, role, department,
      hourly_rate, hire_date, pin_code, access_level = 1,
      permissions = {}, notes
    } = req.body;
    
    if (!first_name || !last_name || !role || !department) {
      return res.status(400).json({ error: 'Missing required employee information' });
    }
    
    // Generate employee number
    const [lastEmployee] = await pool.execute(`
      SELECT employee_number FROM employees 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    let employeeNumber = 'EMP001';
    if (lastEmployee.length > 0) {
      const lastNum = parseInt(lastEmployee[0].employee_number.replace('EMP', ''));
      employeeNumber = `EMP${String(lastNum + 1).padStart(3, '0')}`;
    }
    
    const [result] = await pool.execute(`
      INSERT INTO employees (employee_number, first_name, last_name, email, phone, 
                           role, department, hourly_rate, hire_date, pin_code, 
                           access_level, permissions, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [employeeNumber, first_name, last_name, email, phone, role, department,
        hourly_rate, hire_date, pin_code, access_level, JSON.stringify(permissions), notes]);
    
    const [newEmployee] = await pool.execute(`
      SELECT id, employee_number, first_name, last_name, email, phone, role, 
             department, hourly_rate, hire_date, is_active, access_level, created_at
      FROM employees WHERE id = ?
    `, [result.insertId]);
    
    res.status(201).json(newEmployee[0]);
  } catch (error) {
    console.error('Error creating employee:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Email already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create employee' });
    }
  }
});

// PUT /api/staff/employees/:id - Update employee
router.put('/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      first_name, last_name, email, phone, role, department,
      hourly_rate, pin_code, access_level, permissions, notes, is_active
    } = req.body;
    
    const [result] = await pool.execute(`
      UPDATE employees 
      SET first_name = ?, last_name = ?, email = ?, phone = ?, role = ?, 
          department = ?, hourly_rate = ?, pin_code = ?, access_level = ?, 
          permissions = ?, notes = ?, is_active = ?
      WHERE id = ?
    `, [first_name, last_name, email, phone, role, department, hourly_rate,
        pin_code, access_level, JSON.stringify(permissions || {}), notes, is_active, id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    const [updatedEmployee] = await pool.execute(`
      SELECT id, employee_number, first_name, last_name, email, phone, role, 
             department, hourly_rate, hire_date, is_active, access_level, created_at
      FROM employees WHERE id = ?
    `, [id]);
    
    res.json(updatedEmployee[0]);
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

// GET /api/staff/schedules - Get employee schedules
router.get('/schedules', async (req, res) => {
  try {
    const { employee_id, date, start_date, end_date, status } = req.query;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (employee_id) {
      whereClause += ' AND es.employee_id = ?';
      params.push(employee_id);
    }
    
    if (date) {
      whereClause += ' AND es.schedule_date = ?';
      params.push(date);
    } else if (start_date && end_date) {
      whereClause += ' AND es.schedule_date BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }
    
    if (status) {
      whereClause += ' AND es.status = ?';
      params.push(status);
    }
    
    const [schedules] = await pool.execute(`
      SELECT es.*, e.first_name, e.last_name, e.employee_number
      FROM employee_schedules es
      JOIN employees e ON es.employee_id = e.id
      ${whereClause}
      ORDER BY es.schedule_date, es.shift_start
    `, params);
    
    res.json({ schedules });
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

// POST /api/staff/schedules - Create employee schedule
router.post('/schedules', async (req, res) => {
  try {
    const {
      employee_id, schedule_date, shift_start, shift_end,
      break_minutes = 30, position, notes, created_by
    } = req.body;
    
    if (!employee_id || !schedule_date || !shift_start || !shift_end) {
      return res.status(400).json({ error: 'Missing required schedule information' });
    }
    
    // Check for schedule conflicts
    const [conflicts] = await pool.execute(`
      SELECT id FROM employee_schedules 
      WHERE employee_id = ? AND schedule_date = ?
      AND status NOT IN ('cancelled', 'no_show')
      AND (
        (shift_start <= ? AND shift_end > ?) OR
        (shift_start < ? AND shift_end >= ?) OR
        (shift_start >= ? AND shift_end <= ?)
      )
    `, [employee_id, schedule_date, shift_start, shift_start, shift_end, shift_end, shift_start, shift_end]);
    
    if (conflicts.length > 0) {
      return res.status(400).json({ error: 'Schedule conflicts with existing shift' });
    }
    
    const [result] = await pool.execute(`
      INSERT INTO employee_schedules (employee_id, schedule_date, shift_start, shift_end, 
                                     break_minutes, position, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [employee_id, schedule_date, shift_start, shift_end, break_minutes, position, notes, created_by]);
    
    const [newSchedule] = await pool.execute(`
      SELECT es.*, e.first_name, e.last_name, e.employee_number
      FROM employee_schedules es
      JOIN employees e ON es.employee_id = e.id
      WHERE es.id = ?
    `, [result.insertId]);
    
    res.status(201).json(newSchedule[0]);
  } catch (error) {
    console.error('Error creating schedule:', error);
    res.status(500).json({ error: 'Failed to create schedule' });
  }
});

// POST /api/staff/time-clock - Clock in/out employee
router.post('/time-clock', async (req, res) => {
  try {
    const {
      employee_id, clock_type, location, ip_address, notes
    } = req.body;
    
    if (!employee_id || !clock_type) {
      return res.status(400).json({ error: 'Employee ID and clock type are required' });
    }
    
    const validClockTypes = ['clock_in', 'clock_out', 'break_start', 'break_end'];
    if (!validClockTypes.includes(clock_type)) {
      return res.status(400).json({ error: 'Invalid clock type' });
    }
    
    // Verify employee exists and is active
    const [employee] = await pool.execute(`
      SELECT id, first_name, last_name FROM employees 
      WHERE id = ? AND is_active = true
    `, [employee_id]);
    
    if (employee.length === 0) {
      return res.status(404).json({ error: 'Employee not found or inactive' });
    }
    
    // Get last clock entry to validate sequence
    const [lastEntry] = await pool.execute(`
      SELECT clock_type, clock_time FROM time_clock 
      WHERE employee_id = ? 
      ORDER BY clock_time DESC 
      LIMIT 1
    `, [employee_id]);
    
    // Basic validation of clock sequence
    if (lastEntry.length > 0) {
      const lastType = lastEntry[0].clock_type;
      if (clock_type === 'clock_in' && ['clock_in', 'break_start'].includes(lastType)) {
        return res.status(400).json({ error: 'Employee is already clocked in' });
      }
      if (clock_type === 'clock_out' && ['clock_out', 'break_end'].includes(lastType)) {
        return res.status(400).json({ error: 'Employee is already clocked out' });
      }
    }
    
    const [result] = await pool.execute(`
      INSERT INTO time_clock (employee_id, clock_type, location, ip_address, notes)
      VALUES (?, ?, ?, ?, ?)
    `, [employee_id, clock_type, location, ip_address, notes]);
    
    const [newEntry] = await pool.execute(`
      SELECT tc.*, e.first_name, e.last_name, e.employee_number
      FROM time_clock tc
      JOIN employees e ON tc.employee_id = e.id
      WHERE tc.id = ?
    `, [result.insertId]);
    
    res.status(201).json(newEntry[0]);
  } catch (error) {
    console.error('Error recording time clock:', error);
    res.status(500).json({ error: 'Failed to record time clock entry' });
  }
});

// GET /api/staff/time-clock/:employee_id/status - Get current clock status
router.get('/time-clock/:employee_id/status', async (req, res) => {
  try {
    const { employee_id } = req.params;
    
    const [lastEntry] = await pool.execute(`
      SELECT clock_type, clock_time, location FROM time_clock 
      WHERE employee_id = ? 
      ORDER BY clock_time DESC 
      LIMIT 1
    `, [employee_id]);
    
    let status = 'clocked_out';
    let since = null;
    
    if (lastEntry.length > 0) {
      const lastType = lastEntry[0].clock_type;
      since = lastEntry[0].clock_time;
      
      switch (lastType) {
        case 'clock_in':
          status = 'clocked_in';
          break;
        case 'break_start':
          status = 'on_break';
          break;
        case 'break_end':
          status = 'clocked_in';
          break;
        case 'clock_out':
          status = 'clocked_out';
          break;
      }
    }
    
    // Calculate hours worked today
    const [todayEntries] = await pool.execute(`
      SELECT clock_type, clock_time FROM time_clock 
      WHERE employee_id = ? AND DATE(clock_time) = CURDATE()
      ORDER BY clock_time
    `, [employee_id]);
    
    let hoursWorked = 0;
    let clockInTime = null;
    
    for (const entry of todayEntries) {
      if (entry.clock_type === 'clock_in') {
        clockInTime = new Date(entry.clock_time);
      } else if (entry.clock_type === 'clock_out' && clockInTime) {
        const clockOutTime = new Date(entry.clock_time);
        hoursWorked += (clockOutTime - clockInTime) / (1000 * 60 * 60);
        clockInTime = null;
      }
    }
    
    // If still clocked in, add current time
    if (clockInTime && status === 'clocked_in') {
      hoursWorked += (new Date() - clockInTime) / (1000 * 60 * 60);
    }
    
    res.json({
      employee_id,
      status,
      since,
      hours_worked_today: Math.round(hoursWorked * 100) / 100,
      last_entry: lastEntry[0] || null
    });
  } catch (error) {
    console.error('Error fetching time clock status:', error);
    res.status(500).json({ error: 'Failed to fetch time clock status' });
  }
});

// POST /api/staff/performance - Record employee performance
router.post('/performance', async (req, res) => {
  try {
    const {
      employee_id, performance_date, shift_duration_minutes,
      tables_served = 0, orders_taken = 0, sales_total = 0,
      tips_total = 0, customer_rating, performance_notes
    } = req.body;
    
    if (!employee_id || !performance_date) {
      return res.status(400).json({ error: 'Employee ID and performance date are required' });
    }
    
    const [result] = await pool.execute(`
      INSERT INTO employee_performance (employee_id, performance_date, shift_duration_minutes,
                                       tables_served, orders_taken, sales_total, tips_total,
                                       customer_rating, performance_notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        shift_duration_minutes = VALUES(shift_duration_minutes),
        tables_served = VALUES(tables_served),
        orders_taken = VALUES(orders_taken),
        sales_total = VALUES(sales_total),
        tips_total = VALUES(tips_total),
        customer_rating = VALUES(customer_rating),
        performance_notes = VALUES(performance_notes)
    `, [employee_id, performance_date, shift_duration_minutes, tables_served,
        orders_taken, sales_total, tips_total, customer_rating, performance_notes]);
    
    res.json({ success: true, message: 'Performance recorded successfully' });
  } catch (error) {
    console.error('Error recording performance:', error);
    res.status(500).json({ error: 'Failed to record performance' });
  }
});

// GET /api/staff/stats/summary - Staff analytics summary
router.get('/stats/summary', async (req, res) => {
  try {
    const [employeeStats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_employees,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_employees,
        role,
        COUNT(*) as count_by_role
      FROM employees
      GROUP BY role
    `);
    
    const [scheduleStats] = await pool.execute(`
      SELECT 
        status,
        COUNT(*) as count
      FROM employee_schedules
      WHERE schedule_date >= CURDATE() - INTERVAL 7 DAY
      GROUP BY status
    `);
    
    const [performanceStats] = await pool.execute(`
      SELECT 
        AVG(sales_total) as avg_sales,
        AVG(customer_rating) as avg_rating,
        SUM(tables_served) as total_tables_served
      FROM employee_performance
      WHERE performance_date >= CURDATE() - INTERVAL 30 DAY
    `);
    
    res.json({
      employees: employeeStats,
      schedules_7d: scheduleStats,
      performance_30d: performanceStats[0]
    });
  } catch (error) {
    console.error('Error fetching staff stats:', error);
    res.status(500).json({ error: 'Failed to fetch staff statistics' });
  }
});

module.exports = router;
