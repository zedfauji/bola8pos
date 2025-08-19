const express = require('express');
const router = express.Router();
const { categorySchema } = require('../../validators/inventory.validator');
const validate = require('../../middleware/validate');
const { pool } = require('../../db');

// Get all categories
router.get('/', async (req, res, next) => {
  try {
    const [categories] = await pool.query(
      'SELECT * FROM product_categories ORDER BY parent_id, sort_order, name'
    );
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

// Get a single category
router.get('/:id', async (req, res, next) => {
  try {
    const [category] = await pool.query(
      'SELECT * FROM product_categories WHERE id = ?',
      [req.params.id]
    );
    
    if (!category.length) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    res.json(category[0]);
  } catch (error) {
    next(error);
  }
});

// Create a new category
router.post('/', validate(categorySchema), async (req, res, next) => {
  try {
    const { name, description, parent_id, sort_order = 0, active = true } = req.body;
    
    // Check if parent exists
    if (parent_id) {
      const [parent] = await pool.query(
        'SELECT 1 FROM product_categories WHERE id = ?',
        [parent_id]
      );
      
      if (!parent.length) {
        return res.status(400).json({ error: 'Parent category not found' });
      }
    }
    
    // Generate ID from name if not provided
    const id = req.body.id || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    
    // Insert category
    await pool.query(
      'INSERT INTO product_categories (id, name, description, parent_id, sort_order, active) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name, description, parent_id || null, sort_order, active]
    );
    
    // Return the created category
    const [newCategory] = await pool.query(
      'SELECT * FROM product_categories WHERE id = ?',
      [id]
    );
    
    res.status(201).json(newCategory[0]);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Category with this ID already exists' });
    }
    next(error);
  }
});

// Update a category
router.put('/:id', validate(categorySchema.partial()), async (req, res, next) => {
  try {
    const { name, description, parent_id, sort_order, active } = req.body;
    
    // Check if category exists
    const [existing] = await pool.query(
      'SELECT 1 FROM product_categories WHERE id = ?',
      [req.params.id]
    );
    
    if (!existing.length) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Prevent circular references
    if (parent_id === req.params.id) {
      return res.status(400).json({ error: 'Category cannot be its own parent' });
    }
    
    // Check if new parent exists
    if (parent_id) {
      const [parent] = await pool.query(
        'SELECT 1 FROM product_categories WHERE id = ?',
        [parent_id]
      );
      
      if (!parent.length) {
        return res.status(400).json({ error: 'Parent category not found' });
      }
    }
    
    // Update category
    const updateData = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (parent_id !== undefined) updateData.parent_id = parent_id || null;
    if (sort_order !== undefined) updateData.sort_order = sort_order;
    if (active !== undefined) updateData.active = active;
    
    if (Object.keys(updateData).length > 0) {
      await pool.query(
        'UPDATE product_categories SET ? WHERE id = ?',
        [updateData, req.params.id]
      );
    }
    
    // Return the updated category
    const [updated] = await pool.query(
      'SELECT * FROM product_categories WHERE id = ?',
      [req.params.id]
    );
    
    res.json(updated[0]);
  } catch (error) {
    next(error);
  }
});

// Delete a category
router.delete('/:id', async (req, res, next) => {
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  
  try {
    // Check if category exists
    const [category] = await conn.query(
      'SELECT * FROM product_categories WHERE id = ?',
      [req.params.id]
    );
    
    if (!category.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Check if category has children
    const [children] = await conn.query(
      'SELECT 1 FROM product_categories WHERE parent_id = ?',
      [req.params.id]
    );
    
    if (children.length > 0) {
      await conn.rollback();
      return res.status(400).json({ 
        error: 'Cannot delete category with subcategories. Please delete or move subcategories first.' 
      });
    }
    
    // Check if category is in use by products
    const [products] = await conn.query(
      'SELECT 1 FROM products WHERE category_id = ? LIMIT 1',
      [req.params.id]
    );
    
    if (products.length > 0) {
      await conn.rollback();
      return res.status(400).json({ 
        error: 'Cannot delete category that is in use by products. Please update or delete the products first.'
      });
    }
    
    // Delete the category
    await conn.query(
      'DELETE FROM product_categories WHERE id = ?',
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

// Get category tree
router.get('/tree', async (req, res, next) => {
  try {
    const [categories] = await pool.query(
      'SELECT * FROM product_categories ORDER BY parent_id, sort_order, name'
    );
    
    // Build category tree
    const categoryMap = {};
    const categoryTree = [];
    
    // First pass: create a map of categories
    categories.forEach(category => {
      category.children = [];
      categoryMap[category.id] = category;
    });
    
    // Second pass: build the tree
    categories.forEach(category => {
      if (category.parent_id && categoryMap[category.parent_id]) {
        categoryMap[category.parent_id].children.push(category);
      } else {
        categoryTree.push(category);
      }
    });
    
    res.json(categoryTree);
  } catch (error) {
    next(error);
  }
});

// Get products in a category
router.get('/:id/products', async (req, res, next) => {
  try {
    const { includeInactive } = req.query;
    
    let query = `
      SELECT p.* 
      FROM products p
      WHERE p.category_id = ?
    `;
    
    const params = [req.params.id];
    
    if (includeInactive !== 'true') {
      query += ' AND p.is_active = 1';
    }
    
    query += ' ORDER BY p.name';
    
    const [products] = await pool.query(query, params);
    res.json(products);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
