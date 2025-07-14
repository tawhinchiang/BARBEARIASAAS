const express = require('express');
const normalizePhone = require('../utils/normalizePhone');
const { Client, Barber, ServiceType, Appointment } = require('../models');
const { sendWhatsAppMessage } = require('../utils/whatsapp');
const router = express.Router();

// ===== LOGS DETALHADOS =====
const log = (message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [HISTORY] ${message}`);
  if (data) {
    console.log(`[${timestamp}] [HISTORY] Data:`, JSON.stringify(data, null, 2));
  }
};

const logError = (message, error) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [HISTORY ERROR] ${message}`);
  console.error(`[${timestamp}] [HISTORY ERROR] Stack:`, error.stack);
};

// Página de histórico
router.get('/', (req, res) => {
  log('Acessando página de histórico');
  res.render('history', { 
    appointments: null,
    bodyClass: 'fade-in-soft',
    title: 'Histórico de Agendamentos'
  });
});

// Buscar histórico por telefone
router.post('/search', async (req, res) => {
  try {
    log('Buscando histórico por telefone', req.body);
    
    const { phone } = req.body;

    if (!phone) {
      log('Telefone não informado na busca de histórico');
      return res.json({ success: false, message: 'Telefone não informado.' });
    }

    // Limpar o telefone removendo caracteres não numéricos
     const cleanPhone = normalizePhone(phone);
    log('Telefone limpo para busca', { original: phone, clean: cleanPhone });

    // Primeiro, buscar o cliente pelo telefone
    const client = await Client.findOne({ 
      where: { phone: cleanPhone }
    });

    if (!client) {
      log('Cliente não encontrado para o telefone', { phone: cleanPhone });
      return res.json({ 
        success: false, 
        message: 'Nenhum cliente encontrado com este telefone.' 
      });
    }

    log('Cliente encontrado', { 
      id: client.id, 
      name: `${client.firstName} ${client.lastName}`,
      phone: client.phone 
    });

    // Buscar os agendamentos do cliente
    const appointments = await Appointment.findAll({
      where: { clientId: client.id },
      include: [
        { model: ServiceType, as: 'serviceType' },
        { model: Barber, as: 'barber' },
        { model: Client, as: 'client' }
      ],
      order: [['appointmentDate', 'DESC'], ['appointmentTime', 'DESC']]
    });

    log('Agendamentos encontrados', { count: appointments.length });

    if (appointments.length === 0) {
      return res.json({ 
        success: true, 
        appointments: [],
        message: 'Nenhum agendamento encontrado para este cliente.' 
      });
    }

    // Formatar os dados dos agendamentos
    const data = appointments.map(app => {
      const appointmentDateTime = new Date(`${app.appointmentDate}T${app.appointmentTime}`);
      const now = new Date();
      const oneHourFromNow = new Date(now.getTime() + (60 * 60 * 1000));
      
      return {
        id: app.id,
        service: app.serviceType?.name || '—',
        barber: app.barber?.name || '—',
        date: new Date(app.appointmentDate).toLocaleDateString('pt-BR'),
        time: app.appointmentTime?.slice(0, 5) || '—',
        status: app.status,
        canCancel: (app.status === 'scheduled' || app.status === 'confirmed') && 
                   appointmentDateTime > oneHourFromNow,
        clientName: `${client.firstName} ${client.lastName}`,
        totalPrice: app.totalPrice || 0
      };
    });

    log('Dados formatados para resposta', { appointmentsCount: data.length });

    res.json({ success: true, appointments: data });

  } catch (error) {
    logError('Erro ao buscar histórico por telefone', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno ao buscar agendamentos. Tente novamente.' 
    });
  }
});

// Cancelar agendamento
router.post('/cancel/:id', async (req, res) => {
  try {
    log('Tentativa de cancelamento de agendamento', { appointmentId: req.params.id });
    
    const appointmentId = req.params.id;
    
    if (!appointmentId) {
      log('ID do agendamento não fornecido');
      return res.status(400).json({ 
        success: false, 
        message: 'ID do agendamento é obrigatório.' 
      });
    }

    // Buscar o agendamento
    const appointment = await Appointment.findByPk(appointmentId, {
      include: [
        { model: Client, as: 'client' },
        { model: Barber, as: 'barber' },
        { model: ServiceType, as: 'serviceType' }
      ]
    });

    if (!appointment) {
      log('Agendamento não encontrado', { appointmentId });
      return res.status(404).json({ 
        success: false, 
        message: 'Agendamento não encontrado.' 
      });
    }

    log('Agendamento encontrado para cancelamento', {
      id: appointment.id,
      status: appointment.status,
      date: appointment.appointmentDate,
      time: appointment.appointmentTime
    });

    // Verificar se o agendamento pode ser cancelado
    const appointmentDateTime = new Date(`${appointment.appointmentDate}T${appointment.appointmentTime}`);
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + (60 * 60 * 1000));

    if (appointmentDateTime <= oneHourFromNow) {
      log('Tentativa de cancelamento muito próximo ao horário', {
        appointmentDateTime: appointmentDateTime.toISOString(),
        oneHourFromNow: oneHourFromNow.toISOString()
      });
      return res.status(403).json({ 
        success: false, 
        message: 'Não é possível cancelar agendamentos com menos de 1 hora de antecedência.' 
      });
    }

    // Verificar se o status permite cancelamento
    if (appointment.status === 'cancelled') {
      log('Agendamento já cancelado', { appointmentId });
      return res.status(400).json({ 
        success: false, 
        message: 'Este agendamento já foi cancelado.' 
      });
    }

    if (appointment.status === 'completed') {
      log('Tentativa de cancelar agendamento já concluído', { appointmentId });
      return res.status(400).json({ 
        success: false, 
        message: 'Não é possível cancelar um agendamento já concluído.' 
      });
    }

    // Cancelar o agendamento
    await appointment.update({ status: 'cancelled' });

    log('Agendamento cancelado com sucesso', {
      id: appointment.id,
      client: `${appointment.client.firstName} ${appointment.client.lastName}`,
      service: appointment.serviceType.name,
      barber: appointment.barber.name,
      date: appointment.appointmentDate,
      time: appointment.appointmentTime
    });

    // Enviar mensagem de cancelamento via WhatsApp (opcional)
    try {
      const cancelMsg = `Olá, ${appointment.client.firstName}! 👋\n\nSeu agendamento foi cancelado:\n🗓️ *Data:* ${appointment.appointmentDate}\n⏰ *Horário:* ${appointment.appointmentTime}\n✂️ *Serviço:* ${appointment.serviceType.name}\n💈 *Barbeiro:* ${appointment.barber.name}\n\nSe desejar reagendar, entre em contato conosco.`;
      
      const sent = await sendWhatsAppMessage(appointment.client.phone, cancelMsg);
      if (!sent) {
        log('Falha ao enviar mensagem de cancelamento via WhatsApp', { 
          phone: appointment.client.phone 
        });
      } else {
        log('Mensagem de cancelamento enviada via WhatsApp');
      }
    } catch (whatsappError) {
      logError('Erro ao enviar mensagem de cancelamento', whatsappError);
    }

    // Resposta de sucesso
    res.json({
      success: true,
      message: 'Agendamento cancelado com sucesso.',
      appointment: {
        id: appointment.id,
        status: 'cancelled',
        client: `${appointment.client.firstName} ${appointment.client.lastName}`,
        service: appointment.serviceType.name,
        barber: appointment.barber.name,
        date: appointment.appointmentDate,
        time: appointment.appointmentTime
      }
    });

  } catch (error) {
    logError('Erro ao cancelar agendamento', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno ao cancelar agendamento. Tente novamente.' 
    });
  }
});

// Buscar agendamentos em andamento ou futuros
router.post('/active', async (req, res) => {
  console.log('🎯 ROTA /active CHAMADA!');
  try {
    log('Buscando agendamentos ativos', req.body);
    
    const { phone } = req.body;

    if (!phone) {
      return res.json({ success: false, message: 'Telefone não informado.' });
    }

    const normalizePhone = require('../utils/normalizePhone');
    const cleanPhone = normalizePhone(phone);

    
    const client = await Client.findOne({ where: { phone: cleanPhone } });
    
    if (!client) {
      return res.json({ 
        success: false, 
        message: 'Cliente não encontrado.' 
      });
    }

    const now = new Date();
    
    // Buscar agendamentos futuros ou em andamento
    const activeAppointments = await Appointment.findAll({
      where: { 
        clientId: client.id,
        status: ['scheduled', 'confirmed']
      },
      include: [
        { model: ServiceType, as: 'serviceType' },
        { model: Barber, as: 'barber' }
      ],
      order: [['appointmentDate', 'ASC'], ['appointmentTime', 'ASC']]
    });

    // Filtrar apenas agendamentos futuros
const activeOrOngoingAppointments = activeAppointments.filter(app => {
  const [hour, minute] = app.appointmentTime.split(':');
  const appointmentStart = new Date(app.appointmentDate);
  appointmentStart.setHours(hour, minute, 0, 0);

  const durationMinutes = parseInt(app.serviceDuration) || parseInt(app.serviceType?.duration) || 30;
  const appointmentEnd = new Date(appointmentStart.getTime() + durationMinutes * 60 * 1000);

  console.log('🧪 VERIFICANDO ATIVO:', {
    id: app.id,
    start: appointmentStart,
    end: appointmentEnd,
    now: new Date(),
    result: appointmentEnd > new Date()
  });

  return appointmentEnd > new Date();
});


const data = activeOrOngoingAppointments.map(app => {
  
  const appointmentDateTime = new Date(`${app.appointmentDate}T${app.appointmentTime}`);
  const oneHourFromNow = new Date(now.getTime() + (60 * 60 * 1000));

  return {
    id: app.id,
    service: app.serviceType?.name || '—',
    barber: app.barber?.name || '—',
    date: new Date(app.appointmentDate).toLocaleDateString('pt-BR'),
    time: app.appointmentTime?.slice(0, 5) || '—',
    status: app.status,
    canCancel: appointmentDateTime > oneHourFromNow,
    totalPrice: app.totalPrice || 0
  };
});

    log('Agendamentos ativos encontrados', { count: data.length });

    res.json({ 
      success: true, 
      appointments: data,
      hasActiveAppointments: data.length > 0
    });

  } catch (error) {
    logError('Erro ao buscar agendamentos ativos', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno ao buscar agendamentos ativos.' 
    });
  }
});

module.exports = router;
