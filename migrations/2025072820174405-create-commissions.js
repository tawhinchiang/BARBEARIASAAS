// Migration para tabela: commissions

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('commissions', {
      id: { type: Sequelize.INTEGER },
      barberId: { type: Sequelize.INTEGER },
      serviceTypeId: { type: Sequelize.INTEGER },
      percentage: { type: Sequelize.STRING },
      fixedAmount: { type: Sequelize.STRING },
      type: { type: Sequelize.ENUM },
      isActive: { type: Sequelize.BOOLEAN },
      startDate: { type: Sequelize.DATE },
      endDate: { type: Sequelize.DATE },
      notes: { type: Sequelize.STRING },
      createdAt: { type: Sequelize.DATE },
      updatedAt: { type: Sequelize.DATE },
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('commissions');
  }
};
