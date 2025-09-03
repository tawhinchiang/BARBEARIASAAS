'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Remove índice antigo
    await queryInterface.removeIndex('appointments', 'uq_appointments_regular_slot');

    // Cria índice novo parcial
    await queryInterface.addIndex('appointments', {
      name: 'uq_appointments_regular_slot',
      unique: true,
      fields: ['barberId', 'appointmentDate', 'appointmentTime'],
      where: {
        isEncaixe: false,
        status: { [Sequelize.Op.notIn]: ['cancelled', 'no_show'] }
      }
    });
  },

  async down(queryInterface, Sequelize) {
    // Reverte: remove índice novo
    await queryInterface.removeIndex('appointments', 'uq_appointments_regular_slot');

    // Recria índice antigo (só filtrando encaixe)
    await queryInterface.addIndex('appointments', {
      name: 'uq_appointments_regular_slot',
      unique: true,
      fields: ['barberId', 'appointmentDate', 'appointmentTime'],
      where: { isEncaixe: false }
    });
  }
};
