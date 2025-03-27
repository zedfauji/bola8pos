module.exports = (sequelize, DataTypes) => {
  const Shift = sequelize.define('Shift', {
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
    notes: {
      type: DataTypes.TEXT
    }
  }, {
    timestamps: true
  });

  Shift.associate = (models) => {
    Shift.belongsTo(models.Employee, { foreignKey: 'employee_id' });
  };

  return Shift;
};
