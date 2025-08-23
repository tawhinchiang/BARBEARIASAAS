module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('fixed_expenses', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      name: Sequelize.STRING,
      description: Sequelize.STRING,
      amount: Sequelize.STRING,
      frequency: {
        type: Sequelize.ENUM('mensal', 'bimestral', 'trimestral', 'anual'),
        allowNull: false
      },
      dueDay: Sequelize.INTEGER,
      category: {
        type: Sequelize.ENUM('aluguel', 'salario', 'internet', 'energia', 'outro'),
        allowNull: false
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      startDate: Sequelize.DATE,
      endDate: Sequelize.DATE,
      autoGenerate: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      lastGenerated: Sequelize.DATE,
      notes: Sequelize.STRING,
      createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('fixed_expenses');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_fixed_expenses_frequency";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_fixed_expenses_category";');
  }
};
