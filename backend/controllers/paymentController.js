const Payment = require("../models/paymentModel");

// Process payment
exports.processPayment = async (req, res) => {
  try {
    const { orderId, amount, method } = req.body;
    const payment = new Payment({ orderId, amount, method, status: "completed" });
    await payment.save();
    res.status(201).json(payment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Get payment history
exports.getPaymentHistory = async (req, res) => {
  try {
    const payments = await Payment.find().populate("orderId");
    res.json(payments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};