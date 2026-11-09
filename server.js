require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');
const { syncDatabase } = require('./models');
const { initializeWhatsApp, isWhatsAppEnabled } = require('./utils/whatsapp');
const app = require('./app');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

async function startServer() {
  try {
    const dbConnected = await syncDatabase();
    if (!dbConnected) {
      console.error('[BOOT] Falha ao conectar com o banco de dados');
      process.exit(1);
    }

    const server = http.createServer(app);
    const allowedCorsOrigins = process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
      : (process.env.BASE_URL ? [process.env.BASE_URL] : true);

    const io = new Server(server, {
      cors: {
        origin: allowedCorsOrigins,
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    app.set('io', io);
    io.on('connection', (socket) => {
      socket.on('disconnect', () => {});
    });

    server.listen(PORT, HOST, () => {
      console.log(`[BOOT] Servidor rodando em http://127.0.0.1:${PORT}`);
      console.log(`[BOOT] Admin: http://127.0.0.1:${PORT}/admin/login`);
    });

    if (isWhatsAppEnabled()) {
      initializeWhatsApp().catch((err) => {
        console.error('[BOOT] WhatsApp não inicializado:', err?.message || err);
      });
    }

    if (!global.__CRON_STARTED__) {
      global.__CRON_STARTED__ = true;
      try { require('./worker/cronScheduler'); } catch (err) {
        console.warn('[BOOT] Cron não iniciado:', err?.message || err);
      }
    }

    process.on('unhandledRejection', (err) => console.error('[UNHANDLED REJECTION]', err));
    process.on('uncaughtException', (err) => console.error('[UNCAUGHT EXCEPTION]', err));

    ['SIGINT', 'SIGTERM'].forEach((sig) => {
      process.on(sig, () => server.close(() => process.exit(0)));
    });
  } catch (error) {
    console.error('Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

startServer();
