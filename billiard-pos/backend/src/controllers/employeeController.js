const { Employee, Shift } = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.registerEmployee = async (req, res) => {
  try {
    const { name, email, phone, role, pinCode } = req.body;
    
    // Validate pin code length
    if (pinCode.length !== 4) {
      return res.status(400).json({ error: 'PIN code must be 4 digits' });
    }
    
    // Hash pin code
    const hashedPin = await bcrypt.hash(pinCode, 10);
    
    const employee = await Employee.create({
      name,
      email,
      phone,
      role,
      pin_code: hashedPin
    });

    res.status(201).json({
      id: employee.id,
      name: employee.name,
      email: employee.email,
      role: employee.role
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.loginEmployee = async (req, res) => {
  try {
    const { email, pinCode } = req.body;
    
    const employee = await Employee.findOne({ where: { email } });
    if (!employee) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(pinCode, employee.pin_code);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: employee.id, role: employee.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      token,
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        role: employee.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAllEmployees = async (req, res) => {
  try {
    const employees = await Employee.findAll({
      attributes: { exclude: ['pin_code'] },
      order: [['name', 'ASC']]
    });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getEmployeeById = async (req, res) => {
  try {
    const employee = await Employee.findByPk(req.params.id, {
      attributes: { exclude: ['pin_code'] },
      include: [Shift]
    });
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json(employee);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.startShift = async (req, res) => {
  try {
    // End any active shift first
    const activeShift = await Shift.findOne({
      where: {
        employee_id: req.employee.id,
        end_time: null
      }
    });

    if (activeShift) {
      await activeShift.update({ end_time: new Date() });
    }

    const shift = await Shift.create({
      employee_id: req.employee.id,
      start_time: new Date()
    });
    res.status(201).json(shift);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.endShift = async (req, res) => {
  try {
    const shift = await Shift.findOne({
      where: {
        employee_id: req.employee.id,
        end_time: null
      },
      order: [['start_time', 'DESC']]
    });

    if (!shift) {
      return res.status(400).json({ error: 'No active shift found' });
    }

    await shift.update({ end_time: new Date() });
    res.json(shift);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getEmployeeShifts = async (req, res) => {
  try {
    const shifts = await Shift.findAll({
      where: { employee_id: req.params.id },
      order: [['start_time', 'DESC']]
    });
    res.json(shifts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
