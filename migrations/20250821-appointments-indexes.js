'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'appointments';

    // Força execução fora de transação para suportar CREATE INDEX CONCURRENTLY
    const options = { transaction: false };

    // 1) Remove o índice único antigo, se existir
    await queryInterface.removeIndex(table, ['appointmentDate', 'appointmentTime', 'barberId'], options).catch(() => {});

    // 2) Cria índice único PARCIAL — só bloqueia horários normais (não bloqueia encaixe)
    await queryInterface.addIndex(table, ['barberId', 'appointmentDate', 'appointmentTime'], {
      name: 'uq_appointments_regular_slot',
      unique: true,
      where: Sequelize.literal('"isEncaixe" = false'),  // Força compatibilidade Postgres
      concurrently: true
    });

    // 3) Índice para listar por barbeiro + data
    await queryInterface.addIndex(table, ['barberId', 'appointmentDate'], {
      name: 'idx_appointments_barber_date',
      concurrently: true
    });

    // 4) Índice para filtrar por status
    await queryInterface.addIndex(table, ['status'], {
      name: 'idx_appointments_status',
      concurrently: true
    });
  },

  async down(queryInterface, Sequelize) {
    const table = 'appointments';
    const options = { transaction: false };

    // Remove novos índices
    await queryInterface.removeIndex(table, 'uq_appointments_regular_slot', options).catch(() => {});
    await queryInterface.removeIndex(table, 'idx_appointments_barber_date', options).catch(() => {});
    await queryInterface.removeIndex(table, 'idx_appointments_status', options).catch(() => {});

    // Restaura índice antigo (sem parcial)
    await queryInterface.addIndex(table, ['appointmentDate', 'appointmentTime', 'barberId'], {
      name: 'uniq_old_appointments_slot',
      unique: true
    });
  }
};
