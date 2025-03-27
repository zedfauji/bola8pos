const express = require("express");
const router = express.Router();
const inventoryController = require("../controllers/inventoryController");

// Add new inventory item
router.post("/", inventoryController.addInventoryItem);

// Get all inventory items
router.get("/", inventoryController.getAllInventoryItems);

// Get an inventory item by ID
router.get("/:id", inventoryController.getInventoryItemById);

// Update an inventory item
router.put("/:id", inventoryController.updateInventoryItem);

// Delete an inventory item
router.delete("/:id", inventoryController.deleteInventoryItem);

// Log wastage/spoilage of an inventory item
router.post("/wastage", inventoryController.logWastage);
console.log(inventoryController); // Check if the controller is properly loaded

module.exports = router;
