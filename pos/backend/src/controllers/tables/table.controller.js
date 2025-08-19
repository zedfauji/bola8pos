const { Table, TableLayout, TableSession, sequelize } = require('../../models');
const { Op } = require('sequelize');
const { createError } = require('../../utils/errors');

/**
 * Get all tables with optional filters
 */
async function getTables(req, res, next) {
  try {
    const { layoutId, status, group, search } = req.query;
    
    const where = {};
    if (layoutId) where.layoutId = layoutId;
    if (status) where.status = status;
    if (group) where.group = group;
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { notes: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const tables = await Table.findAll({
      where,
      include: [
        {
          model: TableLayout,
          as: 'layout',
          attributes: ['id', 'name'],
        },
      ],
      order: [['name', 'ASC']],
    });

    res.json(tables);
  } catch (error) {
    next(error);
  }
}

/**
 * Get a single table by ID
 */
async function getTable(req, res, next) {
  try {
    const { id } = req.params;
    const table = await Table.findByPk(id, {
      include: [
        {
          model: TableLayout,
          as: 'layout',
          attributes: ['id', 'name'],
        },
      ],
    });

    if (!table) {
      throw createError(404, 'Table not found');
    }

    res.json(table);
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new table
 */
async function createTable(req, res, next) {
  const transaction = await sequelize.transaction();
  
  try {
    const { name, group, capacity, positionX, positionY, rotation, width, height, notes, layoutId, type } = req.body;

    // Diagnostics: log incoming payload (without headers/auth) for troubleshooting
    console.log('[tables:createTable] payload', {
      name,
      group,
      capacity,
      positionX,
      positionY,
      rotation,
      width,
      height,
      hasNotes: typeof notes === 'string' ? notes.length : !!notes,
      layoutId,
      type,
    });

    if (!layoutId) {
      await transaction.rollback();
      throw createError(400, 'Missing required layoutId');
    }

    // Check if table name already exists
    const existingTable = await Table.findOne({
      where: { name },
      transaction,
    });

    if (existingTable) {
      await transaction.rollback();
      throw createError(400, 'A table with this name already exists');
    }

    const table = await Table.create({
      name,
      group,
      capacity,
      positionX,
      positionY,
      rotation,
      width,
      height,
      notes,
      layoutId,
      // ensure type is persisted to satisfy DB non-null constraint
      type: type || 'billiard',
    }, { transaction });

    await transaction.commit();
    res.status(201).json(table);
  } catch (error) {
    // Enhanced diagnostics for DB/Sequelize errors
    console.error('[tables:createTable] failed', {
      message: error?.message,
      sql: error?.sql || error?.original?.sql,
      sqlState: error?.original?.sqlState,
      sqlMessage: error?.original?.sqlMessage || error?.parent?.sqlMessage,
      payload: req?.body,
    });
    // Only rollback if the transaction hasn't already been finished
    if (!transaction.finished) {
      await transaction.rollback();
    }
    next(error);
  }
}

/**
 * Update a table
 */
async function updateTable(req, res, next) {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const updates = req.body;

    const table = await Table.findByPk(id, { transaction });
    if (!table) {
      await transaction.rollback();
      throw createError(404, 'Table not found');
    }

    // Prevent updating name to an existing one
    if (updates.name && updates.name !== table.name) {
      const existingTable = await Table.findOne({
        where: { name: updates.name, id: { [Op.ne]: id } },
        transaction,
      });

      if (existingTable) {
        await transaction.rollback();
        throw createError(400, 'A table with this name already exists');
      }
    }

    await table.update(updates, { transaction });
    await transaction.commit();
    
    const updatedTable = await Table.findByPk(id, {
      include: [
        {
          model: TableLayout,
          as: 'layout',
          attributes: ['id', 'name'],
        },
      ],
    });
    
    res.json(updatedTable);
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    next(error);
  }
}

/**
 * Delete a table
 */
async function deleteTable(req, res, next) {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;

    // Detect if table_sessions exists to avoid 500s in environments without that table
    const qi = sequelize.getQueryInterface();
    let hasSessionsTable = false;
    try {
      const all = await qi.showAllTables();
      const normalize = (t) => (typeof t === 'string' ? t : t?.tableName || t?.name || '').toLowerCase();
      hasSessionsTable = all.map(normalize).includes('table_sessions');
    } catch (_e) {
      hasSessionsTable = false;
    }

    let table;
    if (hasSessionsTable) {
      table = await Table.findByPk(id, {
        include: [
          {
            model: TableSession,
            as: 'sessions',
            where: { status: 'active' },
            required: false,
          },
        ],
        transaction,
      });
    } else {
      table = await Table.findByPk(id, { transaction });
    }

    if (!table) {
      await transaction.rollback();
      throw createError(404, 'Table not found');
    }

    if (hasSessionsTable && table.sessions && table.sessions.length > 0) {
      await transaction.rollback();
      throw createError(400, 'Cannot delete a table with active sessions');
    }

    await table.destroy({ transaction });
    await transaction.commit();
    
    res.status(204).send();
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
}

/**
 * Update table positions in bulk (for layout editor)
 */
async function updateTablePositions(req, res, next) {
  const transaction = await sequelize.transaction();
  
  try {
    const { updates } = req.body;
    
    if (!Array.isArray(updates) || updates.length === 0) {
      await transaction.rollback();
      throw createError(400, 'No updates provided');
    }

    // Validate all updates first
    const tableIds = updates.map(update => update.id);
    const tables = await Table.findAll({
      where: { id: { [Op.in]: tableIds } },
      transaction,
    });

    if (tables.length !== tableIds.length) {
      await transaction.rollback();
      throw createError(400, 'One or more tables not found');
    }

    // Update positions
    await Promise.all(
      updates.map(update =>
        Table.update(
          {
            positionX: update.positionX,
            positionY: update.positionY,
            rotation: update.rotation,
            width: update.width,
            height: update.height,
            layoutId: update.layoutId,
          },
          {
            where: { id: update.id },
            transaction,
          }
        )
      )
    );

    await transaction.commit();
    
    // Return updated tables
    const updatedTables = await Table.findAll({
      where: { id: { [Op.in]: tableIds } },
      include: [
        {
          model: TableLayout,
          as: 'layout',
          attributes: ['id', 'name'],
        },
      ],
    });
    
    res.json(updatedTables);
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
}

/**
 * Update only the status of a table
 */
async function updateTableStatus(req, res, next) {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    if (!status) {
      await transaction.rollback();
      throw createError(400, 'Missing status');
    }

    const table = await Table.findByPk(id, { transaction });
    if (!table) {
      await transaction.rollback();
      throw createError(404, 'Table not found');
    }

    await table.update({ status }, { transaction });
    await transaction.commit();

    const updated = await Table.findByPk(id, {
      include: [
        { model: TableLayout, as: 'layout', attributes: ['id', 'name'] },
      ],
    });

    res.json(updated);
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
}

/**
 * Get table statistics
 */
async function getTableStats(req, res, next) {
  try {
    const { layoutId } = req.query;
    
    const where = {};
    if (layoutId) where.layoutId = layoutId;
    
    // Get total tables count
    const totalTables = await Table.count({ where });
    
    // Get active tables count
    const activeTables = await Table.count({
      where: {
        ...where,
        status: 'occupied'
      }
    });
    
    // Get available tables count
    const availableTables = await Table.count({
      where: {
        ...where,
        status: 'available'
      }
    });
    
    res.json({
      success: true,
      data: {
        tables: totalTables,
        active: activeTables,
        available: availableTables,
        maintenance: totalTables - activeTables - availableTables
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get tables that need attention
 */
async function getTablesNeedingAttention(req, res, next) {
  try {
    const { layoutId } = req.query;
    
    const where = {
      status: 'needs_attention'
    };
    
    if (layoutId) where.layoutId = layoutId;
    
    const tables = await Table.findAll({
      where,
      include: [
        {
          model: TableLayout,
          as: 'layout',
          attributes: ['id', 'name'],
        },
      ],
      order: [['updatedAt', 'DESC']],
    });
    
    res.json({
      success: true,
      data: tables
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getTables,
  getTable,
  createTable,
  updateTable,
  deleteTable,
  updateTablePositions,
  updateTableStatus,
  getTableStats,
  getTablesNeedingAttention
};
