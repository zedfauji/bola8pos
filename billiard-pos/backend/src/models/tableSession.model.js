module.exports = (sequelize, DataTypes) => {
  const TableSession = sequelize.define('TableSession', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    start_time: {
      type: DataTypes.DATE,
      allowNull: false
    },
    end_time: {
      type: DataTypes.DATE
    },
    total_time_minutes: {
      type: DataTypes.INTEGER
    },
    total_amount: {
      type: DataTypes.DECIMAL(10, 2)
    },
    is_paid: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    timestamps: true
  });

  TableSession.associate = (models) => {
    TableSession.belongsTo(models.Table, { foreignKey: 'table_id' });
    TableSession.belongsTo(models.Member, { foreignKey: 'member_id' });
    TableSession.hasMany(models.Order, { foreignKey: 'session_id' });
  };

  return TableSession;
};
