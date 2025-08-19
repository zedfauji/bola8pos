const { Product, Category, Supplier, Inventory } = require('../../models');
const { createError } = require('../../utils/errorHandler');
const mongoose = require('mongoose');

// Get all products with pagination and filtering
exports.getProducts = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      sortBy = 'name', 
      sortOrder = 'asc',
      isActive,
      category,
      supplier,
      lowStock,
      search
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
    
    // Build query filters
    const filter = {};
    
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }
    
    if (category) {
      filter.category = mongoose.Types.ObjectId(category);
    }
    
    if (supplier) {
      filter.supplier = mongoose.Types.ObjectId(supplier);
    }
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Build aggregation pipeline
    const pipeline = [
      { $match: filter }
    ];
    
    // Lookup related collections
    pipeline.push(
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'categoryData'
        }
      },
      {
        $lookup: {
          from: 'suppliers',
          localField: 'supplier',
          foreignField: '_id',
          as: 'supplierData'
        }
      },
      {
        $lookup: {
          from: 'inventories',
          localField: '_id',
          foreignField: 'product',
          as: 'inventoryData'
        }
      }
    );
    
    // Add computed fields
    pipeline.push({
      $addFields: {
        categoryName: { $arrayElemAt: ['$categoryData.name', 0] },
        supplierName: { $arrayElemAt: ['$supplierData.name', 0] },
        totalStock: { $sum: '$inventoryData.quantity' }
      }
    });
    
    // Apply low stock filter if requested
    if (lowStock === 'true') {
      pipeline.push({
        $match: {
          $expr: {
            $lte: ['$totalStock', '$minStockLevel']
          }
        }
      });
    }
    
    // Count total documents for pagination
    const countPipeline = [...pipeline];
    countPipeline.push({ $count: 'total' });
    
    // Get count result
    const countResult = await Product.aggregate(countPipeline);
    const totalItems = countResult.length > 0 ? countResult[0].total : 0;
    
    // Add sorting and pagination to the main pipeline
    pipeline.push(
      { $sort: sort },
      { $skip: skip },
      { $limit: parseInt(limit) }
    );
    
    // Project the final result
    pipeline.push({
      $project: {
        _id: 1,
        name: 1,
        sku: 1,
        barcode: 1,
        description: 1,
        price: 1,
        cost: 1,
        minStockLevel: 1,
        isActive: 1,
        category: 1,
        supplier: 1,
        unit: 1,
        variants: 1,
        images: 1,
        createdAt: 1,
        updatedAt: 1,
        categoryName: 1,
        supplierName: 1,
        totalStock: 1,
        isLowStock: {
          $lte: ['$totalStock', '$minStockLevel']
        }
      }
    });
    
    // Execute the query
    const products = await Product.aggregate(pipeline);
    
    // Return paginated results
    res.json({
      items: products,
      page: parseInt(page),
      limit: parseInt(limit),
      totalItems,
      totalPages: Math.ceil(totalItems / parseInt(limit))
    });
  } catch (error) {
    next(error);
  }
};

// Get product by ID
exports.getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const product = await Product.findById(id)
      .populate('category', 'name')
      .populate('supplier', 'name contactPerson')
      .populate('unit', 'name symbol');
    
    if (!product) {
      return next(createError(404, 'Product not found'));
    }
    
    // Get inventory data for this product
    const inventory = await Inventory.aggregate([
      { $match: { product: mongoose.Types.ObjectId(id) } },
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
          location: 1,
          locationName: '$locationData.name',
          quantity: 1,
          unitCost: 1
        }
      }
    ]);
    
    // Calculate total stock
    const totalStock = inventory.reduce((sum, item) => sum + item.quantity, 0);
    
    // Return product with inventory data
    res.json({
      ...product.toObject(),
      inventory,
      totalStock,
      isLowStock: totalStock <= product.minStockLevel
    });
  } catch (error) {
    next(error);
  }
};

// Create a new product
exports.createProduct = async (req, res, next) => {
  try {
    const {
      name,
      sku,
      barcode,
      description,
      price,
      cost,
      minStockLevel,
      category,
      supplier,
      unit,
      variants,
      images,
      isActive
    } = req.body;
    
    // Check if product with same SKU or barcode already exists
    if (sku) {
      const existingProductSku = await Product.findOne({ sku });
      if (existingProductSku) {
        return next(createError(400, 'Product with this SKU already exists'));
      }
    }
    
    if (barcode) {
      const existingProductBarcode = await Product.findOne({ barcode });
      if (existingProductBarcode) {
        return next(createError(400, 'Product with this barcode already exists'));
      }
    }
    
    // Check if category exists
    if (category) {
      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        return next(createError(404, 'Category not found'));
      }
    }
    
    // Check if supplier exists
    if (supplier) {
      const supplierExists = await Supplier.findById(supplier);
      if (!supplierExists) {
        return next(createError(404, 'Supplier not found'));
      }
    }
    
    // Create new product
    const product = new Product({
      name,
      sku,
      barcode,
      description,
      price: price || 0,
      cost: cost || 0,
      minStockLevel: minStockLevel || 0,
      category,
      supplier,
      unit,
      variants: variants || [],
      images: images || [],
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user._id,
      updatedBy: req.user._id
    });
    
    await product.save();
    
    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
};

// Update product
exports.updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      sku,
      barcode,
      description,
      price,
      cost,
      minStockLevel,
      category,
      supplier,
      unit,
      variants,
      images,
      isActive
    } = req.body;
    
    const product = await Product.findById(id);
    
    if (!product) {
      return next(createError(404, 'Product not found'));
    }
    
    // Check if SKU is being changed and if it conflicts with existing product
    if (sku && sku !== product.sku) {
      const existingProductSku = await Product.findOne({ sku });
      if (existingProductSku && existingProductSku._id.toString() !== id) {
        return next(createError(400, 'Product with this SKU already exists'));
      }
    }
    
    // Check if barcode is being changed and if it conflicts with existing product
    if (barcode && barcode !== product.barcode) {
      const existingProductBarcode = await Product.findOne({ barcode });
      if (existingProductBarcode && existingProductBarcode._id.toString() !== id) {
        return next(createError(400, 'Product with this barcode already exists'));
      }
    }
    
    // Check if category exists
    if (category && category !== product.category?.toString()) {
      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        return next(createError(404, 'Category not found'));
      }
    }
    
    // Check if supplier exists
    if (supplier && supplier !== product.supplier?.toString()) {
      const supplierExists = await Supplier.findById(supplier);
      if (!supplierExists) {
        return next(createError(404, 'Supplier not found'));
      }
    }
    
    // Update product fields
    product.name = name || product.name;
    product.sku = sku !== undefined ? sku : product.sku;
    product.barcode = barcode !== undefined ? barcode : product.barcode;
    product.description = description !== undefined ? description : product.description;
    product.price = price !== undefined ? price : product.price;
    product.cost = cost !== undefined ? cost : product.cost;
    product.minStockLevel = minStockLevel !== undefined ? minStockLevel : product.minStockLevel;
    product.category = category !== undefined ? category : product.category;
    product.supplier = supplier !== undefined ? supplier : product.supplier;
    product.unit = unit !== undefined ? unit : product.unit;
    product.variants = variants || product.variants;
    product.images = images || product.images;
    product.isActive = isActive !== undefined ? isActive : product.isActive;
    product.updatedBy = req.user._id;
    
    await product.save();
    
    res.json(product);
  } catch (error) {
    next(error);
  }
};

// Delete product
exports.deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const product = await Product.findById(id);
    
    if (!product) {
      return next(createError(404, 'Product not found'));
    }
    
    // Check if product is referenced by inventory
    const inventoryWithProduct = await Inventory.countDocuments({ product: id });
    
    if (inventoryWithProduct > 0) {
      return next(createError(400, `Cannot delete product: ${inventoryWithProduct} inventory items are associated with this product`));
    }
    
    await product.remove();
    
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Batch create products
exports.batchCreateProducts = async (req, res, next) => {
  try {
    const { products } = req.body;
    
    if (!Array.isArray(products) || products.length === 0) {
      return next(createError(400, 'Products array is required and must not be empty'));
    }
    
    const createdProducts = [];
    const errors = [];
    
    // Process each product
    for (const productData of products) {
      try {
        const {
          name,
          sku,
          barcode,
          description,
          price,
          cost,
          minStockLevel,
          category,
          supplier,
          unit,
          variants,
          images,
          isActive
        } = productData;
        
        // Check if product with same SKU or barcode already exists
        if (sku) {
          const existingProductSku = await Product.findOne({ sku });
          if (existingProductSku) {
            errors.push(`Product with SKU '${sku}' already exists`);
            continue;
          }
        }
        
        if (barcode) {
          const existingProductBarcode = await Product.findOne({ barcode });
          if (existingProductBarcode) {
            errors.push(`Product with barcode '${barcode}' already exists`);
            continue;
          }
        }
        
        // Check if category exists
        if (category) {
          const categoryExists = await Category.findById(category);
          if (!categoryExists) {
            errors.push(`Category not found for product '${name}'`);
            continue;
          }
        }
        
        // Check if supplier exists
        if (supplier) {
          const supplierExists = await Supplier.findById(supplier);
          if (!supplierExists) {
            errors.push(`Supplier not found for product '${name}'`);
            continue;
          }
        }
        
        // Create new product
        const product = new Product({
          name,
          sku,
          barcode,
          description,
          price: price || 0,
          cost: cost || 0,
          minStockLevel: minStockLevel || 0,
          category,
          supplier,
          unit,
          variants: variants || [],
          images: images || [],
          isActive: isActive !== undefined ? isActive : true,
          createdBy: req.user._id,
          updatedBy: req.user._id
        });
        
        await product.save();
        createdProducts.push(product);
      } catch (error) {
        errors.push(`Error creating product: ${error.message}`);
      }
    }
    
    res.status(201).json({
      created: createdProducts,
      errors: errors.length > 0 ? errors : undefined,
      success: createdProducts.length,
      failed: errors.length
    });
  } catch (error) {
    next(error);
  }
};

// Batch update products
exports.batchUpdateProducts = async (req, res, next) => {
  try {
    const { products } = req.body;
    
    if (!Array.isArray(products) || products.length === 0) {
      return next(createError(400, 'Products array is required and must not be empty'));
    }
    
    const updatedProducts = [];
    const errors = [];
    
    // Process each product
    for (const productData of products) {
      try {
        const { id, ...updateData } = productData;
        
        if (!id) {
          errors.push('Product ID is required');
          continue;
        }
        
        const product = await Product.findById(id);
        
        if (!product) {
          errors.push(`Product with ID ${id} not found`);
          continue;
        }
        
        // Check if SKU is being changed and if it conflicts with existing product
        if (updateData.sku && updateData.sku !== product.sku) {
          const existingProductSku = await Product.findOne({ sku: updateData.sku });
          if (existingProductSku && existingProductSku._id.toString() !== id) {
            errors.push(`Product with SKU '${updateData.sku}' already exists`);
            continue;
          }
        }
        
        // Check if barcode is being changed and if it conflicts with existing product
        if (updateData.barcode && updateData.barcode !== product.barcode) {
          const existingProductBarcode = await Product.findOne({ barcode: updateData.barcode });
          if (existingProductBarcode && existingProductBarcode._id.toString() !== id) {
            errors.push(`Product with barcode '${updateData.barcode}' already exists`);
            continue;
          }
        }
        
        // Check if category exists
        if (updateData.category && updateData.category !== product.category?.toString()) {
          const categoryExists = await Category.findById(updateData.category);
          if (!categoryExists) {
            errors.push(`Category not found for product '${product.name}'`);
            continue;
          }
        }
        
        // Check if supplier exists
        if (updateData.supplier && updateData.supplier !== product.supplier?.toString()) {
          const supplierExists = await Supplier.findById(updateData.supplier);
          if (!supplierExists) {
            errors.push(`Supplier not found for product '${product.name}'`);
            continue;
          }
        }
        
        // Update product fields
        Object.keys(updateData).forEach(key => {
          if (updateData[key] !== undefined) {
            product[key] = updateData[key];
          }
        });
        
        product.updatedBy = req.user._id;
        
        await product.save();
        updatedProducts.push(product);
      } catch (error) {
        errors.push(`Error updating product: ${error.message}`);
      }
    }
    
    res.json({
      updated: updatedProducts,
      errors: errors.length > 0 ? errors : undefined,
      success: updatedProducts.length,
      failed: errors.length
    });
  } catch (error) {
    next(error);
  }
};

// Get low stock products
exports.getLowStockProducts = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      sortBy = 'name', 
      sortOrder = 'asc',
      category,
      supplier
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
    
    // Build query filters
    const filter = {};
    
    if (category) {
      filter.category = mongoose.Types.ObjectId(category);
    }
    
    if (supplier) {
      filter.supplier = mongoose.Types.ObjectId(supplier);
    }
    
    // Build aggregation pipeline
    const pipeline = [
      { $match: filter }
    ];
    
    // Lookup related collections
    pipeline.push(
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'categoryData'
        }
      },
      {
        $lookup: {
          from: 'suppliers',
          localField: 'supplier',
          foreignField: '_id',
          as: 'supplierData'
        }
      },
      {
        $lookup: {
          from: 'inventories',
          localField: '_id',
          foreignField: 'product',
          as: 'inventoryData'
        }
      }
    );
    
    // Add computed fields
    pipeline.push({
      $addFields: {
        categoryName: { $arrayElemAt: ['$categoryData.name', 0] },
        supplierName: { $arrayElemAt: ['$supplierData.name', 0] },
        totalStock: { $sum: '$inventoryData.quantity' }
      }
    });
    
    // Filter for low stock products
    pipeline.push({
      $match: {
        $expr: {
          $lte: ['$totalStock', '$minStockLevel']
        }
      }
    });
    
    // Count total documents for pagination
    const countPipeline = [...pipeline];
    countPipeline.push({ $count: 'total' });
    
    // Get count result
    const countResult = await Product.aggregate(countPipeline);
    const totalItems = countResult.length > 0 ? countResult[0].total : 0;
    
    // Add sorting and pagination to the main pipeline
    pipeline.push(
      { $sort: sort },
      { $skip: skip },
      { $limit: parseInt(limit) }
    );
    
    // Project the final result
    pipeline.push({
      $project: {
        _id: 1,
        name: 1,
        sku: 1,
        barcode: 1,
        price: 1,
        minStockLevel: 1,
        isActive: 1,
        category: 1,
        supplier: 1,
        categoryName: 1,
        supplierName: 1,
        totalStock: 1,
        stockDeficit: { $subtract: ['$minStockLevel', '$totalStock'] }
      }
    });
    
    // Execute the query
    const products = await Product.aggregate(pipeline);
    
    // Return paginated results
    res.json({
      items: products,
      page: parseInt(page),
      limit: parseInt(limit),
      totalItems,
      totalPages: Math.ceil(totalItems / parseInt(limit))
    });
  } catch (error) {
    next(error);
  }
};

// Get product inventory by location
exports.getProductInventory = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const product = await Product.findById(id);
    
    if (!product) {
      return next(createError(404, 'Product not found'));
    }
    
    // Get inventory data for this product
    const inventory = await Inventory.aggregate([
      { $match: { product: mongoose.Types.ObjectId(id) } },
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
          location: 1,
          locationName: '$locationData.name',
          locationType: '$locationData.type',
          quantity: 1,
          unitCost: 1,
          updatedAt: 1
        }
      },
      { $sort: { locationName: 1 } }
    ]);
    
    // Calculate total stock
    const totalStock = inventory.reduce((sum, item) => sum + item.quantity, 0);
    
    res.json({
      product: {
        _id: product._id,
        name: product.name,
        sku: product.sku,
        minStockLevel: product.minStockLevel
      },
      inventory,
      totalStock,
      isLowStock: totalStock <= product.minStockLevel
    });
  } catch (error) {
    next(error);
  }
};

// Import products from CSV
exports.importProducts = async (req, res, next) => {
  try {
    // This would typically use a CSV parsing library
    // For now, we'll assume the data is already parsed into JSON
    const { products } = req.body;
    
    if (!Array.isArray(products) || products.length === 0) {
      return next(createError(400, 'Products array is required and must not be empty'));
    }
    
    const results = {
      created: [],
      updated: [],
      errors: [],
      skipped: []
    };
    
    // Process each product
    for (const productData of products) {
      try {
        const { sku, name, ...otherFields } = productData;
        
        // SKU or name is required
        if (!sku && !name) {
          results.errors.push(`Product missing both SKU and name`);
          continue;
        }
        
        // Check if product exists by SKU
        let product = null;
        if (sku) {
          product = await Product.findOne({ sku });
        }
        
        // If not found by SKU and name is provided, try to find by name
        if (!product && name) {
          product = await Product.findOne({ name });
        }
        
        if (product) {
          // Update existing product
          Object.keys(otherFields).forEach(key => {
            if (otherFields[key] !== undefined) {
              product[key] = otherFields[key];
            }
          });
          
          if (name) {
            product.name = name;
          }
          
          product.updatedBy = req.user._id;
          await product.save();
          results.updated.push(product);
        } else {
          // Create new product
          const newProduct = new Product({
            sku,
            name,
            ...otherFields,
            createdBy: req.user._id,
            updatedBy: req.user._id
          });
          
          await newProduct.save();
          results.created.push(newProduct);
        }
      } catch (error) {
        results.errors.push(`Error processing product: ${error.message}`);
      }
    }
    
    res.json({
      created: results.created.length,
      updated: results.updated.length,
      errors: results.errors.length > 0 ? results.errors : undefined,
      failed: results.errors.length
    });
  } catch (error) {
    next(error);
  }
};
