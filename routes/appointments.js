const express = require('express');
const { sendWhatsAppMessage } = require('../utils/whatsapp');
const normalizePhone = require('../utils/normalizePhone');
const moment = require('moment');
const { Client, Barber, ServiceType, Appointment } = require('../models');
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

// API para criar novo agendamento
router.post('/api/appointments', async (req, res) => {
  try {
    log('Recebendo novo agendamento', req.body);

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
    const serviceType = await ServiceType.findByPk(serviceId);

    if (!barber || !serviceType) {
      log('Barbeiro ou serviço não encontrado', { barberFound: !!barber, serviceFound: !!serviceType });
      return res.status(404).json({
        success: false,
        error: 'Barbeiro ou serviço não encontrado'
      });
    }

    const existingAppointment = await Appointment.findOne({
      where: {
        barberId,
        appointmentDate,
        appointmentTime
      }
    });

    if (existingAppointment) {
      log('Horário já ocupado', { barberId, appointmentDate, appointmentTime });
      return res.status(409).json({
        success: false,
        error: 'Horário não disponível'
      });
    }

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
      if (  client.firstName !== firstName.toUpperCase() ||
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
      appointmentTime,
      serviceDuration: serviceType.duration,
      totalPrice: serviceType.price,
      status: 'confirmed',
      notes: clientData.notes || null
    });

    const io = req.app.get('io');
    io.emit('new_appointment', {
      id: appointment.id,
      client: `${client.firstName} ${client.lastName}`,
      time: appointment.appointmentTime,
      date: appointment.appointmentDate
    });

    const fullName = `${client.firstName} ${client.lastName}`;
    const priceNum = Number(serviceType.price);
    const priceFormatted = Number.isNaN(priceNum) ? '0.00' : priceNum.toFixed(2);

    const msg = `Olá, ${fullName}! 👋\n\nSeu agendamento foi confirmado com sucesso:\n🗓️ *Data:* ${appointmentDate}\n⏰ *Horário:* ${appointmentTime}\n✂️ *Serviço:* ${serviceType.name}\n💈 *Barbeiro:* ${barber.name}\n💰 *Valor:* R$ ${priceFormatted}\n\nAgradecemos pela preferência!`;

    const sent = await sendWhatsAppMessage(client.phone, msg);
    if (!sent) {
      logError('❌ Falha ao enviar mensagem pelo WhatsApp', { phone: client.phone });
    }

    log('Agendamento criado com sucesso', {
      id: appointment.id,
      client: `${client.firstName} ${client.lastName}`,
      barber: barber.name,
      service: serviceType.name,
      date: appointmentDate,
      time: appointmentTime,
      price: serviceType.price
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
      whatsappSent: sent
    });

  } catch (error) {
    logError('Erro ao criar agendamento', error);
    res.status(500).json({
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

module.exports = router;
