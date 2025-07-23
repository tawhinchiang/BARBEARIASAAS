const express = require('express');
const moment = require('moment');
const normalizePhone = require('../utils/normalizePhone');
const { Client, Barber, ServiceType, Appointment } = require('../models');
const { sendWhatsAppMessage } = require('../utils/whatsapp');
const router = express.Router();
const VerificationCode = require('../models/VerificationCode');

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

// Enviar código via WhatsApp para verificação
router.post('/send-code', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'Telefone é obrigatório.' });

    const cleanPhone = normalizePhone(phone);
    await VerificationCode.destroy({
    where: {
      phone: cleanPhone,
      expiresAt: { [require('sequelize').Op.lt]: new Date() }
    }
  });
    // Buscar último código gerado
    const lastCode = await VerificationCode.findOne({
      where: { phone: cleanPhone },
      order: [['createdAt', 'DESC']]
    });

    // Verificar se foi solicitado há menos de 50 segundos
    if (lastCode) {
      const elapsed = (Date.now() - new Date(lastCode.createdAt).getTime()) / 1000;
      if (elapsed < 50) {
        return res.status(429).json({
          success: false,
          message: `Por segurança, aguarde ${Math.ceil(50 - elapsed)} segundos antes de solicitar um novo código.`
        });
      }
    }

    // Gerar e salvar novo código
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutos

    await VerificationCode.create({ phone: cleanPhone, code, expiresAt });

    const msg = `👋 Olá! Seu código de verificação é:\n\n*${code}*\n\nEle expira em 2 minutos.`;
    const sent = await sendWhatsAppMessage(cleanPhone, msg);

    if (!sent) {
      return res.status(500).json({ success: false, message: 'Erro ao enviar mensagem via WhatsApp.' });
    }

    res.json({ success: true });

  } catch (error) {
    logError('Erro ao enviar código', error);
    res.status(500).json({ success: false, message: 'Erro interno ao enviar código. Tente novamente.' });
  }
});


// Verificar código de autenticação
router.post('/verify-code', async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ success: false, message: 'Telefone e código são obrigatórios.' });
    }

    const cleanPhone = normalizePhone(phone);

    const record = await VerificationCode.findOne({
      where: { phone: cleanPhone },
      order: [['createdAt', 'DESC']]
    });

    // Nenhum código encontrado
    if (!record) {
      return res.status(404).json({ success: false, message: 'Código não encontrado.' });
    }

    // Expirado
    if (new Date(record.expiresAt) < new Date()) {
      return res.status(401).json({ success: false, message: 'Código expirado. Solicite um novo.' });
    }

    // Verificações de tentativas
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentAttempts = await VerificationCode.count({
      where: {
        phone: cleanPhone,
        createdAt: { [require('sequelize').Op.gt]: tenMinutesAgo }
      }
    });

    if (record.attempts >= 5 || recentAttempts >= 10) {
      return res.status(429).json({
        success: false,
        message: 'Muitas tentativas inválidas. Aguarde alguns minutos para tentar novamente.'
      });
    }

    // Código inválido
    if (record.code !== code) {
      await record.increment('attempts');
      return res.status(401).json({ success: false, message: 'Código incorreto.' });
    }

    // Código válido
    res.json({ success: true });

  } catch (error) {
    logError('Erro ao verificar código', error);
    res.status(500).json({ success: false, message: 'Erro interno ao verificar código. Tente novamente.' });
  }
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
      const msg = `Olá, ${appointment.client.firstName}! 👋

      Seu agendamento foi cancelado com sucesso:
      🗓️ *Data:* ${appointment.appointmentDate}
      ⏰ *Horário:* ${appointment.appointmentTime}
      ✂️ *Serviço:* ${appointment.serviceType.name}
      💈 *Barbeiro:* ${appointment.barber.name}

      Se precisar remarcar ou se tiver algum motivo para o cancelamento, ficaremos felizes em ouvir. 😊

      Estamos à disposição para te atender quando quiser! 💈✨`;

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
