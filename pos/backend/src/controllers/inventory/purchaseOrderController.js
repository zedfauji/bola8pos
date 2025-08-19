const { PurchaseOrder, Supplier, Product, Inventory, StockMovement } = require('../../models');
const mongoose = require('mongoose');
const { createError } = require('../../utils/errorHandler');
const inventoryAlerts = require('../../utils/inventoryAlerts');

// Generate a unique purchase order number
const generateOrderNumber = async () => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const prefix = `PO${year}${month}`;
  
  // Find the highest order number with this prefix
  const lastOrder = await PurchaseOrder.findOne({
    orderNumber: new RegExp(`^${prefix}`)
  }).sort({ orderNumber: -1 });
  
  let nextNumber = 1;
  
  if (lastOrder) {
    const lastNumber = parseInt(lastOrder.orderNumber.slice(-4));
    nextNumber = lastNumber + 1;
  }
  
  return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
};

// Get all purchase orders with pagination and filtering
exports.getPurchaseOrders = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      sortBy = 'orderDate', 
      sortOrder = 'desc',
      supplier,
      status,
      startDate,
      endDate,
      search
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
    
    // Build query filters
    const filter = {};
    
    if (supplier) {
      filter.supplier = mongoose.Types.ObjectId(supplier);
    }
    
    if (status) {
      filter.status = status;
    }
    
    // Date range filter
    if (startDate || endDate) {
      filter.orderDate = {};
      
      if (startDate) {
        filter.orderDate.$gte = new Date(startDate);
      }
      
      if (endDate) {
        filter.orderDate.$lte = new Date(endDate);
      }
    }
    
    // Search filter
    if (search) {
      filter.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Count total documents
    const totalItems = await PurchaseOrder.countDocuments(filter);
    
    // Get purchase orders
    const purchaseOrders = await PurchaseOrder.find(filter)
      .populate('supplier', 'name contactPerson phone')
      .populate('location', 'name')
      .populate('createdBy', 'username')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
    // Return paginated results
    res.json({
      items: purchaseOrders,
      page: parseInt(page),
      limit: parseInt(limit),
      totalItems,
      totalPages: Math.ceil(totalItems / parseInt(limit))
    });
  } catch (error) {
    next(error);
  }
};

// Get purchase order by ID
exports.getPurchaseOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const purchaseOrder = await PurchaseOrder.findById(id)
      .populate('supplier', 'name contactPerson email phone address')
      .populate('location', 'name type')
      .populate('items.product', 'name sku barcode price')
      .populate('createdBy', 'username')
      .populate('updatedBy', 'username');
    
    if (!purchaseOrder) {
      return next(createError(404, 'Purchase order not found'));
    }
    
    res.json(purchaseOrder);
  } catch (error) {
    next(error);
  }
};

// Create a new purchase order
exports.createPurchaseOrder = async (req, res, next) => {
  try {
    const {
      supplier,
      location,
      items,
      expectedDeliveryDate,
      notes,
      status = 'draft'
    } = req.body;
    
    // Validate required fields
    if (!supplier || !location || !items || !Array.isArray(items) || items.length === 0) {
      return next(createError(400, 'Supplier, location, and at least one item are required'));
    }
    
    // Check if supplier exists
    const supplierExists = await Supplier.findById(supplier);
    if (!supplierExists) {
      return next(createError(404, 'Supplier not found'));
    }
    
    // Generate order number
    const orderNumber = await generateOrderNumber();
    
    // Validate items and calculate totals
    let subtotal = 0;
    const validatedItems = [];
    
    for (const item of items) {
      const { product, quantity, unitCost, notes } = item;
      
      if (!product || !quantity || !unitCost) {
        return next(createError(400, 'Product, quantity, and unit cost are required for all items'));
      }
      
      // Check if product exists
      const productExists = await Product.findById(product);
      if (!productExists) {
        return next(createError(404, `Product not found: ${product}`));
      }
      
      validatedItems.push({
        product,
        quantity,
        receivedQuantity: 0,
        unitCost,
        notes: notes || ''
      });
      
      subtotal += quantity * unitCost;
    }
    
    // Create purchase order
    const purchaseOrder = new PurchaseOrder({
      orderNumber,
      supplier,
      location,
      status,
      items: validatedItems,
      orderDate: new Date(),
      expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
      subtotal,
      totalAmount: subtotal, // No tax or shipping yet
      notes,
      createdBy: req.user._id,
      updatedBy: req.user._id
    });
    
    await purchaseOrder.save();
    
    // Return the created purchase order with populated fields
    const populatedOrder = await PurchaseOrder.findById(purchaseOrder._id)
      .populate('supplier', 'name contactPerson')
      .populate('location', 'name')
      .populate('items.product', 'name sku')
      .populate('createdBy', 'username');
    
    res.status(201).json(populatedOrder);
  } catch (error) {
    next(error);
  }
};

// Update purchase order
exports.updatePurchaseOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      supplier,
      location,
      items,
      expectedDeliveryDate,
      notes,
      status,
      taxAmount,
      shippingCost
    } = req.body;
    
    const purchaseOrder = await PurchaseOrder.findById(id);
    
    if (!purchaseOrder) {
      return next(createError(404, 'Purchase order not found'));
    }
    
    // Check if order can be updated
    if (['received', 'cancelled'].includes(purchaseOrder.status)) {
      return next(createError(400, `Cannot update purchase order in ${purchaseOrder.status} status`));
    }
    
    // Update supplier if provided
    if (supplier && supplier !== purchaseOrder.supplier.toString()) {
      const supplierExists = await Supplier.findById(supplier);
      if (!supplierExists) {
        return next(createError(404, 'Supplier not found'));
      }
      purchaseOrder.supplier = supplier;
    }
    
    // Update location if provided
    if (location && location !== purchaseOrder.location.toString()) {
      const { Location } = require('../../models');
      const locationExists = await Location.findById(location);
      if (!locationExists) {
        return next(createError(404, 'Location not found'));
      }
      purchaseOrder.location = location;
    }
    
    // Update items if provided
    if (items && Array.isArray(items) && items.length > 0) {
      // Validate items and calculate totals
      let subtotal = 0;
      const validatedItems = [];
      
      for (const item of items) {
        const { product, quantity, unitCost, notes } = item;
        
        if (!product || !quantity || !unitCost) {
          return next(createError(400, 'Product, quantity, and unit cost are required for all items'));
        }
        
        // Check if product exists
        const productExists = await Product.findById(product);
        if (!productExists) {
          return next(createError(404, `Product not found: ${product}`));
        }
        
        // Keep received quantity if item already exists
        const existingItem = purchaseOrder.items.find(i => i.product.toString() === product);
        const receivedQuantity = existingItem ? existingItem.receivedQuantity : 0;
        
        validatedItems.push({
          product,
          quantity,
          receivedQuantity,
          unitCost,
          notes: notes || ''
        });
        
        subtotal += quantity * unitCost;
      }
      
      purchaseOrder.items = validatedItems;
      purchaseOrder.subtotal = subtotal;
      purchaseOrder.totalAmount = subtotal + (taxAmount || purchaseOrder.taxAmount) + (shippingCost || purchaseOrder.shippingCost);
    }
    
    // Update other fields
    if (expectedDeliveryDate) {
      purchaseOrder.expectedDeliveryDate = new Date(expectedDeliveryDate);
    }
    
    if (notes !== undefined) {
      purchaseOrder.notes = notes;
    }
    
    if (status && status !== purchaseOrder.status) {
      purchaseOrder.status = status;
    }
    
    if (taxAmount !== undefined) {
      purchaseOrder.taxAmount = taxAmount;
      purchaseOrder.totalAmount = purchaseOrder.subtotal + taxAmount + purchaseOrder.shippingCost;
    }
    
    if (shippingCost !== undefined) {
      purchaseOrder.shippingCost = shippingCost;
      purchaseOrder.totalAmount = purchaseOrder.subtotal + purchaseOrder.taxAmount + shippingCost;
    }
    
    purchaseOrder.updatedBy = req.user._id;
    
    await purchaseOrder.save();
    
    // Return the updated purchase order with populated fields
    const populatedOrder = await PurchaseOrder.findById(purchaseOrder._id)
      .populate('supplier', 'name contactPerson')
      .populate('location', 'name')
      .populate('items.product', 'name sku')
      .populate('updatedBy', 'username');
    
    res.json(populatedOrder);
  } catch (error) {
    next(error);
  }
};

// Delete purchase order
exports.deletePurchaseOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const purchaseOrder = await PurchaseOrder.findById(id);
    
    if (!purchaseOrder) {
      return next(createError(404, 'Purchase order not found'));
    }
    
    // Check if order can be deleted
    if (['ordered', 'partial', 'received'].includes(purchaseOrder.status)) {
      return next(createError(400, `Cannot delete purchase order in ${purchaseOrder.status} status`));
    }
    
    await purchaseOrder.remove();
    
    res.json({ message: 'Purchase order deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Receive purchase order items
exports.receivePurchaseOrder = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { id } = req.params;
    const { items, receivedDate = new Date(), notes } = req.body;
    
    if (!Array.isArray(items) || items.length === 0) {
      return next(createError(400, 'Items array is required and must not be empty'));
    }
    
    const purchaseOrder = await PurchaseOrder.findById(id).session(session);
    
    if (!purchaseOrder) {
      await session.abortTransaction();
      return next(createError(404, 'Purchase order not found'));
    }
    
    // Check if order can be received
    if (['draft', 'cancelled', 'received'].includes(purchaseOrder.status)) {
      await session.abortTransaction();
      return next(createError(400, `Cannot receive items for purchase order in ${purchaseOrder.status} status`));
    }
    
    // Process each received item
    const stockMovements = [];
    let allItemsReceived = true;
    const productsToCheckForAlerts = new Set();
    
    for (const receivedItem of items) {
      const { product, quantity } = receivedItem;
      
      if (!product || !quantity || quantity <= 0) {
        await session.abortTransaction();
        return next(createError(400, 'Product and quantity > 0 are required for all items'));
      }
      
      // Find the item in the purchase order
      const orderItem = purchaseOrder.items.find(item => item.product.toString() === product);
      
      if (!orderItem) {
        await session.abortTransaction();
        return next(createError(400, `Product ${product} is not in the purchase order`));
      }
      
      // Check if quantity is valid
      const remainingQuantity = orderItem.quantity - orderItem.receivedQuantity;
      
      if (quantity > remainingQuantity) {
        await session.abortTransaction();
        return next(createError(400, `Cannot receive more than the remaining quantity (${remainingQuantity}) for product ${product}`));
      }
      
      // Update received quantity
      orderItem.receivedQuantity += quantity;
      
      // Check if all items are fully received
      if (orderItem.receivedQuantity < orderItem.quantity) {
        allItemsReceived = false;
      }
      
      // Update inventory
      let inventory = await Inventory.findOne({
        product: mongoose.Types.ObjectId(product),
        location: purchaseOrder.location
      }).session(session);
      
      if (inventory) {
        inventory.quantity += quantity;
        inventory.updatedBy = req.user._id;
        await inventory.save({ session });
      } else {
        inventory = new Inventory({
          product,
          location: purchaseOrder.location,
          quantity,
          unitCost: orderItem.unitCost,
          createdBy: req.user._id,
          updatedBy: req.user._id
        });
        await inventory.save({ session });
      }
      
      // Add product to check for alerts
      productsToCheckForAlerts.add(product);
      
      // Create stock movement
      stockMovements.push({
        transactionType: 'purchase',
        product,
        toLocation: purchaseOrder.location,
        quantity,
        unitCost: orderItem.unitCost,
        referenceType: 'purchase_order',
        referenceId: purchaseOrder._id,
        notes: `Received from PO ${purchaseOrder.orderNumber}`,
        createdBy: req.user._id
      });
    }
    
    // Update purchase order status
    purchaseOrder.status = allItemsReceived ? 'received' : 'partial';
    purchaseOrder.receivedDate = receivedDate;
    
    if (notes) {
      purchaseOrder.notes = purchaseOrder.notes 
        ? `${purchaseOrder.notes}\n${notes}` 
        : notes;
    }
    
    purchaseOrder.updatedBy = req.user._id;
    
    await purchaseOrder.save({ session });
    
    // Create stock movements
    await StockMovement.insertMany(stockMovements, { session });
    
    await session.commitTransaction();
    
    // Check for inventory alerts after transaction is committed
    for (const product of productsToCheckForAlerts) {
      await inventoryAlerts.checkAndTriggerProductAlert(product, purchaseOrder.location);
    }
    
    res.json(populatedOrder);
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

// Cancel purchase order
exports.cancelPurchaseOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const purchaseOrder = await PurchaseOrder.findById(id);
    
    if (!purchaseOrder) {
      return next(createError(404, 'Purchase order not found'));
    }
    
    // Check if order can be cancelled
    if (['received', 'cancelled'].includes(purchaseOrder.status)) {
      return next(createError(400, `Cannot cancel purchase order in ${purchaseOrder.status} status`));
    }
    
    // Update purchase order
    purchaseOrder.status = 'cancelled';
    
    if (reason) {
      purchaseOrder.notes = purchaseOrder.notes 
        ? `${purchaseOrder.notes}\nCancellation reason: ${reason}` 
        : `Cancellation reason: ${reason}`;
    }
    
    purchaseOrder.updatedBy = req.user._id;
    
    await purchaseOrder.save();
    
    res.json({
      message: 'Purchase order cancelled successfully',
      purchaseOrder
    });
  } catch (error) {
    next(error);
  }
};

// Get purchase order summary statistics
// Batch create purchase orders
exports.batchCreatePurchaseOrders = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { purchaseOrders } = req.body;
    
    if (!Array.isArray(purchaseOrders) || purchaseOrders.length === 0) {
      return next(createError(400, 'Purchase orders array is required and must not be empty'));
    }
    
    const createdPurchaseOrders = [];
    const errors = [];
    
    // Process each purchase order
    for (const poData of purchaseOrders) {
      try {
        const {
          supplier,
          location,
          items,
          expectedDeliveryDate,
          notes,
          status = 'draft'
        } = poData;
        
        // Validate required fields
        if (!supplier || !location || !items || !Array.isArray(items) || items.length === 0) {
          errors.push('Supplier, location, and at least one item are required');
          continue;
        }
        
        // Check if supplier exists
        const supplierExists = await Supplier.findById(supplier).session(session);
        if (!supplierExists) {
          errors.push(`Supplier not found: ${supplier}`);
          continue;
        }
        
        // Generate order number
        const orderNumber = await generateOrderNumber();
        
        // Validate items and calculate totals
        let subtotal = 0;
        const validatedItems = [];
        let hasItemErrors = false;
        
        for (const item of items) {
          const { product, quantity, unitCost, notes } = item;
          
          if (!product || !quantity || !unitCost) {
            errors.push('Product, quantity, and unit cost are required for all items');
            hasItemErrors = true;
            break;
          }
          
          // Check if product exists
          const productExists = await Product.findById(product).session(session);
          if (!productExists) {
            errors.push(`Product not found: ${product}`);
            hasItemErrors = true;
            break;
          }
          
          validatedItems.push({
            product,
            quantity,
            receivedQuantity: 0,
            unitCost,
            notes: notes || ''
          });
          
          subtotal += quantity * unitCost;
        }
        
        if (hasItemErrors) {
          continue;
        }
        
        // Create purchase order
        const purchaseOrder = new PurchaseOrder({
          orderNumber,
          supplier,
          location,
          status,
          items: validatedItems,
          orderDate: new Date(),
          expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
          subtotal,
          totalAmount: subtotal, // No tax or shipping yet
          notes,
          createdBy: req.user._id,
          updatedBy: req.user._id
        });
        
        await purchaseOrder.save({ session });
        createdPurchaseOrders.push(purchaseOrder);
      } catch (error) {
        errors.push(`Error creating purchase order: ${error.message}`);
      }
    }
    
    if (createdPurchaseOrders.length === 0) {
      await session.abortTransaction();
      return next(createError(400, 'No purchase orders could be created'));
    }
    
    await session.commitTransaction();
    
    // Return the created purchase orders
    res.status(201).json({
      created: createdPurchaseOrders,
      errors: errors.length > 0 ? errors : undefined,
      success: createdPurchaseOrders.length,
      failed: errors.length
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

// Batch update purchase orders
exports.batchUpdatePurchaseOrders = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { purchaseOrders } = req.body;
    
    if (!Array.isArray(purchaseOrders) || purchaseOrders.length === 0) {
      return next(createError(400, 'Purchase orders array is required and must not be empty'));
    }
    
    const updatedPurchaseOrders = [];
    const errors = [];
    
    // Process each purchase order
    for (const poData of purchaseOrders) {
      try {
        const { id, ...updateData } = poData;
        
        if (!id) {
          errors.push('Purchase order ID is required');
          continue;
        }
        
        const purchaseOrder = await PurchaseOrder.findById(id).session(session);
        
        if (!purchaseOrder) {
          errors.push(`Purchase order with ID ${id} not found`);
          continue;
        }
        
        // Check if order can be updated
        if (['received', 'cancelled'].includes(purchaseOrder.status)) {
          errors.push(`Cannot update purchase order in ${purchaseOrder.status} status`);
          continue;
        }
        
        // Update supplier if provided
        if (updateData.supplier && updateData.supplier !== purchaseOrder.supplier.toString()) {
          const supplierExists = await Supplier.findById(updateData.supplier).session(session);
          if (!supplierExists) {
            errors.push(`Supplier not found: ${updateData.supplier}`);
            continue;
          }
          purchaseOrder.supplier = updateData.supplier;
        }
        
        // Update location if provided
        if (updateData.location && updateData.location !== purchaseOrder.location.toString()) {
          const { Location } = require('../../models');
          const locationExists = await Location.findById(updateData.location).session(session);
          if (!locationExists) {
            errors.push(`Location not found: ${updateData.location}`);
            continue;
          }
          purchaseOrder.location = updateData.location;
        }
        
        // Update items if provided
        if (updateData.items && Array.isArray(updateData.items) && updateData.items.length > 0) {
          // Validate items and calculate totals
          let subtotal = 0;
          const validatedItems = [];
          let hasItemErrors = false;
          
          for (const item of updateData.items) {
            const { product, quantity, unitCost, notes } = item;
            
            if (!product || !quantity || !unitCost) {
              errors.push(`Product, quantity, and unit cost are required for all items in order ${id}`);
              hasItemErrors = true;
              break;
            }
            
            // Check if product exists
            const productExists = await Product.findById(product).session(session);
            if (!productExists) {
              errors.push(`Product not found: ${product} in order ${id}`);
              hasItemErrors = true;
              break;
            }
            
            // Keep received quantity if item already exists
            const existingItem = purchaseOrder.items.find(i => i.product.toString() === product);
            const receivedQuantity = existingItem ? existingItem.receivedQuantity : 0;
            
            validatedItems.push({
              product,
              quantity,
              receivedQuantity,
              unitCost,
              notes: notes || ''
            });
            
            subtotal += quantity * unitCost;
          }
          
          if (hasItemErrors) {
            continue;
          }
          
          purchaseOrder.items = validatedItems;
          purchaseOrder.subtotal = subtotal;
          purchaseOrder.totalAmount = subtotal + 
            (updateData.taxAmount !== undefined ? updateData.taxAmount : purchaseOrder.taxAmount) + 
            (updateData.shippingCost !== undefined ? updateData.shippingCost : purchaseOrder.shippingCost);
        }
        
        // Update other fields
        if (updateData.expectedDeliveryDate) {
          purchaseOrder.expectedDeliveryDate = new Date(updateData.expectedDeliveryDate);
        }
        
        if (updateData.notes !== undefined) {
          purchaseOrder.notes = updateData.notes;
        }
        
        if (updateData.status && updateData.status !== purchaseOrder.status) {
          purchaseOrder.status = updateData.status;
        }
        
        if (updateData.taxAmount !== undefined) {
          purchaseOrder.taxAmount = updateData.taxAmount;
          purchaseOrder.totalAmount = purchaseOrder.subtotal + updateData.taxAmount + purchaseOrder.shippingCost;
        }
        
        if (updateData.shippingCost !== undefined) {
          purchaseOrder.shippingCost = updateData.shippingCost;
          purchaseOrder.totalAmount = purchaseOrder.subtotal + purchaseOrder.taxAmount + updateData.shippingCost;
        }
        
        purchaseOrder.updatedBy = req.user._id;
        
        await purchaseOrder.save({ session });
        updatedPurchaseOrders.push(purchaseOrder);
      } catch (error) {
        errors.push(`Error updating purchase order: ${error.message}`);
      }
    }
    
    if (updatedPurchaseOrders.length === 0) {
      await session.abortTransaction();
      return next(createError(400, 'No purchase orders could be updated'));
    }
    
    await session.commitTransaction();
    
    // Return the updated purchase orders
    res.json({
      updated: updatedPurchaseOrders,
      errors: errors.length > 0 ? errors : undefined,
      success: updatedPurchaseOrders.length,
      failed: errors.length
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

// Batch delete purchase orders
exports.batchDeletePurchaseOrders = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return next(createError(400, 'Purchase order IDs array is required and must not be empty'));
    }
    
    const deletedPurchaseOrders = [];
    const errors = [];
    
    // Process each purchase order ID
    for (const id of ids) {
      try {
        const purchaseOrder = await PurchaseOrder.findById(id).session(session);
        
        if (!purchaseOrder) {
          errors.push(`Purchase order with ID ${id} not found`);
          continue;
        }
        
        // Check if order can be deleted
        if (!['draft', 'cancelled'].includes(purchaseOrder.status)) {
          errors.push(`Cannot delete purchase order in ${purchaseOrder.status} status`);
          continue;
        }
        
        await PurchaseOrder.findByIdAndDelete(id).session(session);
        deletedPurchaseOrders.push({ id, orderNumber: purchaseOrder.orderNumber });
      } catch (error) {
        errors.push(`Error deleting purchase order ${id}: ${error.message}`);
      }
    }
    
    if (deletedPurchaseOrders.length === 0) {
      await session.abortTransaction();
      return next(createError(400, 'No purchase orders could be deleted'));
    }
    
    await session.commitTransaction();
    
    // Return the deleted purchase orders
    res.json({
      deleted: deletedPurchaseOrders,
      errors: errors.length > 0 ? errors : undefined,
      success: deletedPurchaseOrders.length,
      failed: errors.length
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

exports.getPurchaseOrderStats = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build match stage
    const matchStage = {};
    
    // Date range filter
    if (startDate || endDate) {
      matchStage.orderDate = {};
      
      if (startDate) {
        matchStage.orderDate.$gte = new Date(startDate);
      }
      
      if (endDate) {
        matchStage.orderDate.$lte = new Date(endDate);
      }
    }
    
    // Aggregate purchase order statistics
    const stats = await PurchaseOrder.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      },
      {
        $project: {
          _id: 0,
          status: '$_id',
          count: 1,
          totalAmount: 1
        }
      }
    ]);
    
    // Get total counts
    const totalCount = stats.reduce((sum, stat) => sum + stat.count, 0);
    const totalAmount = stats.reduce((sum, stat) => sum + stat.totalAmount, 0);
    
    // Get top suppliers
    const topSuppliers = await PurchaseOrder.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$supplier',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      },
      { $sort: { totalAmount: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'suppliers',
          localField: '_id',
          foreignField: '_id',
          as: 'supplierData'
        }
      },
      { $unwind: '$supplierData' },
      {
        $project: {
          _id: 0,
          supplierId: '$_id',
          supplierName: '$supplierData.name',
          count: 1,
          totalAmount: 1
        }
      }
    ]);
    
    res.json({
      statusBreakdown: stats,
      totalCount,
      totalAmount,
      topSuppliers
    });
  } catch (error) {
    next(error);
  }
};
