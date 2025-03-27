const express = require("express");
const router = express.Router();
const employeeController = require("../controllers/employeeController");

// Add new employee
router.post("/", employeeController.addEmployee);

// Get all employees
router.get("/", employeeController.getAllEmployees);

// Get an employee by ID
router.get("/:id", employeeController.getEmployeeById);

// Update an employee
router.put("/:id", employeeController.updateEmployee);

// Delete an employee
router.delete("/:id", employeeController.deleteEmployee);

// Update employee status (e.g., on leave, active)
router.patch("/status", employeeController.updateEmployeeStatus);

module.exports = router;


console.log(employeeController); // Check if the controller is properly loaded
