'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('payments', 'cashSessionId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'cash_sessions',
        key: 'id'
      },
      onDelete: 'SET NULL'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('payments', 'cashSessionId');
  }
};
