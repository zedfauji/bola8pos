const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Table = sequelize.define('Table', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true,
    },
  },
  // Align with MySQL schema which requires a non-null type
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'billiard',
  },
  group: {
    type: DataTypes.ENUM('VIP', 'Hall', 'Smoking', 'Outdoor'),
    defaultValue: 'Hall',
  },
  status: {
    type: DataTypes.ENUM('available', 'occupied', 'cleaning', 'maintenance'),
    defaultValue: 'available',
  },
  capacity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 4,
    validate: {
      min: 1,
      max: 12,
    },
  },
  positionX: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'X position in the floor plan',
  },
  positionY: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Y position in the floor plan',
  },
  rotation: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0,
      max: 360,
    },
  },
  width: {
    type: DataTypes.INTEGER,
    defaultValue: 100,
    comment: 'Width in pixels',
  },
  height: {
    type: DataTypes.INTEGER,
    defaultValue: 200,
    comment: 'Height in pixels',
  },
  notes: {
    type: DataTypes.TEXT,
  },
  // Foreign key to the active layout (UUID). Column name is camelCase `layoutId`.
  layoutId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  timestamps: true,
  paranoid: true, // Enable soft delete
});

module.exports = Table;
