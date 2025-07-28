// Migration para tabela: message_templates

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('message_templates', {
      id: { type: Sequelize.INTEGER },
      name: { type: Sequelize.STRING },
      type: { type: Sequelize.ENUM },
      title: { type: Sequelize.STRING },
      content: { type: Sequelize.STRING },
      triggerHours: { type: Sequelize.INTEGER },
      triggerDays: { type: Sequelize.INTEGER },
      isActive: { type: Sequelize.BOOLEAN },
      platform: { type: Sequelize.ENUM },
      createdAt: { type: Sequelize.DATE },
      updatedAt: { type: Sequelize.DATE },
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('message_templates');
  }
};
