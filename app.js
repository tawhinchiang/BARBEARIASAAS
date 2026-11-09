const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config();

const { corsLogger, additionalSecurityValidation, createCorsConfig } = require('./config/cors-config');
const { securityHeaders, attackDetection, blockScanners } = require('./middleware/security');

const app = express();
app.set('trust proxy', 1);
app.use(securityHeaders);
app.use(corsLogger);
app.use(additionalSecurityValidation);
app.use(cors(createCorsConfig('default')));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));

app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  etag: true,
}));

app.use(attackDetection);
app.use(blockScanners);

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api', cors(createCorsConfig('public')), require('./routes/publicApi'));
app.use('/', require('./routes/appointments'));

const sendDashboard = (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
};

['/', '/dashboard', '/agenda', '/profissionais', '/servicos', '/faturamento', '/people', '/time-off', '/hiring', '/payroll'].forEach(p => app.get(p, sendDashboard));

app.use((req, res) => {
  if (req.path.startsWith('/api/') || (req.headers.accept || '').includes('application/json')) {
    return res.status(404).json({ error: 'Not Found' });
  }
  return sendDashboard(req, res);
});

app.use((err, req, res, _next) => {
  const status = err.status || 500;
  if (req.path.startsWith('/api/') || (req.headers.accept || '').includes('application/json')) {
    return res.status(status).json({ error: err.message || 'Internal Server Error' });
  }
  return res.status(status).send(err.message || 'Internal Server Error');
});

module.exports = app;
