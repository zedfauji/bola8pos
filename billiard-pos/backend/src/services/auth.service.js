const jwt = require('jsonwebtoken');
const { Employee } = require('../models');
const bcrypt = require('bcryptjs');

const login = async (email, pinCode) => {
  try {
    const employee = await Employee.findOne({
      where: { email }
    });

    if (!employee || !employee.is_active) {
      throw new Error('Invalid credentials or account disabled');
    }

    const isPinValid = await bcrypt.compare(pinCode, employee.pin_code);
    if (!isPinValid) {
      throw new Error('Invalid PIN code');
    }

    const token = jwt.sign(
      { 
        id: employee.id, 
        role: employee.role,
        name: employee.name
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '8h' }
    );

    return {
      token,
      user: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        role: employee.role
      }
    };
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

module.exports = { login };
