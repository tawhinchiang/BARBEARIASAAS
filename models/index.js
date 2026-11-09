const sequelize = require('../config/database');
const User = require('./User');
const Client = require('./Client');
const Barber = require('./Barber');
const ServiceType = require('./ServiceType');
const Appointment = require('./Appointment');
const SystemConfig = require('./SystemConfig');
const VerificationCode = require('./VerificationCode');

Client.hasMany(Appointment, { foreignKey: 'clientId', as: 'appointments' });
Appointment.belongsTo(Client, { foreignKey: 'clientId', as: 'client' });

Barber.hasMany(Appointment, { foreignKey: 'barberId', as: 'appointments' });
Appointment.belongsTo(Barber, { foreignKey: 'barberId', as: 'barber' });

ServiceType.hasMany(Appointment, { foreignKey: 'serviceTypeId', as: 'appointments' });
Appointment.belongsTo(ServiceType, { foreignKey: 'serviceTypeId', as: 'serviceType' });

async function autoSeedIfEmpty() {
  if (process.env.AUTO_SEED === 'false') return;
  const userCount = await User.count();
  if (userCount > 0) return;

  const bcrypt = require('bcryptjs');
  const password = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10);
  await User.findOrCreate({
    where: { username: process.env.ADMIN_USERNAME || 'admin' },
    defaults: {
      username: process.env.ADMIN_USERNAME || 'admin',
      password,
      email: process.env.ADMIN_EMAIL || 'admin@barbearia.local',
      role: 'admin',
      isActive: true,
    },
  });

  const defaultHours = {
    monday: { morning: '08:00-12:00', afternoon: '14:00-18:00' },
    tuesday: { morning: '08:00-12:00', afternoon: '14:00-18:00' },
    wednesday: { morning: '08:00-12:00', afternoon: '14:00-18:00' },
    thursday: { morning: '08:00-12:00', afternoon: '14:00-18:00' },
    friday: { morning: '08:00-12:00', afternoon: '14:00-18:00' },
    saturday: { morning: '08:00-12:00', afternoon: '14:00-16:00' },
    sunday: { morning: 'closed', afternoon: 'closed' },
  };

  const barbers = [
    { name: 'Junior Alves', phone: '(63) 99999-0001', email: 'junior@example.com', cpf: '000.000.000-01', specialties: ['Corte', 'Barba'], photo: '/images/barbers/junior_alves.png', workingHours: defaultHours, isActive: true },
    { name: 'Daniel Barone', phone: '(63) 99999-0002', email: 'daniel@example.com', cpf: '000.000.000-02', specialties: ['Corte', 'Acabamento'], photo: '/images/barbers/daniel_barone.png', workingHours: defaultHours, isActive: true },
    { name: 'Pedro Assunção', phone: '(63) 99999-0003', email: 'pedro@example.com', cpf: '000.000.000-03', specialties: ['Corte', 'Sobrancelha'], photo: '/images/barbers/pedro_assuncao.png', workingHours: defaultHours, isActive: true },
  ];
  for (const b of barbers) {
    const [rec, created] = await Barber.findOrCreate({ where: { cpf: b.cpf }, defaults: b });
    if (!created) await rec.update({ name: b.name, phone: b.phone, email: b.email, specialties: b.specialties, photo: b.photo, workingHours: b.workingHours, isActive: true });
  }

  const services = [
    { name: 'Corte Simples', description: 'Corte clássico com acabamento na máquina e tesoura', price: 35, duration: 30, isActive: true, isPromo: false, photo: '/images/services/corte.svg' },
    { name: 'Corte + Barba', description: 'Combo completo: corte de cabelo e barba com toalha/acabamento', price: 60, duration: 60, isActive: true, isPromo: false, photo: '/images/services/corte-barba.svg' },
    { name: 'Barba Completa', description: 'Modelagem de barba e bigode com acabamento preciso', price: 30, duration: 30, isActive: true, isPromo: false, photo: '/images/services/barba.svg' },
    { name: 'Sobrancelha', description: 'Design e limpeza de sobrancelha', price: 15, duration: 15, isActive: true, isPromo: false, photo: '/images/services/sobrancelha.svg' },
    { name: 'Acabamento / Pézinho', description: 'Manutenção rápida do contorno e acabamento', price: 20, duration: 15, isActive: true, isPromo: false, photo: '/images/services/acabamento.svg' },
    { name: 'Hidratação Capilar', description: 'Tratamento para hidratar e revitalizar os fios', price: 45, duration: 40, isActive: true, isPromo: false, photo: '/images/services/hidratacao.svg' },
    { name: 'Pigmentação', description: 'Pigmentação para realçar barba ou cabelo com aspecto natural', price: 40, duration: 35, isActive: true, isPromo: false, photo: '/images/services/pigmentacao.svg' },
    { name: 'Corte Infantil', description: 'Corte para crianças, com atenção e conforto', price: 30, duration: 30, isActive: true, isPromo: false, photo: '/images/services/infantil.svg' },
  ];
  for (const s of services) {
    const [rec, created] = await ServiceType.findOrCreate({ where: { name: s.name }, defaults: s });
    if (!created) await rec.update(s);
  }

  await SystemConfig.findOrCreate({ where: { key: 'reminderHoursBefore' }, defaults: { key: 'reminderHoursBefore', value: '5' } });
  await SystemConfig.findOrCreate({ where: { key: 'followUpHoursAfter' }, defaults: { key: 'followUpHoursAfter', value: '2' } });

  console.log('[SEED] Dados iniciais criados (admin/admin123).');
}

const syncDatabase = async (force = false) => {
  try {
    await sequelize.authenticate();
    console.log('Conexão com o banco de dados estabelecida.');
    await sequelize.sync({ force });
    await autoSeedIfEmpty();
    console.log('Banco de dados pronto.');
    return true;
  } catch (error) {
    console.error('Erro ao conectar/sincronizar o banco de dados:', error);
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
  syncDatabase,
  VerificationCode,
};
