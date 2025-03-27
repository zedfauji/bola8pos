const Inventory = require("../models/inventoryModel");

// Get all inventory items
exports.getAllInventory = async (req, res) => {
  try {
    const inventory = await Inventory.find();
    res.json(inventory);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add new item
exports.addInventoryItem = async (req, res) => {
  try {
    const { name, category, stock, price } = req.body;
    const item = new Inventory({ name, category, stock, price });
    await item.save();
    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update inventory
exports.updateInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedItem = await Inventory.findByIdAndUpdate(id, req.body, { new: true });
    res.json(updatedItem);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete item
exports.deleteInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    await Inventory.findByIdAndDelete(id);
    res.json({ message: "Item deleted" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};