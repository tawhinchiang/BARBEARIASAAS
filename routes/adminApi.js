const express = require('express');
const router = express.Router();
const {
  getWhatsAppStatus,
  disconnectWhatsApp,
  initializeWhatsApp
} = require('../utils/whatsapp');
const { Appointment, Client, Barber, ServiceType } = require('../models');
const { isAuthenticatedApi } = require('../middleware/auth');

router.use(isAuthenticatedApi);

// GET /admin/appointments/:id
router.get('/appointments/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ success: false, error: 'ID inválido' });
  }

  try {
    const appointment = await Appointment.findByPk(id, {
      include: [
        { model: Client, as: 'client' },
        { model: Barber, as: 'barber' },
        { model: ServiceType, as: 'serviceType' }
      ]
    });

    if (!appointment) return res.status(404).json({ success: false, error: 'Agendamento não encontrado' });

    res.json({ success: true, appointment });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PUT /admin/appointments/:id
router.put('/appointments/:id', async (req, res) => {
  try {
    const { appointmentDate, appointmentTime, serviceTypeId, barberId } = req.body;
    const appointment = await Appointment.findByPk(req.params.id);

    if (!appointment) return res.status(404).json({ success: false, message: 'Agendamento não encontrado' });

    appointment.appointmentDate = appointmentDate;
    appointment.appointmentTime = appointmentTime;
    appointment.serviceTypeId = serviceTypeId;
    appointment.barberId = barberId;

    // Atualiza também o preço e duração com base no novo serviço
    const service = await ServiceType.findByPk(serviceTypeId);
    if (service) {
      appointment.totalPrice = service.price;
      appointment.serviceDuration = service.duration;
    }

    await appointment.save();

    res.json({ success: true, message: 'Agendamento atualizado com sucesso' });
  } catch (error) {
    console.error('[ADMIN API ERROR] Erro ao atualizar agendamento:', error);
    res.status(500).json({ success: false, message: 'Erro interno ao atualizar agendamento' });
  }
});

// POST /admin/appointments/:id/whatsapp
router.post('/appointments/:id/whatsapp', async (req, res) => {
  try {
    // Lógica para enviar WhatsApp
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno' });
  }
});
// Bloquear horário manualmente
router.post('/appointments/block', async (req, res) => {
  try {
    const { barberId, appointmentDate, appointmentTime, reason } = req.body;

    if (!barberId || !appointmentDate || !appointmentTime) {
      return res.status(400).json({ success: false, error: 'Campos obrigatórios: barbeiro, data e hora' });
    }

    const { Appointment } = require('../models');

    const appointment = await Appointment.create({
      barberId,
      appointmentDate,
      appointmentTime,
      clientId: null,
      serviceTypeId: null,
      serviceDuration: 20, // pode usar default do sistema
      totalPrice: 0,
      status: 'blocked',
      isBlock: true,
      blockReason: reason || null
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('appointment_blocked', {
        id: appointment.id,
        time: appointment.appointmentTime,
        date: appointment.appointmentDate,
        barberId
      });
    }

    return res.json({ success: true, appointment });
  } catch (err) {
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(400).json({
      success: false,
      error: 'Horário já está bloqueado.'
    });
  }
  console.error('[ADMIN API] Erro ao bloquear horário:', err);
  return res.status(500).json({ success: false, error: 'Erro interno' });
}
});

// POST /admin/appointments/:id/cancel
router.post('/appointments/:id/cancel', async (req, res) => {
  try {
    const appointment = await Appointment.findByPk(req.params.id, {
      include: [{ model: Client, as: 'client' }]
    });

    if (!appointment) return res.status(404).json({ error: 'Agendamento não encontrado' });

    appointment.status = 'cancelled';
    await appointment.save();

    const io = req.app.get('io'); // necessário para emitir evento via socket
    io.emit('appointment_cancelled', {
      id: appointment.id,
      client: `${appointment.client?.firstName || ''} ${appointment.client?.lastName || ''}`.trim(),
      time: appointment.appointmentTime,
      date: appointment.appointmentDate
    });
    console.log('[ADMIN API] Emitindo cancelamento via socket:', appointment.id);
    // if (!io) {
    //   console.error('[SOCKET.IO] io está indefinido');
    // } else {
    //   console.log('[SOCKET.IO] Emitindo appointment_cancelled');
    //   io.emit('appointment_cancelled', {
    //     id: appointment.id,
    //     client: `${appointment.client.firstName} ${appointment.client.lastName}`,
    //     time: appointment.appointmentTime,
    //     date: appointment.appointmentDate
    //   });
    // }

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// DELETE /admin/appointments/:id/unblock
router.delete('/appointments/:id/unblock', async (req, res) => {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findByPk(id);

    if (!appointment) {
      return res.status(404).json({ success: false, error: 'Agendamento não encontrado' });
    }

    if (appointment.status !== 'blocked') {
      return res.status(400).json({ success: false, error: 'Este agendamento não está bloqueado' });
    }

    await appointment.destroy(); // remove do banco
    const io = req.app.get('io');
    if (io) {
      io.emit('appointment_unblocked', {
        id,
        barberId: appointment.barberId,
        date: appointment.appointmentDate,
        time: appointment.appointmentTime
      });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[ADMIN API] Erro ao desbloquear horário:', err);
    return res.status(500).json({ success: false, error: 'Erro interno ao desbloquear horário' });
  }
});

// DELETE /admin/appointments/:id
router.delete('/appointments/:id', async (req, res) => {
  try {
    const deletedCount = await Appointment.destroy({ where: { id: req.params.id } });
    if (!deletedCount) return res.status(404).json({ error: 'Agendamento não encontrado' });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// === WHATSAPP ADMIN API ===

// Status atual (connectado/QR)
router.get('/whatsapp/status', async (req, res) => {
  try {
    const status = getWhatsAppStatus();
    return res.json({ success: true, ...status });
  } catch (e) {
    console.error('[ADMIN API] /whatsapp/status erro:', e);
    return res.status(500).json({ success: false, error: 'Falha ao obter status do WhatsApp' });
  }
});

// Logout completo + reinit esperando QR novo por até 10s
router.post('/whatsapp/logout', async (req, res) => {
  try {
    // logout MANUAL (marca 'manual' para não re-inicializar duas vezes)
    await disconnectWhatsApp({ keepSession: false, manual: true });

    // reinit imediato (em vez de esperar 'disconnected')
    await initializeWhatsApp();

    // espera até 10s por um QR novo
    const started = Date.now();
    while ((Date.now() - started) < 10000) {
      const status = getWhatsAppStatus();
      if (!status.isConnected && status.qrCode) {
        return res.json({ success: true, qr: status.qrCode, message: 'QR gerado' });
      }
      await new Promise(r => setTimeout(r, 300));
    }

    // sem QR a tempo: front deve continuar polling
    return res.json({ success: true, qr: null, message: 'Reinicializado; aguarde QR via polling' });

  } catch (e) {
    console.error('[ADMIN API] /whatsapp/logout erro:', e);
    return res.status(500).json({ success: false, error: 'Falha ao reiniciar WhatsApp' });
  }
});

// (Opcional) Reinicialização mantendo sessão local
router.post('/whatsapp/restart', async (req, res) => {
  try {
    await disconnectWhatsApp({ keepSession: true, manual: true });
    await initializeWhatsApp();
    return res.json({ success: true, message: 'WhatsApp reinicializando' });
  } catch (e) {
    console.error('[ADMIN API] /whatsapp/restart erro:', e);
    return res.status(500).json({ success: false, error: 'Falha ao reinicializar' });
  }
});

module.exports = router;
