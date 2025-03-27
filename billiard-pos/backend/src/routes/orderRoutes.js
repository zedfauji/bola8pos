const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/', authenticate, authorize(['waiter', 'cashier', 'manager']), orderController.createOrder);
router.get('/:id', authenticate, orderController.getOrderById);
router.put('/:id/status', authenticate, authorize(['waiter', 'cashier', 'manager', 'kitchen']), orderController.updateOrderStatus);

module.exports = router;
