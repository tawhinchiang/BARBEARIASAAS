'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('GoogleCalendarSyncLogs', {
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
      appointmentId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'appointments',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      operationType: {
        type: Sequelize.STRING,
        allowNull: false
      }, // 'sync_full', 'sync_incremental', 'create', 'update', 'delete'
      direction: {
        type: Sequelize.STRING,
        allowNull: false
      }, // 'to_google', 'from_google', 'bidirectional'
      status: {
        type: Sequelize.STRING,
        allowNull: false
      }, // 'success', 'error', 'conflict', 'skipped'
      googleEventId: Sequelize.STRING,
      googleCalendarId: Sequelize.STRING,
      errorMessage: Sequelize.TEXT,
      dataBefore: Sequelize.JSONB,
      dataAfter: Sequelize.JSONB,
      syncDurationMs: Sequelize.INTEGER,
      createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Índices recomendados
    await queryInterface.addIndex('GoogleCalendarSyncLogs', ['barberId', 'createdAt'], {
      name: 'idx_sync_logs_barber_date'
    });

    await queryInterface.addIndex('GoogleCalendarSyncLogs', ['status'], {
      name: 'idx_sync_logs_status'
    });

    await queryInterface.addIndex('GoogleCalendarSyncLogs', ['operationType'], {
      name: 'idx_sync_logs_operation'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('GoogleCalendarSyncLogs');
  }
};
