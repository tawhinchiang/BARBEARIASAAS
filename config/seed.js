const bcrypt = require('bcryptjs');
const { syncDatabase } = require('../models');

async function seedDatabase() {
  try {
    // Sincronizar banco (recriar tabelas)
    await syncDatabase(true);
    
    const { User, Barber, ServiceType } = require('../models');
    
    // Criar usuário admin
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await User.create({
      username: 'admin',
      password: hashedPassword,
      email: 'admin@barbearia.com',
      role: 'admin',
      isActive: true
    });
    
    // Criar barbeiros
    await Barber.bulkCreate([
      {
        name: 'João Silva',
        phone: '(11) 99999-9999',
        email: 'joao@barbearia.com',
        specialties: ['Corte', 'Barba', 'Bigode'],
        workingHours: {
          monday: '08:00-18:00',
          tuesday: '08:00-18:00',
          wednesday: '08:00-18:00',
          thursday: '08:00-18:00',
          friday: '08:00-18:00',
          saturday: '08:00-16:00',
          sunday: 'closed'
        },
        isActive: true
      },
      {
        name: 'Pedro Santos',
        phone: '(11) 88888-8888',
        email: 'pedro@barbearia.com',
        specialties: ['Corte', 'Barba', 'Sobrancelha'],
        workingHours: {
          monday: '09:00-19:00',
          tuesday: '09:00-19:00',
          wednesday: '09:00-19:00',
          thursday: '09:00-19:00',
          friday: '09:00-19:00',
          saturday: '09:00-17:00',
          sunday: 'closed'
        },
        isActive: true
      },
      {
        name: 'Carlos Oliveira',
        phone: '(11) 77777-7777',
        email: 'carlos@barbearia.com',
        specialties: ['Corte', 'Barba', 'Relaxamento'],
        workingHours: {
          monday: '08:00-18:00',
          tuesday: '08:00-18:00',
          wednesday: '08:00-18:00',
          thursday: '08:00-18:00',
          friday: '08:00-18:00',
          saturday: '08:00-16:00',
          sunday: 'closed'
        },
        isActive: true
      }
    ]);
    
    // Criar tipos de serviço
    await ServiceType.bulkCreate([
      {
        name: 'Corte Simples',
        description: 'Corte de cabelo tradicional',
        price: 25.00,
        duration: 30,
        isActive: true
      },
      {
        name: 'Corte + Barba',
        description: 'Corte de cabelo + barba completa',
        price: 35.00,
        duration: 45,
        isActive: true
      },
      {
        name: 'Barba Completa',
        description: 'Barba, bigode e acabamento',
        price: 20.00,
        duration: 30,
        isActive: true
      },
      {
        name: 'Corte Premium',
        description: 'Corte estilizado + lavagem + finalização',
        price: 45.00,
        duration: 60,
        isActive: true
      },
      {
        name: 'Sobrancelha',
        description: 'Design e limpeza de sobrancelha',
        price: 15.00,
        duration: 20,
        isActive: true
      },
      {
        name: 'Relaxamento',
        description: 'Relaxamento capilar completo',
        price: 80.00,
        duration: 120,
        isActive: true
      }
    ]);
    
    console.log('✅ Banco de dados populado com sucesso!');
    console.log('👤 Usuário admin criado: admin / admin123');
    console.log('💇 3 barbeiros criados');
    console.log('✂️ 6 tipos de serviço criados');
    
  } catch (error) {
    console.error('❌ Erro ao popular banco de dados:', error);
  } finally {
    process.exit();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };

