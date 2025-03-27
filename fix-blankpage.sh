#!/bin/bash

# =============================================
# FRONTEND-BACKEND CONNECTION FIX SCRIPT
# Resolves "Error: Request failed with status code 404"
# =============================================

# Navigate to project root
cd billiard-pos || { echo "Project directory not found"; exit 1; }

# 1. First, verify backend health endpoint
cat > backend/src/routes/health.js <<'EOL'
const express = require('express');
const router = express.Router();

router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date(),
    service: 'Billiard POS Backend'
  });
});

module.exports = router;
EOL

# 2. Update backend app.js to use health route
cat > backend/src/app.js <<'EOL'
const express = require('express');
const cors = require('cors');
const healthRouter = require('./routes/health');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', healthRouter);

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
EOL

# 3. Update frontend API configuration
cat > frontend/src/api.js <<'EOL'
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 5000,
});

// Add response interceptor
api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error.config.url, error.response?.status);
    return Promise.reject(error);
  }
);

export default api;
EOL

# 4. Update frontend App.jsx with better error handling
cat > frontend/src/App.jsx <<'EOL'
import { useState, useEffect } from 'react';
import api from './api';

export default function App() {
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  useEffect(() => {
    const testConnection = async () => {
      try {
        const response = await api.get('/health');
        setStatus(response.data.status === 'OK' ? 'connected' : 'disconnected');
      } catch (err) {
        setStatus('disconnected');
        setError({
          message: err.message,
          url: err.config.url,
          status: err.response?.status
        });
        console.error('Connection error:', err);
      }
    };

    testConnection();
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Billiard POS System</h1>
      <div style={{
        margin: '2rem auto',
        padding: '1rem',
        backgroundColor: status === 'connected' ? '#d4edda' : '#f8d7da',
        color: status === 'connected' ? '#155724' : '#721c24',
        borderRadius: '4px',
        maxWidth: '500px'
      }}>
        <p>Backend Status: <strong>{status}</strong></p>
        {error && (
          <div style={{ marginTop: '1rem' }}>
            <p>Error Details:</p>
            <ul>
              <li>URL: {error.url}</li>
              <li>Status: {error.status || 'No response'}</li>
              <li>Message: {error.message}</li>
            </ul>
          </div>
        )}
      </div>
      <div style={{ marginTop: '2rem' }}>
        <p>Testing connection to: <code>{import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}</code></p>
      </div>
    </div>
  );
}
EOL

# 5. Update frontend environment
echo "VITE_API_URL=http://localhost:5000/api" > frontend/.env

# 6. Install required dependencies
cd backend && npm install cors
cd ../frontend && npm install axios
cd ..

echo "============================================"
echo "CONNECTION FIX APPLIED SUCCESSFULLY!"
echo "============================================"
echo "To test the connection:"
echo "1. Start backend: cd backend && npm run start"
echo "2. Start frontend: cd frontend && npm run start"
echo "3. Visit http://localhost:3000"
echo ""
echo "Debugging tips:"
echo "- Check backend logs for incoming requests"
echo "- Verify the endpoint with: curl http://localhost:5000/api/health"
echo "- Inspect browser console