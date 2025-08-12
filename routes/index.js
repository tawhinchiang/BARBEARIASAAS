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
    title: 'Agendamento - ' + (process.env.BARBERSHOP_NAME),
    barbershopName: process.env.BARBERSHOP_NAME ,
    barbershopLogo: process.env.BARBERSHOP_LOGO ,
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
    barbershopName: process.env.BARBERSHOP_NAME
  });
});

// Rota de teste para login (remover se não necessária)
// router.get('/login', (req, res) => {
//   log('Acessando rota de login via cliente (redirecionando para admin)');
//   res.redirect('/admin/login');
// });

// API para listar serviços disponíveis
router.get('/api/services', async (req, res) => {
  try {
    log('Buscando serviços disponíveis');
    
    const { ServiceType } = require('../models');
    const services = await ServiceType.findAll({
      where: { isActive: true },
      attributes: ['id', 'name', 'price', 'duration'],    // ← inclui duration
      order: [['name', 'ASC']]
    });
    
    log('Serviços encontrados', {
      count: services.length,
      services: services.map(s => ({
        id: s.id,
        name: s.name,
        price: s.price,
        duration: s.duration    // ← loga também a duração
      }))
    });
    
    res.json({ services });
  } catch (error) {
    logError('Erro ao buscar serviços', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});


//rota para validar o código





// API para obter horários disponíveis - CORRIGIDA
router.get('/api/available-times', async (req, res) => {
  try {
    const { barberId, date, serviceTypeId } = req.query;

    if (!barberId || !date || !serviceTypeId) {
      log('Parâmetros obrigatórios não fornecidos');
      return res.status(400).json({
        error: 'Parâmetros obrigatórios: barberId, date, serviceTypeId',
        received: { barberId, date, serviceTypeId }
      });
    }

    // Validar formato da data YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      log('Formato de data inválido', { date });
      return res.status(400).json({
        error: 'Formato de data inválido. Use YYYY-MM-DD',
        received: date
      });
    }

    const { Appointment, Barber, ServiceType } = require('../models');

    // Buscar serviço para pegar duração
    const serviceType = await ServiceType.findByPk(serviceTypeId);
    if (!serviceType) {
      return res.status(404).json({ error: 'Serviço não encontrado' });
    }

    // Pegando duração do serviço em minutos (garantindo número inteiro)
    // Usa duração da query se existir, senão pega do banco
    const durationFromQuery = parseInt(req.query.duration, 10);
    const requiredDuration = durationFromQuery || parseInt(serviceType.duration, 10) || 20;


    // Buscar barbeiro
    const barber = await Barber.findByPk(barberId);
    if (!barber) {
      return res.status(404).json({ error: 'Barbeiro não encontrado' });
    }

    // Definir horário de trabalho para o dia da semana
    const selectedDate = new Date(date + 'T00:00:00');
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][selectedDate.getDay()];
    let workingPeriods = [];
    let parsed = {};
    if (barber.workingHours) {
      
      try {
        parsed = typeof barber.workingHours === 'string'
          ? JSON.parse(barber.workingHours)
          : barber.workingHours || {};
      } catch (err) {
        logError('Erro ao fazer parse de workingHours', err);
        parsed = {};
      }
      log('workingHours recebido do banco', { raw: barber.workingHours });

if (parsed && typeof parsed === 'object' && parsed[dayOfWeek]) {
  const dayConfig = parsed[dayOfWeek];
  if (dayConfig.morning && dayConfig.morning !== 'closed') {
    workingPeriods.push(dayConfig.morning);
  }
  if (dayConfig.afternoon && dayConfig.afternoon !== 'closed') {
    workingPeriods.push(dayConfig.afternoon);
  }
}
    }


    if (workingPeriods.length === 0) {
  return res.json({ availableTimes: [] });
}
 // Buscar agendamentos existentes do barbeiro na data
    const existingAppointments = await Appointment.findAll({
      where: { barberId, appointmentDate: date },
      attributes: ['appointmentTime', 'serviceDuration'] // ajuste o nome da coluna se necessário
    });

  // Obter tempos bloqueados
    const bookedTimes = getBlockedTimesWithDuration(existingAppointments);
    // Gerar slots disponíveis a partir de todos os turnos (manhã e tarde)
let availableTimes = [];
workingPeriods.forEach(period => {
  const [start, end] = period.split('-');
  const slots = generateTimeSlots(start, end, bookedTimes, date, requiredDuration);
  availableTimes = availableTimes.concat(slots);
});

   
  

    // Gerar slots disponíveis


return res.json({
  availableTimes,
  date,
  barberId,
  barberName: barber.name,
  workingHours: parsed[dayOfWeek] || {}
});


  } catch (error) {
    logError('Erro ao buscar horários', error);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
});

function getBlockedTimesWithDuration(appointments) {
  const blocked = new Set();

    appointments.forEach(({ appointmentTime, serviceDuration }) => {
      const start = timeToMinutes(appointmentTime.slice(0, 5));
      const duration = parseInt(serviceDuration, 10) || 20;
      const end = start + duration;

      // Marca cada slot de 10 minutos dentro do intervalo como bloqueado
        for (let t = start; t < end; t += 10) {
        blocked.add(minutesToTime(t));
        } 
        //ou 
        // for (let t = start; t < end; t += 10) {
        //   blocked.add(minutesToTime(t));
        // }

    });

  return Array.from(blocked);
}


function generateTimeSlots(startTime, endTime, bookedTimes = [], selectedDateStr = null, requiredDuration = 20) {
  const slots = [];
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime) + 1; // inclui exatamente até 19:40
  const now = new Date();

  for (let t = start; t + requiredDuration <= end; t += 20) {  // ← MUDOU AQUI: de 10 para 20
    let blocked = false;

    for (let dt = 0; dt < requiredDuration; dt += 10) {
      const candidate = minutesToTime(t + dt);
      if (bookedTimes.includes(candidate)) {
        blocked = true;
        break;
      }
    }

    if (blocked) continue;

    const slot = minutesToTime(t);

    if (selectedDateStr === now.toISOString().slice(0, 10)) {
      const slotDate = new Date(`${selectedDateStr}T${slot}:00`);
      if (slotDate < now) continue;
    }

    slots.push(slot);
  }

  return slots;
}



function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + (minutes || 0);
}

function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}



module.exports = router;

