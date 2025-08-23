// Migration para tabela: barbers

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('barbers', {
      id: { type: Sequelize.INTEGER },
      name: { type: Sequelize.STRING },
      phone: { type: Sequelize.STRING },
      email: { type: Sequelize.STRING },
      cpf: { type: Sequelize.STRING },
      specialties: { type: Sequelize.STRING },
      workingHours: { type: Sequelize.STRING },
      isActive: { type: Sequelize.BOOLEAN },
      photo: { type: Sequelize.STRING },
      password: { type: Sequelize.STRING },
      lunchStart: { type: Sequelize.STRING },
      lunchEnd: { type: Sequelize.STRING },
      lastLogin: { type: Sequelize.DATE },
      createdAt: { type: Sequelize.DATE },
      updatedAt: { type: Sequelize.DATE },
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('barbers');
  }
};
