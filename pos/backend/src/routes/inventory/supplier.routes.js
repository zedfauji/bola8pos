const express = require('express');
const router = express.Router();
const { supplierSchema } = require('../../validators/inventory.validator');
const validate = require('../../middleware/validate');
const { pool } = require('../../db');

// Get all suppliers
router.get('/', async (req, res, next) => {
  try {
    const { active, search } = req.query;
    
    let query = 'SELECT * FROM suppliers';
    const params = [];
    const conditions = [];
    
    if (active === 'true' || active === 'false') {
      conditions.push('is_active = ?');
      params.push(active === 'true' ? 1 : 0);
    }
    
    if (search) {
      conditions.push('(name LIKE ? OR contact_person LIKE ? OR email LIKE ?)');
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (conditions.length) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY name';
    
    const [suppliers] = await pool.query(query, params);
    res.json(suppliers);
  } catch (error) {
    next(error);
  }
});

// Get a single supplier
router.get('/:id', async (req, res, next) => {
  try {
    const [supplier] = await pool.query(
      'SELECT * FROM suppliers WHERE id = ?',
      [req.params.id]
    );
    
    if (!supplier.length) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    
    res.json(supplier[0]);
  } catch (error) {
    next(error);
  }
});

// Create a new supplier
router.post('/', validate(supplierSchema), async (req, res, next) => {
  try {
    const { 
      name, 
      contact_person, 
      email, 
      phone, 
      address, 
      tax_id, 
      payment_terms, 
      notes, 
      is_active = true 
    } = req.body;
    
    // Generate ID from name if not provided
    const id = req.body.id || name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    
    // Insert supplier
    await pool.query(
      `INSERT INTO suppliers 
       (id, name, contact_person, email, phone, address, tax_id, payment_terms, notes, is_active) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, contact_person, email, phone, address, tax_id, payment_terms, notes, is_active]
    );
    
    // Return the created supplier
    const [newSupplier] = await pool.query(
      'SELECT * FROM suppliers WHERE id = ?',
      [id]
    );
    
    res.status(201).json(newSupplier[0]);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Supplier with this ID already exists' });
    }
    next(error);
  }
});

// Update a supplier
router.put('/:id', validate(supplierSchema.partial()), async (req, res, next) => {
  try {
    // Check if supplier exists
    const [existing] = await pool.query(
      'SELECT 1 FROM suppliers WHERE id = ?',
      [req.params.id]
    );
    
    if (!existing.length) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    
    // Update supplier
    const updateData = {};
    const fields = [
      'name', 'contact_person', 'email', 'phone', 'address', 
      'tax_id', 'payment_terms', 'notes', 'is_active'
    ];
    
    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });
    
    if (Object.keys(updateData).length > 0) {
      await pool.query(
        'UPDATE suppliers SET ? WHERE id = ?',
        [updateData, req.params.id]
      );
    }
    
    // Return the updated supplier
    const [updated] = await pool.query(
      'SELECT * FROM suppliers WHERE id = ?',
      [req.params.id]
    );
    
    res.json(updated[0]);
  } catch (error) {
    next(error);
  }
});

// Delete a supplier
router.delete('/:id', async (req, res, next) => {
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  
  try {
    // Check if supplier exists
    const [supplier] = await conn.query(
      'SELECT * FROM suppliers WHERE id = ?',
      [req.params.id]
    );
    
    if (!supplier.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Supplier not found' });
    }
    
    // Check if supplier has purchase orders
    const [purchaseOrders] = await conn.query(
      'SELECT 1 FROM purchase_orders WHERE supplier_id = ? LIMIT 1',
      [req.params.id]
    );
    
    if (purchaseOrders.length > 0) {
      await conn.rollback();
      return res.status(400).json({ 
        error: 'Cannot delete supplier with purchase orders. Please update or delete the purchase orders first.'
      });
    }
    
    // Delete the supplier
    await conn.query(
      'DELETE FROM suppliers WHERE id = ?',
      [req.params.id]
    );
    
    await conn.commit();
    res.status(204).end();
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
});

// Get purchase orders for a supplier
router.get('/:id/purchase-orders', async (req, res, next) => {
  try {
    const { status } = req.query;
    
    let query = `
      SELECT po.*, 
             CONCAT(u.first_name, ' ', u.last_name) as created_by_name,
             COUNT(poi.id) as item_count,
             SUM(poi.quantity_ordered * poi.unit_cost) as total_amount
      FROM purchase_orders po
      LEFT JOIN purchase_order_items poi ON po.id = poi.po_id
      LEFT JOIN users u ON po.created_by = u.id
      WHERE po.supplier_id = ?
    `;
    
    const params = [req.params.id];
    
    if (status) {
      query += ' AND po.status = ?';
      params.push(status);
    }
    
    query += ' GROUP BY po.id ORDER BY po.order_date DESC, po.id DESC';
    
    const [purchaseOrders] = await pool.query(query, params);
    res.json(purchaseOrders);
  } catch (error) {
    next(error);
  }
});

// Get supplier statistics
router.get('/:id/stats', async (req, res, next) => {
  try {
    // Get total purchase orders
    const [totalOrders] = await pool.query(
      'SELECT COUNT(*) as count FROM purchase_orders WHERE supplier_id = ?',
      [req.params.id]
    );
    
    // Get total spent
    const [totalSpent] = await pool.query(
      `SELECT 
         SUM(poi.quantity_ordered * poi.unit_cost) as total
       FROM purchase_order_items poi
       JOIN purchase_orders po ON poi.po_id = po.id
       WHERE po.supplier_id = ? AND po.status != 'cancelled'`,
      [req.params.id]
    );
    
    // Get orders by status
    const [ordersByStatus] = await pool.query(
      `SELECT 
         status, 
         COUNT(*) as count,
         SUM(total_amount) as total_amount
       FROM purchase_orders 
       WHERE supplier_id = ?
       GROUP BY status`,
      [req.params.id]
    );
    
    // Get recent orders
    const [recentOrders] = await pool.query(
      `SELECT 
         id, 
         po_number, 
         order_date, 
         status, 
         total_amount
       FROM purchase_orders 
       WHERE supplier_id = ?
       ORDER BY order_date DESC 
       LIMIT 5`,
      [req.params.id]
    );
    
    res.json({
      total_orders: totalOrders[0].count || 0,
      total_spent: totalSpent[0].total || 0,
      orders_by_status: ordersByStatus,
      recent_orders: recentOrders
    });
  } catch (error) {
    next(error);
  }
});

// Search suppliers
router.get('/search/:query', async (req, res, next) => {
  try {
    const searchTerm = `%${req.params.query}%`;
    
    const [suppliers] = await pool.query(
      `SELECT id, name, contact_person, email, phone 
       FROM suppliers 
       WHERE (name LIKE ? OR contact_person LIKE ? OR email LIKE ? OR phone LIKE ?)
         AND is_active = 1
       ORDER BY name
       LIMIT 10`,
      [searchTerm, searchTerm, searchTerm, searchTerm]
    );
    
    res.json(suppliers);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
