/**
 * Customer Management API Routes
 * Phase 8 Track A: Advanced POS Features
 */

const express = require('express');
const { pool } = require('../db');
const router = express.Router();

// GET /api/customers - List all customers with pagination and search
router.get('/', async (req, res) => {
  try {
    const { page: pageQ = 1, limit: limitQ = 50, search = '', tier = '', active = 'true' } = req.query;
    const page = parseInt(pageQ);
    const limit = parseInt(limitQ);
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (search) {
      whereClause += ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR phone LIKE ? OR customer_number LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }
    
    if (tier) {
      whereClause += ' AND membership_tier = ?';
      params.push(tier);
    }
    
    if (active !== 'all') {
      whereClause += ' AND is_active = ?';
      params.push(active === 'true');
    }
    
    // MySQL does not allow parameter markers for LIMIT/OFFSET in prepared statements.
    // Interpolate sanitized integers for LIMIT/OFFSET, keep other params bound.
    const [customers] = await pool.execute(`
      SELECT id, customer_number, first_name, last_name, email, phone, 
             membership_tier, loyalty_points, total_visits, total_spent, 
             is_active, created_at, updated_at
      FROM customers 
      ${whereClause}
      ORDER BY created_at DESC 
      LIMIT ${Number.isFinite(limit) ? limit : 50} OFFSET ${Number.isFinite(offset) ? offset : 0}
    `, params);
    
    const [countResult] = await pool.execute(`
      SELECT COUNT(*) as total FROM customers ${whereClause}
    `, params);
    
    res.json({
      customers,
      pagination: {
        page: page,
        limit: limit,
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// POST /api/customers/:id/points - Adjust loyalty points (award/redeem)
router.post('/:id/points', async (req, res) => {
  try {
    const { id } = req.params;
    let { points, reason = '', type = null } = req.body || {};
    const pts = Number(points);
    if (!Number.isFinite(pts) || pts === 0) {
      return res.status(400).json({ error: 'points must be a non-zero number' });
    }

    // Fetch current points
    const [rows] = await pool.execute(`SELECT loyalty_points FROM customers WHERE id = ?`, [id]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
    const current = Number(rows[0].loyalty_points || 0);

    // Determine transaction type by sign or explicit type
    const txnType = type && String(type).toLowerCase() === 'redeem' ? 'redeemed' : (pts > 0 ? 'earned' : 'redeemed');

    // If redeeming, ensure sufficient balance
    if (txnType === 'redeemed' && current < Math.abs(pts)) {
      return res.status(400).json({ error: 'Insufficient loyalty points' });
    }

    // Update balance
    await pool.execute(`UPDATE customers SET loyalty_points = loyalty_points + ? WHERE id = ?`, [pts, id]);

    // Record transaction (store negative points for redeemed to keep consistency with existing route)
    const storePoints = txnType === 'redeemed' ? -Math.abs(pts) : Math.abs(pts);
    await pool.execute(`
      INSERT INTO loyalty_transactions (customer_id, transaction_type, points, description)
      VALUES (?, ?, ?, ?)
    `, [id, txnType, storePoints, reason || (txnType === 'earned' ? 'Points awarded' : 'Points redeemed')]);

    res.json({ success: true, new_balance: current + pts });
  } catch (error) {
    console.error('Error adjusting loyalty points:', error);
    res.status(500).json({ error: 'Failed to adjust loyalty points' });
  }
});

// GET /api/customers/stats - Aggregate stats for loyalty dashboard
router.get('/stats', async (req, res) => {
  try {
    // Basic counts
    const [counts] = await pool.execute(`
      SELECT 
        COUNT(*) AS total_members,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) AS active_members,
        COUNT(CASE WHEN membership_tier = 'bronze' THEN 1 END) AS bronze_members,
        COUNT(CASE WHEN membership_tier = 'silver' THEN 1 END) AS silver_members,
        COUNT(CASE WHEN membership_tier = 'gold' THEN 1 END) AS gold_members,
        COUNT(CASE WHEN membership_tier = 'platinum' THEN 1 END) AS platinum_members
      FROM customers
    `);

    // Points issued (earned) and redeemed from loyalty_transactions
    const [pointsAgg] = await pool.execute(`
      SELECT 
        COALESCE(SUM(CASE WHEN transaction_type = 'earned' THEN points END), 0) AS points_issued,
        COALESCE(ABS(SUM(CASE WHEN transaction_type = 'redeemed' THEN points END)), 0) AS points_redeemed
      FROM loyalty_transactions
    `);

    const result = {
      total_members: counts[0].total_members || 0,
      active_members: counts[0].active_members || 0,
      bronze_members: counts[0].bronze_members || 0,
      silver_members: counts[0].silver_members || 0,
      gold_members: counts[0].gold_members || 0,
      platinum_members: counts[0].platinum_members || 0,
      points_issued: pointsAgg[0].points_issued || 0,
      points_redeemed: pointsAgg[0].points_redeemed || 0,
    };

    res.json(result);
  } catch (error) {
    console.error('Error fetching /api/customers/stats:', error);
    res.status(500).json({ error: 'Failed to fetch customer stats' });
  }
});

// GET /api/customers/stats/summary - Customer analytics summary
router.get('/stats/summary', async (req, res) => {
  try {
    const [stats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_customers,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_customers,
        COUNT(CASE WHEN membership_tier = 'bronze' THEN 1 END) as bronze_members,
        COUNT(CASE WHEN membership_tier = 'silver' THEN 1 END) as silver_members,
        COUNT(CASE WHEN membership_tier = 'gold' THEN 1 END) as gold_members,
        COUNT(CASE WHEN membership_tier = 'platinum' THEN 1 END) as platinum_members,
        AVG(total_spent) as avg_spent_per_customer,
        SUM(loyalty_points) as total_loyalty_points
      FROM customers
    `);
    
    res.json(stats[0]);
  } catch (error) {
    console.error('Error fetching customer stats:', error);
    res.status(500).json({ error: 'Failed to fetch customer statistics' });
  }
});

// GET /api/customers/:id - Get customer by ID with visit history
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [customers] = await pool.execute(`
      SELECT * FROM customers WHERE id = ?
    `, [id]);
    
    if (customers.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    // Get recent visits
    const [visits] = await pool.execute(`
      SELECT * FROM customer_visits 
      WHERE customer_id = ? 
      ORDER BY visit_date DESC 
      LIMIT 10
    `, [id]);
    
    // Get loyalty transactions
    const [loyaltyTransactions] = await pool.execute(`
      SELECT * FROM loyalty_transactions 
      WHERE customer_id = ? 
      ORDER BY created_at DESC 
      LIMIT 20
    `, [id]);
    
    // Get preferences
    const [preferences] = await pool.execute(`
      SELECT preference_key, preference_value FROM customer_preferences 
      WHERE customer_id = ?
    `, [id]);
    
    const customer = customers[0];
    customer.recent_visits = visits;
    customer.loyalty_transactions = loyaltyTransactions;
    customer.preferences = preferences.reduce((acc, pref) => {
      acc[pref.preference_key] = pref.preference_value;
      return acc;
    }, {});
    
    res.json(customer);
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

// POST /api/customers - Create new customer
router.post('/', async (req, res) => {
  try {
    const {
      first_name, last_name, email, phone, date_of_birth,
      membership_tier = 'bronze', notes
    } = req.body;
    
    if (!first_name || !last_name) {
      return res.status(400).json({ error: 'First name and last name are required' });
    }
    
    // Generate customer number
    const [lastCustomer] = await pool.execute(`
      SELECT customer_number FROM customers 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    let customerNumber = 'CUST001';
    if (lastCustomer.length > 0) {
      const lastNum = parseInt(lastCustomer[0].customer_number.replace('CUST', ''));
      customerNumber = `CUST${String(lastNum + 1).padStart(3, '0')}`;
    }
    
    await pool.execute(`
      INSERT INTO customers (customer_number, first_name, last_name, email, phone, 
                           date_of_birth, membership_tier, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [customerNumber, first_name, last_name, email, phone, date_of_birth, membership_tier, notes]);

    // For UUID primary keys, insertId is not populated. Fetch by unique customer_number.
    const [newCustomer] = await pool.execute(`
      SELECT * FROM customers WHERE customer_number = ?
    `, [customerNumber]);

    res.status(201).json(newCustomer[0]);
  } catch (error) {
    console.error('Error creating customer:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Email or phone already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create customer' });
    }
  }
});

// PUT /api/customers/:id - Update customer
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      first_name, last_name, email, phone, date_of_birth,
      membership_tier, notes, is_active
    } = req.body;
    
    const [result] = await pool.execute(`
      UPDATE customers 
      SET first_name = ?, last_name = ?, email = ?, phone = ?, 
          date_of_birth = ?, membership_tier = ?, notes = ?, is_active = ?
      WHERE id = ?
    `, [first_name, last_name, email, phone, date_of_birth, membership_tier, notes, is_active, id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    const [updatedCustomer] = await pool.execute(`
      SELECT * FROM customers WHERE id = ?
    `, [id]);
    
    res.json(updatedCustomer[0]);
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// POST /api/customers/:id/visit - Record a customer visit
router.post('/:id/visit', async (req, res) => {
  try {
    const { id } = req.params;
    const { table_id, duration_minutes, amount_spent, notes } = req.body;
    
    // Calculate loyalty points (1 point per dollar spent)
    const points_earned = Math.floor(amount_spent || 0);
    
    await pool.execute(`
      INSERT INTO customer_visits (customer_id, table_id, duration_minutes, amount_spent, points_earned, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, table_id, duration_minutes, amount_spent, points_earned, notes]);
    
    // Update customer totals
    await pool.execute(`
      UPDATE customers 
      SET total_visits = total_visits + 1,
          total_spent = total_spent + ?,
          loyalty_points = loyalty_points + ?
      WHERE id = ?
    `, [amount_spent || 0, points_earned, id]);
    
    // Record loyalty transaction
    if (points_earned > 0) {
      await pool.execute(`
        INSERT INTO loyalty_transactions (customer_id, transaction_type, points, description)
        VALUES (?, 'earned', ?, ?)
      `, [id, points_earned, `Visit points earned for $${amount_spent}`]);
    }
    
    res.json({ success: true, points_earned });
  } catch (error) {
    console.error('Error recording customer visit:', error);
    res.status(500).json({ error: 'Failed to record visit' });
  }
});

// POST /api/customers/:id/loyalty/redeem - Redeem loyalty points
router.post('/:id/loyalty/redeem', async (req, res) => {
  try {
    const { id } = req.params;
    const { points, description } = req.body;
    
    if (!points || points <= 0) {
      return res.status(400).json({ error: 'Invalid points amount' });
    }
    
    // Check customer has enough points
    const [customer] = await pool.execute(`
      SELECT loyalty_points FROM customers WHERE id = ?
    `, [id]);
    
    if (customer.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    if (customer[0].loyalty_points < points) {
      return res.status(400).json({ error: 'Insufficient loyalty points' });
    }
    
    // Deduct points
    await pool.execute(`
      UPDATE customers SET loyalty_points = loyalty_points - ? WHERE id = ?
    `, [points, id]);
    
    // Record transaction
    await pool.execute(`
      INSERT INTO loyalty_transactions (customer_id, transaction_type, points, description)
      VALUES (?, 'redeemed', ?, ?)
    `, [id, -points, description || 'Points redeemed']);
    
    res.json({ success: true, points_redeemed: points });
  } catch (error) {
    console.error('Error redeeming loyalty points:', error);
    res.status(500).json({ error: 'Failed to redeem points' });
  }
});

// GET /api/customers/stats - Aggregate stats for loyalty dashboard
router.get('/stats', async (req, res) => {
  try {
    // Basic counts
    const [counts] = await pool.execute(`
      SELECT 
        COUNT(*) AS total_members,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) AS active_members,
        COUNT(CASE WHEN membership_tier = 'bronze' THEN 1 END) AS bronze_members,
        COUNT(CASE WHEN membership_tier = 'silver' THEN 1 END) AS silver_members,
        COUNT(CASE WHEN membership_tier = 'gold' THEN 1 END) AS gold_members,
        COUNT(CASE WHEN membership_tier = 'platinum' THEN 1 END) AS platinum_members
      FROM customers
    `);

    // Points issued (earned) and redeemed from loyalty_transactions
    const [pointsAgg] = await pool.execute(`
      SELECT 
        COALESCE(SUM(CASE WHEN transaction_type = 'earned' THEN points END), 0) AS points_issued,
        COALESCE(ABS(SUM(CASE WHEN transaction_type = 'redeemed' THEN points END)), 0) AS points_redeemed
      FROM loyalty_transactions
    `);

    const result = {
      total_members: counts[0].total_members || 0,
      active_members: counts[0].active_members || 0,
      bronze_members: counts[0].bronze_members || 0,
      silver_members: counts[0].silver_members || 0,
      gold_members: counts[0].gold_members || 0,
      platinum_members: counts[0].platinum_members || 0,
      points_issued: pointsAgg[0].points_issued || 0,
      points_redeemed: pointsAgg[0].points_redeemed || 0,
    };

    res.json(result);
  } catch (error) {
    console.error('Error fetching /api/customers/stats:', error);
    res.status(500).json({ error: 'Failed to fetch customer stats' });
  }
});

// GET /api/customers/stats/summary - Customer analytics summary
router.get('/stats/summary', async (req, res) => {
  try {
    const [stats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_customers,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_customers,
        COUNT(CASE WHEN membership_tier = 'bronze' THEN 1 END) as bronze_members,
        COUNT(CASE WHEN membership_tier = 'silver' THEN 1 END) as silver_members,
        COUNT(CASE WHEN membership_tier = 'gold' THEN 1 END) as gold_members,
        COUNT(CASE WHEN membership_tier = 'platinum' THEN 1 END) as platinum_members,
        AVG(total_spent) as avg_spent_per_customer,
        SUM(loyalty_points) as total_loyalty_points
      FROM customers
    `);
    
    res.json(stats[0]);
  } catch (error) {
    console.error('Error fetching customer stats:', error);
    res.status(500).json({ error: 'Failed to fetch customer statistics' });
  }
});

module.exports = router;
