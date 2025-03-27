const express = require("express");
const router = express.Router();
const inventoryController = require("../controllers/inventoryController");

// Get all inventory items
router.get("/", inventoryController.getAllInventory);

// Add a new inventory item
router.post("/", inventoryController.addInventoryItem);

// Update inventory item
router.put("/:id", inventoryController.updateInventoryItem);

// Delete inventory item
router.delete("/:id", inventoryController.deleteInventoryItem);

module.exports = router;
