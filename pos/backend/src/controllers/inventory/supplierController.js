const { Supplier } = require('../../models');
const { createError } = require('../../utils/errorHandler');

// Get all suppliers with pagination and filtering
exports.getSuppliers = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      sortBy = 'name', 
      sortOrder = 'asc',
      isActive,
      search
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
    
    // Build query filters
    const filter = {};
    
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { contactPerson: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { 'address.city': { $regex: search, $options: 'i' } }
      ];
    }
    
    // Count total documents
    const totalItems = await Supplier.countDocuments(filter);
    
    // Get suppliers
    const suppliers = await Supplier.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
    // Return paginated results
    res.json({
      items: suppliers,
      page: parseInt(page),
      limit: parseInt(limit),
      totalItems,
      totalPages: Math.ceil(totalItems / parseInt(limit))
    });
  } catch (error) {
    next(error);
  }
};

// Get supplier by ID
exports.getSupplierById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const supplier = await Supplier.findById(id);
    
    if (!supplier) {
      return next(createError(404, 'Supplier not found'));
    }
    
    res.json(supplier);
  } catch (error) {
    next(error);
  }
};

// Create a new supplier
exports.createSupplier = async (req, res, next) => {
  try {
    const {
      name,
      contactPerson,
      email,
      phone,
      address,
      taxId,
      notes,
      isActive,
      paymentTerms,
      leadTime
    } = req.body;
    
    // Check if supplier with same name already exists
    const existingSupplier = await Supplier.findOne({ name });
    
    if (existingSupplier) {
      return next(createError(400, 'Supplier with this name already exists'));
    }
    
    // Create new supplier
    const supplier = new Supplier({
      name,
      contactPerson,
      email,
      phone,
      address,
      taxId,
      notes,
      isActive: isActive !== undefined ? isActive : true,
      paymentTerms,
      leadTime,
      createdBy: req.user._id,
      updatedBy: req.user._id
    });
    
    await supplier.save();
    
    res.status(201).json(supplier);
  } catch (error) {
    next(error);
  }
};

// Update supplier
exports.updateSupplier = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      contactPerson,
      email,
      phone,
      address,
      taxId,
      notes,
      isActive,
      paymentTerms,
      leadTime
    } = req.body;
    
    const supplier = await Supplier.findById(id);
    
    if (!supplier) {
      return next(createError(404, 'Supplier not found'));
    }
    
    // Check if name is being changed and if it conflicts with existing supplier
    if (name && name !== supplier.name) {
      const existingSupplier = await Supplier.findOne({ name });
      
      if (existingSupplier && existingSupplier._id.toString() !== id) {
        return next(createError(400, 'Supplier with this name already exists'));
      }
    }
    
    // Update supplier fields
    supplier.name = name || supplier.name;
    supplier.contactPerson = contactPerson !== undefined ? contactPerson : supplier.contactPerson;
    supplier.email = email !== undefined ? email : supplier.email;
    supplier.phone = phone !== undefined ? phone : supplier.phone;
    supplier.address = address || supplier.address;
    supplier.taxId = taxId !== undefined ? taxId : supplier.taxId;
    supplier.notes = notes !== undefined ? notes : supplier.notes;
    supplier.isActive = isActive !== undefined ? isActive : supplier.isActive;
    supplier.paymentTerms = paymentTerms !== undefined ? paymentTerms : supplier.paymentTerms;
    supplier.leadTime = leadTime !== undefined ? leadTime : supplier.leadTime;
    supplier.updatedBy = req.user._id;
    
    await supplier.save();
    
    res.json(supplier);
  } catch (error) {
    next(error);
  }
};

// Delete supplier
exports.deleteSupplier = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const supplier = await Supplier.findById(id);
    
    if (!supplier) {
      return next(createError(404, 'Supplier not found'));
    }
    
    // Check if supplier is referenced by products
    const { Product } = require('../../models');
    const productsWithSupplier = await Product.countDocuments({ supplier: id });
    
    if (productsWithSupplier > 0) {
      return next(createError(400, `Cannot delete supplier: ${productsWithSupplier} products are associated with this supplier`));
    }
    
    // Check if supplier is referenced by purchase orders
    const { PurchaseOrder } = require('../../models');
    const purchaseOrdersWithSupplier = await PurchaseOrder.countDocuments({ supplier: id });
    
    if (purchaseOrdersWithSupplier > 0) {
      return next(createError(400, `Cannot delete supplier: ${purchaseOrdersWithSupplier} purchase orders are associated with this supplier`));
    }
    
    await supplier.remove();
    
    res.json({ message: 'Supplier deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Batch create suppliers
exports.batchCreateSuppliers = async (req, res, next) => {
  try {
    const { suppliers } = req.body;
    
    if (!Array.isArray(suppliers) || suppliers.length === 0) {
      return next(createError(400, 'Suppliers array is required and must not be empty'));
    }
    
    const createdSuppliers = [];
    const errors = [];
    
    // Process each supplier
    for (const supplierData of suppliers) {
      try {
        const {
          name,
          contactPerson,
          email,
          phone,
          address,
          taxId,
          notes,
          isActive,
          paymentTerms,
          leadTime
        } = supplierData;
        
        // Check if supplier with same name already exists
        const existingSupplier = await Supplier.findOne({ name });
        
        if (existingSupplier) {
          errors.push(`Supplier with name '${name}' already exists`);
          continue;
        }
        
        // Create new supplier
        const supplier = new Supplier({
          name,
          contactPerson,
          email,
          phone,
          address,
          taxId,
          notes,
          isActive: isActive !== undefined ? isActive : true,
          paymentTerms,
          leadTime,
          createdBy: req.user._id,
          updatedBy: req.user._id
        });
        
        await supplier.save();
        createdSuppliers.push(supplier);
      } catch (error) {
        errors.push(`Error creating supplier: ${error.message}`);
      }
    }
    
    res.status(201).json({
      created: createdSuppliers,
      errors: errors.length > 0 ? errors : undefined,
      success: createdSuppliers.length,
      failed: errors.length
    });
  } catch (error) {
    next(error);
  }
};

// Batch update suppliers
exports.batchUpdateSuppliers = async (req, res, next) => {
  try {
    const { suppliers } = req.body;
    
    if (!Array.isArray(suppliers) || suppliers.length === 0) {
      return next(createError(400, 'Suppliers array is required and must not be empty'));
    }
    
    const updatedSuppliers = [];
    const errors = [];
    
    // Process each supplier
    for (const supplierData of suppliers) {
      try {
        const { id, ...updateData } = supplierData;
        
        if (!id) {
          errors.push('Supplier ID is required');
          continue;
        }
        
        const supplier = await Supplier.findById(id);
        
        if (!supplier) {
          errors.push(`Supplier with ID ${id} not found`);
          continue;
        }
        
        // Check if name is being changed and if it conflicts with existing supplier
        if (updateData.name && updateData.name !== supplier.name) {
          const existingSupplier = await Supplier.findOne({ name: updateData.name });
          
          if (existingSupplier && existingSupplier._id.toString() !== id) {
            errors.push(`Supplier with name '${updateData.name}' already exists`);
            continue;
          }
        }
        
        // Update supplier fields
        Object.keys(updateData).forEach(key => {
          if (updateData[key] !== undefined) {
            supplier[key] = updateData[key];
          }
        });
        
        supplier.updatedBy = req.user._id;
        
        await supplier.save();
        updatedSuppliers.push(supplier);
      } catch (error) {
        errors.push(`Error updating supplier: ${error.message}`);
      }
    }
    
    res.json({
      updated: updatedSuppliers,
      errors: errors.length > 0 ? errors : undefined,
      success: updatedSuppliers.length,
      failed: errors.length
    });
  } catch (error) {
    next(error);
  }
};

// Get supplier products
exports.getSupplierProducts = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const supplier = await Supplier.findById(id);
    
    if (!supplier) {
      return next(createError(404, 'Supplier not found'));
    }
    
    const { Product } = require('../../models');
    
    const products = await Product.find({ supplier: id })
      .select('name sku barcode price cost stock minStockLevel category isActive');
    
    res.json(products);
  } catch (error) {
    next(error);
  }
};
