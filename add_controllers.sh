#!/bin/bash

# Create directory structure if it doesn't exist
mkdir -p billiard-pos/backend/src/{controllers,models,routes,services,middleware}

# Create tableController.js
cat > billiard-pos/backend/src/controllers/tableController.js <<'EOL'
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
EOL

# Now create the routes that depend on tableController
cat > billiard-pos/backend/src/routes/tableRoutes.js <<'EOL'
const express = require('express');
const router = express.Router();
const tableController = require('../controllers/tableController');
const { authenticate, authorize } = require('../middleware/auth');

// Table management
router.get('/', tableController.getAllTables);
router.get('/:id', tableController.getTableById);

// Session management
router.post('/:id/start', authenticate, authorize(['cashier', 'manager']), tableController.startTableSession);
router.post('/:id/end', authenticate, authorize(['cashier', 'manager']), tableController.endTableSession);
router.post('/transfer', authenticate, authorize(['cashier', 'manager']), tableController.transferTableSession);

module.exports = router;
EOL

# Create auth middleware that the routes depend on
cat > billiard-pos/backend/src/middleware/auth.js <<'EOL'
const jwt = require('jsonwebtoken');
const { Employee } = require('../models');

exports.authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const employee = await Employee.findByPk(decoded.id);

    if (!employee) {
      return res.status(401).json({ error: 'Employee not found' });
    }

    req.employee = employee;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

exports.authorize = (roles = []) => {
  return (req, res, next) => {
    if (!roles.includes(req.employee.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  };
};
EOL

# Create billing service that tableController depends on
cat > billiard-pos/backend/src/services/billingService.js <<'EOL'
const { Member } = require('../models');

async function calculateTimeCharge(hourlyRate, minutes, memberId = null) {
  const hours = minutes / 60;
  let baseAmount = hourlyRate * hours;
  let discountAmount = 0;

  if (memberId) {
    const member = await Member.findByPk(memberId);
    if (member) {
      // Apply membership discount
      let discountPercentage = 0;
      switch (member.membership_tier) {
        case 'silver':
          discountPercentage = 0.10;
          break;
        case 'gold':
          discountPercentage = 0.15;
          break;
      }

      discountAmount = baseAmount * discountPercentage;
      baseAmount -= discountAmount;

      // Deduct free hours if available
      if (member.free_hours_balance > 0) {
        const freeHoursToUse = Math.min(member.free_hours_balance, hours);
        const freeAmount = freeHoursToUse * hourlyRate;
        discountAmount += freeAmount;
        baseAmount -= freeAmount;

        // Update member's free hours balance
        await member.decrement('free_hours_balance', { by: freeHoursToUse });
      }
    }
  }

  return {
    totalAmount: parseFloat(baseAmount.toFixed(2)),
    discountAmount: parseFloat(discountAmount.toFixed(2))
  };
}

module.exports = { calculateTimeCharge };
EOL

echo "Created all files with proper dependencies:"
echo "- Created tableController.js"
echo "- Created tableRoutes.js that depends on it"
echo "- Created auth middleware needed by routes"
echo "- Created billingService needed by tableController"
echo ""
echo "To complete setup:"
echo "1. cd billiard-pos/backend"
echo "2. npm install"
echo "3. Create the required models (Table, TableSession, Member, Employee)"
echo "4. Run with: npm run dev"