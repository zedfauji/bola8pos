const { Location } = require('../../models');
const { createError } = require('../../utils/errorHandler');
const mongoose = require('mongoose');

// Get all locations with pagination and filtering
exports.getLocations = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      sortBy = 'name', 
      sortOrder = 'asc',
      isActive,
      type,
      parentLocation,
      search
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
    
    // Build query filters
    const filter = {};
    
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }
    
    if (type) {
      filter.type = type;
    }
    
    if (parentLocation) {
      if (parentLocation === 'null') {
        filter.parentLocation = null;
      } else {
        filter.parentLocation = mongoose.Types.ObjectId(parentLocation);
      }
    }
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'address.street': { $regex: search, $options: 'i' } },
        { 'address.city': { $regex: search, $options: 'i' } }
      ];
    }
    
    // Count total documents
    const totalItems = await Location.countDocuments(filter);
    
    // Get locations
    const locations = await Location.find(filter)
      .populate('parentLocation', 'name')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
    // Return paginated results
    res.json({
      items: locations,
      page: parseInt(page),
      limit: parseInt(limit),
      totalItems,
      totalPages: Math.ceil(totalItems / parseInt(limit))
    });
  } catch (error) {
    next(error);
  }
};

// Get location by ID
exports.getLocationById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const location = await Location.findById(id)
      .populate('parentLocation', 'name');
    
    if (!location) {
      return next(createError(404, 'Location not found'));
    }
    
    res.json(location);
  } catch (error) {
    next(error);
  }
};

// Create a new location
exports.createLocation = async (req, res, next) => {
  try {
    const {
      name,
      description,
      type,
      address,
      parentLocation,
      isActive,
      capacity
    } = req.body;
    
    // Check if location with same name already exists
    const existingLocation = await Location.findOne({ name });
    
    if (existingLocation) {
      return next(createError(400, 'Location with this name already exists'));
    }
    
    // Check if parent location exists if provided
    if (parentLocation) {
      const parentExists = await Location.findById(parentLocation);
      
      if (!parentExists) {
        return next(createError(404, 'Parent location not found'));
      }
    }
    
    // Create new location
    const location = new Location({
      name,
      description,
      type: type || 'store',
      address,
      parentLocation: parentLocation || null,
      isActive: isActive !== undefined ? isActive : true,
      capacity,
      createdBy: req.user._id,
      updatedBy: req.user._id
    });
    
    await location.save();
    
    res.status(201).json(location);
  } catch (error) {
    next(error);
  }
};

// Update location
exports.updateLocation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      type,
      address,
      parentLocation,
      isActive,
      capacity
    } = req.body;
    
    const location = await Location.findById(id);
    
    if (!location) {
      return next(createError(404, 'Location not found'));
    }
    
    // Check if name is being changed and if it conflicts with existing location
    if (name && name !== location.name) {
      const existingLocation = await Location.findOne({ name });
      
      if (existingLocation && existingLocation._id.toString() !== id) {
        return next(createError(400, 'Location with this name already exists'));
      }
    }
    
    // Check if parent location exists if provided
    if (parentLocation && parentLocation !== location.parentLocation?.toString()) {
      // Prevent circular references
      if (parentLocation === id) {
        return next(createError(400, 'Location cannot be its own parent'));
      }
      
      const parentExists = await Location.findById(parentLocation);
      
      if (!parentExists) {
        return next(createError(404, 'Parent location not found'));
      }
      
      // Check for circular references in the hierarchy
      let currentParent = parentLocation;
      while (currentParent) {
        const parent = await Location.findById(currentParent);
        
        if (!parent) break;
        
        if (parent.parentLocation && parent.parentLocation.toString() === id) {
          return next(createError(400, 'Circular reference detected in location hierarchy'));
        }
        
        currentParent = parent.parentLocation;
      }
    }
    
    // Update location fields
    location.name = name || location.name;
    location.description = description !== undefined ? description : location.description;
    location.type = type || location.type;
    location.address = address || location.address;
    location.parentLocation = parentLocation === null ? null : (parentLocation || location.parentLocation);
    location.isActive = isActive !== undefined ? isActive : location.isActive;
    location.capacity = capacity !== undefined ? capacity : location.capacity;
    location.updatedBy = req.user._id;
    
    await location.save();
    
    res.json(location);
  } catch (error) {
    next(error);
  }
};

// Delete location
exports.deleteLocation = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const location = await Location.findById(id);
    
    if (!location) {
      return next(createError(404, 'Location not found'));
    }
    
    // Check if location has child locations
    const childLocations = await Location.countDocuments({ parentLocation: id });
    
    if (childLocations > 0) {
      return next(createError(400, `Cannot delete location: ${childLocations} child locations are associated with this location`));
    }
    
    // Check if location is referenced by inventory
    const { Inventory } = require('../../models');
    const inventoryWithLocation = await Inventory.countDocuments({ location: id });
    
    if (inventoryWithLocation > 0) {
      return next(createError(400, `Cannot delete location: ${inventoryWithLocation} inventory items are associated with this location`));
    }
    
    // Check if location is referenced by purchase orders
    const { PurchaseOrder } = require('../../models');
    const purchaseOrdersWithLocation = await PurchaseOrder.countDocuments({ location: id });
    
    if (purchaseOrdersWithLocation > 0) {
      return next(createError(400, `Cannot delete location: ${purchaseOrdersWithLocation} purchase orders are associated with this location`));
    }
    
    await location.remove();
    
    res.json({ message: 'Location deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Batch delete locations
exports.batchDeleteLocations = async (req, res, next) => {
  try {
    const { locationIds } = req.body;
    
    if (!Array.isArray(locationIds) || locationIds.length === 0) {
      return next(createError(400, 'Location IDs array is required and must not be empty'));
    }
    
    const deletedLocations = [];
    const errors = [];
    
    // Start a transaction
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Process each location
      for (const id of locationIds) {
        try {
          // Check if location exists
          const location = await Location.findById(id).session(session);
          
          if (!location) {
            errors.push(`Location with ID ${id} not found`);
            continue;
          }
          
          // Check if location has child locations
          const childLocations = await Location.countDocuments({ parentLocation: id }).session(session);
          
          if (childLocations > 0) {
            errors.push(`Cannot delete location ${id}: ${childLocations} child locations are associated with this location`);
            continue;
          }
          
          // Check if location is referenced by inventory
          const { Inventory } = require('../../models');
          const inventoryWithLocation = await Inventory.countDocuments({ location: id }).session(session);
          
          if (inventoryWithLocation > 0) {
            errors.push(`Cannot delete location ${id}: ${inventoryWithLocation} inventory items are associated with this location`);
            continue;
          }
          
          // Check if location is referenced by purchase orders
          const { PurchaseOrder } = require('../../models');
          const purchaseOrdersWithLocation = await PurchaseOrder.countDocuments({ location: id }).session(session);
          
          if (purchaseOrdersWithLocation > 0) {
            errors.push(`Cannot delete location ${id}: ${purchaseOrdersWithLocation} purchase orders are associated with this location`);
            continue;
          }
          
          // Delete the location
          await Location.findByIdAndDelete(id).session(session);
          deletedLocations.push(id);
        } catch (error) {
          errors.push(`Error deleting location ${id}: ${error.message}`);
        }
      }
      
      // Commit the transaction if there were any successful deletions
      if (deletedLocations.length > 0) {
        await session.commitTransaction();
      } else {
        await session.abortTransaction();
      }
    } catch (error) {
      // Abort the transaction on error
      await session.abortTransaction();
      throw error;
    } finally {
      // End the session
      session.endSession();
    }
    
    res.json({
      deleted: deletedLocations,
      errors: errors.length > 0 ? errors : undefined,
      success: deletedLocations.length,
      failed: errors.length
    });
  } catch (error) {
    next(error);
  }
};

// Get location tree
exports.getLocationTree = async (req, res, next) => {
  try {
    // Get all locations
    const allLocations = await Location.find().lean();
    
    // Build location tree
    const locationMap = {};
    const rootLocations = [];
    
    // First, map all locations by ID
    allLocations.forEach(location => {
      locationMap[location._id] = {
        ...location,
        children: []
      };
    });
    
    // Then, build the tree structure
    allLocations.forEach(location => {
      if (location.parentLocation) {
        // Add to parent's children if parent exists
        const parentId = location.parentLocation.toString();
        if (locationMap[parentId]) {
          locationMap[parentId].children.push(locationMap[location._id]);
        } else {
          // If parent doesn't exist, add to root
          rootLocations.push(locationMap[location._id]);
        }
      } else {
        // Add to root locations if no parent
        rootLocations.push(locationMap[location._id]);
      }
    });
    
    res.json(rootLocations);
  } catch (error) {
    next(error);
  }
};

// Batch create locations
exports.batchCreateLocations = async (req, res, next) => {
  try {
    const { locations } = req.body;
    
    if (!Array.isArray(locations) || locations.length === 0) {
      return next(createError(400, 'Locations array is required and must not be empty'));
    }
    
    const createdLocations = [];
    const errors = [];
    
    // Process each location
    for (const locationData of locations) {
      try {
        const {
          name,
          description,
          type,
          address,
          parentLocation,
          isActive,
          capacity
        } = locationData;
        
        // Check if location with same name already exists
        const existingLocation = await Location.findOne({ name });
        
        if (existingLocation) {
          errors.push(`Location with name '${name}' already exists`);
          continue;
        }
        
        // Check if parent location exists if provided
        if (parentLocation) {
          const parentExists = await Location.findById(parentLocation);
          
          if (!parentExists) {
            errors.push(`Parent location not found for '${name}'`);
            continue;
          }
        }
        
        // Create new location
        const location = new Location({
          name,
          description,
          type: type || 'store',
          address,
          parentLocation: parentLocation || null,
          isActive: isActive !== undefined ? isActive : true,
          capacity,
          createdBy: req.user._id,
          updatedBy: req.user._id
        });
        
        await location.save();
        createdLocations.push(location);
      } catch (error) {
        errors.push(`Error creating location: ${error.message}`);
      }
    }
    
    res.status(201).json({
      created: createdLocations,
      errors: errors.length > 0 ? errors : undefined,
      success: createdLocations.length,
      failed: errors.length
    });
  } catch (error) {
    next(error);
  }
};

// Batch update locations
exports.batchUpdateLocations = async (req, res, next) => {
  try {
    const { locations } = req.body;
    
    if (!Array.isArray(locations) || locations.length === 0) {
      return next(createError(400, 'Locations array is required and must not be empty'));
    }
    
    const updatedLocations = [];
    const errors = [];
    
    // Process each location
    for (const locationData of locations) {
      try {
        const { id, ...updateData } = locationData;
        
        if (!id) {
          errors.push('Location ID is required');
          continue;
        }
        
        const location = await Location.findById(id);
        
        if (!location) {
          errors.push(`Location with ID ${id} not found`);
          continue;
        }
        
        // Check if name is being changed and if it conflicts with existing location
        if (updateData.name && updateData.name !== location.name) {
          const existingLocation = await Location.findOne({ name: updateData.name });
          
          if (existingLocation && existingLocation._id.toString() !== id) {
            errors.push(`Location with name '${updateData.name}' already exists`);
            continue;
          }
        }
        
        // Check if parent location exists if provided
        if (updateData.parentLocation && updateData.parentLocation !== location.parentLocation?.toString()) {
          // Prevent circular references
          if (updateData.parentLocation === id) {
            errors.push(`Location cannot be its own parent: ${id}`);
            continue;
          }
          
          const parentExists = await Location.findById(updateData.parentLocation);
          
          if (!parentExists) {
            errors.push(`Parent location not found for ID ${id}`);
            continue;
          }
          
          // Check for circular references in the hierarchy
          let currentParent = updateData.parentLocation;
          let circularReference = false;
          
          while (currentParent && !circularReference) {
            const parent = await Location.findById(currentParent);
            
            if (!parent) break;
            
            if (parent.parentLocation && parent.parentLocation.toString() === id) {
              errors.push(`Circular reference detected in location hierarchy for ID ${id}`);
              circularReference = true;
              break;
            }
            
            currentParent = parent.parentLocation;
          }
          
          if (circularReference) continue;
        }
        
        // Update location fields
        if (updateData.name) location.name = updateData.name;
        if (updateData.description !== undefined) location.description = updateData.description;
        if (updateData.type !== undefined) location.type = updateData.type;
        if (updateData.address !== undefined) location.address = updateData.address;
        if (updateData.parentLocation !== undefined) {
          location.parentLocation = updateData.parentLocation === null ? null : updateData.parentLocation;
        }
        if (updateData.isActive !== undefined) location.isActive = updateData.isActive;
        if (updateData.capacity !== undefined) location.capacity = updateData.capacity;
        
        location.updatedBy = req.user._id;
        
        await location.save();
        updatedLocations.push(location);
      } catch (error) {
        errors.push(`Error updating location: ${error.message}`);
      }
    }
    
    res.json({
      updated: updatedLocations,
      errors: errors.length > 0 ? errors : undefined,
      success: updatedLocations.length,
      failed: errors.length
    });
  } catch (error) {
    next(error);
  }
};

// Get location inventory
exports.getLocationInventory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { 
      page = 1, 
      limit = 20, 
      sortBy = 'product.name', 
      sortOrder = 'asc',
      lowStock,
      category,
      search
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const location = await Location.findById(id);
    
    if (!location) {
      return next(createError(404, 'Location not found'));
    }
    
    // Build aggregation pipeline
    const pipeline = [
      { $match: { location: mongoose.Types.ObjectId(id) } },
      {
        $lookup: {
          from: 'products',
          localField: 'product',
          foreignField: '_id',
          as: 'productData'
        }
      },
      { $unwind: '$productData' }
    ];
    
    // Apply category filter
    if (category) {
      pipeline.push({
        $match: { 'productData.category': mongoose.Types.ObjectId(category) }
      });
    }
    
    // Apply low stock filter
    if (lowStock === 'true') {
      pipeline.push({
        $match: {
          $expr: {
            $lte: ['$quantity', '$productData.minStockLevel']
          }
        }
      });
    }
    
    // Apply search filter
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { 'productData.name': { $regex: search, $options: 'i' } },
            { 'productData.sku': { $regex: search, $options: 'i' } },
            { 'productData.barcode': { $regex: search, $options: 'i' } }
          ]
        }
      });
    }
    
    // Count total documents
    const countPipeline = [...pipeline];
    countPipeline.push({ $count: 'total' });
    
    const { Inventory } = require('../../models');
    const countResult = await Inventory.aggregate(countPipeline);
    const totalItems = countResult.length > 0 ? countResult[0].total : 0;
    
    // Apply sorting
    const sortField = sortBy.startsWith('product.') 
      ? `productData.${sortBy.substring(8)}` 
      : sortBy;
    
    pipeline.push({
      $sort: { [sortField]: sortOrder === 'desc' ? -1 : 1 }
    });
    
    // Apply pagination
    pipeline.push(
      { $skip: skip },
      { $limit: parseInt(limit) }
    );
    
    // Project the final result
    pipeline.push({
      $project: {
        _id: 1,
        product: 1,
        location: 1,
        quantity: 1,
        unitCost: 1,
        createdAt: 1,
        updatedAt: 1,
        productName: '$productData.name',
        productSku: '$productData.sku',
        productBarcode: '$productData.barcode',
        productPrice: '$productData.price',
        productCategory: '$productData.category',
        minStockLevel: '$productData.minStockLevel',
        isLowStock: {
          $lte: ['$quantity', '$productData.minStockLevel']
        }
      }
    });
    
    // Execute the query
    const inventory = await Inventory.aggregate(pipeline);
    
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
