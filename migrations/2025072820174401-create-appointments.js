// Migration para tabela: appointments

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('appointments', {
      id: { type: Sequelize.INTEGER },
      clientId: { type: Sequelize.INTEGER },
      barberId: { type: Sequelize.INTEGER },
      appointmentDate: { type: Sequelize.STRING },
      appointmentTime: { type: Sequelize.STRING },
      serviceDuration: { type: Sequelize.INTEGER },
      status: { type: Sequelize.ENUM },
      notes: { type: Sequelize.STRING },
      whatsappSent: { type: Sequelize.BOOLEAN },
      totalPrice: { type: Sequelize.STRING },
      createdAt: { type: Sequelize.DATE },
      updatedAt: { type: Sequelize.DATE },
      serviceTypeId: { type: Sequelize.INTEGER },
      followUpSent: { type: Sequelize.BOOLEAN },
      cancelReason: { type: Sequelize.STRING },
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('appointments');
  }
};
