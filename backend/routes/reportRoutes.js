const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");

router.get("/", reportController.getReports); // Get all reports
router.post("/sales", reportController.generateSalesReport); // Generate sales report
router.post("/inventory", reportController.generateInventoryReport); // Generate inventory report
router.post("/employee", reportController.generateEmployeeReport); // Generate employee report
console.log(reportController); // Check if the controller is properly loaded

module.exports = router;
