/**
 * Reservations and Booking API Routes
 * Phase 8 Track A: Advanced POS Features
 */

const express = require('express');
const { pool } = require('../db');
const router = express.Router();

// GET /api/reservations - List reservations with filters
router.get('/', async (req, res) => {
  try {
    const { 
      date, table_id, status, customer_name, 
      start_date, end_date, limit = '100' 
    } = req.query;
    
    // Convert limit to integer
    const limitInt = parseInt(limit) || 100;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (date) {
      whereClause += ' AND reservation_date = ?';
      params.push(date);
    } else if (start_date && end_date) {
      whereClause += ' AND reservation_date BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }
    
    if (table_id) {
      whereClause += ' AND table_id = ?';
      params.push(table_id);
    }
    
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    
    if (customer_name) {
      whereClause += ' AND customer_name LIKE ?';
      params.push(`%${customer_name}%`);
    }
    
    const [reservations] = await pool.execute(`
      SELECT r.*
      FROM reservations r
      ${whereClause}
      ORDER BY reservation_date, start_time
      LIMIT ?
    `, [...params, limitInt]);
    
    res.json({ reservations });
  } catch (error) {
    console.error('Error fetching reservations:', error);
    res.status(500).json({ error: 'Failed to fetch reservations' });
  }
});

// GET /api/reservations/:id - Get reservation by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [reservations] = await pool.execute(`
      SELECT r.*, c.first_name, c.last_name, c.email as customer_email, c.phone as customer_phone_alt
      FROM reservations r
      LEFT JOIN customers c ON r.customer_id = c.id
      WHERE r.id = ?
    `, [id]);
    
    if (reservations.length === 0) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    
    // Get reservation history
    const [history] = await pool.execute(`
      SELECT * FROM reservation_history 
      WHERE reservation_id = ? 
      ORDER BY changed_at DESC
    `, [id]);
    
    const reservation = reservations[0];
    reservation.history = history;
    
    res.json(reservation);
  } catch (error) {
    console.error('Error fetching reservation:', error);
    res.status(500).json({ error: 'Failed to fetch reservation' });
  }
});

// POST /api/reservations - Create new reservation
router.post('/', async (req, res) => {
  try {
    const {
      customer_id = null, customer_name, customer_phone = null, customer_email = null,
      table_id, party_size, reservation_date, start_time, end_time,
      special_requests = null, notes = null, deposit_amount = 0, created_by = 'System'
    } = req.body;
    
    if (!customer_name || !table_id || !party_size || !reservation_date || !start_time || !end_time) {
      return res.status(400).json({ error: 'Missing required reservation information' });
    }
    
    // Calculate duration
    const startDateTime = new Date(`${reservation_date} ${start_time}`);
    const endDateTime = new Date(`${reservation_date} ${end_time}`);
    const duration_minutes = Math.floor((endDateTime - startDateTime) / (1000 * 60));
    
    if (duration_minutes <= 0) {
      return res.status(400).json({ error: 'End time must be after start time' });
    }
    
    // Check for conflicts
    const [conflicts] = await pool.execute(`
      SELECT id FROM reservations 
      WHERE table_id = ? AND reservation_date = ? 
      AND status NOT IN ('cancelled', 'no_show', 'completed')
      AND (
        (start_time <= ? AND end_time > ?) OR
        (start_time < ? AND end_time >= ?) OR
        (start_time >= ? AND end_time <= ?)
      )
    `, [table_id, reservation_date, start_time, start_time, end_time, end_time, start_time, end_time]);
    
    if (conflicts.length > 0) {
      return res.status(400).json({ error: 'Time slot conflicts with existing reservation' });
    }
    
    // Generate reservation number
    const [lastReservation] = await pool.execute(`
      SELECT reservation_number FROM reservations 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    let reservationNumber = 'RES001';
    if (lastReservation.length > 0) {
      const lastNum = parseInt(lastReservation[0].reservation_number.replace('RES', ''));
      reservationNumber = `RES${String(lastNum + 1).padStart(3, '0')}`;
    }
    
    const [result] = await pool.execute(`
      INSERT INTO reservations (reservation_number, customer_id, customer_name, customer_phone, 
                               customer_email, table_id, party_size, reservation_date, start_time, 
                               end_time, duration_minutes, special_requests, notes, deposit_amount, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [reservationNumber, customer_id, customer_name, customer_phone, customer_email, 
        table_id, parseInt(party_size), reservation_date, start_time, end_time, duration_minutes,
        special_requests, notes, parseFloat(deposit_amount), created_by]);
    
    // Log reservation creation
    await pool.execute(`
      INSERT INTO reservation_history (reservation_id, change_type, new_values, changed_by)
      VALUES (?, 'created', ?, ?)
    `, [result.insertId, JSON.stringify(req.body), created_by || 'System']);
    
    const [newReservation] = await pool.execute(`
      SELECT * FROM reservations WHERE id = ?
    `, [result.insertId]);
    
    res.status(201).json(newReservation[0]);
  } catch (error) {
    console.error('Error creating reservation:', error);
    res.status(500).json({ error: 'Failed to create reservation' });
  }
});

// PUT /api/reservations/:id - Update reservation
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      customer_name, customer_phone, customer_email, table_id, party_size,
      reservation_date, start_time, end_time, special_requests, notes,
      deposit_amount, status, changed_by
    } = req.body;
    
    // Get current reservation for history
    const [currentReservation] = await pool.execute(`
      SELECT * FROM reservations WHERE id = ?
    `, [id]);
    
    if (currentReservation.length === 0) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    
    // If changing time/date/table, check for conflicts
    if (table_id || reservation_date || start_time || end_time) {
      const checkTableId = table_id || currentReservation[0].table_id;
      const checkDate = reservation_date || currentReservation[0].reservation_date;
      const checkStartTime = start_time || currentReservation[0].start_time;
      const checkEndTime = end_time || currentReservation[0].end_time;
      
      const [conflicts] = await pool.execute(`
        SELECT id FROM reservations 
        WHERE table_id = ? AND reservation_date = ? AND id != ?
        AND status NOT IN ('cancelled', 'no_show', 'completed')
        AND (
          (start_time <= ? AND end_time > ?) OR
          (start_time < ? AND end_time >= ?) OR
          (start_time >= ? AND end_time <= ?)
        )
      `, [checkTableId, checkDate, id, checkStartTime, checkStartTime, 
          checkEndTime, checkEndTime, checkStartTime, checkEndTime]);
      
      if (conflicts.length > 0) {
        return res.status(400).json({ error: 'Time slot conflicts with existing reservation' });
      }
    }
    
    // Calculate new duration if times changed
    let duration_minutes = currentReservation[0].duration_minutes;
    if (start_time || end_time) {
      const checkDate = reservation_date || currentReservation[0].reservation_date;
      const checkStartTime = start_time || currentReservation[0].start_time;
      const checkEndTime = end_time || currentReservation[0].end_time;
      
      const startDateTime = new Date(`${checkDate} ${checkStartTime}`);
      const endDateTime = new Date(`${checkDate} ${checkEndTime}`);
      duration_minutes = Math.floor((endDateTime - startDateTime) / (1000 * 60));
    }
    
    const [result] = await pool.execute(`
      UPDATE reservations 
      SET customer_name = ?, customer_phone = ?, customer_email = ?, table_id = ?, 
          party_size = ?, reservation_date = ?, start_time = ?, end_time = ?, 
          duration_minutes = ?, special_requests = ?, notes = ?, deposit_amount = ?, status = ?
      WHERE id = ?
    `, [customer_name || currentReservation[0].customer_name,
        customer_phone || currentReservation[0].customer_phone,
        customer_email || currentReservation[0].customer_email,
        table_id || currentReservation[0].table_id,
        party_size || currentReservation[0].party_size,
        reservation_date || currentReservation[0].reservation_date,
        start_time || currentReservation[0].start_time,
        end_time || currentReservation[0].end_time,
        duration_minutes,
        special_requests || currentReservation[0].special_requests,
        notes || currentReservation[0].notes,
        deposit_amount !== undefined ? deposit_amount : currentReservation[0].deposit_amount,
        status || currentReservation[0].status,
        id]);
    
    // Log reservation change
    await pool.execute(`
      INSERT INTO reservation_history (reservation_id, change_type, old_values, new_values, changed_by)
      VALUES (?, 'modified', ?, ?, ?)
    `, [id, JSON.stringify(currentReservation[0]), JSON.stringify(req.body), changed_by]);
    
    const [updatedReservation] = await pool.execute(`
      SELECT * FROM reservations WHERE id = ?
    `, [id]);
    
    res.json(updatedReservation[0]);
  } catch (error) {
    console.error('Error updating reservation:', error);
    res.status(500).json({ error: 'Failed to update reservation' });
  }
});

// POST /api/reservations/:id/check-in - Check in reservation
router.post('/:id/check-in', async (req, res) => {
  try {
    const { id } = req.params;
    const { checked_in_by } = req.body;
    
    const [result] = await pool.execute(`
      UPDATE reservations SET status = 'checked_in' WHERE id = ? AND status = 'confirmed'
    `, [id]);
    
    if (result.affectedRows === 0) {
      return res.status(400).json({ error: 'Reservation not found or cannot be checked in' });
    }
    
    // Log check-in
    await pool.execute(`
      INSERT INTO reservation_history (reservation_id, change_type, new_values, changed_by)
      VALUES (?, 'checked_in', ?, ?)
    `, [id, JSON.stringify({ status: 'checked_in' }), checked_in_by]);
    
    res.json({ success: true, message: 'Reservation checked in successfully' });
  } catch (error) {
    console.error('Error checking in reservation:', error);
    res.status(500).json({ error: 'Failed to check in reservation' });
  }
});

// GET /api/reservations/availability/:table_id - Check table availability
router.get('/availability/:table_id', async (req, res) => {
  try {
    const { table_id } = req.params;
    const { date, duration = 120 } = req.query;
    
    if (!date) {
      return res.status(400).json({ error: 'Date parameter is required' });
    }
    
    // Get existing reservations for the date
    const [reservations] = await pool.execute(`
      SELECT start_time, end_time FROM reservations 
      WHERE table_id = ? AND reservation_date = ? 
      AND status NOT IN ('cancelled', 'no_show', 'completed')
      ORDER BY start_time
    `, [table_id, date]);
    
    // Get table blocks for the date
    const [blocks] = await pool.execute(`
      SELECT start_datetime, end_datetime FROM table_blocks 
      WHERE table_id = ? AND is_active = true
      AND DATE(start_datetime) <= ? AND DATE(end_datetime) >= ?
    `, [table_id, date, date]);
    
    // Generate available time slots (every 30 minutes from 10 AM to 11 PM)
    const availableSlots = [];
    const startHour = 10;
    const endHour = 23;
    const slotDuration = parseInt(duration);
    
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const slotStart = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`;
        const slotStartTime = new Date(`${date} ${slotStart}`);
        const slotEndTime = new Date(slotStartTime.getTime() + slotDuration * 60000);
        const slotEnd = slotEndTime.toTimeString().slice(0, 8);
        
        // Check if slot conflicts with existing reservations
        const hasReservationConflict = reservations.some(res => {
          const resStart = new Date(`${date} ${res.start_time}`);
          const resEnd = new Date(`${date} ${res.end_time}`);
          return (slotStartTime < resEnd && slotEndTime > resStart);
        });
        
        // Check if slot conflicts with table blocks
        const hasBlockConflict = blocks.some(block => {
          const blockStart = new Date(block.start_datetime);
          const blockEnd = new Date(block.end_datetime);
          return (slotStartTime < blockEnd && slotEndTime > blockStart);
        });
        
        if (!hasReservationConflict && !hasBlockConflict) {
          availableSlots.push({
            start_time: slotStart,
            end_time: slotEnd,
            duration_minutes: slotDuration
          });
        }
      }
    }
    
    res.json({ 
      table_id, 
      date, 
      available_slots: availableSlots,
      existing_reservations: reservations,
      blocks: blocks
    });
  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

// GET /api/reservations/stats/summary - Reservation analytics
router.get('/stats/summary', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    let dateFilter = '';
    const params = [];
    
    if (start_date && end_date) {
      dateFilter = 'WHERE reservation_date BETWEEN ? AND ?';
      params.push(start_date, end_date);
    } else {
      dateFilter = 'WHERE reservation_date >= CURDATE()';
    }
    
    const [stats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_reservations,
        COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed,
        COUNT(CASE WHEN status = 'checked_in' THEN 1 END) as checked_in,
        COUNT(CASE WHEN status = 'seated' THEN 1 END) as seated,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
        COUNT(CASE WHEN status = 'no_show' THEN 1 END) as no_shows,
        AVG(party_size) as avg_party_size,
        AVG(duration_minutes) as avg_duration,
        SUM(deposit_amount) as total_deposits
      FROM reservations ${dateFilter}
    `, params);
    
    const [tableStats] = await pool.execute(`
      SELECT 
        table_id,
        COUNT(*) as reservation_count,
        AVG(party_size) as avg_party_size
      FROM reservations ${dateFilter}
      GROUP BY table_id
      ORDER BY reservation_count DESC
    `, params);
    
    res.json({
      summary: stats[0],
      by_table: tableStats
    });
  } catch (error) {
    console.error('Error fetching reservation stats:', error);
    res.status(500).json({ error: 'Failed to fetch reservation statistics' });
  }
});

module.exports = router;
