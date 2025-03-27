require('dotenv').config();
const app = require('./app');
const { sequelize } = require('./models');
const redisClient = require('./config/redis');

const PORT = process.env.PORT || 5000;

const connectWithRetry = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected...');
    
    await sequelize.sync({ alter: true });
    console.log('Models synchronized...');
    
    // Only start server here
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Connection error:', err.message);
    console.log('Retrying connection in 5 seconds...');
    setTimeout(connectWithRetry, 5000);
  }
};

redisClient.on('connect', () => console.log('Redis connected...'));
redisClient.on('error', (err) => console.log('Redis Client Error', err));

connectWithRetry();