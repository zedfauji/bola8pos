module.exports = (sequelize, DataTypes) => {
  const Member = sequelize.define('Member', {
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
    membership_tier: {
      type: DataTypes.ENUM('bronze', 'silver', 'gold'),
      defaultValue: 'bronze'
    },
    points_balance: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    free_hours_balance: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0
    },
    qr_code: {
      type: DataTypes.STRING,
      unique: true
    }
  }, {
    timestamps: true
  });

  Member.associate = (models) => {
    Member.hasMany(models.TableSession, { foreignKey: 'member_id' });
    Member.hasMany(models.Order, { foreignKey: 'member_id' });
  };

  return Member;
};
