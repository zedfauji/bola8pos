const Employee = require("../models/employeeModel");

// Get all employees
exports.getAllEmployees = async (req, res) => {
  try {
    const employees = await Employee.find();
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add new employee
exports.addEmployee = async (req, res) => {
  try {
    const { name, role, shift } = req.body;
    const employee = new Employee({ name, role, shift });
    await employee.save();
    res.status(201).json(employee);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Remove employee
exports.deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    await Employee.findByIdAndDelete(id);
    res.json({ message: "Employee removed" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};