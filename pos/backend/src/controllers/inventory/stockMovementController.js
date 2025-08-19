const { StockMovement, Inventory, Product, Location } = require('../../models');
const mongoose = require('mongoose');
const { createError } = require('../../utils/errorHandler');
const inventoryAlerts = require('../../utils/inventoryAlerts');

// Get all stock movements with pagination and filtering
exports.getStockMovements = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      sortBy = 'createdAt', 
      sortOrder = 'desc',
      product,
      location,
      transactionType,
      startDate,
      endDate,
      search
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortDirection = sortOrder === 'desc' ? -1 : 1;
    
    // Build query filters
    const filter = {};
    
    if (product) {
      filter.product = mongoose.Types.ObjectId(product);
    }
    
    if (location) {
      filter.$or = [
        { fromLocation: mongoose.Types.ObjectId(location) },
        { toLocation: mongoose.Types.ObjectId(location) }
      ];
    }
    
    if (transactionType) {
      filter.transactionType = transactionType;
    }
    
    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }
    
    // Build aggregation pipeline
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
          localField: 'fromLocation',
          foreignField: '_id',
          as: 'fromLocationData'
        }
      },
      { $lookup: {
          from: 'locations',
          localField: 'toLocation',
          foreignField: '_id',
          as: 'toLocationData'
        }
      },
      { $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'userData'
        }
      },
      { $unwind: {
          path: '$userData',
          preserveNullAndEmptyArrays: true
        }
      }
    );
    
    // Apply search filter if provided
    if (search) {
      aggregatePipeline.push({
        $match: {
          $or: [
            { 'productData.name': { $regex: search, $options: 'i' } },
            { 'productData.sku': { $regex: search, $options: 'i' } },
            { 'fromLocationData.name': { $regex: search, $options: 'i' } },
            { 'toLocationData.name': { $regex: search, $options: 'i' } },
            { notes: { $regex: search, $options: 'i' } }
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
    const countResult = await StockMovement.aggregate(countPipeline);
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
        transactionType: 1,
        product: 1,
        fromLocation: 1,
        toLocation: 1,
        quantity: 1,
        unitCost: 1,
        referenceType: 1,
        referenceId: 1,
        notes: 1,
        createdBy: 1,
        createdAt: 1,
        productName: '$productData.name',
        productSku: '$productData.sku',
        fromLocationName: { $arrayElemAt: ['$fromLocationData.name', 0] },
        toLocationName: { $arrayElemAt: ['$toLocationData.name', 0] },
        createdByUser: {
          _id: '$userData._id',
          username: '$userData.username'
        }
      }
    });
    
    // Execute the query
    const stockMovements = await StockMovement.aggregate(aggregatePipeline);
    
    // Return paginated results
    res.json({
      items: stockMovements,
      page: parseInt(page),
      limit: parseInt(limit),
      totalItems,
      totalPages: Math.ceil(totalItems / parseInt(limit))
    });
  } catch (error) {
    next(error);
  }
};

// Get stock movement by ID
exports.getStockMovementById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const stockMovement = await StockMovement.findById(id)
      .populate('product', 'name sku barcode price')
      .populate('fromLocation', 'name type')
      .populate('toLocation', 'name type')
      .populate('createdBy', 'username');
    
    if (!stockMovement) {
      return next(createError(404, 'Stock movement not found'));
    }
    
    res.json(stockMovement);
  } catch (error) {
    next(error);
  }
};

// Create a new stock movement and update inventory
exports.createStockMovement = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { 
      transactionType, 
      product, 
      fromLocation, 
      toLocation, 
      quantity, 
      unitCost, 
      referenceType, 
      referenceId, 
      notes 
    } = req.body;
    
    // Validate required fields
    if (!transactionType || !product || !quantity) {
      return next(createError(400, 'Transaction type, product, and quantity are required'));
    }
    
    // Validate transaction type
    const validTransactionTypes = ['purchase', 'sale', 'adjustment_in', 'adjustment_out', 'transfer', 'waste', 'return'];
    if (!validTransactionTypes.includes(transactionType)) {
      return next(createError(400, 'Invalid transaction type'));
    }
    
    // Check if product exists
    const productExists = await Product.findById(product);
    if (!productExists) {
      return next(createError(404, 'Product not found'));
    }
    
    // Validate locations based on transaction type
    if (['transfer', 'sale', 'adjustment_out', 'waste'].includes(transactionType) && !fromLocation) {
      return next(createError(400, 'From location is required for this transaction type'));
    }
    
    if (['transfer', 'purchase', 'adjustment_in', 'return'].includes(transactionType) && !toLocation) {
      return next(createError(400, 'To location is required for this transaction type'));
    }
    
    // Check if locations exist
    if (fromLocation) {
      const fromLocationExists = await Location.findById(fromLocation);
      if (!fromLocationExists) {
        return next(createError(404, 'From location not found'));
      }
    }
    
    if (toLocation) {
      const toLocationExists = await Location.findById(toLocation);
      if (!toLocationExists) {
        return next(createError(404, 'To location not found'));
      }
    }
    
    // Update inventory based on transaction type
    if (fromLocation) {
      // Decrease inventory at source location
      const sourceInventory = await Inventory.findOne({ product, location: fromLocation }).session(session);
      
      if (!sourceInventory || sourceInventory.quantity < quantity) {
        await session.abortTransaction();
        return next(createError(400, 'Insufficient stock in source location'));
      }
      
      sourceInventory.quantity -= quantity;
      sourceInventory.updatedBy = req.user._id;
      await sourceInventory.save({ session });
    }
    
    if (toLocation) {
      // Increase inventory at destination location
      let destInventory = await Inventory.findOne({ product, location: toLocation }).session(session);
      
      if (destInventory) {
        destInventory.quantity += quantity;
        destInventory.updatedBy = req.user._id;
        await destInventory.save({ session });
      } else {
        // Create new inventory record
        destInventory = new Inventory({
          product,
          location: toLocation,
          quantity,
          unitCost: unitCost || 0,
          createdBy: req.user._id,
          updatedBy: req.user._id
        });
        await destInventory.save({ session });
      }
    }
    
    // Create stock movement record
    const stockMovement = new StockMovement({
      transactionType,
      product,
      fromLocation,
      toLocation,
      quantity,
      unitCost: unitCost || 0,
      referenceType,
      referenceId,
      notes,
      createdBy: req.user._id
    });
    
    await stockMovement.save({ session });
    
    await session.commitTransaction();
    
    // Trigger inventory alerts for affected product
    await inventoryAlerts.checkAndTriggerProductAlert(product, toLocation || fromLocation);
    
    // Return the created stock movement with populated fields
    const populatedMovement = await StockMovement.findById(stockMovement._id)
      .populate('product', 'name sku barcode price')
      .populate('fromLocation', 'name type')
      .populate('toLocation', 'name type')
      .populate('createdBy', 'username');
    
    res.status(201).json(populatedMovement);
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

// Batch create stock movements
exports.batchCreateStockMovements = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { movements } = req.body;
    
    if (!Array.isArray(movements) || movements.length === 0) {
      return next(createError(400, 'Movements array is required and must not be empty'));
    }
    
    const createdMovements = [];
    
    // Process each movement
    for (const movement of movements) {
      const { 
        transactionType, 
        product, 
        fromLocation, 
        toLocation, 
        quantity, 
        unitCost, 
        referenceType, 
        referenceId, 
        notes 
      } = movement;
      
      // Validate required fields
      if (!transactionType || !product || !quantity) {
        await session.abortTransaction();
        return next(createError(400, 'Transaction type, product, and quantity are required for all movements'));
      }
      
      // Validate transaction type
      const validTransactionTypes = ['purchase', 'sale', 'adjustment_in', 'adjustment_out', 'transfer', 'waste', 'return'];
      if (!validTransactionTypes.includes(transactionType)) {
        await session.abortTransaction();
        return next(createError(400, `Invalid transaction type: ${transactionType}`));
      }
      
      // Check if product exists
      const productExists = await Product.findById(product);
      if (!productExists) {
        await session.abortTransaction();
        return next(createError(404, `Product not found: ${product}`));
      }
      
      // Validate locations based on transaction type
      if (['transfer', 'sale', 'adjustment_out', 'waste'].includes(transactionType) && !fromLocation) {
        await session.abortTransaction();
        return next(createError(400, 'From location is required for this transaction type'));
      }
      
      if (['transfer', 'purchase', 'adjustment_in', 'return'].includes(transactionType) && !toLocation) {
        await session.abortTransaction();
        return next(createError(400, 'To location is required for this transaction type'));
      }
      
      // Check if locations exist
      if (fromLocation) {
        const fromLocationExists = await Location.findById(fromLocation);
        if (!fromLocationExists) {
          await session.abortTransaction();
          return next(createError(404, `From location not found: ${fromLocation}`));
        }
      }
      
      if (toLocation) {
        const toLocationExists = await Location.findById(toLocation);
        if (!toLocationExists) {
          await session.abortTransaction();
          return next(createError(404, `To location not found: ${toLocation}`));
        }
      }
      
      // Update inventory based on transaction type
      if (fromLocation) {
        // Decrease inventory at source location
        const sourceInventory = await Inventory.findOne({ product, location: fromLocation }).session(session);
        
        if (!sourceInventory || sourceInventory.quantity < quantity) {
          await session.abortTransaction();
          return next(createError(400, `Insufficient stock for product ${product} in location ${fromLocation}`));
        }
        
        sourceInventory.quantity -= quantity;
        sourceInventory.updatedBy = req.user._id;
        await sourceInventory.save({ session });
      }
      
      if (toLocation) {
        // Increase inventory at destination location
        let destInventory = await Inventory.findOne({ product, location: toLocation }).session(session);
        
        if (destInventory) {
          destInventory.quantity += quantity;
          destInventory.updatedBy = req.user._id;
          await destInventory.save({ session });
        } else {
          // Create new inventory record
          destInventory = new Inventory({
            product,
            location: toLocation,
            quantity,
            unitCost: unitCost || 0,
            createdBy: req.user._id,
            updatedBy: req.user._id
          });
          await destInventory.save({ session });
        }
      }
      
      // Create stock movement record
      const stockMovement = new StockMovement({
        transactionType,
        product,
        fromLocation,
        toLocation,
        quantity,
        unitCost: unitCost || 0,
        referenceType,
        referenceId,
        notes,
        createdBy: req.user._id
      });
      
      await stockMovement.save({ session });
      createdMovements.push(stockMovement);
    }
    
    await session.commitTransaction();
    
    // Trigger inventory alerts for affected products
    for (const movement of createdMovements) {
      await inventoryAlerts.checkAndTriggerProductAlert(movement.product, movement.toLocation || movement.fromLocation);
    }
    
    res.status(201).json(createdMovements);
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

// Get stock movement history for a product
exports.getProductStockHistory = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { 
      page = 1, 
      limit = 20, 
      startDate, 
      endDate 
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build query filters
    const filter = { product: mongoose.Types.ObjectId(productId) };
    
    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }
    
    // Count total documents
    const totalItems = await StockMovement.countDocuments(filter);
    
    // Get stock movements
    const stockMovements = await StockMovement.find(filter)
      .populate('product', 'name sku barcode price')
      .populate('fromLocation', 'name type')
      .populate('toLocation', 'name type')
      .populate('createdBy', 'username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Return paginated results
    res.json({
      items: stockMovements,
      page: parseInt(page),
      limit: parseInt(limit),
      totalItems,
      totalPages: Math.ceil(totalItems / parseInt(limit))
    });
  } catch (error) {
    next(error);
  }
};

// Get stock movement summary by product
exports.getStockMovementSummary = async (req, res, next) => {
  try {
    const { startDate, endDate, location } = req.query;
    
    // Build match stage
    const matchStage = {};
    
    // Date range filter
    if (startDate || endDate) {
      matchStage.createdAt = {};
      
      if (startDate) {
        matchStage.createdAt.$gte = new Date(startDate);
      }
      
      if (endDate) {
        matchStage.createdAt.$lte = new Date(endDate);
      }
    }
    
    // Location filter
    if (location) {
      matchStage.$or = [
        { fromLocation: mongoose.Types.ObjectId(location) },
        { toLocation: mongoose.Types.ObjectId(location) }
      ];
    }
    
    // Aggregate stock movements by product
    const summary = await StockMovement.aggregate([
      { $match: matchStage },
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
        $group: {
          _id: '$product',
          productName: { $first: '$productData.name' },
          productSku: { $first: '$productData.sku' },
          totalIn: {
            $sum: {
              $cond: [
                { $in: ['$transactionType', ['purchase', 'adjustment_in', 'return']] },
                '$quantity',
                0
              ]
            }
          },
          totalOut: {
            $sum: {
              $cond: [
                { $in: ['$transactionType', ['sale', 'adjustment_out', 'waste']] },
                '$quantity',
                0
              ]
            }
          },
          totalTransfers: {
            $sum: {
              $cond: [
                { $eq: ['$transactionType', 'transfer'] },
                '$quantity',
                0
              ]
            }
          },
          movements: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          productId: '$_id',
          productName: 1,
          productSku: 1,
          totalIn: 1,
          totalOut: 1,
          totalTransfers: 1,
          netChange: { $subtract: ['$totalIn', '$totalOut'] },
          movements: 1
        }
      },
      { $sort: { productName: 1 } }
    ]);
    
    res.json(summary);
  } catch (error) {
    next(error);
  }
};
