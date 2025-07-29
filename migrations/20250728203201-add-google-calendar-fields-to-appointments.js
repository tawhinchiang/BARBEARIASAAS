'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('appointments', 'google_event_id', {
      type: Sequelize.STRING
    });
    await queryInterface.addColumn('appointments', 'google_calendar_id', {
      type: Sequelize.STRING
    });
    await queryInterface.addColumn('appointments', 'google_sync_status', {
      type: Sequelize.STRING,
      defaultValue: 'pending'
    });
    await queryInterface.addColumn('appointments', 'google_last_sync', {
      type: Sequelize.DATE
    });
    await queryInterface.addColumn('appointments', 'google_sync_error', {
      type: Sequelize.TEXT
    });
    await queryInterface.addColumn('appointments', 'sync_direction', {
      type: Sequelize.STRING,
      defaultValue: 'bidirectional'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('appointments', 'google_event_id');
    await queryInterface.removeColumn('appointments', 'google_calendar_id');
    await queryInterface.removeColumn('appointments', 'google_sync_status');
    await queryInterface.removeColumn('appointments', 'google_last_sync');
    await queryInterface.removeColumn('appointments', 'google_sync_error');
    await queryInterface.removeColumn('appointments', 'sync_direction');
  }
};
