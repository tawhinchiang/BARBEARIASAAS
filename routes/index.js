const express = require('express');
const router = express.Router();

// ===== LOGS DETALHADOS =====
const log = (message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [CLIENT] ${message}`);
  if (data) {
    console.log(`[${timestamp}] [CLIENT] Data:`, JSON.stringify(data, null, 2));
  }
};

const logError = (message, error) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [CLIENT ERROR] ${message}`);
  console.error(`[${timestamp}] [CLIENT ERROR] Stack:`, error.stack);
};

// Página inicial - Agendamento para clientes
router.get('/', (req, res) => {
  log('Acessando página inicial do cliente');
  
  const pageData = {
    title: 'Agendamento - ' + (process.env.BARBERSHOP_NAME || 'Barbearia Premium'),
    barbershopName: process.env.BARBERSHOP_NAME || 'Barbearia Premium',
    barbershopLogo: process.env.BARBERSHOP_LOGO || '/images/logo.png',
    isClientPage: true
  };
  
  log('Renderizando página inicial', pageData);
  
  res.render('index', pageData);
});

// Página de sucesso do agendamento
router.get('/agendamento-confirmado', (req, res) => {
  log('Acessando página de agendamento confirmado');
  
  res.render('success', {
    title: 'Agendamento Confirmado',
    barbershopName: process.env.BARBERSHOP_NAME || 'Barbearia Premium'
  });
});

// Rota de teste para login (remover se não necessária)
router.get('/login', (req, res) => {
  log('Acessando rota de login via cliente (redirecionando para admin)');
  res.redirect('/admin/login');
});

// API para listar serviços disponíveis
router.get('/api/services', async (req, res) => {
  try {
    log('Buscando serviços disponíveis');
    
    const { ServiceType } = require('../models');
    const services = await ServiceType.findAll({
      where: { isActive: true },
      order: [['name', 'ASC']]
    });
    
    log('Serviços encontrados', { count: services.length, services: services.map(s => ({ id: s.id, name: s.name, price: s.price })) });
    
    res.json({ services });
  } catch (error) {
    logError('Erro ao buscar serviços', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// API para listar barbeiros disponíveis - CORRIGIDA
router.get('/api/barbers', async (req, res) => {
  try {
    log('Buscando barbeiros disponíveis');
    
    const { Barber } = require('../models');
    const barbers = await Barber.findAll({
      where: { isActive: true },
      order: [['name', 'ASC']]
    });
    
    log('Barbeiros encontrados', { count: barbers.length, barbers: barbers.map(b => ({ id: b.id, name: b.name })) });
    
    // Retornar no formato esperado pelo frontend
    res.json({ 
      count: barbers.length,
      barbers: barbers.map(b => ({
        id: b.id,
        name: b.name,
        specialties: b.specialties || 'Especialista',
        workingHours: b.workingHours,
        isActive: b.isActive
      }))
    });
  } catch (error) {
    logError('Erro ao buscar barbeiros', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// API para obter horários disponíveis - CORRIGIDA
router.get('/api/available-times', async (req, res) => {
  try {
    const { barberId, date } = req.query;
    
    log('Buscando horários disponíveis', { barberId, date });
    
    // Validação básica
    if (!barberId || !date) {
      log('Parâmetros obrigatórios não fornecidos');
      return res.status(400).json({ 
        error: 'Parâmetros obrigatórios: barberId, date',
        received: { barberId, date }
      });
    }
    
    // Validar formato da data
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      log('Formato de data inválido', { date });
      return res.status(400).json({ 
        error: 'Formato de data inválido. Use YYYY-MM-DD',
        received: date
      });
    }
    
    const { Appointment, Barber } = require('../models');
    
    // Buscar barbeiro
    log('Buscando barbeiro no banco');
    const barber = await Barber.findByPk(barberId);
    
    if (!barber) {
      log('Barbeiro não encontrado', { barberId });
      return res.status(404).json({ error: 'Barbeiro não encontrado' });
    }
    
    log('Barbeiro encontrado', { 
      barber: { id: barber.id, name: barber.name }
    });
    
    // Verificar dia da semana
    const selectedDate = new Date(date + 'T00:00:00');
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][selectedDate.getDay()];
    
    log('Verificando horário de trabalho', { date, dayOfWeek });
    
    // Horários padrão se não houver configuração específica
    let workingHours = '09:00-18:00';
    
    if (barber.workingHours && typeof barber.workingHours === 'object') {
      workingHours = barber.workingHours[dayOfWeek] || workingHours;
    }
    
    log('Horário de trabalho definido', { dayOfWeek, workingHours });
    
    if (workingHours === 'closed') {
      log('Barbeiro não trabalha neste dia', { dayOfWeek });
      return res.json({ availableTimes: [] });
    }
    
    // Buscar agendamentos existentes
    log('Buscando agendamentos existentes para a data');
    const existingAppointments = await Appointment.findAll({
      where: {
        barberId,
        appointmentDate: date
      },
      attributes: ['appointmentTime']
    });
  

    // const bookedTimes = existingAppointments.map(apt => apt.appointmentTime);
    const bookedTimes = existingAppointments.map(apt => apt.appointmentTime.slice(0, 5)); // corta os segundos

    log('Agendamentos existentes encontrados', { count: existingAppointments.length, bookedTimes });
    
    // Gerar horários disponíveis
    const [startTime, endTime] = workingHours.split('-');
    log('Gerando slots de tempo', { startTime, endTime });
      const availableTimes = generateTimeSlots(startTime, endTime, bookedTimes, date);
      console.log('→ Gerando slots para:', { date, today: new Date().toISOString().slice(0,10), bookedTimes });
    // const availableTimes = generateTimeSlots(startTime, endTime, bookedTimes);
    
    log('Horários disponíveis gerados', { count: availableTimes.length, availableTimes });
    
    res.json({ 
      availableTimes,
      date,
      barberId,
      barberName: barber.name,
      workingHours
    });
  } catch (error) {
    logError('Erro ao buscar horários', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
});

// Função auxiliar para gerar slots de tempo - SIMPLIFICADA
function generateTimeSlots(startTime, endTime, bookedTimes = [], selectedDateStr = null) {
  log('Iniciando geração de slots', { startTime, endTime, bookedTimesCount: bookedTimes.length });

  const slots = [];

  try {
    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10); // 'YYYY-MM-DD'

    for (let time = start; time < end; time += 30) {
      const timeStr = minutesToTime(time);

      // Já está agendado?
      if (bookedTimes.includes(timeStr)) continue;

      // Verifica se é hoje e se o horário já passou ou está a menos de 10 min do agora
      if (selectedDateStr === todayStr) {
        const [hour, minute] = timeStr.split(':').map(Number);
        const slotDate = new Date(selectedDateStr + `T${timeStr}:00`);
        const diffInMin = (slotDate.getTime() - now.getTime()) / 60000;
        if (diffInMin < 10) continue;
      }

      slots.push(timeStr);
    }

    log('Slots gerados com sucesso', { totalSlots: slots.length, slots });
  } catch (error) {
    logError('Erro ao gerar slots', error);
    //aqui define os horarios padrão
    const defaultSlots = ['09:00', '09:20', '09:40', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'];
    return defaultSlots.filter(time => !bookedTimes.includes(time));
  }

  return slots;
}



function timeToMinutes(timeStr) {
  try {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const result = hours * 60 + (minutes || 0);
    log('Convertendo tempo para minutos', { timeStr, hours, minutes, result });
    return result;
  } catch (error) {
    logError('Erro ao converter tempo para minutos', error);
    return 0;
  }
}

function minutesToTime(minutes) {
  try {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const result = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    return result;
  } catch (error) {
    logError('Erro ao converter minutos para tempo', error);
    return '00:00';
  }
}

module.exports = router;

