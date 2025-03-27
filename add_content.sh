#!/bin/bash

# Create the project structure
mkdir -p billiard-pos/backend/{src/{config,controllers,models,routes,services,migrations,seeders,middleware},scripts}
touch billiard-pos/backend/{Dockerfile,package.json,.env,.sequelizerc,.gitignore}
touch billiard-pos/backend/src/{app.js,server.js}

# Create .gitignore
cat > billiard-pos/backend/.gitignore <<EOL
node_modules/
.env
.DS_Store
EOL

# Create package.json
cat > billiard-pos/backend/package.json <<EOL
{
  "name": "billiard-pos-backend",
  "version": "1.0.0",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "migrate": "sequelize-cli db:migrate",
    "seed": "sequelize-cli db:seed:all"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.0.3",
    "express": "^4.18.2",
    "helmet": "^7.0.0",
    "jsonwebtoken": "^9.0.0",
    "morgan": "^1.10.0",
    "pg": "^8.11.0",
    "qrcode": "^1.5.3",
    "redis": "^4.6.5",
    "sequelize": "^6.32.0",
    "sequelize-cli": "^6.6.0"
  },
  "devDependencies": {
    "nodemon": "^2.0.22"
  }
}
EOL

# Create .env file
cat > billiard-pos/backend/.env <<EOL
# Database
DB_HOST=postgres
DB_PORT=5432
DB_USER=posuser
DB_PASSWORD=pospassword
DB_NAME=billiardpos

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# App
PORT=5000
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=90d
EOL

# Create .sequelizerc
cat > billiard-pos/backend/.sequelizerc <<EOL
const path = require('path');

module.exports = {
  config: path.resolve('src', 'config', 'database.js'),
  'models-path': path.resolve('src', 'models'),
  'seeders-path': path.resolve('src', 'seeders'),
  'migrations-path': path.resolve('src', 'migrations')
};
EOL

# Create Dockerfile
cat > billiard-pos/backend/Dockerfile <<EOL
FROM node:16

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 5000

CMD ["npm", "run", "dev"]
EOL

# Create config files
cat > billiard-pos/backend/src/config/database.js <<EOL
require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: console.log
  },
  test: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: \`\${process.env.DB_NAME}_test\`,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres'
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: false
  }
};
EOL

cat > billiard-pos/backend/src/config/redis.js <<EOL
const redis = require('redis');
const client = redis.createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT
});

client.on('error', (err) => console.log('Redis Client Error', err));

module.exports = client;
EOL

# Create models
cat > billiard-pos/backend/src/models/index.js <<EOL
const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const basename = path.basename(__filename);
const db = {};

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: console.log
  }
);

fs.readdirSync(__dirname)
  .filter(file => {
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js' &&
      file.indexOf('.test.js') === -1
    );
  })
  .forEach(file => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
EOL

# Create remaining models (Table, Member, etc.)
# Table model
cat > billiard-pos/backend/src/models/table.model.js <<EOL
module.exports = (sequelize, DataTypes) => {
  const Table = sequelize.define('Table', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    table_number: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    table_type: {
      type: DataTypes.ENUM('billiard', 'bar', 'restaurant'),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('available', 'occupied', 'maintenance'),
      defaultValue: 'available'
    },
    current_session_start: {
      type: DataTypes.DATE
    },
    hourly_rate: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 80.00
    }
  }, {
    timestamps: true,
    paranoid: true
  });

  Table.associate = (models) => {
    Table.hasMany(models.Order, { foreignKey: 'table_id' });
    Table.hasMany(models.TableSession, { foreignKey: 'table_id' });
  };

  return Table;
};
EOL

# Member model
cat > billiard-pos/backend/src/models/member.model.js <<EOL
module.exports = (sequelize, DataTypes) => {
  const Member = sequelize.define('Member', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false
    },
    membership_tier: {
      type: DataTypes.ENUM('bronze', 'silver', 'gold'),
      defaultValue: 'bronze'
    },
    points_balance: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    free_hours_balance: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0
    },
    qr_code: {
      type: DataTypes.STRING,
      unique: true
    }
  }, {
    timestamps: true
  });

  Member.associate = (models) => {
    Member.hasMany(models.TableSession, { foreignKey: 'member_id' });
    Member.hasMany(models.Order, { foreignKey: 'member_id' });
  };

  return Member;
};
EOL

# Create controllers, routes, services, etc.
# ... (similar cat commands for all other files shown in previous response)

# Create main application files
cat > billiard-pos/backend/src/app.js <<EOL
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', routes);

// Error handling
app.use(errorHandler);

module.exports = app;
EOL

cat > billiard-pos/backend/src/server.js <<EOL
const app = require('./app');
const { sequelize } = require('./models');
const redisClient = require('./config/redis');

const PORT = process.env.PORT || 5000;

// Test DB connection
sequelize.authenticate()
  .then(() => console.log('Database connected...'))
  .catch(err => console.log('Error: ' + err));

// Sync models
sequelize.sync({ alter: true })
  .then(() => console.log('Models synchronized...'))
  .catch(err => console.log('Sync error: ' + err));

// Test Redis connection
redisClient.on('connect', () => console.log('Redis connected...'));
redisClient.on('error', (err) => console.log('Redis Client Error', err));

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});
EOL

echo "Billiard POS backend project created successfully!"
echo "To set up:"
echo "1. cd billiard-pos/backend"
echo "2. npm install"
echo "3. Update .env with your actual credentials"
echo "4. Run with: npm run dev"