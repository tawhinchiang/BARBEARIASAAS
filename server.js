// server.js
require('dotenv').config();

const { syncDatabase } = require('./models');
const { initializeWhatsApp } = require('./utils/whatsapp');
const app = require('./app');

const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

async function startServer() {
  try {
    // 1) Banco primeiro (se falhar, encerra)
    const dbConnected = await syncDatabase();
    if (!dbConnected) {
      console.error('[BOOT] Falha ao conectar com o banco de dados');
      process.exit(1);
    }

    // 2) Cria HTTP server e socket.io
    const server = http.createServer(app);

    const io = new Server(server, {
      cors: {
        origin: [
          'https://barbeariamarinho.agendastudios.com.br',
          'https://www.barbeariamarinho.agendastudios.com.br',
          'http://64.227.83.125:3000'
        ]
      }
    });

    app.set('io', io);

    io.on('connection', (socket) => {
      console.log('🟢 Cliente conectado ao socket:', socket.id);
      socket.on('disconnect', () => {
        console.log('🔴 Cliente desconectado:', socket.id);
      });
    });

    // 3) Sobe o HTTP IMEDIATAMENTE (não bloqueie esperando WhatsApp)
    console.log('[BOOT] Iniciando server.listen...');
    server.listen(PORT, HOST, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
      // console.log(`Acesse: http://localhost:${PORT}`);
      // console.log(`Admin: http://localhost:${PORT}/admin/login`);
    });

    // 4) Inicializa WhatsApp e CRON em background
    (async () => {
      try {
        console.log('[BOOT] Inicializando WhatsApp em background...');
        await initializeWhatsApp();
      } catch (err) {
        console.error('[BOOT] Falha ao inicializar WhatsApp (app continua):', err?.message || err);
      }
    })();

    if (!global.__CRON_STARTED__) {
      global.__CRON_STARTED__ = true;
      require('./worker/cronScheduler'); // agenda os jobs
    }

    // 5) Tratamento de erros globais (não derrubar o processo sem log)
    process.on('unhandledRejection', (err) => {
      console.error('[UNHANDLED REJECTION]', err);
    });
    process.on('uncaughtException', (err) => {
      console.error('[UNCAUGHT EXCEPTION]', err);
    });

    // 6) Finalização graciosa do HTTP (PM2 gerencia o ciclo de vida)
    const isPM2 = !!process.env.pm_id;
    ['SIGINT', 'SIGTERM', 'SIGHUP'].forEach((sig) => {
      process.on(sig, () => {
        console.log(`[BOOT] Sinal ${sig} recebido — encerrando HTTP...`);
        server.close(() => {
          console.log('[BOOT] HTTP fechado.');
          if (!isPM2) process.exit(0);
          // sob PM2, deixe ele encerrar o processo
        });
      });
    });

  } catch (error) {
    console.error('Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

startServer();
