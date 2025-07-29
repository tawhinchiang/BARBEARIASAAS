'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('barbers', 'google_calendar_enabled', {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    });
    await queryInterface.addColumn('barbers', 'google_access_token', {
      type: Sequelize.TEXT
    });
    await queryInterface.addColumn('barbers', 'google_refresh_token', {
      type: Sequelize.TEXT
    });
    await queryInterface.addColumn('barbers', 'google_token_expires_at', {
      type: Sequelize.DATE
    });
    await queryInterface.addColumn('barbers', 'google_calendar_ids', {
      type: Sequelize.JSONB,
      defaultValue: []
    });
    await queryInterface.addColumn('barbers', 'google_sync_settings', {
      type: Sequelize.JSONB,
      defaultValue: {}
    });
    await queryInterface.addColumn('barbers', 'last_google_sync', {
      type: Sequelize.DATE
    });
    await queryInterface.addColumn('barbers', 'google_sync_status', {
      type: Sequelize.STRING,
      defaultValue: 'disconnected'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('barbers', 'google_calendar_enabled');
    await queryInterface.removeColumn('barbers', 'google_access_token');
    await queryInterface.removeColumn('barbers', 'google_refresh_token');
    await queryInterface.removeColumn('barbers', 'google_token_expires_at');
    await queryInterface.removeColumn('barbers', 'google_calendar_ids');
    await queryInterface.removeColumn('barbers', 'google_sync_settings');
    await queryInterface.removeColumn('barbers', 'last_google_sync');
    await queryInterface.removeColumn('barbers', 'google_sync_status');
  }
};
