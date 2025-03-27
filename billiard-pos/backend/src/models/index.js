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
