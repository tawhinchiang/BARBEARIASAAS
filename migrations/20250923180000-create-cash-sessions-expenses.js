'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // cash_sessions
    await queryInterface.createTable('cash_sessions', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      openedAt: {
        type: 'TIMESTAMPTZ',
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      openedByUserId: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      openingAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      closedAt: {
        type: 'TIMESTAMPTZ',
        allowNull: true
      },
      closedByUserId: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      countedCash: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('open', 'closed'),
        allowNull: false,
        defaultValue: 'open'
      },
      createdAt: {
        type: 'TIMESTAMPTZ',
        defaultValue: Sequelize.fn('NOW')
      },
      updatedAt: {
        type: 'TIMESTAMPTZ',
        defaultValue: Sequelize.fn('NOW')
      }
    });

    // expenses
    await queryInterface.createTable('expenses', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      cashSessionId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'cash_sessions',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      description: {
        type: Sequelize.STRING(150),
        allowNull: false
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      method: {
        type: Sequelize.ENUM('cash', 'pix', 'card', 'other'),
        allowNull: false,
        defaultValue: 'cash'
      },
      createdByUserId: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      createdAt: {
        type: 'TIMESTAMPTZ',
        defaultValue: Sequelize.fn('NOW')
      },
      updatedAt: {
        type: 'TIMESTAMPTZ',
        defaultValue: Sequelize.fn('NOW')
      }
    });
  },

  async down(queryInterface) {
    // Remover dependente primeiro
    await queryInterface.dropTable('expenses');
    await queryInterface.dropTable('cash_sessions');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_cash_sessions_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_expenses_method";');
  }
};
