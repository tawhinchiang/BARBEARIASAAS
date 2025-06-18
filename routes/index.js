const express = require('express');
const router = express.Router();

// Página inicial - Agendamento para clientes
router.get('/', (req, res) => {
  res.render('index', {
    title: 'Agendamento - ' + (process.env.BARBERSHOP_NAME || 'Barbearia Premium'),
    barbershopName: process.env.BARBERSHOP_NAME || 'Barbearia Premium',
    barbershopLogo: process.env.BARBERSHOP_LOGO || '/images/logo.png'
  });
});

// Página de sucesso do agendamento
router.get('/agendamento-confirmado', (req, res) => {
  res.render('success', {
    title: 'Agendamento Confirmado',
    barbershopName: process.env.BARBERSHOP_NAME || 'Barbearia Premium'
  });
});

router.get('/login', (req, res) => {
  res.render('views/admin/login', {  // sem /views e sem .handlebars
    title: 'Agendamento Confirmado',
    barbershopName: process.env.BARBERSHOP_NAME || 'Barbearia Premium'
  });
});

// API para listar serviços disponíveis
router.get('/api/services', async (req, res) => {
  try {
    const { ServiceType } = require('../models');
    const services = await ServiceType.findAll({
      where: { isActive: true },
      order: [['name', 'ASC']]
    });
    res.json(services);
  } catch (error) {
    console.error('Erro ao buscar serviços:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// API para listar barbeiros disponíveis
router.get('/api/barbers', async (req, res) => {
  try {
    const { Barber } = require('../models');
    const barbers = await Barber.findAll({
      where: { isActive: true },
      order: [['name', 'ASC']]
    });
    res.json(barbers);
  } catch (error) {
    console.error('Erro ao buscar barbeiros:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// API para obter horários disponíveis
router.get('/api/available-times', async (req, res) => {
  try {
    const { barberId, date, serviceId } = req.query;
    
    if (!barberId || !date || !serviceId) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios: barberId, date, serviceId' });
    }
    
    const { Appointment, Barber, ServiceType } = require('../models');
    
    // Buscar barbeiro e serviço
    const barber = await Barber.findByPk(barberId);
    const service = await ServiceType.findByPk(serviceId);
    
    if (!barber || !service) {
      return res.status(404).json({ error: 'Barbeiro ou serviço não encontrado' });
    }
    
    // Verificar dia da semana
    const selectedDate = new Date(date);
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][selectedDate.getDay()];
    
    const workingHours = barber.workingHours[dayOfWeek];
    if (!workingHours || workingHours === 'closed') {
      return res.json({ availableTimes: [] });
    }
    
    // Buscar agendamentos existentes
    const existingAppointments = await Appointment.findAll({
      where: {
        barberId,
        appointmentDate: date
      },
      attributes: ['appointmentTime']
    });
    
    const bookedTimes = existingAppointments.map(apt => apt.appointmentTime);
    
    // Gerar horários disponíveis
    const [startTime, endTime] = workingHours.split('-');
    const availableTimes = generateTimeSlots(startTime, endTime, service.duration, bookedTimes);
    
    res.json({ availableTimes });
  } catch (error) {
    console.error('Erro ao buscar horários:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Função auxiliar para gerar slots de tempo
function generateTimeSlots(startTime, endTime, duration, bookedTimes) {
  const slots = [];
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  
  for (let time = start; time + duration <= end; time += 30) {
    const timeStr = minutesToTime(time);
    if (!bookedTimes.includes(timeStr)) {
      slots.push(timeStr);
    }
  }
  
  return slots;
}

function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

module.exports = router;

