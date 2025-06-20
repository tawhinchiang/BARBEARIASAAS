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
    barbershopLogo: process.env.BARBERSHOP_LOGO || '/images/logo.png'
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
    
    res.json(services);
  } catch (error) {
    logError('Erro ao buscar serviços', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// API para listar barbeiros disponíveis
router.get('/api/barbers', async (req, res) => {
  try {
    log('Buscando barbeiros disponíveis');
    
    const { Barber } = require('../models');
    const barbers = await Barber.findAll({
      where: { isActive: true },
      order: [['name', 'ASC']]
    });
    
    log('Barbeiros encontrados', { count: barbers.length, barbers: barbers.map(b => ({ id: b.id, name: b.name })) });
    
    res.json(barbers);
  } catch (error) {
    logError('Erro ao buscar barbeiros', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// API para obter horários disponíveis
router.get('/api/available-times', async (req, res) => {
  try {
    const { barberId, date, serviceId } = req.query;
    
    log('Buscando horários disponíveis', { barberId, date, serviceId });
    
    if (!barberId || !date || !serviceId) {
      log('Parâmetros obrigatórios não fornecidos');
      return res.status(400).json({ error: 'Parâmetros obrigatórios: barberId, date, serviceId' });
    }
    
    const { Appointment, Barber, ServiceType } = require('../models');
    
    // Buscar barbeiro e serviço
    log('Buscando barbeiro e serviço no banco');
    const barber = await Barber.findByPk(barberId);
    const service = await ServiceType.findByPk(serviceId);
    
    if (!barber || !service) {
      log('Barbeiro ou serviço não encontrado', { barberFound: !!barber, serviceFound: !!service });
      return res.status(404).json({ error: 'Barbeiro ou serviço não encontrado' });
    }
    
    log('Barbeiro e serviço encontrados', { 
      barber: { id: barber.id, name: barber.name },
      service: { id: service.id, name: service.name, duration: service.duration }
    });
    
    // Verificar dia da semana
    const selectedDate = new Date(date);
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][selectedDate.getDay()];
    
    log('Verificando horário de trabalho', { date, dayOfWeek, workingHours: barber.workingHours });
    
    const workingHours = barber.workingHours[dayOfWeek];
    if (!workingHours || workingHours === 'closed') {
      log('Barbeiro não trabalha neste dia', { dayOfWeek, workingHours });
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
    
    const bookedTimes = existingAppointments.map(apt => apt.appointmentTime);
    log('Agendamentos existentes encontrados', { count: existingAppointments.length, bookedTimes });
    
    // Gerar horários disponíveis
    const [startTime, endTime] = workingHours.split('-');
    log('Gerando slots de tempo', { startTime, endTime, duration: service.duration });
    
    const availableTimes = generateTimeSlots(startTime, endTime, service.duration, bookedTimes);
    
    log('Horários disponíveis gerados', { count: availableTimes.length, availableTimes });
    
    res.json({ availableTimes });
  } catch (error) {
    logError('Erro ao buscar horários', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Função auxiliar para gerar slots de tempo
function generateTimeSlots(startTime, endTime, duration, bookedTimes) {
  log('Iniciando geração de slots', { startTime, endTime, duration, bookedTimesCount: bookedTimes.length });
  
  const slots = [];
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  
  log('Convertido para minutos', { start, end });
  
  for (let time = start; time + duration <= end; time += 30) {
    const timeStr = minutesToTime(time);
    if (!bookedTimes.includes(timeStr)) {
      slots.push(timeStr);
    }
  }
  
  log('Slots gerados', { totalSlots: slots.length, slots });
  
  return slots;
}

function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const result = hours * 60 + minutes;
  log('Convertendo tempo para minutos', { timeStr, hours, minutes, result });
  return result;
}

function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const result = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  log('Convertendo minutos para tempo', { minutes, hours, mins, result });
  return result;
}

module.exports = router;

