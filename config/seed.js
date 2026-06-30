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
  {
    name: 'Corte Simples',
    description: 'Corte de cabelo tradicional',
    price: 25,
    duration: 30,
    isActive: true,
    isPromo: false
  },
  {
    name: 'Corte + Barba',
    description: 'Corte de cabelo e barba completa',
    price: 40,
    duration: 60,
    isActive: true,
    isPromo: false
  },
  {
    name: 'Barba Completa',
    description: 'Barba, bigode e acabamento',
    price: 20,
    duration: 30,
    isActive: true,
    isPromo: false
  },
  {
    name: 'Sobrancelha',
    description: 'Design e limpeza de sobrancelha',
    price: 15,
    duration: 20,
    isActive: true,
    isPromo: false
  }
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
