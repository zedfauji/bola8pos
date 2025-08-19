const express = require('express');
const router = express.Router();
const { pool } = require('../db');

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
    
    // Handle limit properly - use string interpolation instead of parameter binding for LIMIT
    const limitInt = parseInt(limit) || 100;
    if (limitInt > 0 && limitInt <= 1000) { // Safety check
      sql += ` LIMIT ${limitInt}`;
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

// (Moved) GET /api/reservations/:id - defined after specific routes to avoid shadowing

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
        const reservationId = `res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
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
    
    // Only update status; schema does not have checked_in_at/checked_in_by columns
    const [result] = await pool.execute(`
      UPDATE reservations 
      SET status = 'checked_in'
      WHERE id = ? AND status = 'confirmed'
    `, [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Reservation not found or cannot be checked in' });
    }
    
    // Log check-in
    await pool.execute(`
      INSERT INTO reservation_history (reservation_id, change_type, new_values, changed_by)
      VALUES (?, 'checked_in', ?, ?)
    `, [id, JSON.stringify({ status: 'checked_in' }), checked_in_by]);
    
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
    const [reservationsForDay] = await pool.execute(`
      SELECT start_time, end_time FROM reservations 
      WHERE table_id = ? AND reservation_date = ? 
      AND status NOT IN ('cancelled', 'no_show', 'completed')
      ORDER BY start_time
    `, [table_id, date]);

    // Get table blocks overlapping the date
    const [blocks] = await pool.execute(`
      SELECT start_datetime, end_datetime FROM table_blocks 
      WHERE table_id = ? AND is_active = true
      AND DATE(start_datetime) <= ? AND DATE(end_datetime) >= ?
    `, [table_id, date, date]);
    
    // Generate available time slots (every 30 minutes from 9 AM to 11 PM)
    const availableSlots = [];
    const startHour = 9;
    const endHour = 23;
    const slotDuration = parseInt(duration);
    
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const slotStart = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`;
        const slotStartTime = new Date(`${date} ${slotStart}`);
        const slotEndTime = new Date(slotStartTime.getTime() + slotDuration * 60000);
        const slotEnd = slotEndTime.toTimeString().slice(0, 8);
        
        // Check if slot conflicts with existing reservations
        const hasReservationConflict = reservationsForDay.some(res => {
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
      existing_reservations: reservationsForDay,
      blocks
    });
  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

// PUT /api/reservations/:id - Update reservation
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      customer_name, customer_phone, customer_email, table_id, party_size,
      reservation_date, start_time, end_time, special_requests, notes,
      deposit_amount, status, changed_by = 'System'
    } = req.body;

    // Get current reservation for history and defaults
    const [currentRows] = await pool.execute(`
      SELECT * FROM reservations WHERE id = ?
    `, [id]);
    if (currentRows.length === 0) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    const current = currentRows[0];

    // If changing table/date/times, check for conflicts
    if (table_id || reservation_date || start_time || end_time) {
      const checkTableId = table_id || current.table_id;
      const checkDate = reservation_date || current.reservation_date;
      const checkStartTime = start_time || current.start_time;
      const checkEndTime = end_time || current.end_time;

      const [conflicts] = await pool.execute(`
        SELECT id FROM reservations 
        WHERE table_id = ? AND reservation_date = ? AND id != ?
        AND status NOT IN ('cancelled', 'no_show', 'completed')
        AND (
          (start_time <= ? AND end_time > ?) OR
          (start_time < ? AND end_time >= ?) OR
          (start_time >= ? AND end_time <= ?)
        )
      `, [checkTableId, checkDate, id, checkStartTime, checkStartTime, checkEndTime, checkEndTime, checkStartTime, checkEndTime]);

      if (conflicts.length > 0) {
        return res.status(400).json({ error: 'Time slot conflicts with existing reservation' });
      }
    }

    // Compute duration if times changed
    let duration_minutes = current.duration_minutes;
    if (start_time || end_time || reservation_date) {
      const dt = reservation_date || current.reservation_date;
      const st = start_time || current.start_time;
      const et = end_time || current.end_time;
      const sdt = new Date(`${dt} ${st}`);
      const edt = new Date(`${dt} ${et}`);
      duration_minutes = Math.floor((edt - sdt) / (1000 * 60));
      if (duration_minutes <= 0) {
        return res.status(400).json({ error: 'End time must be after start time' });
      }
    }

    await pool.execute(`
      UPDATE reservations 
      SET customer_name = ?, customer_phone = ?, customer_email = ?, table_id = ?, 
          party_size = ?, reservation_date = ?, start_time = ?, end_time = ?, 
          duration_minutes = ?, special_requests = ?, notes = ?, deposit_amount = ?, status = ?
      WHERE id = ?
    `, [
      customer_name ?? current.customer_name,
      customer_phone ?? current.customer_phone,
      customer_email ?? current.customer_email,
      table_id ?? current.table_id,
      party_size ?? current.party_size,
      reservation_date ?? current.reservation_date,
      start_time ?? current.start_time,
      end_time ?? current.end_time,
      duration_minutes,
      special_requests ?? current.special_requests,
      notes ?? current.notes,
      (deposit_amount !== undefined ? deposit_amount : current.deposit_amount),
      status ?? current.status,
      id
    ]);

    // Log history
    await pool.execute(`
      INSERT INTO reservation_history (reservation_id, change_type, old_values, new_values, changed_by)
      VALUES (?, 'modified', ?, ?, ?)
    `, [id, JSON.stringify(current), JSON.stringify(req.body), changed_by]);

    const [updated] = await pool.execute(`SELECT * FROM reservations WHERE id = ?`, [id]);
    res.json(updated[0]);
  } catch (error) {
    console.error('Error updating reservation:', error);
    res.status(500).json({ error: 'Failed to update reservation' });
  }
});

// DELETE /api/reservations/:id - Soft cancel reservation
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { changed_by = 'System', reason = null } = req.body || {};

    const [rows] = await pool.execute(`SELECT * FROM reservations WHERE id = ?`, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    const current = rows[0];

    // Only allow cancel if not already completed/cancelled/no_show
    if (['completed', 'cancelled', 'no_show'].includes(current.status)) {
      return res.status(400).json({ error: `Cannot cancel a reservation with status '${current.status}'` });
    }

    await pool.execute(`UPDATE reservations SET status = 'cancelled' WHERE id = ?`, [id]);

    await pool.execute(`
      INSERT INTO reservation_history (reservation_id, change_type, old_values, new_values, changed_by, change_reason)
      VALUES (?, 'cancelled', ?, ?, ?, ?)
    `, [id, JSON.stringify(current), JSON.stringify({ status: 'cancelled' }), changed_by, reason]);

    res.json({ success: true, message: 'Reservation cancelled' });
  } catch (error) {
    console.error('Error cancelling reservation:', error);
    res.status(500).json({ error: 'Failed to cancel reservation' });
  }
});

// GET /api/reservations/stats/summary - Reservation analytics summary
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

    const [summaryRows] = await pool.execute(`
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

    const [byTable] = await pool.execute(`
      SELECT 
        table_id,
        COUNT(*) as reservation_count,
        AVG(party_size) as avg_party_size
      FROM reservations ${dateFilter}
      GROUP BY table_id
      ORDER BY reservation_count DESC
    `, params);

    res.json({ summary: summaryRows[0], by_table: byTable });
  } catch (error) {
    console.error('Error fetching reservation statistics:', error);
    res.status(500).json({ error: 'Failed to fetch reservation statistics' });
  }
});

// GET /api/reservations/:id - Get reservation by ID (placed last to avoid shadowing specific routes)
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
      ORDER BY changed_at DESC
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

module.exports = router;
