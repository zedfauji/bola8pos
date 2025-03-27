const express = require("express");
const router = express.Router();
const tableController = require("../controllers/tableController"); // Ensure this path is correct

// Route handlers
router.get("/", tableController.getAllTables);
router.get("/:id", tableController.getTableById);
router.post("/", tableController.createTable);
router.put("/:id", tableController.updateTable);
router.delete("/:id", tableController.deleteTable);
console.log(tableController); // Check if the controller is properly loaded
module.exports = router;