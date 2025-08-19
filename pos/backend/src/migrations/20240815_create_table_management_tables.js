'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Create TableLayouts table
      await queryInterface.createTable('TableLayouts', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        floorPlanImage: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        width: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 1200,
        },
        height: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 800,
        },
        gridSize: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 10,
        },
        settings: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: {
            showGrid: true,
            snapToGrid: true,
            showTableNumbers: true,
            showStatus: true,
          },
        },
        isActive: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        createdAt: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW,
        },
        updatedAt: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW,
        },
        deletedAt: {
          type: Sequelize.DATE,
          allowNull: true,
        },
      }, { transaction });

      // Create Tariffs table
      await queryInterface.createTable('Tariffs', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        rate: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
        },
        rateType: {
          type: Sequelize.ENUM('hourly', 'fixed', 'session'),
          allowNull: false,
          defaultValue: 'hourly',
        },
        minDuration: {
          type: Sequelize.INTEGER, // in minutes
          allowNull: true,
        },
        maxDuration: {
          type: Sequelize.INTEGER, // in minutes
          allowNull: true,
        },
        freeMinutes: {
          type: Sequelize.INTEGER, // in minutes
          allowNull: true,
        },
        restrictions: {
          type: Sequelize.JSONB,
          allowNull: true,
        },
        tieredRates: {
          type: Sequelize.JSONB,
          allowNull: true,
        },
        isActive: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        metadata: {
          type: Sequelize.JSONB,
          allowNull: true,
        },
        createdAt: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW,
        },
        updatedAt: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW,
        },
        deletedAt: {
          type: Sequelize.DATE,
          allowNull: true,
        },
      }, { transaction });

      // Create Tables table
      await queryInterface.createTable('Tables', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
        },
        layoutId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'TableLayouts',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        group: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        status: {
          type: Sequelize.ENUM('available', 'occupied', 'reserved', 'cleaning', 'maintenance'),
          allowNull: false,
          defaultValue: 'available',
        },
        capacity: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        positionX: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        positionY: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        rotation: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        width: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 100,
        },
        height: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 100,
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        isActive: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        metadata: {
          type: Sequelize.JSONB,
          allowNull: true,
        },
        createdAt: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW,
        },
        updatedAt: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW,
        },
        deletedAt: {
          type: Sequelize.DATE,
          allowNull: true,
        },
      }, { transaction });

      // Create TableSessions table
      await queryInterface.createTable('TableSessions', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
        },
        tableId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Tables',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        tariffId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Tariffs',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        startTime: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
        endTime: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        status: {
          type: Sequelize.ENUM('active', 'paused', 'ended', 'cleaning'),
          allowNull: false,
          defaultValue: 'active',
        },
        playerCount: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 1,
        },
        totalPausedTime: {
          type: Sequelize.INTEGER, // in milliseconds
          allowNull: false,
          defaultValue: 0,
        },
        pauseStartTime: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        freeMinutesUsed: {
          type: Sequelize.INTEGER, // in minutes
          allowNull: false,
          defaultValue: 0,
        },
        paidMinutes: {
          type: Sequelize.INTEGER, // in minutes
          allowNull: false,
          defaultValue: 0,
        },
        totalAmount: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0,
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        metadata: {
          type: Sequelize.JSONB,
          allowNull: true,
        },
        createdBy: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'Users',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        endedBy: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'Users',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        createdAt: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW,
        },
        updatedAt: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW,
        },
        deletedAt: {
          type: Sequelize.DATE,
          allowNull: true,
        },
      }, { transaction });

      // Create indexes
      await queryInterface.addIndex('Tables', ['layoutId', 'isActive'], { transaction });
      await queryInterface.addIndex('TableSessions', ['tableId', 'status'], { transaction });
      await queryInterface.addIndex('TableSessions', ['status', 'startTime'], { transaction });
      await queryInterface.addIndex('TableSessions', ['tariffId'], { transaction });
      await queryInterface.addIndex('Tariffs', ['isActive'], { transaction });
      await queryInterface.addIndex('TableLayouts', ['isActive'], { transaction });
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Drop tables in reverse order to respect foreign key constraints
      await queryInterface.dropTable('TableSessions', { transaction, cascade: true });
      await queryInterface.dropTable('Tables', { transaction, cascade: true });
      await queryInterface.dropTable('Tariffs', { transaction, cascade: true });
      await queryInterface.dropTable('TableLayouts', { transaction, cascade: true });
    });
  },
};
