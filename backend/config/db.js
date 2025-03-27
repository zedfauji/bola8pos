const mysql = require("mysql2/promise");
const { Connector } = require("@google-cloud/cloud-sql-connector");
require("dotenv").config();

const connector = new Connector();

async function createDBConnection() {
  const clientOpts = await connector.getOptions({
    instanceConnectionName: process.env.CLOUD_SQL_CONNECTION_NAME,
    ipType: "PRIVATE", // or "PUBLIC" based on your setup
  });

  return mysql.createPool({
    ...clientOpts,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
}

const db = createDBConnection();

module.exports = db;
