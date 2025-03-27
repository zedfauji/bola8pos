const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  role: {
    type: String,
    required: true,
    enum: ["Admin", "Manager", "Cashier", "Waiter"],
  },
  password: {
    type: String,
    required: true,
  },
  shift: {
    start: {
      type: Date,
    },
    end: {
      type: Date,
    },
  },
  status: {
    type: String,
    enum: ["active", "inactive", "on leave"],
    default: "active",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Employee = mongoose.model("Employee", employeeSchema);

module.exports = Employee;
