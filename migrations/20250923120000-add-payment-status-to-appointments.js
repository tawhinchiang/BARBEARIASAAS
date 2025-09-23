// migrations/20250923120000-add-payment-status-to-appointments.js
'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('appointments', 'paymentStatus', {
      type: Sequelize.ENUM('pending', 'partial', 'paid'),
      allowNull: false,
      defaultValue: 'pending'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('appointments', 'paymentStatus');
  }
};
