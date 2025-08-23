// Migration para tabela: system_configs

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('system_configs', {
      key: { type: Sequelize.STRING },
      value: { type: Sequelize.STRING },
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('system_configs');
  }
};
