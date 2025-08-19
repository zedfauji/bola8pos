const Table = require('./Table');
const TableLayout = require('./TableLayout');
const TableSession = require('./TableSession');
const Tariff = require('./Tariff');
const sequelize = require('../config/database');

// Table Relationships
Table.belongsTo(TableLayout, {
  foreignKey: 'layoutId',
  as: 'layout',
});

TableLayout.hasMany(Table, {
  foreignKey: 'layoutId',
  as: 'tables',
});

Table.hasMany(TableSession, {
  foreignKey: 'tableId',
  as: 'sessions',
});

TableSession.belongsTo(Table, {
  foreignKey: 'tableId',
  as: 'table',
});

TableSession.belongsTo(Tariff, {
  foreignKey: 'tariffId',
  as: 'tariff',
});

Tariff.hasMany(TableSession, {
  foreignKey: 'tariffId',
  as: 'sessions',
});

// Add hooks
TableLayout.beforeUpdate(async (layout) => {
  // Ensure only one active layout at a time
  if (layout.isActive) {
    await TableLayout.update(
      { isActive: false },
      {
        where: {
          id: { [sequelize.Op.ne]: layout.id },
          isActive: true,
        },
      }
    );
  }
});

module.exports = {
  sequelize,
  Table,
  TableLayout,
  TableSession,
  Tariff,
};
