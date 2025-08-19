const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../middleware/auth');
const { pool } = require('../../db');

// Import route modules
const productRoutes = require('./product.routes');
const inventoryRoutes = require('./inventory.routes');
const purchaseOrderRoutes = require('./purchase-order.routes');
const categoryRoutes = require('./category.routes');
const locationRoutes = require('./location.routes');
const supplierRoutes = require('./supplier.routes');

// Mount routes with authentication and authorization
router.use('/products', authenticate, authorize(['admin', 'manager', 'inventory']), productRoutes);
router.use('/', authenticate, authorize(['admin', 'manager', 'inventory']), inventoryRoutes);
router.use('/purchase-orders', authenticate, authorize(['admin', 'manager', 'purchasing']), purchaseOrderRoutes);
router.use('/categories', authenticate, authorize(['admin', 'manager']), categoryRoutes);
router.use('/locations', authenticate, authorize(['admin', 'manager']), locationRoutes);
router.use('/suppliers', authenticate, authorize(['admin', 'manager', 'purchasing']), supplierRoutes);

// Expose menu_item_product_map at root: /api/inventory/map
router.get('/map', authenticate, authorize(['admin', 'manager', 'inventory']), async (req, res, next) => {
  try {
    const { menu_item_id } = req.query;
    let sql = `SELECT * FROM menu_item_product_map`;
    const params = [];
    if (menu_item_id) {
      sql += ` WHERE menu_item_id = ?`;
      params.push(menu_item_id);
    }
    sql += ` ORDER BY menu_item_id`;
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/map', authenticate, authorize(['admin', 'manager', 'inventory']), async (req, res, next) => {
  try {
    const { id, menu_item_id, product_id, variant_id = null, qty_per_item = 1, unit_id = null, notes = '' } = req.body || {};
    if (!menu_item_id || !product_id) return res.status(400).json({ error: 'menu_item_id and product_id are required' });
    if (id) {
      await pool.query(
        `UPDATE menu_item_product_map SET menu_item_id = ?, product_id = ?, variant_id = ?, qty_per_item = ?, unit_id = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [menu_item_id, product_id, variant_id, qty_per_item, unit_id, notes, id]
      );
      const [rows] = await pool.query(`SELECT * FROM menu_item_product_map WHERE id = ?`, [id]);
      return res.json(rows[0] || null);
    } else {
      const [result] = await pool.query(
        `INSERT INTO menu_item_product_map (menu_item_id, product_id, variant_id, qty_per_item, unit_id, notes) VALUES (?,?,?,?,?,?)`,
        [menu_item_id, product_id, variant_id, qty_per_item, unit_id, notes]
      );
      const [rows] = await pool.query(`SELECT * FROM menu_item_product_map WHERE id = ?`, [result.insertId]);
      return res.status(201).json(rows[0] || null);
    }
  } catch (err) { next(err); }
});

router.delete('/map/:id', authenticate, authorize(['admin', 'manager', 'inventory']), async (req, res, next) => {
  try {
    const { id } = req.params;
    await pool.query(`DELETE FROM menu_item_product_map WHERE id = ?`, [id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
