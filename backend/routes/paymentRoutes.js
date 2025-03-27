const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");

// Add a new payment
router.post("/", paymentController.addPayment);

// Get all payments
router.get("/", paymentController.getAllPayments);

// Get a payment by ID
router.get("/:id", paymentController.getPaymentById);

// Update payment status
router.put("/:id", paymentController.updatePaymentStatus);

// Delete a payment
router.delete("/:id", paymentController.deletePayment);

module.exports = router;


console.log(paymentController); // Check if the controller is properly loaded
