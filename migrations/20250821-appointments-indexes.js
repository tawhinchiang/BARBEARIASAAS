'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'appointments';

    // 1) Remove o índice único antigo, se existir
    // Tenta por colunas; se não achar, cai silenciosamente
    await queryInterface.removeIndex(table, ['appointmentDate', 'appointmentTime', 'barberId']).catch(() => {});

    // 2) Cria o único PARCIAL (libera encaixe)
    await queryInterface.addIndex(table, ['barberId', 'appointmentDate', 'appointmentTime'], {
      name: 'uq_appointments_regular_slot',
      unique: true,
      where: { isEncaixe: false },   // índice parcial (Postgres)
      concurrently: true
    });

    // 3) Apoio para listagens/filtros
    await queryInterface.addIndex(table, ['barberId', 'appointmentDate'], {
      name: 'idx_appointments_barber_date',
      concurrently: true
    });

    await queryInterface.addIndex(table, ['status'], {
      name: 'idx_appointments_status',
      concurrently: true
    });
  },

  async down(queryInterface, Sequelize) {
    const table = 'appointments';

    await queryInterface.removeIndex(table, 'uq_appointments_regular_slot').catch(() => {});
    await queryInterface.removeIndex(table, 'idx_appointments_barber_date').catch(() => {});
    await queryInterface.removeIndex(table, 'idx_appointments_status').catch(() => {});

    // recria o antigo (sem parcial) se precisar voltar
    await queryInterface.addIndex(table, ['appointmentDate', 'appointmentTime', 'barberId'], {
      name: 'uniq_old_appointments_slot',
      unique: true
    });
  }
};
