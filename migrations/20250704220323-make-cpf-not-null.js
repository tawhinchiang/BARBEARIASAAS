'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('barbers', 'cpf', {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('barbers', 'cpf', {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true
    });
  }
};
