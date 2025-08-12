const express = require('express');
const router = express.Router();
const inventoryController = require('../../controllers/inventory/inventory.controller');
const { inventoryAdjustmentSchema } = require('../../validators/inventory.validator');
const validate = require('../../middleware/validate');
const { pool } = require('../../db');

// Get inventory by location
router.get('/location/:locationId', async (req, res, next) => {
  try {
    const { includeInactive } = req.query;
    const inventory = await inventoryController.getByLocation(
      req.params.locationId,
      includeInactive === 'true'
    );
    res.json(inventory);
  } catch (error) {
    next(error);
  }
});

// Get inventory for a specific product
router.get('/product/:productId', async (req, res, next) => {
  try {
    const { variantId, locationId } = req.query;
    const inventory = await inventoryController.getByProduct(
      req.params.productId,
      variantId,
      locationId
    );
    res.json(inventory);
  } catch (error) {
    next(error);
  }
});

// Adjust inventory (add/remove stock)
router.post('/adjust', validate(inventoryAdjustmentSchema), async (req, res, next) => {
  try {
    const adjustment = await inventoryController.adjustInventory(
      req.body,
      req.user.id
    );
    res.status(201).json(adjustment);
  } catch (error) {
    next(error);
  }
});

// Transfer inventory between locations
router.post('/transfer', async (req, res, next) => {
  try {
    const transfer = await inventoryController.transferInventory(
      req.body,
      req.user.id
    );
    res.status(201).json(transfer);
  } catch (error) {
    next(error);
  }
});

// Get inventory history for a product
router.get('/history/product/:productId', async (req, res, next) => {
  try {
    const { variantId, locationId, limit = 100, offset = 0 } = req.query;
    const history = await inventoryController.getHistory(
      req.params.productId,
      variantId,
      locationId,
      parseInt(limit),
      parseInt(offset)
    );
    res.json(history);
  } catch (error) {
    next(error);
  }
});

// Get low stock items
router.get('/low-stock', async (req, res, next) => {
  try {
    const { threshold = 10 } = req.query;
    const lowStock = await inventoryController.getLowStock(parseInt(threshold));
    res.json(lowStock);
  } catch (error) {
    next(error);
  }
});

// Get inventory snapshot (current stock levels)
router.get('/snapshot', async (req, res, next) => {
  try {
    const { locationId, categoryId, threshold } = req.query;
    
    let query = `
      SELECT 
        i.*,
        p.name as product_name,
        p.sku as product_sku,
        p.barcode as product_barcode,
        p.category_id,
        pc.name as category_name,
        pv.id as variant_id,
        pv.name as variant_name,
        pv.sku as variant_sku,
        pv.barcode as variant_barcode,
        l.name as location_name,
        u.symbol as unit_symbol
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      LEFT JOIN product_variants pv ON i.variant_id = pv.id
      JOIN product_categories pc ON p.category_id = pc.id
      JOIN locations l ON i.location_id = l.id
      LEFT JOIN units u ON COALESCE(pv.unit_id, p.unit_id) = u.id
      WHERE p.is_active = 1
    `;
    
    const params = [];
    
    if (locationId) {
      query += ' AND i.location_id = ?';
      params.push(locationId);
    }
    
    if (categoryId) {
      query += ' AND p.category_id = ?';
      params.push(categoryId);
    }
    
    if (threshold) {
      query += ' AND i.quantity <= ?';
      params.push(parseInt(threshold));
    }
    
    query += ' ORDER BY p.name, pv.name, l.name';
    
    const [inventory] = await pool.query(query, params);
    res.json(inventory);
  } catch (error) {
    next(error);
  }
});

// Map menu items to inventory products (CRUD - minimal)
// List mappings, optionally filter by menu_item_id
router.get('/map', async (req, res, next) => {
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

// Create or update a mapping
router.post('/map', async (req, res, next) => {
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

// Delete a mapping
router.delete('/map/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await pool.query(`DELETE FROM menu_item_product_map WHERE id = ?`, [id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
