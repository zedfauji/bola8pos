const { Inventory, Product } = require('../models');
const mongoose = require('mongoose');

/**
 * Inventory Alert Service
 * Handles real-time low stock alerts using Socket.io
 */
class InventoryAlertService {
  constructor(io) {
    this.io = io;
    this.alertsRoom = 'inventory-alerts';
    this.setupSocketEvents();
    this.alertThreshold = 0; // Default threshold percentage
  }

  /**
   * Setup Socket.io event handlers
   */
  setupSocketEvents() {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      // Join inventory alerts room when client subscribes
      socket.on('subscribe:inventory-alerts', (userData) => {
        // Only allow authenticated users with appropriate roles
        if (userData && userData.roles && 
            (userData.roles.includes('admin') || 
             userData.roles.includes('manager') || 
             userData.roles.includes('inventory'))) {
          socket.join(this.alertsRoom);
          console.log(`User ${userData.username} subscribed to inventory alerts`);
        }
      });

      // Leave inventory alerts room
      socket.on('unsubscribe:inventory-alerts', () => {
        socket.leave(this.alertsRoom);
      });

      // Set custom alert threshold for this connection
      socket.on('set:alert-threshold', (threshold) => {
        if (typeof threshold === 'number' && threshold >= 0) {
          socket.alertThreshold = threshold;
        }
      });
    });
  }

  /**
   * Check for low stock items and emit alerts
   * @param {Object} options - Options for the check
   * @param {Number} options.threshold - Override the default threshold percentage
   * @param {String} options.categoryId - Filter by category
   * @param {String} options.locationId - Filter by location
   */
  async checkLowStockItems(options = {}) {
    if (!this.io) return;
    
    try {
      const threshold = options.threshold || this.alertThreshold;
      const filter = {};
      
      if (options.locationId) {
        filter.location = mongoose.Types.ObjectId(options.locationId);
      }
      
      // Build aggregation pipeline
      const pipeline = [
        { $match: filter }
      ];
      
      // Lookup product data
      pipeline.push(
        {
          $lookup: {
            from: 'products',
            localField: 'product',
            foreignField: '_id',
            as: 'productData'
          }
        },
        { $unwind: '$productData' }
      );
      
      // Filter by category if provided
      if (options.categoryId) {
        pipeline.push({
          $match: { 'productData.category': mongoose.Types.ObjectId(options.categoryId) }
        });
      }
      
      // Add location data
      pipeline.push({
        $lookup: {
          from: 'locations',
          localField: 'location',
          foreignField: '_id',
          as: 'locationData'
        }
      });
      
      pipeline.push({ $unwind: '$locationData' });
      
      // Calculate if stock is low
      pipeline.push({
        $addFields: {
          isLowStock: {
            $lte: ['$quantity', '$productData.minStockLevel']
          },
          stockPercentage: {
            $cond: [
              { $eq: ['$productData.minStockLevel', 0] },
              100, // Avoid division by zero
              {
                $multiply: [
                  { $divide: ['$quantity', '$productData.minStockLevel'] },
                  100
                ]
              }
            ]
          }
        }
      });
      
      // Filter for low stock based on threshold
      pipeline.push({
        $match: {
          $or: [
            { isLowStock: true },
            { stockPercentage: { $lte: threshold } }
          ]
        }
      });
      
      // Project the final result
      pipeline.push({
        $project: {
          _id: 1,
          product: 1,
          location: 1,
          quantity: 1,
          productName: '$productData.name',
          productSku: '$productData.sku',
          minStockLevel: '$productData.minStockLevel',
          locationName: '$locationData.name',
          isLowStock: 1,
          stockPercentage: 1,
          deficit: {
            $subtract: ['$productData.minStockLevel', '$quantity']
          }
        }
      });
      
      // Sort by stock percentage ascending (most critical first)
      pipeline.push({ $sort: { stockPercentage: 1 } });
      
      const lowStockItems = await Inventory.aggregate(pipeline);
      
      if (lowStockItems.length > 0) {
        // Emit low stock alerts to subscribed clients
        this.io.to(this.alertsRoom).emit('low-stock-alert', {
          timestamp: new Date(),
          items: lowStockItems,
          count: lowStockItems.length
        });
        
        return lowStockItems;
      }
      
      return [];
    } catch (error) {
      console.error('Error checking low stock items:', error);
      return [];
    }
  }

  /**
   * Check if a specific product is low in stock
   * @param {String} productId - Product ID to check
   * @param {String} locationId - Optional location ID to check
   * @returns {Promise<Boolean>} - True if product is low in stock
   */
  async isProductLowInStock(productId, locationId = null) {
    try {
      const product = await Product.findById(productId);
      if (!product) return false;
      
      const filter = { product: mongoose.Types.ObjectId(productId) };
      if (locationId) {
        filter.location = mongoose.Types.ObjectId(locationId);
      }
      
      // Get inventory for this product
      const inventoryItems = await Inventory.find(filter);
      
      if (inventoryItems.length === 0) {
        // No inventory records means it's definitely low in stock
        return true;
      }
      
      // Calculate total quantity across all locations (or specific location)
      const totalQuantity = inventoryItems.reduce((sum, item) => sum + item.quantity, 0);
      
      // Check if total quantity is below minimum stock level
      return totalQuantity <= product.minStockLevel;
    } catch (error) {
      console.error('Error checking if product is low in stock:', error);
      return false;
    }
  }

  /**
   * Send an alert for a specific product
   * @param {String} productId - Product ID to alert about
   * @param {String} locationId - Optional location ID
   */
  async sendProductAlert(productId, locationId = null) {
    if (!this.io) return;
    
    try {
      const product = await Product.findById(productId);
      if (!product) return;
      
      const filter = { product: mongoose.Types.ObjectId(productId) };
      if (locationId) {
        filter.location = mongoose.Types.ObjectId(locationId);
      }
      
      // Get inventory for this product with location data
      const inventoryItems = await Inventory.aggregate([
        { $match: filter },
        {
          $lookup: {
            from: 'locations',
            localField: 'location',
            foreignField: '_id',
            as: 'locationData'
          }
        },
        { $unwind: '$locationData' },
        {
          $project: {
            _id: 1,
            product: 1,
            location: 1,
            quantity: 1,
            locationName: '$locationData.name',
            deficit: {
              $subtract: [product.minStockLevel, '$quantity']
            },
            isLowStock: {
              $lte: ['$quantity', product.minStockLevel]
            }
          }
        }
      ]);
      
      if (inventoryItems.some(item => item.isLowStock)) {
        // Emit product-specific alert
        this.io.to(this.alertsRoom).emit('product-stock-alert', {
          timestamp: new Date(),
          product: {
            _id: product._id,
            name: product.name,
            sku: product.sku,
            minStockLevel: product.minStockLevel
          },
          inventory: inventoryItems,
          isLowStock: true
        });
      }
    } catch (error) {
      console.error('Error sending product alert:', error);
    }
  }

  /**
   * Schedule periodic checks for low stock items
   * @param {Number} intervalMinutes - Interval in minutes between checks
   */
  schedulePeriodicChecks(intervalMinutes = 60) {
    if (!this.io) return;
    
    // Convert minutes to milliseconds
    const interval = intervalMinutes * 60 * 1000;
    
    // Schedule periodic checks
    setInterval(() => {
      this.checkLowStockItems();
    }, interval);
    
    console.log(`Scheduled low stock checks every ${intervalMinutes} minutes`);
  }
}

module.exports = InventoryAlertService;
