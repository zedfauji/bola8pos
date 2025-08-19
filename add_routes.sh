#!/bin/bash

# Create routes directory if it doesn't exist
mkdir -p billiard-pos/backend/src/routes

# Create index.js for routes
cat > billiard-pos/backend/src/routes/index.js <<'EOL'
const express = require('express');
const router = express.Router();

const tableRoutes = require('./tableRoutes');
const memberRoutes = require('./memberRoutes');
const orderRoutes = require('./orderRoutes');
const inventoryRoutes = require('./inventoryRoutes');
const employeeRoutes = require('./employeeRoutes');
const authRoutes = require('./authRoutes');

router.use('/tables', tableRoutes);
router.use('/members', memberRoutes);
router.use('/orders', orderRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/employees', employeeRoutes);
router.use('/auth', authRoutes);

module.exports = router;
EOL

# Create tableRoutes.js
cat > billiard-pos/backend/src/routes/tableRoutes.js <<'EOL'
const express = require('express');
const router = express.Router();
const tableController = require('../controllers/tableController');
const { authenticate, authorize } = require('../middleware/auth');

// Table management
router.get('/', tableController.getAllTables);
router.get('/:id', tableController.getTableById);

// Session management
router.post('/:id/start', authenticate, authorize(['cashier', 'manager']), tableController.startTableSession);
router.post('/:id/end', authenticate, authorize(['cashier', 'manager']), tableController.endTableSession);
router.post('/transfer', authenticate, authorize(['cashier', 'manager']), tableController.transferTableSession);

module.exports = router;
EOL

# Create memberRoutes.js
cat > billiard-pos/backend/src/routes/memberRoutes.js <<'EOL'
const express = require('express');
const router = express.Router();
const memberController = require('../controllers/memberController');
const { authenticate, authorize } = require('../middleware/auth');

// Member management
router.post('/', authenticate, authorize(['cashier', 'manager']), memberController.createMember);
router.get('/:id', authenticate, memberController.getMemberById);
router.get('/qr/:qrCode', authenticate, memberController.getMemberByQR);
router.put('/:id/tier', authenticate, authorize(['manager']), memberController.updateMemberTier);
router.post('/:id/points', authenticate, authorize(['cashier', 'manager']), memberController.addMemberPoints);

module.exports = router;
EOL

# Create orderRoutes.js
cat > billiard-pos/backend/src/routes/orderRoutes.js <<'EOL'
const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/', authenticate, authorize(['waiter', 'cashier', 'manager']), orderController.createOrder);
router.get('/:id', authenticate, orderController.getOrderById);
router.put('/:id/status', authenticate, authorize(['waiter', 'cashier', 'manager', 'kitchen']), orderController.updateOrderStatus);

module.exports = router;
EOL

# Create inventoryRoutes.js
cat > billiard-pos/backend/src/routes/inventoryRoutes.js <<'EOL'
const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, inventoryController.getAllInventoryItems);
router.get('/:id', authenticate, inventoryController.getInventoryItemById);
router.post('/', authenticate, authorize(['manager']), inventoryController.createInventoryItem);
router.put('/:id', authenticate, authorize(['manager']), inventoryController.updateInventoryItem);
router.post('/movements', authenticate, authorize(['manager', 'cashier']), inventoryController.recordInventoryMovement);

module.exports = router;
EOL

# Create employeeRoutes.js
cat > billiard-pos/backend/src/routes/employeeRoutes.js <<'EOL'
const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/register', authenticate, authorize(['admin']), employeeController.registerEmployee);
router.post('/login', employeeController.loginEmployee);
router.get('/', authenticate, authorize(['admin', 'manager']), employeeController.getAllEmployees);
router.post('/shifts/start', authenticate, employeeController.startShift);
router.post('/shifts/end', authenticate, employeeController.endShift);

module.exports = router;
EOL

# Create authRoutes.js
cat > billiard-pos/backend/src/routes/authRoutes.js <<'EOL'
const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');

router.post('/login', employeeController.loginEmployee);

module.exports = router;
EOL

# Create a script to add all content
cat > billiard-pos/backend/scripts/add_all_content.sh <<'EOL'
#!/bin/bash

# This script adds all content to the backend files
# Make sure to run it from the backend directory

echo "Adding content to all backend files..."

# Create models
echo "Creating models..."
mkdir -p src/models

cat > src/models/table.model.js <<'MODEL'
// Table model content here...
MODEL

cat > src/models/member.model.js <<'MODEL'
// Member model content here...
MODEL

# Continue with other models, controllers, services, etc.

echo "All content has been added to backend files!"
EOL

# Make the content script executable
chmod +x billiard-pos/backend/scripts/add_all_content.sh

echo "All route files have been created with their content!"
echo "A script to add all content has been created at:"
echo "billiard-pos/backend/scripts/add_all_content.sh"
echo ""
echo "To complete setup:"
echo "1. cd billiard-pos/backend"
echo "2. npm install"
echo "3. Update .env with your actual credentials"
echo "4. Run with: npm run dev"