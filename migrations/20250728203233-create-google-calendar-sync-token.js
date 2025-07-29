'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('google_calendar_sync_tokens', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      barberId: {
        type: Sequelize.INTEGER,
        references: { model: 'barbers', key: 'id' },
        onDelete: 'CASCADE',
        allowNull: false
      },
      calendarId: {
        type: Sequelize.STRING,
        allowNull: false
      },
      syncToken: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      resourceType: {
        type: Sequelize.STRING,
        defaultValue: 'events'
      },
      expiresAt: Sequelize.DATE,
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('google_calendar_sync_tokens', ['barberId', 'calendarId']);
    await queryInterface.addIndex('google_calendar_sync_tokens', ['isActive']);
    await queryInterface.addConstraint('google_calendar_sync_tokens', {
      fields: ['barberId', 'calendarId', 'resourceType'],
      type: 'unique',
      name: 'unique_barber_calendar_resource'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('google_calendar_sync_tokens');
  }
};
