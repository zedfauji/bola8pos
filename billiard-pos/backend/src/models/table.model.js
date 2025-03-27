module.exports = (sequelize, DataTypes) => {
  const Table = sequelize.define('Table', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    table_number: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    table_type: {
      type: DataTypes.ENUM('billiard', 'bar', 'restaurant'),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('available', 'occupied', 'maintenance'),
      defaultValue: 'available'
    },
    current_session_start: {
      type: DataTypes.DATE
    },
    hourly_rate: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 80.00
    }
  }, {
    timestamps: true,
    paranoid: true
  });

  Table.associate = (models) => {
    Table.hasMany(models.Order, { foreignKey: 'table_id' });
    Table.hasMany(models.TableSession, { foreignKey: 'table_id' });
  };

  return Table;
};
