const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// GET /api/reservations - List reservations with filters
router.get('/', async (req, res) => {
  try {
    const { 
      date, table_id, status, customer_name, 
      start_date, end_date, limit = '100' 
    } = req.query;
    
    // Build query dynamically with proper parameter handling
    let sql = 'SELECT * FROM reservations WHERE 1=1';
    const params = [];
    
    if (date) {
      sql += ' AND reservation_date = ?';
      params.push(date);
    } else if (start_date && end_date) {
      sql += ' AND reservation_date BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }
    
    if (table_id) {
      sql += ' AND table_id = ?';
      params.push(table_id);
    }
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    if (customer_name) {
      sql += ' AND customer_name LIKE ?';
      params.push(`%${customer_name}%`);
    }
    
    sql += ' ORDER BY reservation_date, start_time';
    
    // Handle limit properly
    const limitInt = parseInt(limit) || 100;
    if (limitInt > 0) {
      sql += ' LIMIT ?';
      params.push(limitInt);
    }
    
    console.log('Executing SQL:', sql);
    console.log('With parameters:', params);
    
    const [reservations] = await pool.execute(sql, params);
    
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
      SELECT * FROM reservations WHERE id = ?
    `, [id]);
    
    if (reservations.length === 0) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    
    // Get reservation history
    const [history] = await pool.execute(`
      SELECT * FROM reservation_history 
      WHERE reservation_id = ? 
      ORDER BY created_at DESC
    `, [id]);
    
    res.json({ 
      ...reservations[0], 
      history 
    });
  } catch (error) {
    console.error('Error fetching reservation:', error);
    res.status(500).json({ error: 'Failed to fetch reservation' });
  }
});

// POST /api/reservations - Create new reservation
router.post('/', async (req, res) => {
  try {
    const {
      customer_name, customer_phone, customer_email,
      table_id, party_size, reservation_date, start_time, end_time,
      special_requests, deposit_amount = 0
    } = req.body;
    
    // Validate required fields
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
    
    // Generate unique reservation number with retry logic
    let reservationNumber;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      try {
        // Get the highest existing reservation number
        const [lastReservation] = await pool.execute(`
          SELECT reservation_number FROM reservations 
          WHERE reservation_number LIKE 'RES%'
          ORDER BY CAST(SUBSTRING(reservation_number, 4) AS UNSIGNED) DESC 
          LIMIT 1
        `);
        
        let nextNum = 1;
        if (lastReservation.length > 0) {
          const lastNum = parseInt(lastReservation[0].reservation_number.replace('RES', ''));
          nextNum = lastNum + 1;
        }
        
        reservationNumber = `RES${String(nextNum).padStart(3, '0')}`;
        
        // Try to insert with this reservation number
        const reservationId = uuidv4();
        
        const [result] = await pool.execute(`
          INSERT INTO reservations (
            id, reservation_number, customer_name, customer_phone, 
            customer_email, table_id, party_size, reservation_date, 
            start_time, end_time, duration_minutes, special_requests, 
            deposit_amount, status, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', 'System')
        `, [
          reservationId, reservationNumber, customer_name, customer_phone || null, 
          customer_email || null, table_id, parseInt(party_size), reservation_date, 
          start_time, end_time, duration_minutes, special_requests || null, 
          parseFloat(deposit_amount) || 0
        ]);
        
        // Log reservation creation
        await pool.execute(`
          INSERT INTO reservation_history (reservation_id, change_type, new_values, changed_by)
          VALUES (?, 'created', ?, 'System')
        `, [reservationId, JSON.stringify(req.body)]);
        
        // Get the created reservation
        const [newReservation] = await pool.execute(`
          SELECT * FROM reservations WHERE id = ?
        `, [reservationId]);
        
        res.status(201).json(newReservation[0]);
        return;
        
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY' && error.sqlMessage.includes('reservation_number')) {
          attempts++;
          console.log(`Reservation number ${reservationNumber} already exists, retrying... (attempt ${attempts})`);
          continue;
        } else {
          throw error;
        }
      }
    }
    
    throw new Error('Failed to generate unique reservation number after maximum attempts');
    
  } catch (error) {
    console.error('Error creating reservation:', error);
    res.status(500).json({ error: 'Failed to create reservation' });
  }
});

// PUT /api/reservations/:id/check-in - Check in reservation
router.post('/:id/check-in', async (req, res) => {
  try {
    const { id } = req.params;
    const { checked_in_by = 'Staff' } = req.body;
    
    const [result] = await pool.execute(`
      UPDATE reservations 
      SET status = 'checked_in', checked_in_at = NOW(), checked_in_by = ?
      WHERE id = ? AND status = 'confirmed'
    `, [checked_in_by, id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Reservation not found or cannot be checked in' });
    }
    
    // Log check-in
    await pool.execute(`
      INSERT INTO reservation_history (reservation_id, change_type, new_values, changed_by)
      VALUES (?, 'checked_in', ?, ?)
    `, [id, JSON.stringify({ checked_in_at: new Date(), checked_in_by }), checked_in_by]);
    
    res.json({ message: 'Customer checked in successfully' });
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
    const [existingReservations] = await pool.execute(`
      SELECT start_time, end_time FROM reservations 
      WHERE table_id = ? AND reservation_date = ? 
      AND status NOT IN ('cancelled', 'no_show', 'completed')
      ORDER BY start_time
    `, [table_id, date]);
    
    // Generate available time slots (9 AM to 11 PM, 2-hour slots)
    const availableSlots = [];
    const startHour = 9;
    const endHour = 23;
    const slotDuration = parseInt(duration);
    
    for (let hour = startHour; hour <= endHour - (slotDuration / 60); hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const slotStart = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        const slotEndTime = new Date(`2000-01-01 ${slotStart}`);
        slotEndTime.setMinutes(slotEndTime.getMinutes() + slotDuration);
        const slotEnd = `${String(slotEndTime.getHours()).padStart(2, '0')}:${String(slotEndTime.getMinutes()).padStart(2, '0')}`;
        
        // Check if this slot conflicts with existing reservations
        const hasConflict = existingReservations.some(reservation => {
          const existingStart = reservation.start_time;
          const existingEnd = reservation.end_time;
          
          return (
            (slotStart < existingEnd && slotEnd > existingStart)
          );
        });
        
        if (!hasConflict) {
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
      duration_minutes: slotDuration,
      available_slots: availableSlots
    });
  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

module.exports = router;
