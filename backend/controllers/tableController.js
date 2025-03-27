const Table = require("../models/tableModel");

// Get all tables
exports.getAllTables = async (req, res) => {
  try {
    const tables = await Table.find();
    res.status(200).json(tables);
  } catch (err) {
    res.status(500).json({ error: "Error fetching tables" });
  }
};

// Get table by ID
exports.getTableById = async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) {
      return res.status(404).json({ error: "Table not found" });
    }
    res.status(200).json(table);
  } catch (err) {
    res.status(500).json({ error: "Error fetching table" });
  }
};

// Create a new table
exports.createTable = async (req, res) => {
  try {
    const { number, type } = req.body;
    const newTable = new Table({ number, type });
    await newTable.save();
    res.status(201).json(newTable);
  } catch (err) {
    res.status(500).json({ error: "Error creating table" });
  }
};

// Update table
exports.updateTable = async (req, res) => {
  try {
    const updatedTable = await Table.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedTable) {
      return res.status(404).json({ error: "Table not found" });
    }
    res.status(200).json(updatedTable);
  } catch (err) {
    res.status(500).json({ error: "Error updating table" });
  }
};

// Delete table
exports.deleteTable = async (req, res) => {
  try {
    const deletedTable = await Table.findByIdAndDelete(req.params.id);
    if (!deletedTable) {
      return res.status(404).json({ error: "Table not found" });
    }
    res.status(200).json({ message: "Table deleted" });
  } catch (err) {
    res.status(500).json({ error: "Error deleting table" });
  }
};