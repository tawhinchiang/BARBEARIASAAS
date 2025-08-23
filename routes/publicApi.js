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

module.exports = router;
