const express = require('express');
const router = express.Router();
const { Barber } = require('../models');
const VerificationCode = require('../models/VerificationCode');

router.get('/barbers', async (req, res) => {
  try {
    const barbers = await Barber.findAll({
      where: { isActive: true },
      order: [['name', 'ASC']]
    });

    res.json({
      count: barbers.length,
      barbers: barbers.map(b => ({
        id: b.id,
        name: b.name,
        photo: b.photo || null,
        specialties: b.specialties || 'Especialista',
        workingHours: b.workingHours || {}
      }))
    });
  } catch (error) {
    console.error('[PUBLIC API] Erro ao buscar barbeiros:', error);
    res.status(500).json({ error: 'Erro interno ao buscar barbeiros' });
  }
});
router.post('/log-touch', async (req, res) => {
  const log = {
    time: new Date().toISOString(),
    selector: req.body.selector,
    userAgent: req.body.userAgent,
    platform: req.body.platform,
  };

  console.log('[TOUCH LOG] Interação detectada:', log);
  res.json({ ok: true });
});


module.exports = router;
