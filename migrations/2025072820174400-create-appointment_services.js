// Migration para tabela: appointment_services

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('appointment_services', {
      id: { type: Sequelize.INTEGER },
      appointmentId: { type: Sequelize.INTEGER },
      serviceTypeId: { type: Sequelize.INTEGER },
      price: { type: Sequelize.STRING },
      duration: { type: Sequelize.INTEGER },
      createdAt: { type: Sequelize.DATE },
      updatedAt: { type: Sequelize.DATE },
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('appointment_services');
  }
};
