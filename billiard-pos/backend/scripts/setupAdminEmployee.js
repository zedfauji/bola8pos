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

// Wait for database to be ready (for Docker)
const waitForDb = async () => {
  const maxAttempts = 10;
  let currentAttempt = 0;
  
  while (currentAttempt < maxAttempts) {
    try {
      await sequelize.authenticate();
      console.log('Database connection established');
      await setupAdminEmployee();
      process.exit(0);
    } catch (err) {
      currentAttempt++;
      console.log(`Waiting for database... (attempt ${currentAttempt}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  console.error('Failed to connect to database after multiple attempts');
  process.exit(1);
};

waitForDb();
