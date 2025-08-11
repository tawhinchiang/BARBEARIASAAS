'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('GoogleCalendarWebhooks', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      barberId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'barbers',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      calendarId: {
        type: Sequelize.STRING,
        allowNull: false
      },
      channelId: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      resourceId: Sequelize.STRING,
      resourceUri: Sequelize.TEXT,
      webhookUrl: Sequelize.TEXT,
      channelToken: Sequelize.STRING,
      expiresAt: Sequelize.DATE,
      lastNotification: Sequelize.DATE,
      notificationCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      status: {
        type: Sequelize.STRING,
        defaultValue: 'active'
      },
      createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Índices e constraints
    await queryInterface.addConstraint('GoogleCalendarWebhooks', {
      fields: ['barberId', 'calendarId'],
      type: 'unique',
      name: 'uniq_webhook_barber_calendar'
    });

    await queryInterface.addIndex('GoogleCalendarWebhooks', ['status']);
    await queryInterface.addIndex('GoogleCalendarWebhooks', ['expiresAt']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('GoogleCalendarWebhooks');
  }
};
