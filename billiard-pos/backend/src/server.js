require('dotenv').config();
const app = require('./app');
const { sequelize } = require('./models');
const redisClient = require('./config/redis');

const PORT = process.env.PORT || 5000;

// Database connection with retry logic
const connectWithRetry = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected...');
    
    // Sync models
    await sequelize.sync({ alter: true });
    console.log('Models synchronized...');
    
    // Start server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Connection error:', err.message);
    console.log('Retrying connection in 5 seconds...');
    setTimeout(connectWithRetry, 5000);
  }
};

// Redis connection
redisClient.on('connect', () => console.log('Redis connected...'));
redisClient.on('error', (err) => console.log('Redis Client Error', err));

// Start the connection process
connectWithRetry();
