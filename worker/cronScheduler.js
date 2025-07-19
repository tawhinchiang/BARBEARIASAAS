const cron = require('node-cron');
require('dotenv').config();
const moment = require('moment');
const { Appointment, Client, Barber, ServiceType, SystemConfig } = require('../models');
const { sendWhatsAppMessage } = require('../utils/whatsapp');

// Variáveis da barbearia via .env
const BARBERSHOP_NAME = process.env.BARBERSHOP_NAME || 'Barbearia';
const BARBERSHOP_ADDRESS = process.env.BARBERSHOP_ADDRESS || 'Endereço não definido';
const BARBERSHOP_MAPS_LINK = process.env.BARBERSHOP_MAPS_LINK || '';

async function getConfig(key) {
  const config = await SystemConfig.findByPk(key);
  return config?.value || null;
}

cron.schedule('*/5 * * * *', async () => {
  const now = moment();
  const reminderHours = parseInt(await getConfig('reminderHoursBefore'), 10);
  const followUpHours = parseInt(await getConfig('followUpHoursAfter'), 10);

  console.log(`\n🔁 [CRON] Executando verificação - ${now.format('YYYY-MM-DD HH:mm:ss')}`);
  console.log(`⏰ Lembrete: ${reminderHours}h antes | 📬 Acompanhamento: ${followUpHours}h depois`);

  const appointments = await Appointment.findAll({
    where: { status: 'confirmed' },
    include: ['client', 'barber', 'serviceType']
  });

  for (const apt of appointments) {
    const datetime = moment(`${apt.appointmentDate}T${apt.appointmentTime}`);
    const diffInHours = datetime.diff(now, 'hours', true);
    const hoursSince = now.diff(datetime, 'hours', true);

    // === ENVIO DE LEMBRETE ===
    if (!apt.whatsappSent && diffInHours <= reminderHours && diffInHours > reminderHours - 1) {
      const msg = `Olá, ${apt.client.firstName}! Lembrete: seu agendamento é hoje às ${apt.appointmentTime} com ${apt.barber.name}.
📍 Endereço: ${BARBERSHOP_NAME} - ${BARBERSHOP_ADDRESS}
🗺️ Localização: ${BARBERSHOP_MAPS_LINK}`;
      
      const sent = await sendWhatsAppMessage(apt.client.phone, msg);

      if (sent) {
        await apt.update({ whatsappSent: true });
        console.log(`✅ Lembrete enviado para ${apt.client.firstName} (${apt.client.phone})`);
      } else {
        console.warn(`⚠️ Falha ao enviar lembrete para ${apt.client.firstName} (${apt.client.phone})`);
      }
    }

    // === ENVIO DE ACOMPANHAMENTO ===
    if (!apt.followUpSent && hoursSince >= followUpHours && hoursSince < followUpHours + 0.1) {
      const msg = `Olá, ${apt.client.firstName}! Esperamos que tenha gostado do serviço. Deixe seu feedback!`;
      const sent = await sendWhatsAppMessage(apt.client.phone, msg);

      if (sent) {
        await apt.update({ followUpSent: true });
        console.log(`📬 Acompanhamento enviado para ${apt.client.firstName} (${apt.client.phone})`);
      } else {
        console.warn(`⚠️ Falha ao enviar acompanhamento para ${apt.client.firstName} (${apt.client.phone})`);
      }
    }
  }

  console.log(`✅ [CRON] Ciclo concluído com ${appointments.length} agendamentos verificados.`);
});

console.log('[🕒 CRON] Agendado para rodar a cada 5 minutos.');
