const Report = require("../models/Report");

// Generate and get sales report
const generateSalesReport = async (req, res) => {
  try {
    // Generate sales data
    const reportData = {
      totalSales: 5000, // Example data
      topSellingItems: ["Item1", "Item2", "Item3"], // Example data
      totalCustomers: 200, // Example data
    };

    const newReport = new Report({
      title: "Sales Report",
      type: "sales",
      data: reportData,
    });

    await newReport.save();
    res.status(201).json(newReport);
  } catch (error) {
    res.status(500).json({ message: "Failed to generate sales report" });
  }
};

// Get all reports
const getReports = async (req, res) => {
  try {
    const reports = await Report.find();
    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch reports" });
  }
};

// Generate inventory report
const generateInventoryReport = async (req, res) => {
  try {
    // Generate inventory data
    const reportData = {
      totalItems: 100, // Example data
      lowStockItems: ["Item1", "Item2"], // Example data
    };

    const newReport = new Report({
      title: "Inventory Report",
      type: "inventory",
      data: reportData,
    });

    await newReport.save();
    res.status(201).json(newReport);
  } catch (error) {
    res.status(500).json({ message: "Failed to generate inventory report" });
  }
};

// Generate employee performance report
const generateEmployeeReport = async (req, res) => {
  try {
    // Example data
    const reportData = {
      totalSalesPerEmployee: [{ name: "John", sales: 1500 }],
      totalTips: [{ name: "John", tips: 200 }],
    };

    const newReport = new Report({
      title: "Employee Performance Report",
      type: "employee",
      data: reportData,
    });

    await newReport.save();
    res.status(201).json(newReport);
  } catch (error) {
    res.status(500).json({ message: "Failed to generate employee report" });
  }
};

module.exports = {
  generateSalesReport,
  getReports,
  generateInventoryReport,
  generateEmployeeReport,
};