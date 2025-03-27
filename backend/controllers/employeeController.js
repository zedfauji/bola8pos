const Employee = require("../models/Employee");

// Add a new employee
const addEmployee = async (req, res) => {
  const { firstName, lastName, email, role, password, shift, status } = req.body;

  try {
    const newEmployee = new Employee({
      firstName,
      lastName,
      email,
      role,
      password,  // Consider hashing the password before saving it
      shift,
      status,
    });

    await newEmployee.save();
    res.status(201).json({ message: "Employee added successfully", employee: newEmployee });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to add employee" });
  }
};

// Get all employees
const getAllEmployees = async (req, res) => {
  try {
    const employees = await Employee.find();
    res.status(200).json(employees);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to retrieve employees" });
  }
};

// Get an employee by ID
const getEmployeeById = async (req, res) => {
  const { id } = req.params;

  try {
    const employee = await Employee.findById(id);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }
    res.status(200).json(employee);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to retrieve employee" });
  }
};

// Update an employee
const updateEmployee = async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, email, role, password, shift, status } = req.body;

  try {
    const updatedEmployee = await Employee.findByIdAndUpdate(
      id,
      { firstName, lastName, email, role, password, shift, status },
      { new: true }
    );

    if (!updatedEmployee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.status(200).json({ message: "Employee updated successfully", employee: updatedEmployee });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update employee" });
  }
};

// Delete an employee
const deleteEmployee = async (req, res) => {
  const { id } = req.params;

  try {
    const deletedEmployee = await Employee.findByIdAndDelete(id);
    if (!deletedEmployee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.status(200).json({ message: "Employee deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to delete employee" });
  }
};

// Update employee status (e.g., On leave, Active)
const updateEmployeeStatus = async (req, res) => {
  const { id, status } = req.body;

  try {
    const updatedEmployee = await Employee.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!updatedEmployee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.status(200).json({ message: "Employee status updated successfully", employee: updatedEmployee });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update employee status" });
  }
};

module.exports = {
  addEmployee,
  getAllEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  updateEmployeeStatus,
};
