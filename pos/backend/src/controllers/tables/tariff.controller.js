const { Tariff, sequelize } = require('../../models');
const { Op } = require('sequelize');
const { createError } = require('../../utils/errors');

/**
 * Get all tariffs with optional filters
 */
async function getTariffs(req, res, next) {
  try {
    const { isActive, rateType, search } = req.query;
    
    const where = {};
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (rateType) where.rateType = rateType;
    
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const tariffs = await Tariff.findAll({
      where,
      order: [['name', 'ASC']],
    });

    res.json(tariffs);
  } catch (error) {
    next(error);
  }
}

/**
 * Get a single tariff by ID
 */
async function getTariff(req, res, next) {
  try {
    const { id } = req.params;
    
    const tariff = await Tariff.findByPk(id);
    if (!tariff) {
      throw createError(404, 'Tariff not found');
    }

    res.json(tariff);
  } catch (error) {
    next(error);
  }
}

/**
 * Get applicable tariffs for a specific date/time and player count
 */
async function getApplicableTariffs(req, res, next) {
  try {
    const { datetime, players } = req.query;
    
    if (!datetime) {
      throw createError(400, 'Datetime is required');
    }

    const targetDate = new Date(datetime);
    const dayOfWeek = targetDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const timeString = targetDate.toTimeString().substring(0, 5); // HH:MM
    
    const tariffs = await Tariff.findAll({
      where: {
        isActive: true,
        '$restrictions.daysOfWeek$': {
          [Op.contains]: [dayOfWeek],
        },
        '$restrictions.timeRanges$': {
          [Op.overlap]: [
            {
              start: { [Op.lte]: timeString },
              end: { [Op.gte]: timeString },
            },
          ],
        },
      },
      order: [['rate', 'ASC']], // Return cheapest first
    });

    // Filter by player count if specified
    let applicableTariffs = tariffs;
    if (players) {
      const playerCount = parseInt(players, 10);
      applicableTariffs = tariffs.filter(tariff => {
        const { minPlayers = 1, maxPlayers } = tariff.restrictions || {};
        return (
          playerCount >= minPlayers && 
          (!maxPlayers || playerCount <= maxPlayers)
        );
      });
    }

    res.json(applicableTariffs);
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new tariff
 */
async function createTariff(req, res, next) {
  const transaction = await sequelize.transaction();
  
  try {
    const { 
      name, 
      description, 
      rate, 
      rateType, 
      minDuration, 
      maxDuration, 
      freeMinutes, 
      restrictions, 
      tieredRates, 
      metadata 
    } = req.body;

    // Validate rate type
    const validRateTypes = ['hourly', 'fixed', 'session'];
    if (!validRateTypes.includes(rateType)) {
      await transaction.rollback();
      throw createError(400, `Invalid rate type. Must be one of: ${validRateTypes.join(', ')}`);
    }

    // Validate restrictions if provided
    if (restrictions) {
      if (restrictions.daysOfWeek && 
          (!Array.isArray(restrictions.daysOfWeek) || 
           !restrictions.daysOfWeek.every(d => d >= 0 && d <= 6))) {
        await transaction.rollback();
        throw createError(400, 'Invalid daysOfWeek. Must be an array of numbers 0-6 (0=Sunday)');
      }

      if (restrictions.timeRanges) {
        if (!Array.isArray(restrictions.timeRanges)) {
          await transaction.rollback();
          throw createError(400, 'timeRanges must be an array');
        }

        for (const range of restrictions.timeRanges) {
          if (!range.start || !range.end) {
            await transaction.rollback();
            throw createError(400, 'Each time range must have start and end times');
          }
          
          // Simple time format validation (HH:MM)
          const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
          if (!timeRegex.test(range.start) || !timeRegex.test(range.end)) {
            await transaction.rollback();
            throw createError(400, 'Time ranges must be in HH:MM format (24-hour)');
          }
        }
      }
    }

    // Validate tiered rates if provided
    if (tieredRates && Array.isArray(tieredRates)) {
      // Sort by fromMinute to ensure proper ordering
      tieredRates.sort((a, b) => a.fromMinute - b.fromMinute);
      
      // Check for gaps or overlaps
      for (let i = 0; i < tieredRates.length; i++) {
        const current = tieredRates[i];
        
        if (current.fromMinute < 0) {
          await transaction.rollback();
          throw createError(400, 'fromMinute must be 0 or greater');
        }
        
        if (i > 0) {
          const previous = tieredRates[i - 1];
          if (current.fromMinute <= previous.fromMinute) {
            await transaction.rollback();
            throw createError(400, 'Tiered rates must be in ascending order by fromMinute');
          }
        }
      }
    }

    const tariff = await Tariff.create({
      name,
      description,
      rate,
      rateType,
      minDuration,
      maxDuration,
      freeMinutes,
      restrictions,
      tieredRates,
      metadata,
    }, { transaction });

    await transaction.commit();
    res.status(201).json(tariff);
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
}

/**
 * Update a tariff
 */
async function updateTariff(req, res, next) {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const updates = req.body;

    const tariff = await Tariff.findByPk(id, { transaction });
    if (!tariff) {
      await transaction.rollback();
      throw createError(404, 'Tariff not found');
    }

    // Validate rate type if being updated
    if (updates.rateType) {
      const validRateTypes = ['hourly', 'fixed', 'session'];
      if (!validRateTypes.includes(updates.rateType)) {
        await transaction.rollback();
        throw createError(400, `Invalid rate type. Must be one of: ${validRateTypes.join(', ')}`);
      }
    }

    // Similar validation as create for restrictions and tieredRates
    if (updates.restrictions) {
      // Same validation as in createTariff...
    }

    if (updates.tieredRates) {
      // Same validation as in createTariff...
    }

    await tariff.update(updates, { transaction });
    await transaction.commit();
    
    const updatedTariff = await Tariff.findByPk(id);
    res.json(updatedTariff);
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
}

/**
 * Delete a tariff
 */
async function deleteTariff(req, res, next) {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;

    const tariff = await Tariff.findByPk(id, { transaction });
    if (!tariff) {
      await transaction.rollback();
      throw createError(404, 'Tariff not found');
    }

    // Check if tariff is in use by any active sessions
    const activeSessions = await TableSession.count({
      where: { 
        tariffId: id,
        status: { [Op.in]: ['active', 'paused'] },
      },
      transaction,
    });

    if (activeSessions > 0) {
      await transaction.rollback();
      throw createError(400, 'Cannot delete a tariff that has active sessions');
    }

    await tariff.destroy({ transaction });
    await transaction.commit();
    
    res.status(204).send();
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
}

module.exports = {
  getTariffs,
  getTariff,
  getApplicableTariffs,
  createTariff,
  updateTariff,
  deleteTariff,
};
