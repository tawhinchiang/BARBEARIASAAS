module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('message_logs', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      appointmentId: Sequelize.INTEGER,
      templateId: Sequelize.INTEGER,
      clientPhone: Sequelize.STRING,
      messageContent: Sequelize.STRING,
      platform: {
        type: Sequelize.ENUM('whatsapp', 'sms', 'email'),
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('pendente', 'enviado', 'erro', 'agendado'),
        allowNull: false
      },
      scheduledFor: Sequelize.DATE,
      sentAt: Sequelize.DATE,
      errorMessage: Sequelize.STRING,
      attempts: {
        type: Sequelize.INTEGER,
        defaultValue: 0
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
    await queryInterface.dropTable('message_logs');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_message_logs_platform";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_message_logs_status";');
  }
};
