// Migration para tabela: cash_flows

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('cash_flows', {
      id: { type: Sequelize.INTEGER },
      type: { type: Sequelize.ENUM },
      category: { type: Sequelize.ENUM },
      description: { type: Sequelize.STRING },
      amount: { type: Sequelize.STRING },
      appointmentId: { type: Sequelize.INTEGER },
      expenseId: { type: Sequelize.INTEGER },
      date: { type: Sequelize.STRING },
      notes: { type: Sequelize.STRING },
      createdBy: { type: Sequelize.STRING },
      createdAt: { type: Sequelize.DATE },
      updatedAt: { type: Sequelize.DATE },
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('cash_flows');
  }
};
