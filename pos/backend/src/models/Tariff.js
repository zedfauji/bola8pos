const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Tariff = sequelize.define('Tariff', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
    },
  },
  description: {
    type: DataTypes.TEXT,
  },
  rate: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0,
    },
  },
  rateType: {
    type: DataTypes.ENUM('hourly', 'fixed', 'session'),
    defaultValue: 'hourly',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  minDuration: {
    type: DataTypes.INTEGER,
    comment: 'Minimum duration in minutes',
    defaultValue: 60,
  },
  maxDuration: {
    type: DataTypes.INTEGER,
    comment: 'Maximum duration in minutes (0 for unlimited)',
    defaultValue: 0,
  },
  freeMinutes: {
    type: DataTypes.INTEGER,
    defaultValue: 10,
    comment: 'Number of free minutes at the start',
  },
  restrictions: {
    type: DataTypes.JSON,
    defaultValue: {
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // 0 = Sunday
      timeRanges: [
        { start: '00:00', end: '23:59' },
      ],
      minPlayers: 1,
      maxPlayers: 12,
    },
  },
  tieredRates: {
    type: DataTypes.JSON,
    comment: 'For tiered pricing (e.g., first hour $15, then $10)',
    defaultValue: [],
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
  },
}, {
  timestamps: true,
});

module.exports = Tariff;
