const mongoose = require("mongoose");

const tableSchema = new mongoose.Schema({
  number: { type: Number, required: true, unique: true },
  type: { type: String, enum: ["billiard", "restaurant"], required: true },
  occupied: { type: Boolean, default: false },
  customer: { type: String, default: null },
  startTime: { type: Date, default: null },
  totalTime: { type: Number, default: 0 } // in minutes
}, { timestamps: true });

module.exports = mongoose.model("Table", tableSchema);