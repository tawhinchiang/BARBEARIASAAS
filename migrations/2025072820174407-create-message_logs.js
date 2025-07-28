// Migration para tabela: message_logs

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('message_logs', {
      id: { type: Sequelize.INTEGER },
      appointmentId: { type: Sequelize.INTEGER },
      templateId: { type: Sequelize.INTEGER },
      clientPhone: { type: Sequelize.STRING },
      messageContent: { type: Sequelize.STRING },
      platform: { type: Sequelize.ENUM },
      status: { type: Sequelize.ENUM },
      scheduledFor: { type: Sequelize.DATE },
      sentAt: { type: Sequelize.DATE },
      errorMessage: { type: Sequelize.STRING },
      attempts: { type: Sequelize.INTEGER },
      createdAt: { type: Sequelize.DATE },
      updatedAt: { type: Sequelize.DATE },
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('message_logs');
  }
};
