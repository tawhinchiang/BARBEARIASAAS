'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('GoogleCalendarConflicts', {
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
        allowNull: false,
        references: {
          model: 'appointments',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      googleEventId: Sequelize.STRING,
      conflictType: {
        type: Sequelize.STRING,
        allowNull: false
      },
      localData: {
        type: Sequelize.JSONB,
        allowNull: false
      },
      googleData: {
        type: Sequelize.JSONB,
        allowNull: false
      },
      resolutionStrategy: Sequelize.STRING,
      resolvedAt: Sequelize.DATE,
      resolvedBy: {
        type: Sequelize.INTEGER,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      resolutionNotes: Sequelize.TEXT,
      status: {
        type: Sequelize.STRING,
        defaultValue: 'pending'
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

    // Índices úteis
    await queryInterface.addIndex('GoogleCalendarConflicts', ['barberId', 'status'], {
      name: 'idx_conflicts_barber_status'
    });

    await queryInterface.addIndex('GoogleCalendarConflicts', ['createdAt'], {
      name: 'idx_conflicts_created'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('GoogleCalendarConflicts');
  }
};
