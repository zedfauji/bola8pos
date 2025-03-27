const jwt = require('jsonwebtoken');
const { Employee } = require('../models');

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new Error('Unauthorized');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const employee = await Employee.findByPk(decoded.id);
    if (!employee) {
      throw new Error('Employee not found');
    }

    req.employee = {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      role: employee.role
    };

    next();
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
};
