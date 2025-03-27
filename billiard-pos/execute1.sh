# 1. Create proper database config
mkdir -p backend/config
cat > backend/config/config.js <<'EOL'
require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    retry: {
      max: 5,
      timeout: 5000
    }
  }
};
EOL

# 2. Add health check endpoint
cat > backend/src/routes/health.js <<'EOL'
const router = require('express').Router();

router.get('/', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date()
  });
});

module.exports = router;
EOL

# 3. Update app.js to include health check
sed -i '/const app = express/a \
app.use("/health", require("./routes/health"));' backend/src/app.js