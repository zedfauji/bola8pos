'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { v4: uuidv4 } = require('uuid');
    const now = new Date();
    
    // Create default layout
    const [layout] = await queryInterface.bulkInsert('TableLayouts', [
      {
        id: uuidv4(),
        name: 'Main Floor',
        description: 'Main billiard hall floor plan',
        width: 1200,
        height: 800,
        gridSize: 20,
        settings: {
          showGrid: true,
          snapToGrid: true,
          showTableNumbers: true,
          showStatus: true,
          backgroundColor: '#f0f0f0',
        },
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ], { returning: true });

    // Create sample tariffs
    const [standardTariff, premiumTariff] = await queryInterface.bulkInsert('Tariffs', [
      {
        id: uuidv4(),
        name: 'Standard Hourly',
        description: 'Standard hourly rate',
        rate: 15.00,
        rateType: 'hourly',
        minDuration: 60, // 1 hour minimum
        freeMinutes: 15, // First 15 minutes free
        restrictions: {
          daysOfWeek: [1, 2, 3, 4, 5, 6, 0], // All days
          timeRanges: [
            { start: '12:00', end: '23:59' },
          ],
          minPlayers: 1,
          maxPlayers: 4,
        },
        tieredRates: [
          { fromMinute: 0, rate: 15.00 },
          { fromMinute: 60, rate: 12.00 }, // Discount after 1 hour
          { fromMinute: 120, rate: 10.00 }, // Further discount after 2 hours
        ],
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uuidv4(),
        name: 'Weekend Premium',
        description: 'Weekend premium rate',
        rate: 20.00,
        rateType: 'hourly',
        minDuration: 30, // 30 minutes minimum
        freeMinutes: 0,
        restrictions: {
          daysOfWeek: [5, 6], // Friday, Saturday
          timeRanges: [
            { start: '17:00', end: '23:59' },
          ],
          minPlayers: 1,
          maxPlayers: 6,
        },
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ], { returning: true });

    // Create sample tables
    const tables = [];
    const tableCount = 12;
    const tableSize = 100; // 100x100 pixels
    const spacing = 40;
    const tablesPerRow = 4;
    
    for (let i = 0; i < tableCount; i++) {
      const row = Math.floor(i / tablesPerRow);
      const col = i % tablesPerRow;
      
      tables.push({
        id: uuidv4(),
        layoutId: layout.id,
        name: `Table ${i + 1}`,
        group: i < 6 ? 'Main Hall' : 'VIP Area',
        status: 'available',
        capacity: i < 6 ? 4 : 6, // VIP tables have higher capacity
        positionX: 200 + (col * (tableSize + spacing)),
        positionY: 100 + (row * (tableSize + spacing)),
        rotation: 0,
        width: tableSize,
        height: tableSize,
        notes: i < 6 ? 'Standard table' : 'VIP table with premium felt',
        isActive: true,
        metadata: {
          tableType: i < 6 ? 'standard' : 'vip',
          hasLight: true,
          hasScoreboard: i % 2 === 0, // Every other table has a scoreboard
        },
        createdAt: now,
        updatedAt: now,
      });
    }
    
    await queryInterface.bulkInsert('Tables', tables);
    
    // Create a sample active session
    const [table] = await queryInterface.sequelize.query(
      'SELECT id FROM "Tables" WHERE "isActive" = true LIMIT 1',
      { type: Sequelize.QueryTypes.SELECT }
    );
    
    if (table) {
      await queryInterface.bulkInsert('TableSessions', [
        {
          id: uuidv4(),
          tableId: table.id,
          tariffId: standardTariff.id,
          startTime: new Date(Date.now() - 30 * 60 * 1000), // Started 30 minutes ago
          status: 'active',
          playerCount: 2,
          totalPausedTime: 0,
          freeMinutesUsed: 15,
          paidMinutes: 15,
          totalAmount: 7.50, // 15 minutes at standard rate
          notes: 'Walk-in customers',
          metadata: {
            services: [
              {
                id: uuidv4(),
                name: 'Cue Rental',
                price: 5.00,
                quantity: 2,
                addedAt: new Date(),
                notes: 'Premium cues',
              },
            ],
          },
          createdBy: null, // Will be set to an admin user ID if available
          createdAt: now,
          updatedAt: now,
        },
      ]);
      
      // Update the table status to occupied
      await queryInterface.bulkUpdate(
        'Tables',
        { status: 'occupied', updatedAt: now },
        { id: table.id }
      );
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Clean up all data
    await queryInterface.bulkDelete('TableSessions', null, {});
    await queryInterface.bulkDelete('Tables', null, {});
    await queryInterface.bulkDelete('Tariffs', null, {});
    await queryInterface.bulkDelete('TableLayouts', null, {});
  },
};
