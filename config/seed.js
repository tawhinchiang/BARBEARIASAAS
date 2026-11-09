const bcrypt = require('bcryptjs');
const { sequelize, User, Barber, ServiceType, SystemConfig } = require('../models');

const DEFAULT_WORKING_HOURS = {
  monday: { morning: '08:00-12:00', afternoon: '14:00-18:00' },
  tuesday: { morning: '08:00-12:00', afternoon: '14:00-18:00' },
  wednesday: { morning: '08:00-12:00', afternoon: '14:00-18:00' },
  thursday: { morning: '08:00-12:00', afternoon: '14:00-18:00' },
  friday: { morning: '08:00-12:00', afternoon: '14:00-18:00' },
  saturday: { morning: '08:00-12:00', afternoon: '14:00-16:00' },
  sunday: { morning: 'closed', afternoon: 'closed' }
};

const barbers = [
  {
    name: 'Junior Alves',
    phone: '(63) 99999-0001',
    email: 'junior@example.com',
    cpf: '000.000.000-01',
    specialties: ['Corte', 'Barba'],
    photo: '/images/barbers/junior_alves.png'
  },
  {
    name: 'Daniel Barone',
    phone: '(63) 99999-0002',
    email: 'daniel@example.com',
    cpf: '000.000.000-02',
    specialties: ['Corte', 'Acabamento'],
    photo: '/images/barbers/daniel_barone.png'
  },
  {
    name: 'Pedro Assuncao',
    phone: '(63) 99999-0003',
    email: 'pedro@example.com',
    cpf: '000.000.000-03',
    specialties: ['Corte', 'Sobrancelha'],
    photo: '/images/barbers/pedro_assuncao.png'
  }
];

const services = [
  { name: 'Corte Simples', description: 'Corte clássico com acabamento na máquina e tesoura', price: 35, duration: 30, isActive: true, isPromo: false, photo: '/images/services/corte.svg' },
  { name: 'Corte + Barba', description: 'Combo completo: corte de cabelo e barba com toalha/acabamento', price: 60, duration: 60, isActive: true, isPromo: false, photo: '/images/services/corte-barba.svg' },
  { name: 'Barba Completa', description: 'Modelagem de barba e bigode com acabamento preciso', price: 30, duration: 30, isActive: true, isPromo: false, photo: '/images/services/barba.svg' },
  { name: 'Sobrancelha', description: 'Design e limpeza de sobrancelha', price: 15, duration: 15, isActive: true, isPromo: false, photo: '/images/services/sobrancelha.svg' },
  { name: 'Acabamento / Pézinho', description: 'Manutenção rápida do contorno e acabamento', price: 20, duration: 15, isActive: true, isPromo: false, photo: '/images/services/acabamento.svg' },
  { name: 'Hidratação Capilar', description: 'Tratamento para hidratar e revitalizar os fios', price: 45, duration: 40, isActive: true, isPromo: false, photo: '/images/services/hidratacao.svg' },
  { name: 'Pigmentação', description: 'Pigmentação para realçar barba ou cabelo com aspecto natural', price: 40, duration: 35, isActive: true, isPromo: false, photo: '/images/services/pigmentacao.svg' },
  { name: 'Corte Infantil', description: 'Corte para crianças, com atenção e conforto', price: 30, duration: 30, isActive: true, isPromo: false, photo: '/images/services/infantil.svg' }
];

async function upsertBy(Model, where, values) {
  const [record, created] = await Model.findOrCreate({
    where,
    defaults: values
  });

  if (!created) {
    await record.update(values);
  }

  return record;
}

async function seedDatabase() {
  try {
    await sequelize.authenticate();
    await sequelize.sync();

    const password = await bcrypt.hash('admin123', 10);
    await User.findOrCreate({
      where: { username: 'admin' },
      defaults: {
        username: 'admin',
        password,
        email: 'admin@barbearia.local',
        role: 'admin',
        isActive: true
      }
    });

    for (const barber of barbers) {
      await upsertBy(Barber, { cpf: barber.cpf }, {
        ...barber,
        workingHours: DEFAULT_WORKING_HOURS,
        isActive: true
      });
    }

    for (const service of services) {
      await upsertBy(ServiceType, { name: service.name }, service);
    }

    await upsertBy(SystemConfig, { key: 'reminderHoursBefore' }, {
      key: 'reminderHoursBefore',
      value: '5'
    });
    await upsertBy(SystemConfig, { key: 'followUpHoursAfter' }, {
      key: 'followUpHoursAfter',
      value: '2'
    });

    console.log('Seed concluido com sucesso.');
    console.log('Admin local: admin / admin123');
  } catch (error) {
    console.error('Erro ao popular banco de dados:', error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
