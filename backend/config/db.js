const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: '/cloudsql/' + process.env.CLOUD_SQL_CONNECTION_NAME,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: 5432, // Default PostgreSQL port
});

pool.connect()
  .then(() => {
    console.log("Connected to PostgreSQL Database!");
  })
  .catch((err) => {
    console.error("Error connecting to PostgreSQL:", err);
  });

module.exports = pool;
