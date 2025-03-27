cd backend
node -e "require('dotenv').config(); require('./src/models').sequelize.authenticate().then(() => console.log('DB OK')).catch(console.error)"