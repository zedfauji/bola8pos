const express = require('express');
const router = express.Router();
const { isAuthenticated, hasRole } = require('../middleware/auth');
const inventoryController = require('../controllers/inventory/inventoryController');
const productController = require('../controllers/inventory/productController');
const categoryController = require('../controllers/inventory/categoryController');
const supplierController = require('../controllers/inventory/supplierController');
const locationController = require('../controllers/inventory/locationController');
const stockMovementController = require('../controllers/inventory/stockMovementController');
const purchaseOrderController = require('../controllers/inventory/purchaseOrderController');

// Health check route
router.get('/health', (_req, res) => res.json({ ok: true, service: 'inventory' }));

// Inventory routes
router.get('/inventory', isAuthenticated, inventoryController.getInventory);
router.get('/inventory/low-stock', isAuthenticated, inventoryController.getLowStockItems);
router.get('/inventory/:id', isAuthenticated, inventoryController.getInventoryById);
router.post('/inventory', isAuthenticated, inventoryController.createInventory);
router.put('/inventory/:id', isAuthenticated, inventoryController.updateInventory);
router.delete('/inventory/:id', isAuthenticated, inventoryController.deleteInventory);
router.post('/inventory/batch', isAuthenticated, inventoryController.batchCreateInventory);
router.put('/inventory/batch', isAuthenticated, inventoryController.batchUpdateInventory);
router.delete('/inventory/batch', isAuthenticated, inventoryController.batchDeleteInventory);
router.post('/inventory/transfer', isAuthenticated, inventoryController.transferInventory);

// Product routes
router.get('/products', isAuthenticated, productController.getProducts);
router.get('/products/low-stock', isAuthenticated, productController.getLowStockProducts);
router.get('/products/:id', isAuthenticated, productController.getProductById);
router.post('/products', isAuthenticated, productController.createProduct);
router.put('/products/:id', isAuthenticated, productController.updateProduct);
router.delete('/products/:id', isAuthenticated, productController.deleteProduct);
router.post('/products/batch', isAuthenticated, productController.batchCreateProducts);
router.put('/products/batch', isAuthenticated, productController.batchUpdateProducts);
router.get('/products/:id/inventory', isAuthenticated, productController.getProductInventory);
router.post('/products/import', isAuthenticated, hasRole(['admin']), productController.importProducts);

// Category routes
router.get('/categories', isAuthenticated, categoryController.getCategories);
router.get('/categories/tree', isAuthenticated, categoryController.getCategoryTree);
router.get('/categories/:id', isAuthenticated, categoryController.getCategoryById);
router.post('/categories', isAuthenticated, categoryController.createCategory);
router.put('/categories/:id', isAuthenticated, categoryController.updateCategory);
router.delete('/categories/:id', isAuthenticated, categoryController.deleteCategory);
router.post('/categories/batch', isAuthenticated, categoryController.batchCreateCategories);
router.get('/categories/:id/products', isAuthenticated, categoryController.getCategoryProducts);

// Supplier routes
router.get('/suppliers', isAuthenticated, supplierController.getSuppliers);
router.get('/suppliers/:id', isAuthenticated, supplierController.getSupplierById);
router.post('/suppliers', isAuthenticated, supplierController.createSupplier);
router.put('/suppliers/:id', isAuthenticated, supplierController.updateSupplier);
router.delete('/suppliers/:id', isAuthenticated, supplierController.deleteSupplier);
router.post('/suppliers/batch', isAuthenticated, supplierController.batchCreateSuppliers);
router.put('/suppliers/batch', isAuthenticated, supplierController.batchUpdateSuppliers);
router.get('/suppliers/:id/products', isAuthenticated, supplierController.getSupplierProducts);

// Location routes
router.get('/locations', isAuthenticated, locationController.getLocations);
router.get('/locations/tree', isAuthenticated, locationController.getLocationTree);
router.get('/locations/:id', isAuthenticated, locationController.getLocationById);
router.post('/locations', isAuthenticated, locationController.createLocation);
router.put('/locations/:id', isAuthenticated, locationController.updateLocation);
router.delete('/locations/:id', isAuthenticated, locationController.deleteLocation);
router.post('/locations/batch', isAuthenticated, locationController.batchCreateLocations);
router.get('/locations/:id/inventory', isAuthenticated, locationController.getLocationInventory);

// Stock Movement routes
router.get('/stock-movements', isAuthenticated, stockMovementController.getStockMovements);
router.get('/stock-movements/:id', isAuthenticated, stockMovementController.getStockMovementById);
router.post('/stock-movements', isAuthenticated, stockMovementController.createStockMovement);
router.post('/stock-movements/batch', isAuthenticated, stockMovementController.batchCreateStockMovements);
router.get('/stock-movements/product/:productId', isAuthenticated, stockMovementController.getProductStockHistory);
router.get('/stock-movements/summary', isAuthenticated, stockMovementController.getStockMovementSummary);

// Purchase Order routes
router.get('/purchase-orders', isAuthenticated, purchaseOrderController.getPurchaseOrders);
router.get('/purchase-orders/:id', isAuthenticated, purchaseOrderController.getPurchaseOrderById);
router.post('/purchase-orders', isAuthenticated, purchaseOrderController.createPurchaseOrder);
router.put('/purchase-orders/:id', isAuthenticated, purchaseOrderController.updatePurchaseOrder);
router.delete('/purchase-orders/:id', isAuthenticated, purchaseOrderController.deletePurchaseOrder);
router.post('/purchase-orders/:id/receive', isAuthenticated, purchaseOrderController.receivePurchaseOrder);
router.post('/purchase-orders/:id/cancel', isAuthenticated, purchaseOrderController.cancelPurchaseOrder);
router.get('/purchase-orders/stats', isAuthenticated, hasRole(['admin', 'manager']), purchaseOrderController.getPurchaseOrderStats);

module.exports = router;
