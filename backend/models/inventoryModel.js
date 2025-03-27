const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  category: { type: String, enum: ["food", "drink", "billiard"], required: true },
  stock: { type: Number, required: true },
  price: { type: Number, required: true },
  lowStockAlert: { type: Number, default: 5 } // Alert when stock is low
}, { timestamps: true });

module.exports = mongoose.model("Inventory", inventorySchema);