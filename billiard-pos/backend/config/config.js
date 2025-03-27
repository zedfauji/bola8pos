module.exports = {
  development: {
    username: process.env.DB_USER || 'posuser',
    password: process.env.DB_PASSWORD || 'pospassword',
    database: process.env.DB_NAME || 'billiardpos',
    host: process.env.DB_HOST || 'postgres',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: console.log
  },
  test: {
    username: 'posuser',
    password: 'pospassword',
    database: 'billiardpos_test',
    host: 'postgres',
    dialect: 'postgres'
  },
  production: {
    username: 'posuser',
    password: 'pospassword',
    database: 'billiardpos_prod',
    host: 'postgres',
    dialect: 'postgres'
  }
};
