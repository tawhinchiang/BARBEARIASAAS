module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_enum e ON t.oid = e.enumtypid
          WHERE t.typname = 'enum_appointments_status'
          AND e.enumlabel = 'in_progress'
        ) THEN
          ALTER TYPE "enum_appointments_status" ADD VALUE 'in_progress';
        END IF;
      END $$;
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // ⚠️ Sequelize não suporta remover valores ENUM facilmente. Só recriando o tipo.
    console.warn('⚠️ A remoção de valores ENUM não é suportada diretamente no down().');
  }
};
