const { TableSession, Table, Tariff, TableLayout, sequelize } = require('../../models');
const { Op } = require('sequelize');
const { createError } = require('../../utils/errors');
const { calculateSessionCost } = require('../../utils/billing');

/**
 * Get all sessions with optional filters
 */
async function getSessions(req, res, next) {
  try {
    const { 
      status, 
      tableId, 
      startDate, 
      endDate,
      includeEnded
    } = req.query;
    
    const where = {};
    if (status) where.status = status;
    if (tableId) where.tableId = tableId;
    
    // Date filtering
    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime[Op.gte] = new Date(startDate);
      if (endDate) where.startTime[Op.lte] = new Date(endDate);
    }
    
    // If not including ended sessions, only return active/paused/cleaning
    if (includeEnded !== 'true') {
      where.status = { [Op.in]: ['active', 'paused', 'cleaning'] };
    }
    const sessions = await TableSession.findAll({
      where,
      include: [
        {
          model: Table,
          as: 'table',
          attributes: ['id', 'name', 'group'],
        },
        {
          model: Tariff,
          as: 'tariff',
          attributes: ['id', 'name', 'rate', 'rateType'],
        },
      ],
      order: [['startTime', 'DESC']],
    });

    res.json(sessions);
  } catch (error) {
    next(error);
  }
}

/**
 * Get currently active sessions (active, paused, cleaning)
 */
async function getActiveSessions(req, res, next) {
  try {
    const sessions = await TableSession.findAll({
      where: { status: { [Op.in]: ['active', 'paused', 'cleaning'] } },
      include: [
        { model: Table, as: 'table', attributes: ['id', 'name', 'group'] },
        { model: Tariff, as: 'tariff', attributes: ['id', 'name', 'rate', 'rateType'] },
      ],
      order: [['startTime', 'DESC']],
    });

    res.json(sessions);
  } catch (error) {
    next(error);
  }
}

/**
 * Get a single session by ID
 */
async function getSession(req, res, next) {
  try {
    const { id } = req.params;
    
    const session = await TableSession.findByPk(id, {
      include: [
        {
          model: Table,
          as: 'table',
          include: [
            {
              model: TableLayout,
              as: 'layout',
              attributes: ['id', 'name'],
            },
          ],
        },
        {
          model: Tariff,
          as: 'tariff',
        },
      ],
    });

    if (!session) {
      throw createError(404, 'Session not found');
    }

    res.json(session);
  } catch (error) {
    next(error);
  }
}

/**
 * Start a new table session
 */
async function startSession(req, res, next) {
  const transaction = await sequelize.transaction();
  
  try {
    const { tableId, tariffId, playerCount, notes, metadata } = req.body;
    
    // Validate required fields
    if (!tableId || !tariffId) {
      await transaction.rollback();
      throw createError(400, 'Table ID and Tariff ID are required');
    }

    // Check if table exists and is available
    const table = await Table.findByPk(tableId, { transaction });
    if (!table) {
      await transaction.rollback();
      throw createError(404, 'Table not found');
    }

    if (table.status !== 'available') {
      await transaction.rollback();
      throw createError(400, `Table is currently ${table.status}`);
    }

    // Check if tariff exists and is active
    const tariff = await Tariff.findOne({
      where: { 
        id: tariffId,
        isActive: true,
      },
      transaction,
    });

    if (!tariff) {
      await transaction.rollback();
      throw createError(400, 'Invalid or inactive tariff');
    }

    // Check player count against tariff restrictions
    const { minPlayers = 1, maxPlayers } = tariff.restrictions || {};
    const actualPlayerCount = playerCount || 1;
    
    if (actualPlayerCount < minPlayers || (maxPlayers && actualPlayerCount > maxPlayers)) {
      await transaction.rollback();
      throw createError(400, `This tariff requires between ${minPlayers} and ${maxPlayers || 'unlimited'} players`);
    }

    // Check for existing active session on this table
    const existingSession = await TableSession.findOne({
      where: {
        tableId,
        status: { [Op.in]: ['active', 'paused'] },
      },
      transaction,
    });

    if (existingSession) {
      await transaction.rollback();
      throw createError(400, 'This table already has an active session');
    }

    // Create the session
    const session = await TableSession.create({
      tableId,
      tariffId,
      playerCount: actualPlayerCount,
      startTime: new Date(),
      status: 'active',
      notes,
      metadata: {
        ...metadata,
        freeMinutesUsed: 0,
        services: [],
        discounts: [],
      },
    }, { transaction });

    // Update table status
    await table.update({ status: 'occupied' }, { transaction });
    
    await transaction.commit();
    
    // Fetch the full session with related data
    const fullSession = await TableSession.findByPk(session.id, {
      include: [
        { model: Table, as: 'table' },
        { model: Tariff, as: 'tariff' },
      ],
    });
    
    // Emit real-time update via WebSocket if configured
    // socketIo.emit('session:started', fullSession);
    
    res.status(201).json(fullSession);
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
}

/**
 * Pause a session
 */
async function pauseSession(req, res, next) {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const session = await TableSession.findByPk(id, {
      include: [
        { model: Table, as: 'table' },
      ],
      transaction,
    });
    
    if (!session) {
      await transaction.rollback();
      throw createError(404, 'Session not found');
    }
    
    if (session.status !== 'active') {
      await transaction.rollback();
      throw createError(400, `Cannot pause a session that is ${session.status}`);
    }
    
    // Update session
    session.status = 'paused';
    session.pauseStartTime = new Date();
    session.metadata = {
      ...session.metadata,
      pauseReason: reason,
    };
    
    await session.save({ transaction });
    
    // Update table status
    await session.table.update({ status: 'available' }, { transaction });
    
    await transaction.commit();
    
    // Emit real-time update
    // socketIo.emit('session:paused', session);
    
    res.json(session);
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
}

/**
 * Resume a paused session
 */
async function resumeSession(req, res, next) {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    
    const session = await TableSession.findByPk(id, {
      include: [
        { model: Table, as: 'table' },
      ],
      transaction,
    });
    
    if (!session) {
      await transaction.rollback();
      throw createError(404, 'Session not found');
    }
    
    if (session.status !== 'paused') {
      await transaction.rollback();
      throw createError(400, 'Only paused sessions can be resumed');
    }
    
    // Check if table is available
    if (session.table.status !== 'available') {
      await transaction.rollback();
      throw createError(400, 'Table is no longer available');
    }
    
    // Calculate paused duration and update total
    const now = new Date();
    const pauseDuration = now - new Date(session.pauseStartTime);
    
    // Update session
    session.status = 'active';
    session.totalPausedTime += pauseDuration;
    session.pauseStartTime = null;
    
    await session.save({ transaction });
    
    // Update table status
    await session.table.update({ status: 'occupied' }, { transaction });
    
    await transaction.commit();
    
    // Emit real-time update
    // socketIo.emit('session:resumed', session);
    
    res.json(session);
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
}

/**
 * End a session
 */
async function endSession(req, res, next) {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { endTime, notes, metadata } = req.body;
    
    const session = await TableSession.findByPk(id, {
      include: [
        { 
          model: Table, 
          as: 'table',
          include: [
            {
              model: TableLayout,
              as: 'layout',
            },
          ],
        },
        { model: Tariff, as: 'tariff' },
      ],
      transaction,
    });
    
    if (!session) {
      await transaction.rollback();
      throw createError(404, 'Session not found');
    }
    
    if (session.status === 'ended') {
      await transaction.rollback();
      throw createError(400, 'Session has already ended');
    }
    
    // Set end time (use provided or current time)
    const endTimestamp = endTime ? new Date(endTime) : new Date();
    
    // Calculate session duration and cost
    const { totalMinutes, cost, freeMinutesUsed } = calculateSessionCost(session, endTimestamp);
    
    // Update session
    session.status = 'ended';
    session.endTime = endTimestamp;
    session.totalAmount = cost;
    session.freeMinutesUsed = freeMinutesUsed;
    session.paidMinutes = totalMinutes - freeMinutesUsed;
    session.notes = notes || session.notes;
    session.metadata = {
      ...session.metadata,
      ...metadata,
      calculatedAt: new Date(),
    };
    
    await session.save({ transaction });
    
    // Update table status
    await session.table.update({ status: 'available' }, { transaction });
    
    await transaction.commit();
    
    // Emit real-time update
    // socketIo.emit('session:ended', session);
    
    res.json(session);
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
}

/**
 * Add a service to a session (e.g., cue rental, drinks)
 */
async function addServiceToSession(req, res, next) {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { name, price, quantity = 1, notes } = req.body;
    
    if (!name || price === undefined) {
      await transaction.rollback();
      throw createError(400, 'Service name and price are required');
    }
    
    const session = await TableSession.findByPk(id, { transaction });
    
    if (!session) {
      await transaction.rollback();
      throw createError(404, 'Session not found');
    }
    
    if (session.status !== 'active' && session.status !== 'paused') {
      await transaction.rollback();
      throw createError(400, 'Cannot add service to a session that is not active or paused');
    }
    
    // Create service object
    const service = {
      id: Date.now().toString(),
      name,
      price: parseFloat(price),
      quantity: parseInt(quantity, 10) || 1,
      addedAt: new Date(),
      notes,
    };
    
    // Add to session services
    const services = Array.isArray(session.metadata?.services) 
      ? [...session.metadata.services, service]
      : [service];
    
    // Update session
    await session.update({
      metadata: {
        ...session.metadata,
        services,
      },
    }, { transaction });
    
    await transaction.commit();
    
    // Emit real-time update
    // socketIo.emit('session:serviceAdded', { sessionId: id, service });
    
    res.status(201).json(service);
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
}

/**
 * Remove a service from a session
 */
async function removeServiceFromSession(req, res, next) {
  const transaction = await sequelize.transaction();
  
  try {
    const { id, serviceId } = req.params;
    
    const session = await TableSession.findByPk(id, { transaction });
    
    if (!session) {
      await transaction.rollback();
      throw createError(404, 'Session not found');
    }
    
    if (session.status !== 'active' && session.status !== 'paused') {
      await transaction.rollback();
      throw createError(400, 'Cannot modify services for a session that is not active or paused');
    }
    
    const services = Array.isArray(session.metadata?.services) 
      ? session.metadata.services.filter(svc => svc.id !== serviceId)
      : [];
    
    if (services.length === (session.metadata?.services?.length || 0)) {
      await transaction.rollback();
      throw createError(404, 'Service not found in session');
    }
    
    // Update session
    await session.update({
      metadata: {
        ...session.metadata,
        services,
      },
    }, { transaction });
    
    await transaction.commit();
    
    // Emit real-time update
    // socketIo.emit('session:serviceRemoved', { sessionId: id, serviceId });
    
    res.status(204).send();
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
}

module.exports = {
  getSessions,
  getActiveSessions,
  getSession,
  startSession,
  pauseSession,
  resumeSession,
  endSession,
  addServiceToSession,
  removeServiceFromSession,
};
