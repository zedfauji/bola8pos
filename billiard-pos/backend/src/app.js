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

// Remove app.listen() from here
module.exports = app; // Ensure this export exists