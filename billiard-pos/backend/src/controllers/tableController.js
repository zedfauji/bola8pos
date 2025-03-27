const { Table, TableSession, Member } = require('../models');
const redisClient = require('../config/redis');
const { calculateTimeCharge } = require('../services/billingService');

exports.getAllTables = async (req, res) => {
  try {
    const tables = await Table.findAll();
    res.json(tables);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getTableById = async (req, res) => {
  try {
    const table = await Table.findByPk(req.params.id);
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }
    res.json(table);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.startTableSession = async (req, res) => {
  try {
    const { tableId, memberId } = req.body;
    
    const table = await Table.findByPk(tableId);
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    if (table.status === 'occupied') {
      return res.status(400).json({ error: 'Table is already occupied' });
    }

    const session = await TableSession.create({
      table_id: tableId,
      member_id: memberId || null,
      start_time: new Date(),
      is_paid: false
    });

    await table.update({
      status: 'occupied',
      current_session_start: new Date()
    });

    // Cache the session start time
    await redisClient.set(`table:${tableId}:session`, session.id);
    await redisClient.set(`session:${session.id}:start`, session.start_time.getTime());

    res.status(201).json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.endTableSession = async (req, res) => {
  try {
    const { tableId } = req.params;
    
    const table = await Table.findByPk(tableId);
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    if (table.status !== 'occupied') {
      return res.status(400).json({ error: 'Table is not occupied' });
    }

    const sessionId = await redisClient.get(`table:${tableId}:session`);
    if (!sessionId) {
      return res.status(400).json({ error: 'No active session found' });
    }

    const session = await TableSession.findByPk(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const endTime = new Date();
    const startTime = new Date(parseInt(await redisClient.get(`session:${sessionId}:start`)));
    const totalMinutes = Math.ceil((endTime - startTime) / (1000 * 60));
    
    // Calculate charges
    const { totalAmount, discountAmount } = await calculateTimeCharge(
      table.hourly_rate,
      totalMinutes,
      session.member_id
    );

    await session.update({
      end_time: endTime,
      total_time_minutes: totalMinutes,
      total_amount: totalAmount,
      discount_amount: discountAmount,
      is_paid: false
    });

    await table.update({
      status: 'available',
      current_session_start: null
    });

    // Clear cache
    await redisClient.del(`table:${tableId}:session`);
    await redisClient.del(`session:${sessionId}:start`);

    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.transferTableSession = async (req, res) => {
  try {
    const { fromTableId, toTableId } = req.body;
    
    const fromTable = await Table.findByPk(fromTableId);
    const toTable = await Table.findByPk(toTableId);
    
    if (!fromTable || !toTable) {
      return res.status(404).json({ error: 'Table not found' });
    }

    if (fromTable.status !== 'occupied') {
      return res.status(400).json({ error: 'Source table is not occupied' });
    }

    if (toTable.status !== 'available') {
      return res.status(400).json({ error: 'Destination table is not available' });
    }

    const sessionId = await redisClient.get(`table:${fromTableId}:session`);
    if (!sessionId) {
      return res.status(400).json({ error: 'No active session found on source table' });
    }

    const session = await TableSession.findByPk(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Update session with new table ID
    await session.update({ table_id: toTableId });

    // Update table statuses
    await fromTable.update({ status: 'available', current_session_start: null });
    await toTable.update({ status: 'occupied', current_session_start: new Date() });

    // Update cache
    await redisClient.del(`table:${fromTableId}:session`);
    await redisClient.set(`table:${toTableId}:session`, sessionId);

    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
