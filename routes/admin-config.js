const express = require('express');
const router = express.Router();
const { SystemConfig } = require('../models');
const { isAuthenticated } = require('../middleware/auth');

router.use(isAuthenticated);

router.get('/', async (req, res) => {
  const configs = await SystemConfig.findAll();
  const configMap = {};
  configs.forEach(c => configMap[c.key] = c.value);

  const success = req.query.success === '1';

  res.render('admin/config', {
    title: 'Configurações do Sistema',
    layout: 'admin',
    config: configMap,
    success
  });
});

router.post('/', async (req, res) => {
  const keys = ['reminderHoursBefore', 'followUpHoursAfter'];

  for (const key of keys) {
    const value = req.body[key];
    await SystemConfig.upsert({ key, value });
  }

  res.redirect('/admin/config?success=1');
});

module.exports = router;
