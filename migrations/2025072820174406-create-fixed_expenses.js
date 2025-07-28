// Migration para tabela: fixed_expenses

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('fixed_expenses', {
      id: { type: Sequelize.INTEGER },
      name: { type: Sequelize.STRING },
      description: { type: Sequelize.STRING },
      amount: { type: Sequelize.STRING },
      frequency: { type: Sequelize.ENUM },
      dueDay: { type: Sequelize.INTEGER },
      category: { type: Sequelize.ENUM },
      isActive: { type: Sequelize.BOOLEAN },
      startDate: { type: Sequelize.DATE },
      endDate: { type: Sequelize.DATE },
      autoGenerate: { type: Sequelize.BOOLEAN },
      lastGenerated: { type: Sequelize.DATE },
      notes: { type: Sequelize.STRING },
      createdAt: { type: Sequelize.DATE },
      updatedAt: { type: Sequelize.DATE },
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('fixed_expenses');
  }
};
