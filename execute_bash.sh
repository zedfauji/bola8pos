#!/bin/bash

# =============================================
# BILLIARD POS AUTHENTICATION SETUP SCRIPT
# Fully compatible with your docker-compose.yml
# =============================================

# Navigate to project root
cd billiard-pos

# 1. Update backend Dockerfile if needed
if [ ! -f backend/Dockerfile ]; then
  cat > backend/Dockerfile <<'EOL'
FROM node:16

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 5000

CMD ["npm", "start"]
EOL
fi

# 2. Create auth service with Docker-compatible config
cat > backend/src/services/auth.service.js <<'EOL'
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
EOL

# 3. Create auth controller
cat > backend/src/controllers/auth.controller.js <<'EOL'
const authService = require('../services/auth.service');

const login = async (req, res) => {
  try {
    const { email, pinCode } = req.body;
    
    if (!email || !pinCode) {
      return res.status(400).json({ 
        success: false,
        message: 'Email and PIN code are required' 
      });
    }

    const result = await authService.login(email, pinCode);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(401).json({ 
      success: false,
      message: error.message || 'Login failed' 
    });
  }
};

module.exports = { login };
EOL

# 4. Create auth routes
cat > backend/src/routes/auth.route.js <<'EOL'
const express = require('express');
const authController = require('../controllers/auth.controller');
const router = express.Router();

router.post('/login', authController.login);

module.exports = router;
EOL

# 5. Create Docker-compatible admin setup script
mkdir -p backend/scripts
cat > backend/scripts/setupAdminEmployee.js <<'EOL'
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
EOL

# 6. Update employee model with hooks
# First backup the original model
cp backend/src/models/employee.model.js backend/src/models/employee.model.js.bak

# Create the modified version
cat > backend/src/models/employee.model.js <<'EOL'
const bcrypt = require('bcryptjs');

module.exports = (sequelize, DataTypes) => {
  const Employee = sequelize.define('Employee', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM('admin', 'manager', 'cashier', 'waiter', 'kitchen'),
      allowNull: false
    },
    pin_code: {
      type: DataTypes.STRING(60),
      allowNull: false
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    timestamps: true,
    paranoid: true,
    hooks: {
      beforeCreate: async (employee) => {
        if (employee.pin_code) {
          const salt = await bcrypt.genSalt(10);
          employee.pin_code = await bcrypt.hash(employee.pin_code, salt);
        }
      },
      beforeUpdate: async (employee) => {
        if (employee.changed('pin_code')) {
          const salt = await bcrypt.genSalt(10);
          employee.pin_code = await bcrypt.hash(employee.pin_code, salt);
        }
      }
    }
  });

  Employee.associate = (models) => {
    Employee.hasMany(models.Order, { foreignKey: 'employee_id' });
    Employee.hasMany(models.Shift, { foreignKey: 'employee_id' });
    Employee.hasMany(models.InventoryMovement, { foreignKey: 'employee_id' });
  };

  Employee.prototype.verifyPin = async function(pin) {
    return await bcrypt.compare(pin, this.pin_code);
  };

  return Employee;
};
EOL

# 7. Create models index file with Docker-compatible config
cat > backend/src/models/index.js <<'EOL'
const { Sequelize } = require('sequelize');
const config = require('../../config/config.js');

const dbConfig = {
  database: process.env.DB_NAME || config.development.database,
  username: process.env.DB_USER || config.development.username,
  password: process.env.DB_PASSWORD || config.development.password,
  host: process.env.DB_HOST || config.development.host,
  port: process.env.DB_PORT || config.development.port,
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
};

const sequelize = new Sequelize(dbConfig);

const Employee = require('./employee.model')(sequelize, Sequelize.DataTypes);

const db = {
  Employee,
  sequelize,
  Sequelize,
};

module.exports = db;
EOL

# 8. Create frontend login component
mkdir -p frontend/src/components/auth
cat > frontend/src/components/auth/Login.js <<'EOL'
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

export default function Login() {
  const [email, setEmail] = useState('admin@billiardpos.com');
  const [pinCode, setPinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/auth/login', { email, pinCode });
      
      if (data.success) {
        localStorage.setItem('token', data.data.token);
        localStorage.setItem('user', JSON.stringify(data.data.user));
        navigate(data.data.user.role === 'admin' ? '/dashboard' : '/pos');
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Billiard POS Login</h2>
          <p className="mt-2 text-sm text-gray-600">
            Enter your email and PIN code
          </p>
        </div>
        
        {error && (
          <div className="p-4 text-sm text-red-700 bg-red-100 rounded-lg">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
            <div>
              <label htmlFor="pinCode" className="block text-sm font-medium text-gray-700">
                PIN Code
              </label>
              <input
                id="pinCode"
                name="pinCode"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength="4"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={pinCode}
                onChange={(e) => {
                  if (e.target.validity.valid) setPinCode(e.target.value);
                }}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </div>
        </form>
        
        <div className="text-center text-sm text-gray-500">
          <p>Default admin: admin@billiardpos.com / 1234</p>
        </div>
      </div>
    </div>
  );
}
EOL

# 9. Update environment files
cat > backend/.env <<'EOL'
# Backend Environment Variables
JWT_SECRET=your_strong_jwt_secret_key_here
NODE_ENV=development
DB_HOST=postgres
DB_PORT=5432
DB_USER=posuser
DB_PASSWORD=pospassword
DB_NAME=billiardpos
REDIS_HOST=redis
REDIS_PORT=6379
EOL

cat > frontend/.env <<'EOL'
# Frontend Environment Variables
REACT_APP_API_URL=http://localhost:5000/api
EOL

# 10. Update docker-compose.yml to run setup script
sed -i '/volumes:/i \    command: sh -c "npm run setup && npm start"' docker-compose.yml
sed -i '/volumes:/i \    environment:' docker-compose.yml
sed -i '/volumes:/i \      - RUN_SETUP=true' docker-compose.yml

# Add setup script to backend package.json if not exists
if ! grep -q '"setup"' backend/package.json; then
  sed -i '/"scripts": {/a \    "setup": "node scripts/setupAdminEmployee.js",' backend/package.json
fi

echo "============================================"
echo "Docker-Compatible Authentication Setup Complete!"
echo "============================================"
echo "Key Docker-specific features:"
echo "1. Database connection retries in setup script"
echo "2. Environment variables aligned with docker-compose.yml"
echo "3. Automatic admin creation on container start"
echo "4. Healthcheck-compatible configuration"
echo ""
echo "To start the system:"
echo "1. Build and start containers:"
echo "   docker-compose up --build"
echo ""
echo "2. Access the application:"
echo "   - Frontend: http://localhost:3000"
echo "   - Backend API: http://localhost:5000"
echo ""
echo "3. Login credentials:"
echo "   Email: admin@billiardpos.com"
echo "   PIN: 1234"
echo "============================================"