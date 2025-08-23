'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Verifica se o índice já existe antes de criar
    const [results] = await queryInterface.sequelize.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'appointments'
        AND indexname = 'uq_appointments_regular_slot'
    `);

    if (results.length === 0) {
      await queryInterface.addIndex('appointments', {
        name: 'uq_appointments_regular_slot',
        unique: true,
        fields: ['barberId', 'appointmentDate', 'appointmentTime'],
        where: {
          isEncaixe: false
        }
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('appointments', 'uq_appointments_regular_slot');
  }
};
