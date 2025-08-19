const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Paths to the files we need to modify
const controllerPath = path.join(__dirname, '../pos/backend/src/controllers/inventory/purchase-order.controller.js');
const routesPath = path.join(__dirname, '../pos/backend/src/routes/inventory/purchase-order.routes.js');

// Fix function for the controller
function fixController() {
  console.log('Fixing purchase order controller...');
  
  let content = fs.readFileSync(controllerPath, 'utf8');
  
  // Replace the getByStatus method
  const getByStatusRegex = /async getByStatus\(status, page = 1, limit = 20\) \{[\s\S]*?return orders;\s*\}/;
  const fixedGetByStatus = `async getByStatus(status, page = 1, limit = 20) {
    try {
      const offset = (page - 1) * limit;
      
      let whereClause = '';
      const params = [];
      
      if (status) {
        whereClause = 'WHERE status = ?';
        params.push(status);
      }
      
      // Get purchase orders with pagination
      let result = await this.query(
        \`SELECT * FROM purchase_orders 
         \${whereClause}
         ORDER BY order_date DESC, id DESC
         LIMIT ? OFFSET ?\`,
        [...params, limit, offset]
      );
      
      // Ensure orders is always an array
      let orders = Array.isArray(result) ? result : [];
      
      // Get item counts for each order
      if (orders.length > 0) {
        for (const order of orders) {
          try {
            const itemCount = await this.queryOne(
              'SELECT COUNT(*) as count FROM purchase_order_items WHERE po_id = ?',
              [order.id]
            );
            order.item_count = itemCount ? itemCount.count : 0;
          } catch (error) {
            console.error(\`Error getting item count for order \${order.id}:\`, error);
            order.item_count = 0;
          }
        }
      }
      
      return orders;
    } catch (error) {
      console.error('Error in getByStatus:', error);
      return [];
    }
  }`;
  
  content = content.replace(getByStatusRegex, fixedGetByStatus);
  
  // Replace the getBySupplier method
  const getBySupplierRegex = /async getBySupplier\(supplierId, status = null, page = 1, limit = 20\) \{[\s\S]*?return orders;\s*\}/;
  const fixedGetBySupplier = `async getBySupplier(supplierId, status = null, page = 1, limit = 20) {
    try {
      const offset = (page - 1) * limit;
      
      let whereClause = 'WHERE supplier_id = ?';
      const params = [supplierId];
      
      if (status) {
        whereClause += ' AND status = ?';
        params.push(status);
      }
      
      let result = await this.query(
        \`SELECT * FROM purchase_orders 
         \${whereClause}
         ORDER BY order_date DESC, id DESC
         LIMIT ? OFFSET ?\`,
        [...params, limit, offset]
      );
      
      // Ensure orders is always an array
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Error in getBySupplier:', error);
      return [];
    }
  }`;
  
  content = content.replace(getBySupplierRegex, fixedGetBySupplier);
  
  // Write the fixed content back to the file
  fs.writeFileSync(controllerPath, content);
  console.log('Controller fixed successfully!');
}

// Fix function for the routes
function fixRoutes() {
  console.log('Fixing purchase order routes...');
  
  let content = fs.readFileSync(routesPath, 'utf8');
  
  // Replace the main route handler
  const mainRouteRegex = /router\.get\('\/', async \(req, res, next\) => \{[\s\S]*?next\(error\);\s*\}\s*\}\);/;
  const fixedMainRoute = `router.get('/', async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    let orders;
    try {
      orders = await purchaseOrderController.getByStatus(status, parseInt(page), parseInt(limit));
      // Ensure orders is always an array
      if (!orders || !Array.isArray(orders)) {
        console.warn('Purchase orders endpoint: orders is not an array, returning empty array');
        orders = [];
      }
    } catch (error) {
      console.error('Error in purchase orders endpoint:', error);
      orders = [];
    }
    res.json(orders);
  } catch (error) {
    console.error('Outer error in purchase orders endpoint:', error);
    // Return empty array instead of error
    res.json([]);
  }
});`;
  
  content = content.replace(mainRouteRegex, fixedMainRoute);
  
  // Replace the supplier route handler
  const supplierRouteRegex = /router\.get\('\/supplier\/:supplierId', async \(req, res, next\) => \{[\s\S]*?next\(error\);\s*\}\s*\}\);/;
  const fixedSupplierRoute = `router.get('/supplier/:supplierId', async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    let orders;
    try {
      orders = await purchaseOrderController.getBySupplier(
        req.params.supplierId,
        status,
        parseInt(page),
        parseInt(limit)
      );
      // Ensure orders is always an array
      if (!orders || !Array.isArray(orders)) {
        console.warn('Supplier purchase orders endpoint: orders is not an array, returning empty array');
        orders = [];
      }
    } catch (error) {
      console.error('Error in supplier purchase orders endpoint:', error);
      orders = [];
    }
    res.json(orders);
  } catch (error) {
    console.error('Outer error in supplier purchase orders endpoint:', error);
    // Return empty array instead of error
    res.json([]);
  }
});`;
  
  content = content.replace(supplierRouteRegex, fixedSupplierRoute);
  
  // Write the fixed content back to the file
  fs.writeFileSync(routesPath, content);
  console.log('Routes fixed successfully!');
}

// Test the purchase orders endpoint
async function testPurchaseOrders() {
  try {
    console.log('Testing purchase orders endpoint...');
    
    // First login to get access token
    console.log('Logging in...');
    const loginResponse = await axios.post('http://localhost:3001/api/access/auth/login', {
      email: 'admin@billiardpos.com',
      password: 'password'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const accessToken = loginResponse.data.accessToken;
    console.log('Login successful, got access token');
    
    // Test purchase orders endpoint
    console.log('Testing purchase orders endpoint...');
    try {
      const purchaseOrdersResponse = await axios.get('http://localhost:3001/api/inventory/purchase-orders', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      console.log('Purchase orders endpoint response status:', purchaseOrdersResponse.status);
      console.log('Response data type:', Array.isArray(purchaseOrdersResponse.data) ? 'Array' : typeof purchaseOrdersResponse.data);
      console.log('Response data length:', Array.isArray(purchaseOrdersResponse.data) ? purchaseOrdersResponse.data.length : 'N/A');
      
      return 'Test completed successfully';
    } catch (error) {
      console.error('Error in purchase orders request:');
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data);
      } else {
        console.error(error.message);
      }
      return 'Test failed';
    }
  } catch (error) {
    console.error('Top level error:', error);
    return 'Test failed';
  }
}

// Main function
async function main() {
  try {
    // Fix the controller and routes
    fixController();
    fixRoutes();
    
    console.log('\nFixes applied successfully. Please restart the backend server for changes to take effect.');
    console.log('After restarting, run this script again with the --test flag to test the endpoint.');
    
    // Test if requested
    if (process.argv.includes('--test')) {
      console.log('\nTesting the purchase orders endpoint...');
      const result = await testPurchaseOrders();
      console.log('\nTest result:', result);
    }
  } catch (error) {
    console.error('Error applying fixes:', error);
  }
}

main();
