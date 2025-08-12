const express = require('express');
const router = express.Router();
const { locationSchema } = require('../../validators/inventory.validator');
const validate = require('../../middleware/validate');

// Get all locations
router.get('/', async (req, res, next) => {
  try {
    const { type, active } = req.query;
    
    let query = 'SELECT * FROM locations';
    const params = [];
    const conditions = [];
    
    if (type) {
      conditions.push('type = ?');
      params.push(type);
    }
    
    if (active === 'true' || active === 'false') {
      conditions.push('is_active = ?');
      params.push(active === 'true' ? 1 : 0);
    }
    
    if (conditions.length) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY name';
    
    const [locations] = await pool.query(query, params);
    res.json(locations);
  } catch (error) {
    next(error);
  }
});

// Get a single location
router.get('/:id', async (req, res, next) => {
  try {
    const [location] = await pool.query(
      'SELECT * FROM locations WHERE id = ?',
      [req.params.id]
    );
    
    if (!location.length) {
      return res.status(404).json({ error: 'Location not found' });
    }
    
    res.json(location[0]);
  } catch (error) {
    next(error);
  }
});

// Create a new location
router.post('/', validate(locationSchema), async (req, res, next) => {
  try {
    const { name, type, is_active = true } = req.body;
    
    // Generate ID from name if not provided
    const id = req.body.id || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    
    // Insert location
    await pool.query(
      'INSERT INTO locations (id, name, type, is_active) VALUES (?, ?, ?, ?)',
      [id, name, type, is_active]
    );
    
    // Return the created location
    const [newLocation] = await pool.query(
      'SELECT * FROM locations WHERE id = ?',
      [id]
    );
    
    res.status(201).json(newLocation[0]);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Location with this ID already exists' });
    }
    next(error);
  }
});

// Update a location
router.put('/:id', validate(locationSchema.partial()), async (req, res, next) => {
  try {
    const { name, type, is_active } = req.body;
    
    // Check if location exists
    const [existing] = await pool.query(
      'SELECT 1 FROM locations WHERE id = ?',
      [req.params.id]
    );
    
    if (!existing.length) {
      return res.status(404).json({ error: 'Location not found' });
    }
    
    // Update location
    const updateData = {};
    if (name) updateData.name = name;
    if (type) updateData.type = type;
    if (is_active !== undefined) updateData.is_active = is_active;
    
    if (Object.keys(updateData).length > 0) {
      await pool.query(
        'UPDATE locations SET ? WHERE id = ?',
        [updateData, req.params.id]
      );
    }
    
    // Return the updated location
    const [updated] = await pool.query(
      'SELECT * FROM locations WHERE id = ?',
      [req.params.id]
    );
    
    res.json(updated[0]);
  } catch (error) {
    next(error);
  }
});

// Delete a location
router.delete('/:id', async (req, res, next) => {
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  
  try {
    // Check if location exists
    const [location] = await conn.query(
      'SELECT * FROM locations WHERE id = ?',
      [req.params.id]
    );
    
    if (!location.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Location not found' });
    }
    
    // Check if location has inventory
    const [inventory] = await conn.query(
      'SELECT 1 FROM inventory WHERE location_id = ? LIMIT 1',
      [req.params.id]
    );
    
    if (inventory.length > 0) {
      await conn.rollback();
      return res.status(400).json({ 
        error: 'Cannot delete location with inventory. Please transfer or remove the inventory first.'
      });
    }
    
    // Check if location is used in any transactions
    const [transactions] = await conn.query(
      'SELECT 1 FROM inventory_transactions WHERE from_location_id = ? OR to_location_id = ? LIMIT 1',
      [req.params.id, req.params.id]
    );
    
    if (transactions.length > 0) {
      await conn.rollback();
      return res.status(400).json({ 
        error: 'Cannot delete location with transaction history. Please archive it instead.'
      });
    }
    
    // Delete the location
    await conn.query(
      'DELETE FROM locations WHERE id = ?',
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

// Get inventory for a location
router.get('/:id/inventory', async (req, res, next) => {
  try {
    const { includeInactive } = req.query;
    
    let query = `
      SELECT 
        i.*,
        p.name as product_name,
        p.sku as product_sku,
        p.barcode as product_barcode,
        p.is_active as product_active,
        pv.id as variant_id,
        pv.name as variant_name,
        pv.sku as variant_sku,
        pv.barcode as variant_barcode,
        u.symbol as unit_symbol
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      LEFT JOIN product_variants pv ON i.variant_id = pv.id
      LEFT JOIN units u ON COALESCE(pv.unit_id, p.unit_id) = u.id
      WHERE i.location_id = ?
    `;
    
    const params = [req.params.id];
    
    if (includeInactive !== 'true') {
      query += ' AND p.is_active = 1';
    }
    
    query += ' ORDER BY p.name, pv.name';
    
    const [inventory] = await pool.query(query, params);
    res.json(inventory);
  } catch (error) {
    next(error);
  }
});

// Get location types
router.get('/types', (req, res) => {
  res.json([
    { id: 'bar', name: 'Bar' },
    { id: 'kitchen', name: 'Kitchen' },
    { id: 'storage', name: 'Storage' },
    { id: 'other', name: 'Other' }
  ]);
});

module.exports = router;
