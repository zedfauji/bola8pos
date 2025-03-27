const InventoryItem = require("../models/InventoryItem");

// Create a new inventory item
const addInventoryItem = async (req, res) => {
  const { name, description, quantity, price, category, supplier, reorderPoint } = req.body;

  try {
    const newItem = new InventoryItem({
      name,
      description,
      quantity,
      price,
      category,
      supplier,
      reorderPoint,
    });

    await newItem.save();
    res.status(201).json({ message: "Inventory item added successfully", item: newItem });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to add inventory item" });
  }
};

// Get all inventory items
const getAllInventoryItems = async (req, res) => {
  try {
    const items = await InventoryItem.find();
    res.status(200).json(items);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to retrieve inventory items" });
  }
};

// Get an inventory item by ID
const getInventoryItemById = async (req, res) => {
  const { id } = req.params;

  try {
    const item = await InventoryItem.findById(id);
    if (!item) {
      return res.status(404).json({ message: "Inventory item not found" });
    }
    res.status(200).json(item);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to retrieve inventory item" });
  }
};

// Update an inventory item
const updateInventoryItem = async (req, res) => {
  const { id } = req.params;
  const { name, description, quantity, price, category, supplier, reorderPoint } = req.body;

  try {
    const updatedItem = await InventoryItem.findByIdAndUpdate(
      id,
      { name, description, quantity, price, category, supplier, reorderPoint },
      { new: true }
    );

    if (!updatedItem) {
      return res.status(404).json({ message: "Inventory item not found" });
    }

    res.status(200).json({ message: "Inventory item updated successfully", item: updatedItem });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update inventory item" });
  }
};

// Delete an inventory item
const deleteInventoryItem = async (req, res) => {
  const { id } = req.params;

  try {
    const deletedItem = await InventoryItem.findByIdAndDelete(id);
    if (!deletedItem) {
      return res.status(404).json({ message: "Inventory item not found" });
    }

    res.status(200).json({ message: "Inventory item deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to delete inventory item" });
  }
};

// Handle inventory wastage and spoilage
const logWastage = async (req, res) => {
  const { id, quantity } = req.body;

  try {
    const item = await InventoryItem.findById(id);
    if (!item) {
      return res.status(404).json({ message: "Inventory item not found" });
    }

    item.wastage += quantity;
    item.quantity -= quantity;
    await item.save();

    res.status(200).json({ message: "Wastage recorded successfully", item });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to log wastage" });
  }
};

module.exports = {
  addInventoryItem,
  getAllInventoryItems,
  getInventoryItemById,
  updateInventoryItem,
  deleteInventoryItem,
  logWastage,
};