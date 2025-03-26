const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({
    tableNumber: Number,
    items: [{ name: String, quantity: Number, price: Number }],
    total: Number,
    status: { type: String, enum: ["pending", "completed"], default: "pending" },
    paymentStatus: { type: String, enum: ["unpaid", "paid"], default: "unpaid" }
}, { timestamps: true });

module.exports = mongoose.model("Order", OrderSchema);
