'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // adiciona a coluna camelCase "reminderSent" (Sequelize criará com aspas no Postgres)
    await queryInterface.addColumn('appointments', 'reminderSent', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('appointments', 'reminderSent');
  }
};
