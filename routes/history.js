const express = require('express');
const moment = require('moment');
const normalizePhone = require('../utils/normalizePhone');
const { Client, Barber, ServiceType, Appointment } = require('../models');
const { sendWhatsAppMessage } = require('../utils/whatsapp');
const router = express.Router();

// ===== LOGS DETALHADOS =====
const log = (message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [HISTORY] ${message}`);
  if (data) console.log(`[${timestamp}] [HISTORY] Data:`, JSON.stringify(data, null, 2));
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
    if (!phone) return res.json({ success: false, message: 'Telefone não informado.' });

    const cleanPhone = normalizePhone(phone);
    log('Telefone limpo para busca', { original: phone, clean: cleanPhone });

    const client = await Client.findOne({ where: { phone: cleanPhone } });
    if (!client) return res.json({ success: false, message: 'Nenhum cliente encontrado com este telefone.' });

    const appointments = await Appointment.findAll({
      where: { clientId: client.id },
      include: [
        { model: ServiceType, as: 'serviceType' },
        { model: Barber, as: 'barber' },
        { model: Client, as: 'client' }
      ],
      order: [['appointmentDate', 'DESC'], ['appointmentTime', 'DESC']]
    });

    const data = appointments.map(app => {
      const appointmentDateTime = new Date(`${app.appointmentDate}T${app.appointmentTime}`);
      const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
      return {
        id: app.id,
        service: app.serviceType?.name || '—',
        barber: app.barber?.name || '—',
        date: moment(appointmentDateTime).format('DD/MM/YYYY'),
        time: app.appointmentTime?.slice(0, 5) || '—',
        status: app.status,
        canCancel: ['scheduled', 'confirmed'].includes(app.status) && appointmentDateTime > oneHourFromNow,
        clientName: `${client.firstName} ${client.lastName}`,
        totalPrice: app.totalPrice || 0
      };
    });

    res.json({ success: true, appointments: data });
  } catch (error) {
    logError('Erro ao buscar histórico por telefone', error);
    res.status(500).json({ success: false, message: 'Erro interno ao buscar agendamentos. Tente novamente.' });
  }
});

// Cancelar agendamento
router.post('/cancel/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, message: 'ID do agendamento é obrigatório.' });

    const appointment = await Appointment.findByPk(id, {
      include: [
        { model: Client, as: 'client' },
        { model: Barber, as: 'barber' },
        { model: ServiceType, as: 'serviceType' }
      ]
    });

    if (!appointment) return res.status(404).json({ success: false, message: 'Agendamento não encontrado.' });

    const appointmentDateTime = new Date(`${appointment.appointmentDate}T${appointment.appointmentTime}`);
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);

    if (appointmentDateTime <= oneHourFromNow)
      return res.status(403).json({ success: false, message: 'Não é possível cancelar agendamentos com menos de 1 hora de antecedência.' });

    if (['cancelled', 'completed'].includes(appointment.status))
      return res.status(400).json({ success: false, message: 'Este agendamento já foi cancelado ou concluído.' });

    await appointment.update({ status: 'cancelled' });

    try {
      const msg = `Olá, ${appointment.client.firstName}! 👋\n\nSeu agendamento foi cancelado:\n🗓️ *Data:* ${appointment.appointmentDate}\n⏰ *Horário:* ${appointment.appointmentTime}\n✂️ *Serviço:* ${appointment.serviceType.name}\n💈 *Barbeiro:* ${appointment.barber.name}`;
      await sendWhatsAppMessage(appointment.client.phone, msg);
    } catch (err) {
      logError('Erro ao enviar mensagem de cancelamento', err);
    }

    res.json({ success: true, message: 'Agendamento cancelado com sucesso.', appointment });
  } catch (error) {
    logError('Erro ao cancelar agendamento', error);
    res.status(500).json({ success: false, message: 'Erro interno ao cancelar agendamento. Tente novamente.' });
  }
});

// Agendamentos ativos ou em andamento
router.post('/active', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.json({ success: false, message: 'Telefone não informado.' });

    const cleanPhone = normalizePhone(phone);
    const client = await Client.findOne({ where: { phone: cleanPhone } });
    if (!client) return res.json({ success: false, message: 'Cliente não encontrado.' });

    const now = new Date();
    const appointments = await Appointment.findAll({
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

    const data = appointments.filter(app => {
      const start = new Date(`${app.appointmentDate}T${app.appointmentTime}`);
      const duration = parseInt(app.serviceDuration || app.serviceType?.duration || 30);
      const end = new Date(start.getTime() + duration * 60000);
      return end > now;
    }).map(app => {
      const appointmentDateTime = new Date(`${app.appointmentDate}T${app.appointmentTime}`);
      const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
      return {
        id: app.id,
        service: app.serviceType?.name || '—',
        barber: app.barber?.name || '—',
        date: moment(appointmentDateTime).format('DD/MM/YYYY'),
        time: app.appointmentTime?.slice(0, 5) || '—',
        status: app.status,
        canCancel: appointmentDateTime > oneHourFromNow,
        totalPrice: app.totalPrice || 0
      };
    });

    res.json({ success: true, appointments: data, hasActiveAppointments: data.length > 0 });
  } catch (error) {
    logError('Erro ao buscar agendamentos ativos', error);
    res.status(500).json({ success: false, message: 'Erro interno ao buscar agendamentos ativos.' });
  }
});

module.exports = router;
