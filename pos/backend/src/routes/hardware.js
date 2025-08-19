/**
 * Hardware Integration API Routes
 * Phase 8 Track B: Hardware Integration
 */

const express = require('express');
const { pool } = require('../db');
const router = express.Router();

// GET /api/hardware/devices - List all hardware devices
router.get('/devices', async (req, res) => {
  try {
    const { type, enabled, online } = req.query;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (type) {
      whereClause += ' AND device_type = ?';
      params.push(type);
    }
    
    if (enabled !== undefined) {
      whereClause += ' AND is_enabled = ?';
      params.push(enabled === 'true');
    }
    
    if (online !== undefined) {
      whereClause += ' AND is_online = ?';
      params.push(online === 'true');
    }
    
    const [devices] = await pool.execute(`
      SELECT * FROM hardware_devices 
      ${whereClause}
      ORDER BY device_type, device_name
    `, params);
    
    res.json({ devices });
  } catch (error) {
    console.error('Error fetching hardware devices:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// POST /api/hardware/devices - Register new hardware device
router.post('/devices', async (req, res) => {
  try {
    const {
      device_type, device_name, device_model, connection_type,
      connection_string, device_config, is_enabled = true
    } = req.body;
    
    if (!device_type || !device_name || !connection_type || !connection_string) {
      return res.status(400).json({ error: 'Missing required device information' });
    }
    
    const [result] = await pool.execute(`
      INSERT INTO hardware_devices (device_type, device_name, device_model, 
                                   connection_type, connection_string, device_config, is_enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [device_type, device_name, device_model, connection_type, connection_string, 
        JSON.stringify(device_config || {}), is_enabled]);
    
    const [newDevice] = await pool.execute(`
      SELECT * FROM hardware_devices WHERE id = ?
    `, [result.insertId]);
    
    res.status(201).json(newDevice[0]);
  } catch (error) {
    console.error('Error registering device:', error);
    res.status(500).json({ error: 'Failed to register device' });
  }
});

// PUT /api/hardware/devices/:id - Update hardware device
router.put('/devices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      device_name, device_model, connection_type, connection_string,
      device_config, is_enabled, is_online
    } = req.body;
    
    const [result] = await pool.execute(`
      UPDATE hardware_devices 
      SET device_name = ?, device_model = ?, connection_type = ?, 
          connection_string = ?, device_config = ?, is_enabled = ?, is_online = ?
      WHERE id = ?
    `, [device_name, device_model, connection_type, connection_string,
        JSON.stringify(device_config || {}), is_enabled, is_online, id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    const [updatedDevice] = await pool.execute(`
      SELECT * FROM hardware_devices WHERE id = ?
    `, [id]);
    
    res.json(updatedDevice[0]);
  } catch (error) {
    console.error('Error updating device:', error);
    res.status(500).json({ error: 'Failed to update device' });
  }
});

// POST /api/hardware/devices/:id/ping - Test device connectivity
router.post('/devices/:id/ping', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Update last ping timestamp
    await pool.execute(`
      UPDATE hardware_devices 
      SET last_ping = CURRENT_TIMESTAMP, is_online = true
      WHERE id = ?
    `, [id]);
    
    // In a real implementation, this would actually test the device connection
    // For now, we'll simulate a successful ping
    res.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error pinging device:', error);
    res.status(500).json({ error: 'Failed to ping device' });
  }
});

// GET /api/hardware/print-jobs - List print jobs
router.get('/print-jobs', async (req, res) => {
  try {
    const { printer_id, status, limit = 50 } = req.query;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (printer_id) {
      whereClause += ' AND printer_id = ?';
      params.push(printer_id);
    }
    
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    
    const [jobs] = await pool.execute(`
      SELECT pj.*, hd.device_name as printer_name
      FROM print_jobs pj
      LEFT JOIN hardware_devices hd ON pj.printer_id = hd.id
      ${whereClause}
      ORDER BY priority ASC, created_at ASC
      LIMIT ?
    `, [...params, parseInt(limit)]);
    
    res.json({ jobs });
  } catch (error) {
    console.error('Error fetching print jobs:', error);
    res.status(500).json({ error: 'Failed to fetch print jobs' });
  }
});

// POST /api/hardware/print-jobs - Create new print job
router.post('/print-jobs', async (req, res) => {
  try {
    const {
      printer_id, job_type, content, priority = 5, metadata = {}
    } = req.body;
    
    if (!printer_id || !job_type || !content) {
      return res.status(400).json({ error: 'Missing required print job information' });
    }
    
    // Verify printer exists and is enabled
    const [printer] = await pool.execute(`
      SELECT id FROM hardware_devices 
      WHERE id = ? AND device_type = 'printer' AND is_enabled = true
    `, [printer_id]);
    
    if (printer.length === 0) {
      return res.status(400).json({ error: 'Printer not found or disabled' });
    }
    
    const [result] = await pool.execute(`
      INSERT INTO print_jobs (printer_id, job_type, content, priority, metadata)
      VALUES (?, ?, ?, ?, ?)
    `, [printer_id, job_type, content, priority, JSON.stringify(metadata)]);
    
    const [newJob] = await pool.execute(`
      SELECT * FROM print_jobs WHERE id = ?
    `, [result.insertId]);
    
    res.status(201).json(newJob[0]);
  } catch (error) {
    console.error('Error creating print job:', error);
    res.status(500).json({ error: 'Failed to create print job' });
  }
});

// PUT /api/hardware/print-jobs/:id/status - Update print job status
router.put('/print-jobs/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, error_message } = req.body;
    
    const validStatuses = ['pending', 'printing', 'completed', 'failed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    let updateFields = 'status = ?';
    const params = [status];
    
    if (status === 'printing') {
      updateFields += ', started_at = CURRENT_TIMESTAMP';
    } else if (['completed', 'failed', 'cancelled'].includes(status)) {
      updateFields += ', completed_at = CURRENT_TIMESTAMP';
    }
    
    if (error_message) {
      updateFields += ', error_message = ?';
      params.push(error_message);
    }
    
    params.push(id);
    
    const [result] = await pool.execute(`
      UPDATE print_jobs SET ${updateFields} WHERE id = ?
    `, params);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Print job not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating print job status:', error);
    res.status(500).json({ error: 'Failed to update print job status' });
  }
});

// GET /api/hardware/payment-transactions - List payment transactions
router.get('/payment-transactions', async (req, res) => {
  try {
    const { terminal_id, status, limit = 50 } = req.query;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (terminal_id) {
      whereClause += ' AND terminal_id = ?';
      params.push(terminal_id);
    }
    
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    
    const [transactions] = await pool.execute(`
      SELECT pt.*, hd.device_name as terminal_name
      FROM payment_transactions pt
      LEFT JOIN hardware_devices hd ON pt.terminal_id = hd.id
      ${whereClause}
      ORDER BY processed_at DESC
      LIMIT ?
    `, [...params, parseInt(limit)]);
    
    res.json({ transactions });
  } catch (error) {
    console.error('Error fetching payment transactions:', error);
    res.status(500).json({ error: 'Failed to fetch payment transactions' });
  }
});

// POST /api/hardware/payment-transactions - Process payment transaction
router.post('/payment-transactions', async (req, res) => {
  try {
    const {
      terminal_id, bill_id, transaction_type, payment_method, amount,
      currency_code = 'USD'
    } = req.body;
    
    if (!terminal_id || !transaction_type || !payment_method || !amount) {
      return res.status(400).json({ error: 'Missing required transaction information' });
    }
    
    // Verify terminal exists and is enabled
    const [terminal] = await pool.execute(`
      SELECT id FROM hardware_devices 
      WHERE id = ? AND device_type = 'payment_terminal' AND is_enabled = true
    `, [terminal_id]);
    
    if (terminal.length === 0) {
      return res.status(400).json({ error: 'Payment terminal not found or disabled' });
    }
    
    // Simulate payment processing (in real implementation, this would communicate with actual terminal)
    const isApproved = Math.random() > 0.1; // 90% success rate for demo
    const status = isApproved ? 'approved' : 'declined';
    const auth_code = isApproved ? `AUTH${Math.random().toString(36).substr(2, 8).toUpperCase()}` : null;
    const reference_number = `REF${Date.now()}`;
    
    const [result] = await pool.execute(`
      INSERT INTO payment_transactions (terminal_id, bill_id, transaction_type, payment_method, 
                                       amount, currency_code, auth_code, reference_number, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [terminal_id, bill_id, transaction_type, payment_method, amount, currency_code, 
        auth_code, reference_number, status]);
    
    const [newTransaction] = await pool.execute(`
      SELECT * FROM payment_transactions WHERE id = ?
    `, [result.insertId]);
    
    res.status(201).json(newTransaction[0]);
  } catch (error) {
    console.error('Error processing payment transaction:', error);
    res.status(500).json({ error: 'Failed to process payment transaction' });
  }
});

// GET /api/hardware/rfid/cards - List RFID cards
router.get('/rfid/cards', async (req, res) => {
  try {
    const { card_type, active, linked_table } = req.query;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (card_type) {
      whereClause += ' AND card_type = ?';
      params.push(card_type);
    }
    
    if (active !== undefined) {
      whereClause += ' AND is_active = ?';
      params.push(active === 'true');
    }
    
    if (linked_table) {
      whereClause += ' AND linked_table = ?';
      params.push(linked_table);
    }
    
    const [cards] = await pool.execute(`
      SELECT * FROM rfid_cards 
      ${whereClause}
      ORDER BY created_at DESC
    `, params);
    
    res.json({ cards });
  } catch (error) {
    console.error('Error fetching RFID cards:', error);
    res.status(500).json({ error: 'Failed to fetch RFID cards' });
  }
});

// POST /api/hardware/rfid/cards - Register new RFID card
router.post('/rfid/cards', async (req, res) => {
  try {
    const {
      card_uid, card_type, linked_id, linked_table, access_level = 1,
      valid_from, valid_until
    } = req.body;
    
    if (!card_uid || !card_type) {
      return res.status(400).json({ error: 'Card UID and type are required' });
    }
    
    const [result] = await pool.execute(`
      INSERT INTO rfid_cards (card_uid, card_type, linked_id, linked_table, 
                             access_level, valid_from, valid_until)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [card_uid, card_type, linked_id, linked_table, access_level, valid_from, valid_until]);
    
    const [newCard] = await pool.execute(`
      SELECT * FROM rfid_cards WHERE id = ?
    `, [result.insertId]);
    
    res.status(201).json(newCard[0]);
  } catch (error) {
    console.error('Error registering RFID card:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Card UID already exists' });
    } else {
      res.status(500).json({ error: 'Failed to register RFID card' });
    }
  }
});

// POST /api/hardware/rfid/access - Log RFID access attempt
router.post('/rfid/access', async (req, res) => {
  try {
    const {
      card_uid, reader_id, access_type, action_description,
      ip_address, user_agent
    } = req.body;
    
    if (!card_uid || !access_type) {
      return res.status(400).json({ error: 'Card UID and access type are required' });
    }
    
    // Look up card
    const [cards] = await pool.execute(`
      SELECT * FROM rfid_cards WHERE card_uid = ? AND is_active = true
    `, [card_uid]);
    
    const success = cards.length > 0;
    const card_id = success ? cards[0].id : null;
    
    // Log access attempt
    await pool.execute(`
      INSERT INTO rfid_access_log (card_id, card_uid, reader_id, access_type, 
                                  action_description, ip_address, user_agent, success)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [card_id, card_uid, reader_id, access_type, action_description, 
        ip_address, user_agent, success]);
    
    if (success) {
      res.json({ 
        success: true, 
        card: cards[0],
        message: 'Access granted'
      });
    } else {
      res.status(401).json({ 
        success: false, 
        message: 'Access denied - card not found or inactive'
      });
    }
  } catch (error) {
    console.error('Error logging RFID access:', error);
    res.status(500).json({ error: 'Failed to log RFID access' });
  }
});

// GET /api/hardware/stats/summary - Hardware status summary
router.get('/stats/summary', async (req, res) => {
  try {
    const [deviceStats] = await pool.execute(`
      SELECT 
        device_type,
        COUNT(*) as total,
        COUNT(CASE WHEN is_enabled = 1 THEN 1 END) as enabled,
        COUNT(CASE WHEN is_online = 1 THEN 1 END) as online
      FROM hardware_devices
      GROUP BY device_type
    `);
    
    const [printStats] = await pool.execute(`
      SELECT 
        status,
        COUNT(*) as count
      FROM print_jobs
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY status
    `);
    
    const [paymentStats] = await pool.execute(`
      SELECT 
        status,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM payment_transactions
      WHERE processed_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY status
    `);
    
    res.json({
      devices: deviceStats,
      print_jobs_24h: printStats,
      payments_24h: paymentStats
    });
  } catch (error) {
    console.error('Error fetching hardware stats:', error);
    res.status(500).json({ error: 'Failed to fetch hardware statistics' });
  }
});

module.exports = router;
