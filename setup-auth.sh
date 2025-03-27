#!/bin/bash

# =============================================
# BILLIARD POS SETUP SCRIPT
# Updated for index.jsx + App.jsx structure
# Run from bola8pos-ai directory
# =============================================

# Verify directory structure
if [ ! -d "billiard-pos/backend/src/models" ] || [ ! -f "billiard-pos/frontend/src/index.jsx" ]; then
  echo "Error: Incorrect directory structure!"
  echo "Expected billiard-pos/frontend/src/index.jsx"
  exit 1
fi

# Navigate to project directory
cd billiard-pos || exit

# 1. Create auth service
cat > backend/src/services/auth.service.js <<'EOL'
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
EOL

# 2. Create auth controller
cat > backend/src/controllers/auth.controller.js <<'EOL'
const authService = require('../services/auth.service');

exports.login = async (req, res, next) => {
  try {
    const { email, pin } = req.body;
    if (!email || !pin) {
      return res.status(400).json({ error: 'Email and PIN are required' });
    }
    
    const result = await authService.login(email, pin);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
EOL

# 3. Create auth routes
cat > backend/src/routes/auth.routes.js <<'EOL'
const router = require('express').Router();
const authController = require('../controllers/auth.controller');

router.post('/login', authController.login);

module.exports = router;
EOL

# 4. Update employee model hooks
cat >> backend/src/models/employee.model.js <<'EOL'

// Add these hooks before the return statement
Employee.beforeCreate(async (employee) => {
  if (employee.pin_code) {
    const salt = await bcrypt.genSalt(10);
    employee.pin_code = await bcrypt.hash(employee.pin_code, salt);
  }
});

Employee.beforeUpdate(async (employee) => {
  if (employee.changed('pin_code')) {
    const salt = await bcrypt.genSalt(10);
    employee.pin_code = await bcrypt.hash(employee.pin_code, salt);
  }
});
EOL

# 5. Create frontend auth components
mkdir -p frontend/src/components/auth
cat > frontend/src/components/auth/Login.jsx <<'EOL'
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

export default function Login() {
  const [email, setEmail] = useState('admin@billiardpos.com');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/auth/login', { email, pin });
      localStorage.setItem('token', data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded shadow">
      <h2 className="text-2xl font-bold mb-6">Billiard POS Login</h2>
      {error && <div className="mb-4 p-2 bg-red-100 text-red-700">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block mb-2">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <div className="mb-4">
          <label className="block mb-2">PIN Code</label>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full p-2 border rounded"
            maxLength="4"
            required
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
        >
          Login
        </button>
      </form>
    </div>
  );
}
EOL

# 6. Update frontend environment
echo "VITE_API_URL=http://localhost:5000/api" > frontend/.env

# 7. Install dependencies
cd backend && npm install bcryptjs jsonwebtoken
cd ../frontend && npm install axios
cd ..

echo "============================================"
echo "SETUP COMPLETE!"
echo "============================================"
echo "To start your application:"
echo "1. Add to backend/.env:"
echo "   JWT_SECRET=$(openssl rand -hex 32)"
echo "2. Run from billiard-pos directory:"
echo "   docker-compose up --build"
echo "3. Access: http://localhost:3000"
echo "============================================"