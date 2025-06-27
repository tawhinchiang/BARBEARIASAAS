'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('service_types', 'duration', {
      type: Sequelize.STRING,  // ou INTEGER, se preferir só minutos
      allowNull: false,
      defaultValue: '30min'
    });
    await queryInterface.addColumn('service_types', 'promo', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('service_types', 'hasPromo', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  async down (queryInterface) {
    await queryInterface.removeColumn('service_types', 'hasPromo');
    await queryInterface.removeColumn('service_types', 'promo');
    await queryInterface.removeColumn('service_types', 'duration');
  }
};
