// Migration para tabela: commissions

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('commissions', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      barberId: {
        type: Sequelize.INTEGER,
        references: { model: 'barbers', key: 'id' },
        onDelete: 'CASCADE'
      },
      serviceTypeId: {
        type: Sequelize.INTEGER,
        references: { model: 'service_types', key: 'id' },
        onDelete: 'SET NULL'
      },
      percentage: Sequelize.STRING,
      fixedAmount: Sequelize.STRING,
      type: {
        type: Sequelize.ENUM('percentual', 'fixa'),
        allowNull: false
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      startDate: Sequelize.DATE,
      endDate: Sequelize.DATE,
      notes: Sequelize.STRING,
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('commissions');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_commissions_type";');
  }
};
