const jwt = require('jsonwebtoken');
const { Employee } = require('../models');
const bcrypt = require('bcryptjs');

const login = async (email, pin) => {
  const employee = await Employee.findOne({ where: { email } });
  
  if (!employee || !employee.is_active) {
    throw new Error('Invalid credentials or account disabled');
  }

  const pinValid = await bcrypt.compare(pin, employee.pin_code);
  if (!pinValid) {
    throw new Error('Invalid PIN');
  }

  const token = jwt.sign(
    { 
      id: employee.id,
      role: employee.role,
      name: employee.name 
    },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  return {
    token,
    employee: {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      role: employee.role
    }
  };
};

module.exports = { login };
