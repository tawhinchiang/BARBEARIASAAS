const { syncDatabase } = require('./models');
const { initializeWhatsApp } = require('./utils/whatsapp');
const app = require('./app');
const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    const dbConnected = await syncDatabase();
    if (!dbConnected) {
      console.error('Falha ao conectar com o banco de dados');
      process.exit(1);
    }

    // Criar servidor HTTP manualmente
    const server = http.createServer(app);

    // Iniciar socket.io e injetar no app
    const io = new Server(server, {
      cors: {
        origin: '*', // ou coloque o domínio correto
      }
    });

    // Disponibilizar o socket.io para o app inteiro
    app.set('io', io);

    // (Opcional) Log para verificar conexões socket
    io.on('connection', (socket) => {
      console.log('🟢 Cliente conectado ao socket:', socket.id);

      socket.on('disconnect', () => {
        console.log('🔴 Cliente desconectado:', socket.id);
      });
    });

    // Inicializar WhatsApp e cron jobs
    await initializeWhatsApp();
    if (!global.__CRON_STARTED__) {
  global.__CRON_STARTED__ = true;
  require('./worker/cronScheduler'); // inicia seus schedules
}

    // Iniciar servidor com suporte a WebSocket
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Servidor rodando na porta ${PORT}`);
      console.log(`Acesse: http://localhost:${PORT}`);
      console.log(`Admin: http://localhost:${PORT}/admin/login`);
    });

  } catch (error) {
    console.error('Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

startServer();
