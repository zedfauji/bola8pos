module.exports = (sequelize, DataTypes) => {
  const Order = sequelize.define('Order', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    status: {
      type: DataTypes.ENUM('pending', 'preparing', 'ready', 'delivered', 'cancelled'),
      defaultValue: 'pending'
    },
    total_amount: {
      type: DataTypes.DECIMAL(10, 2)
    },
    discount_amount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0
    },
    final_amount: {
      type: DataTypes.DECIMAL(10, 2)
    },
    notes: {
      type: DataTypes.TEXT
    }
  }, {
    timestamps: true
  });

  Order.associate = (models) => {
    Order.belongsTo(models.Table, { foreignKey: 'table_id' });
    Order.belongsTo(models.TableSession, { foreignKey: 'session_id' });
    Order.belongsTo(models.Member, { foreignKey: 'member_id' });
    Order.belongsTo(models.Employee, { foreignKey: 'employee_id' });
    Order.hasMany(models.OrderItem, { foreignKey: 'order_id' });
  };

  return Order;
};
