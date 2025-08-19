const { TableLayout, Table, sequelize } = require('../../models');
const { Op } = require('sequelize');
const { createError } = require('../../utils/errors');
const fs = require('fs');
const path = require('path');
const uploadsDir = path.join(__dirname, '../../../uploads/layouts');

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * Get all layouts
 */
async function getLayouts(req, res, next) {
  try {
    const { isActive } = req.query;
    const where = {};
    
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const layouts = await TableLayout.findAll({
      where,
      include: [
        {
          model: Table,
          as: 'tables',
          attributes: ['id', 'name', 'status', 'positionX', 'positionY', 'rotation'],
        },
      ],
      order: [['isActive', 'DESC'], ['name', 'ASC']],
    });

    res.json(layouts);
  } catch (error) {
    next(error);
  }
}

/**
 * Get the active layout (single)
 */
async function getActiveLayout(_req, res, next) {
  try {
    const layout = await TableLayout.findOne({
      where: { isActive: true },
      include: [
        {
          model: Table,
          as: 'tables',
          attributes: ['id', 'name', 'status', 'positionX', 'positionY', 'rotation', 'width', 'height'],
        },
      ],
      order: [['updatedAt', 'DESC']],
    });

    // If none is active, return null (200) rather than 404 to keep frontend simple
    return res.json(layout || null);
  } catch (error) {
    next(error);
  }
}

/**
 * Get a single layout by ID
 */
async function getLayout(req, res, next) {
  try {
    const { id } = req.params;
    
    const layout = await TableLayout.findByPk(id, {
      include: [
        {
          model: Table,
          as: 'tables',
          attributes: ['id', 'name', 'status', 'positionX', 'positionY', 'rotation', 'width', 'height'],
        },
      ],
    });

    if (!layout) {
      throw createError(404, 'Layout not found');
    }

    res.json(layout);
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new layout
 */
async function createLayout(req, res, next) {
  const transaction = await sequelize.transaction();
  
  try {
    const { name, description, width, height, gridSize, settings } = req.body;
    
    // Handle file upload if present
    let floorPlanImage = null;
    if (req.file) {
      const fileExt = path.extname(req.file.originalname);
      const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${fileExt}`;
      const filePath = path.join(uploadsDir, fileName);
      
      await fs.promises.rename(req.file.path, filePath);
      floorPlanImage = `/uploads/layouts/${fileName}`;
    }

    // Create the layout with created_by from authenticated user
    const layout = await TableLayout.create({
      name,
      description,
      floorPlanImage: floorPlanImage,
      width: width || 1000,
      height: height || 800,
      gridSize: gridSize || 10,
      created_by: req.user?.id || '00000000-0000-0000-0000-000000000000', // Default to system user if not authenticated
      settings: settings || {
        showGrid: true,
        snapToGrid: true,
        showTableNumbers: true,
        showStatus: true,
      },
    }, { transaction });

    await transaction.commit();
    res.status(201).json(layout);
  } catch (error) {
    await transaction.rollback();
    
    // Clean up uploaded file if there was an error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    next(error);
  }
}

/**
 * Update a layout
 */
async function updateLayout(req, res, next) {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { name, description, width, height, gridSize, settings, isActive } = req.body;
    
    const layout = await TableLayout.findByPk(id, { transaction });
    if (!layout) {
      await transaction.rollback();
      throw createError(404, 'Layout not found');
    }

    // Handle file upload if present
    if (req.file) {
      // Delete old image if it exists
      if (layout.floorPlanImage) {
        const oldImagePath = path.join(__dirname, '../../..', layout.floorPlanImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }

      const fileExt = path.extname(req.file.originalname);
      const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${fileExt}`;
      const filePath = path.join(uploadsDir, fileName);
      
      await fs.promises.rename(req.file.path, filePath);
      layout.floorPlanImage = `/uploads/layouts/${fileName}`;
    }

    // Update fields
    if (name !== undefined) layout.name = name;
    if (description !== undefined) layout.description = description;
    if (width !== undefined) layout.width = width;
    if (height !== undefined) layout.height = height;
    if (gridSize !== undefined) layout.gridSize = gridSize;
    if (settings !== undefined) layout.settings = settings;
    if (isActive !== undefined) layout.isActive = isActive;

    await layout.save({ transaction });
    await transaction.commit();
    
    res.json(layout);
  } catch (error) {
    await transaction.rollback();
    
    // Clean up uploaded file if there was an error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    next(error);
  }
}

/**
 * Delete a layout
 */
async function deleteLayout(req, res, next) {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;

    const layout = await TableLayout.findByPk(id, {
      include: [
        {
          model: Table,
          as: 'tables',
          required: false,
        },
      ],
      transaction,
    });

    if (!layout) {
      await transaction.rollback();
      throw createError(404, 'Layout not found');
    }

    // Don't allow deletion if it's the only layout
    const layoutCount = await TableLayout.count({ transaction });
    if (layoutCount === 1) {
      await transaction.rollback();
      throw createError(400, 'Cannot delete the only layout');
    }

    // Find another layout to reassign tables to
    const anotherLayout = await TableLayout.findOne({
      where: { id: { [Op.ne]: id } },
      transaction,
    });

    // Reassign tables to another layout
    if (layout.tables && layout.tables.length > 0) {
      await Table.update(
        { layoutId: anotherLayout.id },
        {
          where: { layoutId: id },
          transaction,
        }
      );
    }

    // Delete the layout
    await layout.destroy({ transaction });

    // Delete the floor plan image if it exists
    if (layout.floorPlanImage) {
      const imagePath = path.join(__dirname, '../../..', layout.floorPlanImage);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await transaction.commit();
    res.status(204).send();
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
}

/**
 * Duplicate a layout
 */
async function duplicateLayout(req, res, next) {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!name) {
      await transaction.rollback();
      throw createError(400, 'Name is required for the duplicated layout');
    }

    // Get the original layout with its tables
    const originalLayout = await TableLayout.findByPk(id, {
      include: [
        {
          model: Table,
          as: 'tables',
        },
      ],
      transaction,
    });

    if (!originalLayout) {
      await transaction.rollback();
      throw createError(404, 'Original layout not found');
    }

    // Create a new layout with the same properties
    const newLayout = await TableLayout.create({
      name,
      description: originalLayout.description,
      width: originalLayout.width,
      height: originalLayout.height,
      gridSize: originalLayout.gridSize,
      created_by: req.user?.id || '00000000-0000-0000-0000-000000000000', // Default to system user if not authenticated
      settings: { ...originalLayout.settings },
      isActive: false, // Don't auto-activate the duplicate
    }, { transaction });

    // Duplicate the floor plan image if it exists
    if (originalLayout.floorPlanImage) {
      const oldPath = path.join(__dirname, '../../..', originalLayout.floorPlanImage);
      const fileExt = path.extname(originalLayout.floorPlanImage);
      const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${fileExt}`;
      const newPath = path.join(uploadsDir, fileName);
      
      if (fs.existsSync(oldPath)) {
        fs.copyFileSync(oldPath, newPath);
        newLayout.floorPlanImage = `/uploads/layouts/${fileName}`;
        await newLayout.save({ transaction });
      }
    }

    // Duplicate all tables from the original layout
    if (originalLayout.tables && originalLayout.tables.length > 0) {
      const tablePromises = originalLayout.tables.map(table => 
        Table.create({
          name: table.name,
          group: table.group,
          capacity: table.capacity,
          positionX: table.positionX,
          positionY: table.positionY,
          rotation: table.rotation,
          width: table.width,
          height: table.height,
          notes: table.notes,
          layoutId: newLayout.id,
          type: table.type || 'billiard',
        }, { transaction })
      );
      
      await Promise.all(tablePromises);
    }

    await transaction.commit();
    
    // Fetch the newly created layout with its tables
    const createdLayout = await TableLayout.findByPk(newLayout.id, {
      include: [
        {
          model: Table,
          as: 'tables',
        },
      ],
    });
    
    res.status(201).json(createdLayout);
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
}

/**
 * Activate a layout (set isActive = true) and deactivate all others
 */
async function activateLayout(req, res, next) {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;

    const layout = await TableLayout.findByPk(id, { transaction });
    if (!layout) {
      await transaction.rollback();
      throw createError(404, 'Layout not found');
    }

    // Deactivate other layouts
    await TableLayout.update(
      { isActive: false },
      { where: { id: { [Op.ne]: id } }, transaction }
    );

    // Activate selected layout
    layout.isActive = true;
    await layout.save({ transaction });

    await transaction.commit();

    const activated = await TableLayout.findByPk(id, {
      include: [
        { model: Table, as: 'tables', attributes: ['id', 'name', 'status', 'positionX', 'positionY', 'rotation'] },
      ],
    });

    res.json(activated);
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
}

module.exports = {
  getLayouts,
  getActiveLayout,
  getLayout,
  createLayout,
  updateLayout,
  deleteLayout,
  duplicateLayout,
  activateLayout,
};
