module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('cash_flows', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      type: {
        type: Sequelize.ENUM('entrada', 'saida'),
        allowNull: false
      },
      category: {
        type: Sequelize.ENUM('servico', 'produto', 'outro'),
        allowNull: false
      },
      description: Sequelize.STRING,
      amount: Sequelize.STRING,
      appointmentId: Sequelize.INTEGER,
      expenseId: Sequelize.INTEGER,
      date: Sequelize.STRING,
      notes: Sequelize.STRING,
      createdBy: Sequelize.STRING,
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
    await queryInterface.dropTable('cash_flows');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_cash_flows_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_cash_flows_category";');
  }
};
