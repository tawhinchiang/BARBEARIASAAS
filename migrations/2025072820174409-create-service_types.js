// Migration para tabela: service_types

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('service_types', {
      id: { type: Sequelize.INTEGER },
      name: { type: Sequelize.STRING },
      description: { type: Sequelize.STRING },
      price: { type: Sequelize.STRING },
      duration: { type: Sequelize.INTEGER },
      isActive: { type: Sequelize.BOOLEAN },
      isPromo: { type: Sequelize.BOOLEAN },
      createdAt: { type: Sequelize.DATE },
      updatedAt: { type: Sequelize.DATE },
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('service_types');
  }
};
