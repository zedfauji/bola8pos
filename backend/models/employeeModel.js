const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: { type: String, enum: ["admin", "manager", "cashier", "waiter"], required: true },
  shift: { type: String, required: true },
  pin: { type: String, required: true } // Secure PIN for login
}, { timestamps: true });

module.exports = mongoose.model("Employee", employeeSchema);