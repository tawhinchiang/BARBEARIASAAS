'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('service_types', 'photo', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Nome do arquivo da foto do serviço'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('service_types', 'photo');
  }
};
