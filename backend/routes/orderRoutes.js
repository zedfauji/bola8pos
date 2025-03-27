const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");

// Route to get all orders
router.get("/", orderController.getAllOrders);

// Route to create a new order
router.post("/", orderController.createOrder);

// Route to update an existing order
router.put("/:id", orderController.updateOrder);

// Route to delete an order
router.delete("/:id", orderController.deleteOrder);
console.log(orderController); // Check if the controller is properly loaded

module.exports = router;
