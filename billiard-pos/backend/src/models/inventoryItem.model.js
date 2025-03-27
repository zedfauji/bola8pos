module.exports = (sequelize, DataTypes) => {
  const InventoryItem = sequelize.define('InventoryItem', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT
    },
    category: {
      type: DataTypes.ENUM('food', 'drink', 'supply', 'other'),
      allowNull: false
    },
    current_stock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    reorder_level: {
      type: DataTypes.INTEGER,
      defaultValue: 10
    },
    unit_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    timestamps: true
  });

  InventoryItem.associate = (models) => {
    InventoryItem.hasMany(models.OrderItem, { foreignKey: 'item_id' });
    InventoryItem.hasMany(models.InventoryMovement, { foreignKey: 'item_id' });
  };

  return InventoryItem;
};
