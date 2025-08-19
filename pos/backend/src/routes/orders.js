const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticate } = require('../middleware/auth');
const { sensitiveOpLimiter } = require('../middleware/rateLimiter');

// Health check endpoint
router.get('/health', (_req, res) => res.json({ ok: true, service: 'orders' }));

// Apply authentication to all order routes
router.use(authenticate);

// List orders with pagination and filters
router.get('/', orderController.listOrders);

// Get order by ID
router.get('/:id', orderController.getOrderById);

// Create a new order with inventory validation
router.post('/', orderController.createOrder);

// Complete an order and update inventory
router.post('/:id/complete', orderController.completeOrder);

// Cancel an order and restore inventory if needed
// Apply rate limiting to sensitive operations
router.post('/:id/cancel', sensitiveOpLimiter, orderController.cancelOrder);

module.exports = router;
