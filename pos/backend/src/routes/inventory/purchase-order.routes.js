const express = require('express');
const router = express.Router();
const purchaseOrderController = require('../../controllers/inventory/purchase-order.controller');
const { purchaseOrderSchema } = require('../../validators/inventory.validator');
const validate = require('../../middleware/validate');

// Create a new purchase order
router.post('/', validate(purchaseOrderSchema), async (req, res, next) => {
  try {
    const po = await purchaseOrderController.createWithItems(req.body, req.user.id);
    res.status(201).json(po);
  } catch (error) {
    next(error);
  }
});

// Get all purchase orders
router.get('/', async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    let orders;
    try {
      orders = await purchaseOrderController.getByStatus(status, parseInt(page), parseInt(limit));
      // Ensure orders is always an array
      if (!orders || !Array.isArray(orders)) {
        console.warn('Purchase orders endpoint: orders is not an array, returning empty array');
        orders = [];
      }
    } catch (error) {
      console.error('Error in purchase orders endpoint:', error);
      orders = [];
    }
    res.json(orders);
  } catch (error) {
    console.error('Outer error in purchase orders endpoint:', error);
    // Return empty array instead of error
    res.json([]);
  }
});

// Update purchase order status
router.put('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }
    
    const order = await purchaseOrderController.updateStatus(
      req.params.id, 
      status,
      req.user.id
    );
    
    res.json(order);
  } catch (error) {
    next(error);
  }
});

// Receive items from a purchase order
router.post('/:id/receive', async (req, res, next) => {
  try {
    const { items, location_id, notes } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required' });
    }
    
    if (!location_id) {
      return res.status(400).json({ error: 'Location ID is required' });
    }
    
    const order = await purchaseOrderController.receiveItems(
      req.params.id,
      items,
      location_id,
      req.user.id,
      notes
    );
    
    res.json(order);
  } catch (error) {
    next(error);
  }
});

// Get purchase order history
router.get('/:id/history', async (req, res, next) => {
  try {
    const history = await purchaseOrderController.getHistory(req.params.id);
    res.json(history);
  } catch (error) {
    next(error);
  }
});

// Get purchase orders by supplier
router.get('/supplier/:supplierId', async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    let orders;
    try {
      orders = await purchaseOrderController.getBySupplier(
        req.params.supplierId,
        status,
        parseInt(page),
        parseInt(limit)
      );
      // Ensure orders is always an array
      if (!orders || !Array.isArray(orders)) {
        console.warn('Supplier purchase orders endpoint: orders is not an array, returning empty array');
        orders = [];
      }
    } catch (error) {
      console.error('Error in supplier purchase orders endpoint:', error);
      orders = [];
    }
    res.json(orders);
  } catch (error) {
    console.error('Outer error in supplier purchase orders endpoint:', error);
    // Return empty array instead of error
    res.json([]);
  }
});

module.exports = router;
