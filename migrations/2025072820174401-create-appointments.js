module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('appointments', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      clientId: {
        type: Sequelize.INTEGER,
        references: { model: 'clients', key: 'id' },
        onDelete: 'SET NULL'
      },
      barberId: {
        type: Sequelize.INTEGER,
        references: { model: 'barbers', key: 'id' },
        onDelete: 'SET NULL'
      },
      serviceTypeId: {
        type: Sequelize.INTEGER,
        references: { model: 'service_types', key: 'id' },
        onDelete: 'SET NULL'
      },
      appointmentDate: Sequelize.STRING,
      appointmentTime: Sequelize.STRING,
      serviceDuration: Sequelize.INTEGER,
      totalPrice: Sequelize.STRING,
      status: {
        type: Sequelize.ENUM('pending', 'confirmed', 'completed', 'cancelled', 'no_show'),
        allowNull: false,
        defaultValue: 'pending'
      },
      notes: Sequelize.STRING,
      whatsappSent: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      followUpSent: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      cancelReason: Sequelize.STRING,
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    // É necessário remover o ENUM explicitamente
    await queryInterface.dropTable('appointments');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_appointments_status";');
  }
};
