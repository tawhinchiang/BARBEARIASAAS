const express = require('express');
const moment = require('moment');
const normalizePhone = require('../utils/normalizePhone');
const { Client, Barber, ServiceType, Appointment } = require('../models');
const { sendWhatsAppMessage } = require('../utils/whatsapp');
const router = express.Router();
const VerificationCode = require('../models/VerificationCode');
const { Op, fn, col, where } = require('sequelize');
const TZ_OFFSET = process.env.TZ_OFFSET || '-03:00';
const parseAppt = (dateStr, timeStr) => new Date(`${dateStr}T${timeStr}${TZ_OFFSET}`);
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
    layout: 'main', 
    isHistoryPage: true,
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
      expiresAt: { [Op.lt]: new Date() }    }
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
    const variants = buildPhoneVariants(cleanPhone);
    let sent = false;
    for (const v of variants) {
      const result = await sendWhatsAppMessage(v, msg);
      if (result?.ok || result?.delivered) {
        sent = true;
        break;
      }
    }
    if (!sent) {
      return res.status(500).json({ success: false, message: 'Erro ao enviar mensagem via WhatsApp.' });
    }
    res.json({ success: true });

  } catch (error) {
    logError('Erro ao enviar código', error);
    res.status(500).json({ success: false, message: 'Erro interno ao enviar código. Tente novamente.' });
  }
});

//checar se código já foi enviado

router.post('/check-code-status', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ hasCode: false, message: 'Telefone não informado.' });

  const cleanPhone = normalizePhone(phone);

  try {
    const record = await VerificationCode.findOne({
      where: { phone: cleanPhone },
      order: [['createdAt', 'DESC']]
    });

    if (!record) return res.json({ hasCode: false });

    const now = Date.now();
    const expiresAt = new Date(record.expiresAt).getTime();
    const createdAt = new Date(record.createdAt).getTime();

    const timeLeft = Math.max(0, Math.ceil((expiresAt - now) / 1000));
    const timeSince = now - createdAt;

    if (timeLeft <= 0) {
      await record.destroy(); // remove se já expirou
      return res.json({ hasCode: false });
    }

    const resendAvailable = timeSince >= 50 * 1000;

    return res.json({
      hasCode: true,
      timeLeft,
      resendAvailable
    });
  } catch (err) {
    console.error('Erro em check-code-status:', err);
    res.status(500).json({ hasCode: false });
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
        createdAt: { [Op.gt]: tenMinutesAgo }
      }
    });

    if (recentAttempts >= 10) {
      return res.status(429).json({
        success: false,
        message: 'Muitas tentativas inválidas. Aguarde alguns minutos para tentar novamente.'
      });
    }

    // Código inválido
    if (record.code !== code) {
      return res.status(401).json({ success: false, message: 'Código incorreto.' });
    }

    // Código válido
    await record.destroy();
     res.json({ success: true });

  } catch (error) {
    logError('Erro ao verificar código', error);
    res.status(500).json({ success: false, message: 'Erro interno ao verificar código. Tente novamente.' });
  }
});


// Gera variações plausíveis do telefone para busca no banco
function buildPhoneVariants(input) {
  let cleaned = String(input || '').replace(/\D/g, '');
  if (cleaned.startsWith('55')) cleaned = cleaned.slice(2);

  const ddd = cleaned.slice(0, 2);
  let num = cleaned.slice(2);

  const variants = new Set();
  variants.add(cleaned);
  variants.add('55' + cleaned);
  variants.add('+55' + cleaned);
  // Se começar com 9, tenta sem
  if (num.length === 9 && num.startsWith('9')) {
    variants.add(ddd + num.slice(1));
    variants.add('55' + ddd + num.slice(1));
    variants.add('+55' + ddd + num.slice(1));
  }

  // Se tiver 8 dígitos, tenta com 9
  if (num.length === 8) {
    variants.add(ddd + '9' + num);
    variants.add('55' + ddd + '9' + num);
    variants.add('+55' + ddd + '9' + num);
  }

  return [...variants];
}
async function findClientIdsByPhoneVariants(variants) {
  // normaliza a lista recebida: só dígitos
  const onlyDigits = Array.from(new Set(variants.map(v => String(v || '').replace(/\D/g, ''))));

  // garante presença com/sem 55 (cobre legado)
  const expanded = new Set();
  for (const v of onlyDigits) {
    expanded.add(v);
    expanded.add(v.startsWith('55') ? v.slice(2) : '55' + v);
  }

  // coluna normalizada do banco (só dígitos)
  const normalizedCol = fn('regexp_replace', col('phone'), '\\D', '', 'g');
  const rows = await Client.findAll({
    attributes: ['id'],
    where: where(normalizedCol, { [Op.in]: Array.from(expanded) })
  });
  return rows.map(r => r.id);
}


// Buscar histórico por telefone
router.post('/search', async (req, res) => {
  try {
    log('Buscando histórico por telefone', req.body);
    const { phone } = req.body;
    if (!phone) return res.json({ success: false, message: 'Telefone não informado.' });

    const cleanPhone = normalizePhone(phone);
    const variants = buildPhoneVariants(cleanPhone);
    log('Variações de telefone para busca', variants);

  const clientIds = await findClientIdsByPhoneVariants(variants);
   if (!clientIds.length) {
    return res.json({ success: false, message: 'Nenhum cliente encontrado com este telefone.' });
   }
    const appointments = await Appointment.findAll({
      where: { clientId: { [Op.in]: clientIds } },
      include: [
        { model: ServiceType, as: 'serviceType' },
        { model: Barber, as: 'barber' },
        { model: Client, as: 'client' }
      ],
      order: [['appointmentDate', 'DESC'], ['appointmentTime', 'DESC']]
    });

    const data = appointments.map(app => {
      const appointmentDateTime = parseAppt(app.appointmentDate, app.appointmentTime);
      const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
      return {
        id: app.id,
        service: app.serviceType?.name || '—',
        barber: app.barber?.name || '—',
        date: moment(appointmentDateTime).format('DD/MM/YYYY'),
        time: app.appointmentTime?.slice(0, 5) || '—',
        status: app.status,
        canCancel: ['scheduled', 'confirmed'].includes(app.status) && appointmentDateTime > oneHourFromNow,
          clientName: `${app.client?.firstName ?? ''} ${app.client?.lastName ?? ''}`.trim(),
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

    const appointmentDateTime = parseAppt(appointment.appointmentDate, appointment.appointmentTime);
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);

    if (appointmentDateTime <= oneHourFromNow)
      return res.status(403).json({ success: false, message: 'Não é possível cancelar agendamentos com menos de 1 hora de antecedência.' });

    if (['cancelled', 'completed'].includes(appointment.status))
      return res.status(400).json({ success: false, message: 'Este agendamento já foi cancelado ou concluído.' });

    await appointment.update({ status: 'cancelled' });
    const io = req.app.get('io');

    if (io) {
      io.emit('appointment_cancelled', {
        id: appointment.id,
        client: `${appointment.client.firstName} ${appointment.client.lastName}`.trim(),
        time: appointment.appointmentTime,
        date: appointment.appointmentDate
      });
      console.log('[HISTORY] Agendamento cancelado emitido via socket:', appointment.id);
    }

 try {
  const msg = `Olá, ${appointment.client.firstName}! 👋

  Seu agendamento foi cancelado com sucesso:
  🗓️ *Data:* ${appointment.appointmentDate}
  ⏰ *Horário:* ${appointment.appointmentTime}
  ✂️ *Serviço:* ${appointment.serviceType?.name || '—'}
  💈 *Barbeiro:* ${appointment.barber?.name || '—'}

  Se precisar remarcar ou se tiver algum motivo para o cancelamento, ficaremos felizes em ouvir. 😊

  Estamos à disposição para te atender quando quiser! 💈✨`;

  const variants = buildPhoneVariants(appointment.client.phone);
  let sent = false;
  for (const v of variants) {
    const result = await sendWhatsAppMessage(v, msg);
    if (result?.ok || result?.delivered) {
      sent = true;
      break;
    }
  }
  if (!sent) logError('Nenhuma variação válida para enviar WhatsApp de cancelamento', new Error());
}
catch (err) {
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
    const variants = buildPhoneVariants(cleanPhone);
    const clientIds = await findClientIdsByPhoneVariants(variants);
    if (!clientIds.length) return res.json({ success: false, message: 'Cliente não encontrado.' });

    const now = new Date();
    const appointments = await Appointment.findAll({
      where: {
        clientId: { [Op.in]: clientIds },
        status: { [Op.in]: ['scheduled', 'confirmed'] }
      },
      include: [
        { model: ServiceType, as: 'serviceType' },
        { model: Barber, as: 'barber' }
      ],
      order: [['appointmentDate', 'ASC'], ['appointmentTime', 'ASC']]
    });

    const data = appointments.filter(app => {
      const start = parseAppt(app.appointmentDate, app.appointmentTime);
      const duration = parseInt(app.serviceDuration || app.serviceType?.duration || 30, 10);
      const end = new Date(start.getTime() + duration * 60000);
      return end > now;
    }).map(app => {
      const appointmentDateTime = parseAppt(app.appointmentDate, app.appointmentTime);
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
