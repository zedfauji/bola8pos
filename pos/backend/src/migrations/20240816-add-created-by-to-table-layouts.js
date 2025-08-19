'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('table_layouts', 'created_by', {
      type: Sequelize.UUID,
      allowNull: false,
      comment: 'ID of the user who created this layout',
      after: 'settings',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('table_layouts', 'created_by');
  }
};
