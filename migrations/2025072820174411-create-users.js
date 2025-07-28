// Migration para tabela: users

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('users', {
      id: { type: Sequelize.INTEGER },
      username: { type: Sequelize.STRING },
      password: { type: Sequelize.STRING },
      email: { type: Sequelize.STRING },
      role: { type: Sequelize.ENUM },
      isActive: { type: Sequelize.BOOLEAN },
      createdAt: { type: Sequelize.DATE },
      updatedAt: { type: Sequelize.DATE },
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('users');
  }
};
