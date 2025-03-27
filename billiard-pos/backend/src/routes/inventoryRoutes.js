const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, inventoryController.getAllInventoryItems);
router.get('/:id', authenticate, inventoryController.getInventoryItemById);
router.post('/', authenticate, authorize(['manager']), inventoryController.createInventoryItem);
router.put('/:id', authenticate, authorize(['manager']), inventoryController.updateInventoryItem);
router.post('/movements', authenticate, authorize(['manager', 'cashier']), inventoryController.recordInventoryMovement);

module.exports = router;
