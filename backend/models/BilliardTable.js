const mongoose = require("mongoose");

const BilliardTableSchema = new mongoose.Schema({
    number: Number,
    status: { type: String, enum: ["available", "occupied"], default: "available" },
    startTime: Date
}, { timestamps: true });

module.exports = mongoose.model("BilliardTable", BilliardTableSchema);
