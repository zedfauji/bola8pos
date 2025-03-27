const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");

// Get all payments
router.get("/", paymentController.getAllPayments);

// Get a specific payment by order ID
router.get("/order/:orderId", paymentController.getPaymentByOrder);

// Create a new payment record
router.post("/", paymentController.createPayment);

// Update a payment (e.g., mark as completed)
router.put("/:id", paymentController.updatePayment);

// Delete a payment (if needed)
router.delete("/:id", paymentController.deletePayment);

module.exports = router;