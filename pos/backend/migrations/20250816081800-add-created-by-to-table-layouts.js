'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('table_layouts', 'created_by', {
      type: Sequelize.UUID,
      allowNull: false,
      comment: 'ID of the user who created this layout',
      after: 'settings',
      // Add a default value of 'system' or another valid UUID if needed
      // This is a temporary measure - the frontend should always provide this value
      defaultValue: '00000000-0000-0000-0000-000000000000'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('table_layouts', 'created_by');
  }
};
