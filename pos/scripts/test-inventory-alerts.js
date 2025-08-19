/**
 * Test script for inventory alerts functionality
 * This script tests the inventory alert service by:
 * 1. Creating test products and inventory
 * 2. Updating inventory to trigger low stock alerts
 * 3. Verifying alert functionality through socket connections
 */

const mongoose = require('mongoose');
const { io } = require('socket.io-client');
require('dotenv').config();

// Models
const Product = require('../backend/src/models/Product');
const Category = require('../backend/src/models/Category');
const Location = require('../backend/src/models/Location');
const Inventory = require('../backend/src/models/Inventory');
const StockMovement = require('../backend/src/models/StockMovement');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Test data
const testData = {
  category: {
    name: 'Test Category',
    description: 'Category for testing alerts'
  },
  products: [
    {
      name: 'Test Product 1',
      sku: 'TP001',
      price: 19.99,
      minStockLevel: 10
    },
    {
      name: 'Test Product 2',
      sku: 'TP002',
      price: 29.99,
      minStockLevel: 15
    },
    {
      name: 'Test Product 3',
      sku: 'TP003',
      price: 39.99,
      minStockLevel: 20
    }
  ],
  location: {
    name: 'Test Location',
    type: 'warehouse',
    address: '123 Test St'
  }
};

// Create test data
const setupTestData = async () => {
  console.log('Setting up test data...');
  
  // Create category
  const category = await Category.create(testData.category);
  console.log(`Created category: ${category.name}`);
  
  // Create products
  const products = [];
  for (const productData of testData.products) {
    const product = await Product.create({
      ...productData,
      category: category._id
    });
    products.push(product);
    console.log(`Created product: ${product.name}`);
  }
  
  // Create location
  const location = await Location.create(testData.location);
  console.log(`Created location: ${location.name}`);
  
  // Create inventory with sufficient stock
  for (const product of products) {
    const inventory = await Inventory.create({
      product: product._id,
      location: location._id,
      quantity: product.minStockLevel * 2, // Start with double the min stock level
      unitCost: product.price * 0.6 // 60% of selling price
    });
    
    // Create initial stock movement
    await StockMovement.create({
      transactionType: 'adjustment_in',
      product: product._id,
      toLocation: location._id,
      quantity: inventory.quantity,
      unitCost: inventory.unitCost,
      referenceType: 'test',
      notes: 'Initial test inventory'
    });
    
    console.log(`Created inventory for ${product.name}: ${inventory.quantity} units`);
  }
  
  return { category, products, location };
};

// Reduce inventory to trigger alerts
const triggerLowStockAlerts = async (products, location) => {
  console.log('\nReducing inventory to trigger alerts...');
  
  for (const product of products) {
    // Get current inventory
    const inventory = await Inventory.findOne({ 
      product: product._id, 
      location: location._id 
    });
    
    if (!inventory) {
      console.log(`No inventory found for ${product.name}`);
      continue;
    }
    
    // Calculate reduction amount to go below threshold
    const targetQuantity = Math.floor(product.minStockLevel * 0.5); // 50% of min stock
    const reductionAmount = inventory.quantity - targetQuantity;
    
    if (reductionAmount <= 0) {
      console.log(`Inventory for ${product.name} already below threshold`);
      continue;
    }
    
    // Update inventory
    inventory.quantity = targetQuantity;
    await inventory.save();
    
    // Create stock movement
    await StockMovement.create({
      transactionType: 'adjustment_out',
      product: product._id,
      fromLocation: location._id,
      quantity: reductionAmount,
      unitCost: inventory.unitCost,
      referenceType: 'test',
      notes: 'Test inventory reduction'
    });
    
    console.log(`Reduced inventory for ${product.name} to ${targetQuantity} units (below threshold of ${product.minStockLevel})`);
  }
};

// Connect to socket and listen for alerts
const listenForAlerts = () => {
  return new Promise((resolve) => {
    console.log('\nConnecting to socket server to listen for alerts...');
    
    const socket = io('http://localhost:3001', {
      withCredentials: true
    });
    
    socket.on('connect', () => {
      console.log('Socket connected');
      
      // Subscribe to inventory alerts
      socket.emit('inventory:subscribe', { threshold: 20 });
      console.log('Subscribed to inventory alerts with 20% threshold');
      
      // Request immediate check
      socket.emit('inventory:checkLowStock');
      console.log('Requested immediate low stock check');
    });
    
    socket.on('inventory:alert', (alert) => {
      console.log('\n--- ALERT RECEIVED ---');
      console.log(`Product: ${alert.product.name}`);
      console.log(`Location: ${alert.location.name}`);
      console.log(`Current Stock: ${alert.currentStock}`);
      console.log(`Min Stock: ${alert.minStock}`);
      console.log(`Stock Percentage: ${alert.stockPercentage}%`);
      console.log(`Deficit: ${alert.deficit}`);
      console.log('---------------------\n');
    });
    
    // Wait for alerts for 10 seconds then resolve
    setTimeout(() => {
      socket.disconnect();
      console.log('Socket disconnected');
      resolve();
    }, 10000);
  });
};

// Clean up test data
const cleanupTestData = async (category, products, location) => {
  console.log('\nCleaning up test data...');
  
  // Delete stock movements
  await StockMovement.deleteMany({
    product: { $in: products.map(p => p._id) }
  });
  console.log('Deleted test stock movements');
  
  // Delete inventory
  await Inventory.deleteMany({
    product: { $in: products.map(p => p._id) }
  });
  console.log('Deleted test inventory');
  
  // Delete products
  await Product.deleteMany({
    _id: { $in: products.map(p => p._id) }
  });
  console.log('Deleted test products');
  
  // Delete category
  await Category.findByIdAndDelete(category._id);
  console.log('Deleted test category');
  
  // Delete location
  await Location.findByIdAndDelete(location._id);
  console.log('Deleted test location');
};

// Main test function
const runTest = async () => {
  try {
    await connectDB();
    
    // Setup test data
    const { category, products, location } = await setupTestData();
    
    // Wait a moment for data to be properly saved
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Trigger low stock alerts
    await triggerLowStockAlerts(products, location);
    
    // Listen for alerts
    await listenForAlerts();
    
    // Clean up
    await cleanupTestData(category, products, location);
    
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
    process.exit(0);
  }
};

// Run the test
runTest();
