const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TableSession = sequelize.define('TableSession', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  startTime: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  endTime: {
    type: DataTypes.DATE,
  },
  status: {
    type: DataTypes.ENUM('active', 'paused', 'ended', 'cleaning'),
    defaultValue: 'active',
  },
  playerCount: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    validate: {
      min: 1,
    },
  },
  freeMinutesUsed: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Track free minutes used (e.g., first 10 minutes free)',
  },
  paidMinutes: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Number of paid minutes',
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  notes: {
    type: DataTypes.TEXT,
  },
  pauseStartTime: {
    type: DataTypes.DATE,
    comment: 'When the session was last paused',
  },
  totalPausedTime: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Total paused time in milliseconds',
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {
      services: [],
      discounts: [],
      taxes: [],
    },
  },
}, {
  timestamps: true,
  indexes: [
    {
      fields: ['tableId', 'status'],
      where: {
        status: 'active',
      },
    },
  ],
});

module.exports = TableSession;
