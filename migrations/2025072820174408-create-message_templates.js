module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('message_templates', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      name: Sequelize.STRING,
      type: {
        type: Sequelize.ENUM('lembrete', 'confirmacao', 'followup', 'cancelamento', 'personalizada'),
        allowNull: false
      },
      title: Sequelize.STRING,
      content: Sequelize.STRING,
      triggerHours: Sequelize.INTEGER,
      triggerDays: Sequelize.INTEGER,
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      platform: {
        type: Sequelize.ENUM('whatsapp', 'sms', 'email'),
        allowNull: false
      },
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
    await queryInterface.dropTable('message_templates');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_message_templates_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_message_templates_platform";');
  }
};
