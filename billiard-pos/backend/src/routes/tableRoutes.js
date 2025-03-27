const express = require('express');
const router = express.Router();
const tableController = require('../controllers/tableController');
const { authenticate, authorize } = require('../middleware/auth');

// Table management
router.get('/', tableController.getAllTables);
router.get('/:id', tableController.getTableById);

// Session management
router.post('/:id/start', authenticate, authorize(['cashier', 'manager']), tableController.startTableSession);
router.post('/:id/end', authenticate, authorize(['cashier', 'manager']), tableController.endTableSession);
router.post('/transfer', authenticate, authorize(['cashier', 'manager']), tableController.transferTableSession);

module.exports = router;
