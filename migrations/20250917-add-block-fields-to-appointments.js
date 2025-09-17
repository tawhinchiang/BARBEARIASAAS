// migrations/20250917-add-block-fields-to-appointments.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1) Relaxar NOT NULL em clientId e serviceTypeId
    await queryInterface.changeColumn('appointments', 'clientId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'clients', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    await queryInterface.changeColumn('appointments', 'serviceTypeId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'service_types', key: 'id' },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE'
    });

    // 2) Adicionar isBlock
    await queryInterface.addColumn('appointments', 'isBlock', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    // 3) Adicionar blockReason
    await queryInterface.addColumn('appointments', 'blockReason', {
      type: Sequelize.STRING,
      allowNull: true
    });

    // 4) Alterar ENUM de status
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_appointments_status" 
      ADD VALUE IF NOT EXISTS 'blocked';
    `);
  },

  async down(queryInterface, Sequelize) {
    // Não dá para remover valores de ENUM facilmente no Postgres
    await queryInterface.removeColumn('appointments', 'isBlock');
    await queryInterface.removeColumn('appointments', 'blockReason');

    await queryInterface.changeColumn('appointments', 'clientId', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: 'clients', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    await queryInterface.changeColumn('appointments', 'serviceTypeId', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: 'service_types', key: 'id' },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE'
    });
  }
};
