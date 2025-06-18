const { syncDatabase } = require('./models');
const { initializeWhatsApp } = require('./utils/whatsapp');
const app = require('./app');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Sincronizar banco de dados
    const dbConnected = await syncDatabase();
    if (!dbConnected) {
      console.error('Falha ao conectar com o banco de dados');
      process.exit(1);
    }

    // Inicializar WhatsApp
    await initializeWhatsApp();

    // Iniciar servidor
    app.listen(PORT, '0.0.0.0', () => {
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

