const { Inventory, Product, Location, StockMovement } = require('../../models');
const mongoose = require('mongoose');
const { createError } = require('../../utils/errorHandler');
const inventoryAlerts = require('../../utils/inventoryAlerts');

// Helper function to check if product exists
const checkProductExists = async (productId) => {
  const product = await Product.findById(productId);
  if (!product) {
    throw createError(404, `Product with ID ${productId} not found`);
  }
  return product;
};

// Helper function to check if location exists
const checkLocationExists = async (locationId) => {
  const location = await Location.findById(locationId);
  if (!location) {
    throw createError(404, `Location with ID ${locationId} not found`);
  }
  return location;
};

// Get all inventory items with pagination and filtering
exports.getInventory = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      sortBy = 'product', 
      sortOrder = 'asc',
      location,
      product,
      category,
      lowStock,
      search
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortDirection = sortOrder === 'desc' ? -1 : 1;
    
    // Build query filters
    const filter = {};
    
    if (location) {
      filter.location = location;
    }
    
    if (product) {
      filter.product = product;
    }
    
    // Join with Product to filter by category or search
    let aggregatePipeline = [];
    
    // Lookup related collections
    aggregatePipeline.push(
      { $lookup: {
          from: 'products',
          localField: 'product',
          foreignField: '_id',
          as: 'productData'
        }
      },
      { $unwind: '$productData' },
      { $lookup: {
          from: 'locations',
          localField: 'location',
          foreignField: '_id',
          as: 'locationData'
        }
      },
      { $unwind: '$locationData' }
    );
    
    // Apply filters
    if (category) {
      aggregatePipeline.push({ 
        $match: { 'productData.category': mongoose.Types.ObjectId(category) } 
      });
    }
    
    if (lowStock === 'true') {
      aggregatePipeline.push({ 
        $match: { $expr: { $lte: ['$quantity', '$productData.minStockLevel'] } } 
      });
    }
    
    if (search) {
      aggregatePipeline.push({ 
        $match: { 
          $or: [
            { 'productData.name': { $regex: search, $options: 'i' } },
            { 'productData.sku': { $regex: search, $options: 'i' } },
            { 'productData.barcode': { $regex: search, $options: 'i' } },
            { 'locationData.name': { $regex: search, $options: 'i' } }
          ]
        } 
      });
    }
    
    // Apply base filters
    if (Object.keys(filter).length > 0) {
      aggregatePipeline.push({ $match: filter });
    }
    
    // Count total documents for pagination
    const countPipeline = [...aggregatePipeline];
    countPipeline.push({ $count: 'total' });
    
    // Get count result
    const countResult = await Inventory.aggregate(countPipeline);
    const totalItems = countResult.length > 0 ? countResult[0].total : 0;
    
    // Add sorting and pagination to the main pipeline
    aggregatePipeline.push(
      { $sort: { [sortBy]: sortDirection } },
      { $skip: skip },
      { $limit: parseInt(limit) }
    );
    
    // Project the final result
    aggregatePipeline.push({
      $project: {
        _id: 1,
        product: 1,
        location: 1,
        quantity: 1,
        unitCost: 1,
        lastCountedAt: 1,
        createdAt: 1,
        updatedAt: 1,
        productName: '$productData.name',
        productSku: '$productData.sku',
        productBarcode: '$productData.barcode',
        productPrice: '$productData.price',
        productCost: '$productData.cost',
        minStockLevel: '$productData.minStockLevel',
        locationName: '$locationData.name',
        locationAddress: '$locationData.address'
      }
    });
    
    // Execute the query
    const inventory = await Inventory.aggregate(aggregatePipeline);
    
    // Return paginated results
    res.json({
      items: inventory,
      page: parseInt(page),
      limit: parseInt(limit),
      totalItems,
      totalPages: Math.ceil(totalItems / parseInt(limit))
    });
  } catch (error) {
    next(error);
  }
};

// Get inventory by ID
exports.getInventoryById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const inventory = await Inventory.findById(id)
      .populate('product', 'name sku barcode price cost minStockLevel')
      .populate('location', 'name type address');
    
    if (!inventory) {
      return next(createError(404, 'Inventory item not found'));
    }
    
    res.json(inventory);
  } catch (error) {
    next(error);
  }
};

// Create a new inventory item
exports.createInventory = async (req, res, next) => {
  try {
    const { product, location, quantity, unitCost } = req.body;
    
    // Validate product and location
    await checkProductExists(product);
    await checkLocationExists(location);
    
    // Check if inventory already exists for this product/location
    const existingInventory = await Inventory.findOne({ product, location });
    
    if (existingInventory) {
      return next(createError(400, 'Inventory already exists for this product and location'));
    }
    
    // Create new inventory
    const inventory = new Inventory({
      product,
      location,
      quantity,
      unitCost,
      createdBy: req.user._id,
      updatedBy: req.user._id
    });
    
    await inventory.save();
    
    // Create stock movement record
    const stockMovement = new StockMovement({
      transactionType: 'adjustment_in',
      product,
      toLocation: location,
      quantity,
      unitCost,
      referenceType: 'adjustment',
      notes: 'Initial inventory creation',
      createdBy: req.user._id
    });
    
    await stockMovement.save();
    
    // Trigger inventory alerts for the new product
    await inventoryAlerts.checkAndTriggerProductAlert(product, location);
    
    res.status(201).json(inventory);
  } catch (error) {
    next(error);
  }
};

// Update inventory
exports.updateInventory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { quantity, unitCost } = req.body;
    
    const inventory = await Inventory.findById(id);
    
    if (!inventory) {
      return next(createError(404, 'Inventory item not found'));
    }
    
    // Calculate quantity change
    const quantityChange = quantity - inventory.quantity;
    
    // Update inventory
    inventory.quantity = quantity;
    if (unitCost !== undefined) {
      inventory.unitCost = unitCost;
    }
    inventory.lastCountedAt = new Date();
    inventory.updatedBy = req.user._id;
    
    await inventory.save();
    
    // Create stock movement record if quantity changed
    if (quantityChange !== 0) {
      const stockMovement = new StockMovement({
        transactionType: quantityChange > 0 ? 'adjustment_in' : 'adjustment_out',
        product: inventory.product,
        fromLocation: quantityChange < 0 ? inventory.location : null,
        toLocation: quantityChange > 0 ? inventory.location : null,
        quantity: Math.abs(quantityChange),
        unitCost: inventory.unitCost,
        referenceType: 'adjustment',
        notes: 'Inventory adjustment',
        createdBy: req.user._id
      });
      
      await stockMovement.save();
      
      // Trigger inventory alerts when quantity changes
      await inventoryAlerts.checkAndTriggerProductAlert(inventory.product, inventory.location);
    }
    
    res.json(inventory);
  } catch (error) {
    next(error);
  }
};

// Delete inventory
exports.deleteInventory = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const inventory = await Inventory.findById(id);
    
    if (!inventory) {
      return next(createError(404, 'Inventory item not found'));
    }
    
    // Create stock movement record for the removal
    if (inventory.quantity > 0) {
      const stockMovement = new StockMovement({
        transactionType: 'adjustment_out',
        product: inventory.product,
        fromLocation: inventory.location,
        quantity: inventory.quantity,
        unitCost: inventory.unitCost,
        referenceType: 'adjustment',
        notes: 'Inventory deleted',
        createdBy: req.user._id
      });
      
      await stockMovement.save();
    }
    
    // Store product and location before removal for alerts
    const { product, location } = inventory;
    
    await inventory.remove();
    
    // Trigger inventory alerts for related products after deletion
    await inventoryAlerts.triggerLowStockCheck({ productId: product });
    
    res.json({ message: 'Inventory deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Batch create inventory items
exports.batchCreateInventory = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { items } = req.body;
    
    if (!Array.isArray(items) || items.length === 0) {
      return next(createError(400, 'Items array is required and must not be empty'));
    }
    
    const createdItems = [];
    const stockMovements = [];
    
    // Process each item
    for (const item of items) {
      const { product, location, quantity, unitCost } = item;
      
      // Validate product and location
      await checkProductExists(product);
      await checkLocationExists(location);
      
      // Check if inventory already exists
      const existingInventory = await Inventory.findOne({ product, location }).session(session);
      
      if (existingInventory) {
        await session.abortTransaction();
        return next(createError(400, `Inventory already exists for product ${product} at location ${location}`));
      }
      
      // Create inventory item
      const inventory = new Inventory({
        product,
        location,
        quantity,
        unitCost,
        createdBy: req.user._id,
        updatedBy: req.user._id
      });
      
      await inventory.save({ session });
      createdItems.push(inventory);
      
      // Create stock movement
      stockMovements.push({
        transactionType: 'adjustment_in',
        product,
        toLocation: location,
        quantity,
        unitCost,
        referenceType: 'adjustment',
        notes: 'Batch inventory creation',
        createdBy: req.user._id
      });
    }
    
    // Create all stock movements
    await StockMovement.insertMany(stockMovements, { session });
    
    await session.commitTransaction();
    
    // Trigger inventory alerts for all created items
    for (const item of createdItems) {
      await inventoryAlerts.checkAndTriggerProductAlert(item.product, item.location);
    }
    
    res.status(201).json(createdItems);
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

// Batch update inventory items
exports.batchUpdateInventory = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { items } = req.body;
    
    if (!Array.isArray(items) || items.length === 0) {
      return next(createError(400, 'Items array is required and must not be empty'));
    }
    
    const updatedItems = [];
    const stockMovements = [];
    
    // Process each item
    for (const item of items) {
      const { id, quantity, unitCost } = item;
      
      const inventory = await Inventory.findById(id).session(session);
      
      if (!inventory) {
        await session.abortTransaction();
        return next(createError(404, `Inventory item with ID ${id} not found`));
      }
      
      // Calculate quantity change
      const quantityChange = quantity - inventory.quantity;
      
      // Update inventory
      inventory.quantity = quantity;
      if (unitCost !== undefined) {
        inventory.unitCost = unitCost;
      }
      inventory.lastCountedAt = new Date();
      inventory.updatedBy = req.user._id;
      
      await inventory.save({ session });
      updatedItems.push(inventory);
      
      // Create stock movement if quantity changed
      if (quantityChange !== 0) {
        stockMovements.push({
          transactionType: quantityChange > 0 ? 'adjustment_in' : 'adjustment_out',
          product: inventory.product,
          fromLocation: quantityChange < 0 ? inventory.location : null,
          toLocation: quantityChange > 0 ? inventory.location : null,
          quantity: Math.abs(quantityChange),
          unitCost: inventory.unitCost,
          referenceType: 'adjustment',
          notes: 'Batch inventory adjustment',
          createdBy: req.user._id
        });
      }
    }
    
    // Create all stock movements
    if (stockMovements.length > 0) {
      await StockMovement.insertMany(stockMovements, { session });
    }
    
    await session.commitTransaction();
    
    // Trigger inventory alerts for all updated items
    for (const item of updatedItems) {
      await inventoryAlerts.checkAndTriggerProductAlert(item.product, item.location);
    }
    
    res.json(updatedItems);
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

// Batch delete inventory items
exports.batchDeleteInventory = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return next(createError(400, 'IDs array is required and must not be empty'));
    }
    
    const stockMovements = [];
    
    // Find all inventory items to be deleted
    const inventoryItems = await Inventory.find({ _id: { $in: ids } }).session(session);
    
    if (inventoryItems.length !== ids.length) {
      await session.abortTransaction();
      return next(createError(404, 'One or more inventory items not found'));
    }
    
    // Create stock movements for items with quantity > 0
    for (const inventory of inventoryItems) {
      if (inventory.quantity > 0) {
        stockMovements.push({
          transactionType: 'adjustment_out',
          product: inventory.product,
          fromLocation: inventory.location,
          quantity: inventory.quantity,
          unitCost: inventory.unitCost,
          referenceType: 'adjustment',
          notes: 'Batch inventory deletion',
          createdBy: req.user._id
        });
      }
    }
    
    // Delete inventory items
    await Inventory.deleteMany({ _id: { $in: ids } }).session(session);
    
    // Create stock movements
    if (stockMovements.length > 0) {
      await StockMovement.insertMany(stockMovements, { session });
    }
    
    // Store product IDs before committing transaction
    const affectedProducts = inventoryItems.map(item => item.product);
    
    await session.commitTransaction();
    
    // Trigger inventory alerts for affected products
    for (const productId of affectedProducts) {
      await inventoryAlerts.triggerLowStockCheck({ productId });
    }
    
    res.json({ message: `${ids.length} inventory items deleted successfully` });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

// Get low stock items
exports.getLowStockItems = async (req, res, next) => {
  try {
    const { threshold } = req.query;
    
    const lowStockItems = await Inventory.aggregate([
      {
        $lookup: {
          from: 'products',
          localField: 'product',
          foreignField: '_id',
          as: 'productData'
        }
      },
      { $unwind: '$productData' },
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
        $match: {
          $expr: {
            $lte: [
              '$quantity',
              { $ifNull: [threshold ? parseInt(threshold) : '$productData.minStockLevel', 10] }
            ]
          }
        }
      },
      {
        $project: {
          _id: 1,
          product: 1,
          location: 1,
          quantity: 1,
          unitCost: 1,
          lastCountedAt: 1,
          productName: '$productData.name',
          productSku: '$productData.sku',
          minStockLevel: '$productData.minStockLevel',
          locationName: '$locationData.name',
          stockStatus: {
            $cond: {
              if: { $eq: ['$quantity', 0] },
              then: 'out_of_stock',
              else: 'low_stock'
            }
          }
        }
      },
      { $sort: { quantity: 1 } }
    ]);
    
    res.json(lowStockItems);
  } catch (error) {
    next(error);
  }
};

// Transfer inventory between locations
exports.transferInventory = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { product, fromLocation, toLocation, quantity, notes } = req.body;
    
    if (fromLocation === toLocation) {
      return next(createError(400, 'Source and destination locations cannot be the same'));
    }
    
    // Check if product exists
    await checkProductExists(product);
    
    // Check if locations exist
    await checkLocationExists(fromLocation);
    await checkLocationExists(toLocation);
    
    // Check source inventory
    const sourceInventory = await Inventory.findOne({ product, location: fromLocation }).session(session);
    
    if (!sourceInventory || sourceInventory.quantity < quantity) {
      await session.abortTransaction();
      return next(createError(400, 'Insufficient stock in source location'));
    }
    
    // Update source inventory
    sourceInventory.quantity -= quantity;
    sourceInventory.updatedBy = req.user._id;
    await sourceInventory.save({ session });
    
    // Find or create destination inventory
    let destInventory = await Inventory.findOne({ product, location: toLocation }).session(session);
    
    if (destInventory) {
      // Update existing inventory
      destInventory.quantity += quantity;
      destInventory.updatedBy = req.user._id;
      await destInventory.save({ session });
    } else {
      // Create new inventory
      destInventory = new Inventory({
        product,
        location: toLocation,
        quantity,
        unitCost: sourceInventory.unitCost,
        createdBy: req.user._id,
        updatedBy: req.user._id
      });
      await destInventory.save({ session });
    }
    
    // Create stock movement record
    const stockMovement = new StockMovement({
      transactionType: 'transfer',
      product,
      fromLocation,
      toLocation,
      quantity,
      unitCost: sourceInventory.unitCost,
      referenceType: 'transfer',
      notes: notes || 'Inventory transfer',
      createdBy: req.user._id
    });
    
    await stockMovement.save({ session });
    
    await session.commitTransaction();
    
    res.json({
      sourceInventory,
      destinationInventory: destInventory,
      stockMovement
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};
