const { Category } = require('../../models');
const { createError } = require('../../utils/errorHandler');
const mongoose = require('mongoose');

// Get all categories with pagination and filtering
exports.getCategories = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      sortBy = 'name', 
      sortOrder = 'asc',
      isActive,
      parentCategory,
      search
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
    
    // Build query filters
    const filter = {};
    
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }
    
    if (parentCategory) {
      if (parentCategory === 'null') {
        filter.parentCategory = null;
      } else {
        filter.parentCategory = mongoose.Types.ObjectId(parentCategory);
      }
    }
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Count total documents
    const totalItems = await Category.countDocuments(filter);
    
    // Get categories
    const categories = await Category.find(filter)
      .populate('parentCategory', 'name')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
    // Return paginated results
    res.json({
      items: categories,
      page: parseInt(page),
      limit: parseInt(limit),
      totalItems,
      totalPages: Math.ceil(totalItems / parseInt(limit))
    });
  } catch (error) {
    next(error);
  }
};

// Get category by ID
exports.getCategoryById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const category = await Category.findById(id)
      .populate('parentCategory', 'name');
    
    if (!category) {
      return next(createError(404, 'Category not found'));
    }
    
    res.json(category);
  } catch (error) {
    next(error);
  }
};

// Create a new category
exports.createCategory = async (req, res, next) => {
  try {
    const {
      name,
      description,
      parentCategory,
      isActive,
      color,
      icon
    } = req.body;
    
    // Check if category with same name already exists
    const existingCategory = await Category.findOne({ name });
    
    if (existingCategory) {
      return next(createError(400, 'Category with this name already exists'));
    }
    
    // Check if parent category exists if provided
    if (parentCategory) {
      const parentExists = await Category.findById(parentCategory);
      
      if (!parentExists) {
        return next(createError(404, 'Parent category not found'));
      }
    }
    
    // Create new category
    const category = new Category({
      name,
      description,
      parentCategory: parentCategory || null,
      isActive: isActive !== undefined ? isActive : true,
      color,
      icon,
      createdBy: req.user._id,
      updatedBy: req.user._id
    });
    
    await category.save();
    
    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
};

// Update category
exports.updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      parentCategory,
      isActive,
      color,
      icon
    } = req.body;
    
    const category = await Category.findById(id);
    
    if (!category) {
      return next(createError(404, 'Category not found'));
    }
    
    // Check if name is being changed and if it conflicts with existing category
    if (name && name !== category.name) {
      const existingCategory = await Category.findOne({ name });
      
      if (existingCategory && existingCategory._id.toString() !== id) {
        return next(createError(400, 'Category with this name already exists'));
      }
    }
    
    // Check if parent category exists if provided
    if (parentCategory && parentCategory !== category.parentCategory?.toString()) {
      // Prevent circular references
      if (parentCategory === id) {
        return next(createError(400, 'Category cannot be its own parent'));
      }
      
      const parentExists = await Category.findById(parentCategory);
      
      if (!parentExists) {
        return next(createError(404, 'Parent category not found'));
      }
      
      // Check for circular references in the hierarchy
      let currentParent = parentCategory;
      while (currentParent) {
        const parent = await Category.findById(currentParent);
        
        if (!parent) break;
        
        if (parent.parentCategory && parent.parentCategory.toString() === id) {
          return next(createError(400, 'Circular reference detected in category hierarchy'));
        }
        
        currentParent = parent.parentCategory;
      }
    }
    
    // Update category fields
    category.name = name || category.name;
    category.description = description !== undefined ? description : category.description;
    category.parentCategory = parentCategory === null ? null : (parentCategory || category.parentCategory);
    category.isActive = isActive !== undefined ? isActive : category.isActive;
    category.color = color !== undefined ? color : category.color;
    category.icon = icon !== undefined ? icon : category.icon;
    category.updatedBy = req.user._id;
    
    await category.save();
    
    res.json(category);
  } catch (error) {
    next(error);
  }
};

// Delete category
exports.deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const category = await Category.findById(id);
    
    if (!category) {
      return next(createError(404, 'Category not found'));
    }
    
    // Check if category has child categories
    const childCategories = await Category.countDocuments({ parentCategory: id });
    
    if (childCategories > 0) {
      return next(createError(400, `Cannot delete category: ${childCategories} child categories are associated with this category`));
    }
    
    // Check if category is referenced by products
    const { Product } = require('../../models');
    const productsWithCategory = await Product.countDocuments({ category: id });
    
    if (productsWithCategory > 0) {
      return next(createError(400, `Cannot delete category: ${productsWithCategory} products are associated with this category`));
    }
    
    await category.remove();
    
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Batch delete categories
exports.batchDeleteCategories = async (req, res, next) => {
  try {
    const { categoryIds } = req.body;
    
    if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
      return next(createError(400, 'Category IDs array is required and must not be empty'));
    }
    
    const deletedCategories = [];
    const errors = [];
    
    // Start a transaction
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Process each category
      for (const id of categoryIds) {
        try {
          // Check if category exists
          const category = await Category.findById(id).session(session);
          
          if (!category) {
            errors.push(`Category with ID ${id} not found`);
            continue;
          }
          
          // Check if category has child categories
          const childCategories = await Category.countDocuments({ parentCategory: id }).session(session);
          
          if (childCategories > 0) {
            errors.push(`Cannot delete category ${id}: ${childCategories} child categories are associated with this category`);
            continue;
          }
          
          // Check if category is referenced by products
          const { Product } = require('../../models');
          const productsWithCategory = await Product.countDocuments({ category: id }).session(session);
          
          if (productsWithCategory > 0) {
            errors.push(`Cannot delete category ${id}: ${productsWithCategory} products are associated with this category`);
            continue;
          }
          
          // Delete the category
          await Category.findByIdAndDelete(id).session(session);
          deletedCategories.push(id);
        } catch (error) {
          errors.push(`Error deleting category ${id}: ${error.message}`);
        }
      }
      
      // Commit the transaction if there were any successful deletions
      if (deletedCategories.length > 0) {
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
      deleted: deletedCategories,
      errors: errors.length > 0 ? errors : undefined,
      success: deletedCategories.length,
      failed: errors.length
    });
  } catch (error) {
    next(error);
  }
};

// Get category tree
exports.getCategoryTree = async (req, res, next) => {
  try {
    // Get all categories
    const allCategories = await Category.find().lean();
    
    // Build category tree
    const categoryMap = {};
    const rootCategories = [];
    
    // First, map all categories by ID
    allCategories.forEach(category => {
      categoryMap[category._id] = {
        ...category,
        children: []
      };
    });
    
    // Then, build the tree structure
    allCategories.forEach(category => {
      if (category.parentCategory) {
        // Add to parent's children if parent exists
        const parentId = category.parentCategory.toString();
        if (categoryMap[parentId]) {
          categoryMap[parentId].children.push(categoryMap[category._id]);
        } else {
          // If parent doesn't exist, add to root
          rootCategories.push(categoryMap[category._id]);
        }
      } else {
        // Add to root categories if no parent
        rootCategories.push(categoryMap[category._id]);
      }
    });
    
    res.json(rootCategories);
  } catch (error) {
    next(error);
  }
};

// Batch create categories
exports.batchCreateCategories = async (req, res, next) => {
  try {
    const { categories } = req.body;
    
    if (!Array.isArray(categories) || categories.length === 0) {
      return next(createError(400, 'Categories array is required and must not be empty'));
    }
    
    const createdCategories = [];
    const errors = [];
    
    // Process each category
    for (const categoryData of categories) {
      try {
        const {
          name,
          description,
          parentCategory,
          isActive,
          color,
          icon
        } = categoryData;
        
        // Check if category with same name already exists
        const existingCategory = await Category.findOne({ name });
        
        if (existingCategory) {
          errors.push(`Category with name '${name}' already exists`);
          continue;
        }
        
        // Check if parent category exists if provided
        if (parentCategory) {
          const parentExists = await Category.findById(parentCategory);
          
          if (!parentExists) {
            errors.push(`Parent category not found for '${name}'`);
            continue;
          }
        }
        
        // Create new category
        const category = new Category({
          name,
          description,
          parentCategory: parentCategory || null,
          isActive: isActive !== undefined ? isActive : true,
          color,
          icon,
          createdBy: req.user._id,
          updatedBy: req.user._id
        });
        
        await category.save();
        createdCategories.push(category);
      } catch (error) {
        errors.push(`Error creating category: ${error.message}`);
      }
    }
    
    res.status(201).json({
      created: createdCategories,
      errors: errors.length > 0 ? errors : undefined,
      success: createdCategories.length,
      failed: errors.length
    });
  } catch (error) {
    next(error);
  }
};

// Batch update categories
exports.batchUpdateCategories = async (req, res, next) => {
  try {
    const { categories } = req.body;
    
    if (!Array.isArray(categories) || categories.length === 0) {
      return next(createError(400, 'Categories array is required and must not be empty'));
    }
    
    const updatedCategories = [];
    const errors = [];
    
    // Process each category
    for (const categoryData of categories) {
      try {
        const { id, ...updateData } = categoryData;
        
        if (!id) {
          errors.push('Category ID is required');
          continue;
        }
        
        const category = await Category.findById(id);
        
        if (!category) {
          errors.push(`Category with ID ${id} not found`);
          continue;
        }
        
        // Check if name is being changed and if it conflicts with existing category
        if (updateData.name && updateData.name !== category.name) {
          const existingCategory = await Category.findOne({ name: updateData.name });
          
          if (existingCategory && existingCategory._id.toString() !== id) {
            errors.push(`Category with name '${updateData.name}' already exists`);
            continue;
          }
        }
        
        // Check if parent category exists if provided
        if (updateData.parentCategory && updateData.parentCategory !== category.parentCategory?.toString()) {
          // Prevent circular references
          if (updateData.parentCategory === id) {
            errors.push(`Category cannot be its own parent: ${id}`);
            continue;
          }
          
          const parentExists = await Category.findById(updateData.parentCategory);
          
          if (!parentExists) {
            errors.push(`Parent category not found for ID ${id}`);
            continue;
          }
          
          // Check for circular references in the hierarchy
          let currentParent = updateData.parentCategory;
          let circularReference = false;
          
          while (currentParent && !circularReference) {
            const parent = await Category.findById(currentParent);
            
            if (!parent) break;
            
            if (parent.parentCategory && parent.parentCategory.toString() === id) {
              errors.push(`Circular reference detected in category hierarchy for ID ${id}`);
              circularReference = true;
              break;
            }
            
            currentParent = parent.parentCategory;
          }
          
          if (circularReference) continue;
        }
        
        // Update category fields
        if (updateData.name) category.name = updateData.name;
        if (updateData.description !== undefined) category.description = updateData.description;
        if (updateData.parentCategory !== undefined) {
          category.parentCategory = updateData.parentCategory === null ? null : updateData.parentCategory;
        }
        if (updateData.isActive !== undefined) category.isActive = updateData.isActive;
        if (updateData.color !== undefined) category.color = updateData.color;
        if (updateData.icon !== undefined) category.icon = updateData.icon;
        
        category.updatedBy = req.user._id;
        
        await category.save();
        updatedCategories.push(category);
      } catch (error) {
        errors.push(`Error updating category: ${error.message}`);
      }
    }
    
    res.json({
      updated: updatedCategories,
      errors: errors.length > 0 ? errors : undefined,
      success: updatedCategories.length,
      failed: errors.length
    });
  } catch (error) {
    next(error);
  }
};

// Get category products
exports.getCategoryProducts = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { 
      page = 1, 
      limit = 20, 
      sortBy = 'name', 
      sortOrder = 'asc' 
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
    
    const category = await Category.findById(id);
    
    if (!category) {
      return next(createError(404, 'Category not found'));
    }
    
    // Get all subcategories recursively
    const getAllSubcategoryIds = async (categoryId) => {
      const subcategories = await Category.find({ parentCategory: categoryId });
      let ids = [categoryId];
      
      for (const subcategory of subcategories) {
        const subIds = await getAllSubcategoryIds(subcategory._id);
        ids = [...ids, ...subIds];
      }
      
      return ids;
    };
    
    const categoryIds = await getAllSubcategoryIds(id);
    
    // Get products in this category and all subcategories
    const { Product } = require('../../models');
    
    const totalItems = await Product.countDocuments({ category: { $in: categoryIds } });
    
    const products = await Product.find({ category: { $in: categoryIds } })
      .select('name sku barcode price cost stock minStockLevel category isActive')
      .populate('category', 'name')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
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
