const { Sequelize } = require('sequelize');
require('dotenv').config({ path: './pos/backend/.env' });

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: console.log,
    define: {
      timestamps: true,
      underscored: true,
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

async function inspectTable(tableName) {
  try {
    const [results] = await sequelize.query(`DESCRIBE ${tableName}`);
    console.log(`\nStructure of ${tableName}:`);
    console.table(results);
    
    const [indexes] = await sequelize.query(`SHOW INDEX FROM ${tableName}`);
    if (indexes.length > 0) {
      console.log(`\nIndexes on ${tableName}:`);
      console.table(indexes);
    }
  } catch (error) {
    console.error(`Error inspecting table ${tableName}:`, error.message);
  }
}

async function main() {
  try {
    await sequelize.authenticate();
    console.log('Successfully connected to the database.');
    
    // Check if table_layouts exists
    const [tables] = await sequelize.query("SHOW TABLES LIKE 'table_layouts'");
    if (tables.length === 0) {
      console.log('table_layouts table does not exist.');
      return;
    }
    
    await inspectTable('table_layouts');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}

main();
