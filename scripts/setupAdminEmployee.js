require('dotenv').config();
const { sequelize } = require('../models');
const bcrypt = require('bcryptjs');

const setupAdminEmployee = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established');

    const { Employee } = sequelize.models;

    const adminExists = await Employee.findOne({
      where: { email: 'admin@billiardpos.com' }
    });

    if (adminExists) {
      console.log('Admin employee already exists');
      return;
    }

    const hashedPin = await bcrypt.hash('1234', 10);
    
    await Employee.create({
      name: 'Admin User',
      email: 'admin@billiardpos.com',
      phone: '+1234567890',
      role: 'admin',
      pin_code: hashedPin,
      is_active: true
    });

    console.log('Admin employee created successfully');
    console.log('Email: admin@billiardpos.com');
    console.log('PIN: 1234');
  } catch (error) {
    console.error('Error creating admin employee:', error);
  } finally {
    await sequelize.close();
  }
};

setupAdminEmployee();
