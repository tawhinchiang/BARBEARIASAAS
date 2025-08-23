'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1) Backfill: converte NULL -> false
    await queryInterface.sequelize.query(`
      UPDATE "appointments"
      SET "whatsappSent" = FALSE
      WHERE "whatsappSent" IS NULL
    `);

    // 2) Torna NOT NULL + default false
    await queryInterface.changeColumn('appointments', 'whatsappSent', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  async down(queryInterface, Sequelize) {
    // Volta a permitir NULL (se precisar reverter)
    await queryInterface.changeColumn('appointments', 'whatsappSent', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false
    });
  }
};
