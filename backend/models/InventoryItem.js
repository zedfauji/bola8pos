const mongoose = require("mongoose");

const inventoryItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    required: false,
  },
  quantity: {
    type: Number,
    required: true,
    default: 0,
  },
  price: {
    type: Number,
    required: true,
  },
  category: {
    type: String,
    required: true,
    enum: ["Alcoholic Drinks", "Snacks", "Beverages", "Accessories", "Others"],
  },
  supplier: {
    type: String,
    required: false,
  },
  reorderPoint: {
    type: Number,
    default: 10,  // For low-stock alert
  },
  wastage: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const InventoryItem = mongoose.model("InventoryItem", inventoryItemSchema);

module.exports = InventoryItem;