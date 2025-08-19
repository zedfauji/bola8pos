const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TableLayout = sequelize.define('TableLayout', {
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
  floorPlanImage: {
    type: DataTypes.STRING,
    comment: 'URL to the floor plan image',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Only one layout can be active at a time',
  },
  gridSize: {
    type: DataTypes.INTEGER,
    defaultValue: 10,
    comment: 'Grid size in pixels for snap-to-grid',
  },
  width: {
    type: DataTypes.INTEGER,
    defaultValue: 1200,
    comment: 'Floor plan width in pixels',
  },
  height: {
    type: DataTypes.INTEGER,
    defaultValue: 800,
    comment: 'Floor plan height in pixels',
  },
  settings: {
    type: DataTypes.JSON,
    defaultValue: {
      showGrid: true,
      snapToGrid: true,
      showTableNumbers: true,
      showStatus: true,
    },
  },
  created_by: {
    type: DataTypes.STRING(36),
    allowNull: false,
    comment: 'ID of the user who created this layout',
  },
}, {
  timestamps: true,
});

module.exports = TableLayout;
