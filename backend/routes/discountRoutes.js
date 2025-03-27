const express = require("express");
const router = express.Router();
const discountController = require("../controllers/discountController");

router.get("/", discountController.getActiveDiscounts); // Get active discounts
router.post("/", discountController.createDiscount); // Create discount
router.put("/:id", discountController.updateDiscount); // Update discount
router.delete("/:id", discountController.deleteDiscount); // Delete discount
console.log(discountController); // Check if the controller is properly loaded

module.exports = router;
