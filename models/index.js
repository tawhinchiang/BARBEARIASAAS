const sequelize = require('../config/database');
const User = require('./User');
const Client = require('./Client');
const Barber = require('./Barber');
const ServiceType = require('./ServiceType');
const Appointment = require('./Appointment');
const SystemConfig = require('./SystemConfig');
const VerificationCode = require('./VerificationCode');
const Payment = require('./Payment');
const CashSession = require('./CashSession');
const Expense = require('./Expense');
// Definir associações entre os modelos
Client.hasMany(Appointment, { foreignKey: 'clientId', as: 'appointments' });
Appointment.belongsTo(Client, { foreignKey: 'clientId', as: 'client' });

Barber.hasMany(Appointment, { foreignKey: 'barberId', as: 'appointments' });
Appointment.belongsTo(Barber, { foreignKey: 'barberId', as: 'barber' });

ServiceType.hasMany(Appointment, { foreignKey: 'serviceTypeId', as: 'appointments' });
Appointment.belongsTo(ServiceType, { foreignKey: 'serviceTypeId', as: 'serviceType' });

Appointment.hasMany(Payment, { foreignKey: 'appointmentId', as: 'payments' });
Payment.belongsTo(Appointment, { foreignKey: 'appointmentId', as: 'appointment' });

// Relação CashSession ↔ Expense
CashSession.hasMany(Expense, { foreignKey: 'cashSessionId', as: 'expenses' });
Expense.belongsTo(CashSession, { foreignKey: 'cashSessionId', as: 'cashSession' });

// Relação CashSession ↔ Payment
CashSession.hasMany(Payment, { foreignKey: 'cashSessionId', as: 'payments' });
Payment.belongsTo(CashSession, { foreignKey: 'cashSessionId', as: 'cashSession' });

// Função para sincronizar o banco de dados
const syncDatabase = async (force = false) => {
  try {
    await sequelize.authenticate();
    console.log('Conexão com o banco de dados estabelecida com sucesso.');
    
    await sequelize.sync({ force });
    console.log('Banco de dados sincronizado.');
    
    return true;
  } catch (error) {
    console.error('Erro ao conectar com o banco de dados:', error);
    return false;
  }
};

module.exports = {
  sequelize,
  User,
  Client,
  Barber,
  ServiceType,
  Appointment,
  SystemConfig,
  Payment,
  CashSession,
  Expense,
  syncDatabase,
  VerificationCode
};

