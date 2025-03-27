const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
  amount: { type: Number, required: true },
  method: { type: String, enum: ["cash", "credit_card", "gcash", "maya"], required: true },
  status: { type: String, enum: ["completed", "failed", "pending"], default: "completed" },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Payment", paymentSchema);