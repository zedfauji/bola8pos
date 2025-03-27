const Payment = require("../models/Payment");

// Add a new payment
const addPayment = async (req, res) => {
  const { orderId, amount, paymentMethod, paymentStatus, transactionId } = req.body;

  try {
    const newPayment = new Payment({
      orderId,
      amount,
      paymentMethod,
      paymentStatus,
      transactionId,
    });

    await newPayment.save();
    res.status(201).json({ message: "Payment added successfully", payment: newPayment });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to add payment" });
  }
};

// Get all payments
const getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find().populate("orderId");
    res.status(200).json(payments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to retrieve payments" });
  }
};

// Get payment by ID
const getPaymentById = async (req, res) => {
  const { id } = req.params;

  try {
    const payment = await Payment.findById(id).populate("orderId");
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }
    res.status(200).json(payment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to retrieve payment" });
  }
};

// Update payment status
const updatePaymentStatus = async (req, res) => {
  const { id } = req.params;
  const { paymentStatus } = req.body;

  try {
    const updatedPayment = await Payment.findByIdAndUpdate(
      id,
      { paymentStatus },
      { new: true }
    );

    if (!updatedPayment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    res.status(200).json({ message: "Payment status updated", payment: updatedPayment });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update payment status" });
  }
};

// Delete payment
const deletePayment = async (req, res) => {
  const { id } = req.params;

  try {
    const deletedPayment = await Payment.findByIdAndDelete(id);
    if (!deletedPayment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    res.status(200).json({ message: "Payment deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to delete payment" });
  }
};

module.exports = {
  addPayment,
  getAllPayments,
  getPaymentById,
  updatePaymentStatus,
  deletePayment,
};
