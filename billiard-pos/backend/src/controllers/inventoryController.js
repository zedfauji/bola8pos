const { InventoryItem, InventoryMovement } = require('../models');

exports.getAllInventoryItems = async (req, res) => {
  try {
    const { category } = req.query;
    const where = {};
    
    if (category) {
      where.category = category;
    }

    const items = await InventoryItem.findAll({
      where,
      order: [['category', 'ASC'], ['name', 'ASC']]
    });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getInventoryItemById = async (req, res) => {
  try {
    const item = await InventoryItem.findByPk(req.params.id, {
      include: [InventoryMovement]
    });
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createInventoryItem = async (req, res) => {
  try {
    const item = await InventoryItem.create(req.body);
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateInventoryItem = async (req, res) => {
  try {
    const item = await InventoryItem.findByPk(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    await item.update(req.body);
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.recordInventoryMovement = async (req, res) => {
  try {
    const { itemId, movementType, quantity, unitPrice, notes } = req.body;
    
    const item = await InventoryItem.findByPk(itemId);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Update stock based on movement type
    if (movementType === 'purchase' || movementType === 'adjustment') {
      await item.increment('current_stock', { by: quantity });
    } else if (movementType === 'sale' || movementType === 'waste') {
      await item.decrement('current_stock', { by: quantity });
    }

    const movement = await InventoryMovement.create({
      item_id: itemId,
      movement_type: movementType,
      quantity,
      unit_price: unitPrice || item.unit_price,
      employee_id: req.employee.id,
      notes
    });

    res.status(201).json(movement);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getLowStockItems = async (req, res) => {
  try {
    const items = await InventoryItem.findAll({
      where: {
        current_stock: {
          [Sequelize.Op.lte]: Sequelize.col('reorder_level')
        }
      }
    });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
