const bcrypt = require('bcryptjs');

module.exports = (sequelize, DataTypes) => {
  const Employee = sequelize.define('Employee', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM('admin', 'manager', 'cashier', 'waiter', 'kitchen'),
      allowNull: false
    },
    pin_code: {
      type: DataTypes.STRING(60),
      allowNull: false
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    timestamps: true,
    paranoid: true,
    hooks: {
      beforeCreate: async (employee) => {
        if (employee.pin_code) {
          const salt = await bcrypt.genSalt(10);
          employee.pin_code = await bcrypt.hash(employee.pin_code, salt);
        }
      },
      beforeUpdate: async (employee) => {
        if (employee.changed('pin_code')) {
          const salt = await bcrypt.genSalt(10);
          employee.pin_code = await bcrypt.hash(employee.pin_code, salt);
        }
      }
    }
  });

  Employee.associate = (models) => {
    Employee.hasMany(models.Order, { foreignKey: 'employee_id' });
    Employee.hasMany(models.Shift, { foreignKey: 'employee_id' });
    Employee.hasMany(models.InventoryMovement, { foreignKey: 'employee_id' });
  };

  // Instance method for PIN verification
  Employee.prototype.verifyPin = async function(pin) {
    return await bcrypt.compare(pin, this.pin_code);
  };

  return Employee;
};