const express = require('express');
const { sendWhatsAppMessage } = require('../utils/whatsapp'); // Usando versão corrigida
const normalizePhone = require('../utils/normalizePhone'); // Usando versão corrigida
const moment = require('moment-timezone');
const TZ = process.env.TZ || 'America/Sao_Paulo';
const { QueryTypes } = require('sequelize');
const { Client, Barber, ServiceType, Appointment, Payment, CashSession } = require('../models');

const sequelize = require('../config/database'); 


const router = express.Router();

// ===== LOGS DETALHADOS =====
const log = (message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [APPOINTMENTS] ${message}`);
  if (data) {
    console.log(`[${timestamp}] [APPOINTMENTS] Data:`, JSON.stringify(data, null, 2));
  }
};

const logError = (message, error) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [APPOINTMENTS ERROR] ${message}`);
  console.error(`[${timestamp}] [APPOINTMENTS ERROR] Stack:`, error.stack);
};

function isTimeInRange(time, range) {
  if (!range || range === 'closed') return false;

  const [start, end] = range.split('-');
  return time >= start && time < end;
}
async function existeConflito({ barberId, appointmentDate, appointmentTime, serviceDuration }) {
  const rows = await sequelize.query(
    `
    WITH novo AS (
      SELECT
        (:date::date + :time::time) AS start_at,
        (:date::date + :time::time) + (:durationMin || ' minutes')::interval AS end_at
    )
    SELECT 1
    FROM appointments a, novo n
    WHERE a."barberId" = :barberId
      AND a."status" NOT IN ('cancelled', 'no_show')
      AND (a."appointmentDate"::timestamp + a."appointmentTime") < n.end_at
      AND ((a."appointmentDate"::timestamp + a."appointmentTime")
           + (a."serviceDuration" || ' minutes')::interval) > n.start_at
    LIMIT 1;
    `,
    {
      type: QueryTypes.SELECT, // use QueryTypes importado do sequelize
      replacements: {
        barberId,
        date: appointmentDate,
        time: appointmentTime,
        durationMin: serviceDuration
      }
    }
  );
  return rows.length > 0;
}

// API para criar novo agendamento
router.post('/api/appointments', async (req, res) => {
  try {
    const { isEncaixe = false } = req.body;
   
    const encaixe = (isEncaixe === true || isEncaixe === 'true');

    const { serviceId, barberId, appointmentDate, appointmentTime, clientData } = req.body;

    if (!serviceId || !barberId || !appointmentDate || !appointmentTime || !clientData) {
      log('Dados obrigatórios não fornecidos');
      return res.status(400).json({
        success: false,
        error: 'Todos os campos são obrigatórios',
        received: { serviceId, barberId, appointmentDate, appointmentTime, hasClientData: !!clientData }
      });
    }

    const { firstName, lastName, phone } = clientData;

    if (!firstName || !lastName || !phone) {
      log('Dados do cliente incompletos');
      return res.status(400).json({
        success: false,
        error: 'Dados do cliente são obrigatórios (nome, sobrenome, telefone)'
      });
    }

    const barber = await Barber.findByPk(barberId);

    if (!barber || !barber.workingHours) {
      log('Barbeiro não encontrado ou sem horário definido');
      return res.status(404).json({ success: false, error: 'Barbeiro inválido ou sem expediente configurado' });
    }

    const weekdayIndex = moment.tz(appointmentDate, 'YYYY-MM-DD', TZ).isoWeekday();
    const weekdayNames = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
    const weekday = weekdayNames[weekdayIndex - 1];

    // workingHours pode estar como string JSON no banco — trate os dois casos
    let workingHours = barber.workingHours;
    if (typeof workingHours === 'string') {
      try { workingHours = JSON.parse(workingHours); } catch (e) {
        return res.status(500).json({ success: false, error: 'Horários do barbeiro inválidos' });
      }
    }
    const daySchedule = workingHours?.[weekday];


    if (!daySchedule || (daySchedule.morning === 'closed' && daySchedule.afternoon === 'closed')) {
      return res.status(400).json({
        success: false,
        error: 'Barbeiro não atende nesse dia'
      });
    }

   
    
    const onlyHHmm = (t) => (t || '').slice(0,5); 
    const timeHHmm = onlyHHmm(appointmentTime);

    
    const isValidTime =
      isTimeInRange(timeHHmm, daySchedule.morning) ||
      isTimeInRange(timeHHmm, daySchedule.afternoon);

    if (!isValidTime && !encaixe) {
      return res.status(400).json({ success: false, error: 'Horário fora do expediente do barbeiro' });
    }


    const serviceType = await ServiceType.findByPk(serviceId);

    if (!serviceType) {
      log('Serviço não encontrado');
      return res.status(404).json({
        success: false,
        error: 'Serviço não encontrado'
      });
    }

 if (!encaixe) {
  const temConflito = await existeConflito({
    barberId,
    appointmentDate,
    appointmentTime: timeHHmm,
    serviceDuration: serviceType.duration
  });
  if (temConflito) {
    log('Conflito de horário detectado', { barberId, appointmentDate, appointmentTime: timeHHmm, duration: serviceType.duration });
    return res.status(409).json({ success: false, error: 'Conflito de horário para este barbeiro.' });
  }
}


    // CORREÇÃO CRÍTICA: Usar a nova função de normalização
    const cleanPhone = normalizePhone(phone);
   

    let client = await Client.findOne({ where: { phone: cleanPhone } });

    if (!client) {
      client = await Client.create({
        firstName: firstName.toUpperCase(),
        lastName: lastName.toUpperCase(),
        phone: cleanPhone,
        email: clientData.email || null
      });
      log('Cliente criado', { id: client.id, name: `${client.firstName} ${client.lastName}` });
    } else {
      if (client.firstName !== firstName.toUpperCase() ||
        client.lastName !== lastName.toUpperCase()) {
        await client.update({
          firstName: firstName.toUpperCase(),
          lastName: lastName.toUpperCase(),
          email: clientData.email || client.email
        });
        log('Dados do cliente atualizados');
      }
    }

    const appointment = await Appointment.create({
      clientId: client.id,
      barberId,
      serviceTypeId: serviceId,
      appointmentDate,
      appointmentTime:timeHHmm,
      serviceDuration: serviceType.duration,
      totalPrice: serviceType.price,
      status: 'confirmed',
      isEncaixe: encaixe,
      notes: clientData.notes || null
    });

   const io = req.app.get('io');
   if (io) {
    io.emit('new_appointment', {
      id: appointment.id,
      client: `${client.firstName} ${client.lastName}`,
      time: appointment.appointmentTime,
      date: appointment.appointmentDate
    });
  }
    const fullName = `${client.firstName} ${client.lastName}`;
    const priceNum = Number(serviceType.price);
    const priceFormatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(priceNum);

// Data formatada no padrão brasileiro
const appointmentDateBR = moment(appointmentDate, 'YYYY-MM-DD').format('DD/MM/YYYY');

// Link dinâmico com base no host da requisição
const baseUrl = `${req.protocol}://${req.headers.host}`;

const msg = `✅ Seu agendamento foi confirmado com sucesso! 

❕ Informações 👇

🛠 Serviço: ${serviceType.name}
👤 Profissional: ${barber.name}
📅 Data: ${appointmentDateBR}
🕗 Hora: ${timeHHmm}
💰 Valor:${priceFormatted}
Para realizar o cancelamento, clique no link abaixo, acesse a aba de 'Histórico', selecione seu agendamento e clique na opção Cancelar ⬇

${baseUrl}`;

   
   
   const sent = await sendWhatsAppMessage(cleanPhone, msg);
    
  // Marcar como enviado se o WhatsApp aceitou (ok=true).
 if (sent?.ok) {
   await appointment.update({
     whatsappSent: true,
     whatsappAck: sent.ack ?? null
   });
 }

    log('Agendamento criado com sucesso', {
      id: appointment.id,
      client: `${client.firstName} ${client.lastName}`,
      barber: barber.name,
      service: serviceType.name,
      date: appointmentDate,
      time: timeHHmm,
      price: serviceType.price,
      whatsappSent: !!sent?.delivered
    });

    res.status(201).json({
      success: true,
      message: 'Agendamento criado com sucesso',
      appointment: {
        id: appointment.id,
        client: {
          name: fullName,
          phone: client.phone,
          email: client.email
        },
        barber: barber.name,
        service: {
          name: serviceType.name,
          duration: serviceType.duration,
          price: priceNum
        },
        date: appointment.appointmentDate,
        time: appointment.appointmentTime,
        totalPrice: priceNum,
        status: appointment.status
      },
      whatsappSent: !!sent?.delivered
    });

  } catch (error) {
  // Se caiu na unique parcial do Postgres, responda 409
  const isUnique =
    error?.name === 'SequelizeUniqueConstraintError' ||
    error?.parent?.constraint === 'uq_appointments_regular_slot' ||
    (typeof error?.message === 'string' && error.message.includes('uq_appointments_regular_slot'));

  if (isUnique) {
    logError('Conflito de horário (constraint no banco)', error);
    return res.status(409).json({ success: false, error: 'Conflito de horário para este barbeiro.' });
  }

  logError('Erro ao criar agendamento', error);
  return res.status(500).json({
    success: false,
    error: 'Erro interno do servidor',
    message: error.message
  });
}
});

// Redirecionador (exemplo GET ou POST raiz)
router.post('/', async (req, res, next) => {
  req.url = '/api/appointments';
  next();
});
// POST /admin/appointments/:id/checkout
router.post('/admin/appointments/:id/checkout', async (req, res) => {
 
  const t = await Appointment.sequelize.transaction();

  try {
    const appointmentId = req.params.id;
    const { payments } = req.body; // array [{ method, amount, notes }]

    const appointment = await Appointment.findByPk(appointmentId, { transaction: t });
    if (!appointment) throw new Error('Agendamento não encontrado');
    const openSession = await CashSession.findOne({ where: { status: 'open' } });

    // Salvar pagamentos
    let totalPago = 0;
    for (const p of payments) {
      const newPayment = await Payment.create({
        appointmentId,
        method: p.method,
        amount: p.amount,
        notes: p.notes || null,
        cashSessionId: openSession ? openSession.id : null
      }, { transaction: t });

      totalPago += parseFloat(newPayment.amount);
    }

    // Atualizar status de pagamento
    let paymentStatus = 'pending';
    if (totalPago >= parseFloat(appointment.totalPrice)) {
      paymentStatus = 'paid';
    } else if (totalPago > 0) {
      paymentStatus = 'partial';
    }

    await appointment.update({
      status: 'completed',
      paymentStatus
    }, { transaction: t });

    await t.commit();
    res.json({ success: true, appointmentId, paymentStatus });
  } catch (err) {
    await t.rollback();
    console.error('[CHECKOUT ERROR]', err);
    res.status(400).json({ success: false, error: err.message });
  }
});


module.exports = router;

