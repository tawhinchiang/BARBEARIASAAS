const express = require('express');
const router = express.Router();

const { Appointment, Client, Barber, ServiceType } = require('../models');
const { isAuthenticatedApi } = require('../middleware/auth');

router.use(isAuthenticatedApi);

// GET /admin/appointments/:id
router.get('/appointments/:id', async (req, res) => {
  try {
    const appointment = await Appointment.findByPk(req.params.id, {
      include: [
        { model: Client, as: 'client' },
        { model: Barber, as: 'barber' },
        { model: ServiceType, as: 'serviceType' }
      ]
    });
    if (!appointment) return res.status(404).json({ error: 'Agendamento não encontrado' });
    res.json(appointment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno' });
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

// POST /admin/appointments/:id/cancel
router.post('/appointments/:id/cancel', async (req, res) => {
  try {
    const appointment = await Appointment.findByPk(req.params.id);
    if (!appointment) return res.status(404).json({ error: 'Agendamento não encontrado' });
    appointment.status = 'cancelled';
    await appointment.save();
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno' });
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


module.exports = router;
