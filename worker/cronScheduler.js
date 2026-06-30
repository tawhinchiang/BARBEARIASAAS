const cron = require('node-cron');
require('dotenv').config();
const moment = require('moment-timezone'); // <-- trocar para moment-timezone
const { Op } = require('sequelize');
const { Appointment, Client, Barber, ServiceType, SystemConfig } = require('../models');
const cleanupExpiredCodes = require('../utils/cleanUpCodes');

const {
  sendWhatsAppMessage,
  isWhatsAppEnabled,
  isWhatsAppReady,
  waitWhatsAppReady
} = require('../utils/whatsapp');

// Variáveis da barbearia via .env
const BARBERSHOP_NAME = process.env.BARBERSHOP_NAME || 'Barbearia';
const BARBERSHOP_ADDRESS = process.env.BARBERSHOP_ADDRESS || 'Endereço não definido';
const BARBERSHOP_MAPS_LINK = process.env.BARBERSHOP_MAPS_LINK || '';

// TZ único para todo o arquivo
const TZ = process.env.TZ || 'America/Sao_Paulo';

// Evita iniciar duas vezes se importado em loop
if (global.__CRON_SCHEDULED__) {
  console.log('[CRON] Já iniciado. Ignorando segundo start.');
  return;
}
global.__CRON_SCHEDULED__ = true;

// (opcional) Se alguém executar diretamente: alerta e encerra
if (require.main === module) {
  console.warn('[CRON] Este arquivo não deve ser executado diretamente. Inicie o servidor (server.js/app.js).');
  process.exit(1);
}

async function getConfig(key) {
  const config = await SystemConfig.findByPk(key);
  return config?.value || null;
}
async function getIntConfig(key, fallback) {
  const val = parseInt(await getConfig(key), 10);
  return Number.isFinite(val) ? val : fallback;
}

cron.schedule('*/5 * * * *', async () => {
  // Garante sessão WhatsApp
  let canSendWhatsApp = isWhatsAppEnabled() && isWhatsAppReady();
  if (isWhatsAppEnabled() && !canSendWhatsApp) {
    console.log('⏳ WhatsApp ainda não conectado; aguardando até 15s...');
    canSendWhatsApp = await waitWhatsAppReady(15000);
    if (!canSendWhatsApp) {
      console.log('⏭️ WhatsApp não conectou a tempo; pulando este ciclo.');
    }
  }

  // Usa TZ único
  const now = moment.tz(TZ);
  const reminderHours = await getIntConfig('reminderHoursBefore', 5); // default 5h antes
  const followUpHours = await getIntConfig('followUpHoursAfter', 2);  // default 2h depois
  const WINDOW_MIN = 5;

  console.log(`\n🔁 [CRON] Executando verificação - ${now.format('YYYY-MM-DD HH:mm:ss')} (TZ=${TZ})`);
  console.log(`⏰ Lembrete: ${reminderHours}h antes | 📬 Acompanhamento: ${followUpHours}h depois`);

  const appointments = await Appointment.findAll({
    where: {
      status: { [Op.in]: ['confirmed', 'in_progress'] },
      clientId: { [Op.ne]: null },
      barberId: { [Op.ne]: null }
    },
    attributes: [
      'id', 'appointmentDate', 'appointmentTime', 'status',
      'whatsappSent', 'reminderSent', 'followUpSent', 'serviceDuration'
    ],
    include: [
      { model: Client, as: 'client', attributes: ['firstName', 'phone'] },
      { model: Barber, as: 'barber', attributes: ['name'] },
      { model: ServiceType, as: 'serviceType', attributes: ['duration'] }
    ]
  });

  // Processar sequencialmente evita burst e limita bloqueios do WhatsApp
  for (const apt of appointments) {
    try {
      // Monta o datetime do agendamento com TZ fixo
      const datetime = moment.tz(
        `${apt.appointmentDate} ${apt.appointmentTime}`,
        ['YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD HH:mm'],
        TZ
      );

      if (!datetime.isValid()) {
        console.warn(`⚠️ Datetime inválido para apt ${apt.id}:`, apt.appointmentDate, apt.appointmentTime);
        continue;
      }

      const diffMin = datetime.diff(now, 'minutes');           // minutos até começar (pode ser negativo)
      const sinceStartMin = now.diff(datetime, 'minutes');     // minutos desde o início
      const duration = parseInt(apt.serviceType?.duration ?? apt.serviceDuration ?? 0, 10);
      const endTime = datetime.clone().add(Number.isFinite(duration) ? duration : 0, 'minutes');
      const sinceEndMin = now.diff(endTime, 'minutes');

      // === LEMBRETE (usa reminderSent, NÃO whatsappSent) ===
      const reminderTargetMin = reminderHours * 60;
      if (canSendWhatsApp &&
          !apt.reminderSent &&
          diffMin <= reminderTargetMin &&
          diffMin >= (reminderTargetMin - WINDOW_MIN)) {

        const firstName = (apt.client?.firstName || '').trim() || 'cliente';
        const barberName = (apt.barber?.name || '').trim() || 'nosso profissional';
        const hhmm = (apt.appointmentTime || '').slice(0, 5);

        const msg = `Olá, ${firstName}! 👋
Seu agendamento é hoje às ${hhmm} com ${barberName}. ✂️

📍 ${BARBERSHOP_NAME}
🗺 ${BARBERSHOP_MAPS_LINK}`.trim();

        const result = await sendWhatsAppMessage(apt.client.phone, msg);
       if (result?.ok) {
    await apt.update({
        reminderSent: true,
        whatsappAck: result.ack ?? null
    });
    console.log(`✅ Lembrete enviado para ${firstName} (ack=${result.ack ?? 'n/a'})`);
} else {
    console.warn(`⚠️ Lembrete FALHOU para ${firstName}`, result);
}
      }

      // === ENTRANDO EM ATENDIMENTO ===
      if (apt.status === 'confirmed' &&
          diffMin <= 0 && diffMin > -WINDOW_MIN) {
        await apt.update({ status: 'in_progress' });
        console.log(`🚀 Iniciado: ${apt.id} (${apt.client?.firstName || ''})`);
      }

      // === MARCAR COMO CONCLUÍDO ===
      if (apt.status === 'in_progress' &&
          sinceEndMin >= 0 && sinceEndMin < WINDOW_MIN) {
        await apt.update({ status: 'completed' });
        console.log(`✅ Concluído: ${apt.id} (${apt.client?.firstName || ''})`);
      }

      // === ACOMPANHAMENTO ===
      const followUpTargetMin = followUpHours * 60;
      if (canSendWhatsApp &&
          !apt.followUpSent &&
          sinceStartMin >= followUpTargetMin &&
          sinceStartMin < (followUpTargetMin + WINDOW_MIN)) {

        const firstName = (apt.client?.firstName || '').trim() || 'cliente';
        const msg = `Olá, ${firstName}! Esperamos que tenha gostado do serviço. Pode nos enviar seu feedback?`;

        const result = await sendWhatsAppMessage(apt.client.phone, msg);
        const delivered = (typeof result === 'object') ? !!result.delivered : !!result;

        if (delivered) {
          await apt.update({ followUpSent: true });
          const ack = (typeof result === 'object') ? result.ack : undefined;
          console.log(`📬 Acompanhamento ENTREGUE${ack != null ? ` (ack=${ack})` : ''} para ${firstName}`);
        } else {
          console.warn(`⚠️ Acompanhamento NÃO entregue para ${firstName}`, result);
        }
      }
    } catch (err) {
      console.error(`❌ Erro ao processar agendamento ID ${apt.id}`, err);
    }
  }

  await cleanupExpiredCodes();
  console.log(`✅ [CRON] Ciclo concluído com ${appointments.length} agendamentos verificados.`);
}, { timezone: TZ });

console.log('[🕒 CRON] Agendado para rodar a cada 5 minutos.');
