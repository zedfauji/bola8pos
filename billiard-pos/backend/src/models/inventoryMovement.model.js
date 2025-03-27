module.exports = (sequelize, DataTypes) => {
  const InventoryMovement = sequelize.define('InventoryMovement', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    movement_type: {
      type: DataTypes.ENUM('purchase', 'sale', 'adjustment', 'waste'),
      allowNull: false
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    unit_price: {
      type: DataTypes.DECIMAL(10, 2)
    },
    notes: {
      type: DataTypes.TEXT
    }
  }, {
    timestamps: true
  });

  InventoryMovement.associate = (models) => {
    InventoryMovement.belongsTo(models.InventoryItem, { foreignKey: 'item_id' });
    InventoryMovement.belongsTo(models.Employee, { foreignKey: 'employee_id' });
  };

  return InventoryMovement;
};
