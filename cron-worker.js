// cron-worker.js

/**
 * Worker dedicado para agendamento automático de tarefas cron.
 * Este processo deve ser executado separadamente do servidor principal.
 * 
 * Exemplo:
 *   npm run cron
 *   ou
 *   pm2 start cron-worker.js --name barbershop-cron
 */

require('dotenv').config();

// Log inicial
console.log('[🧠 CRON WORKER] Iniciando processo de agendamento...');

// Inicializar conexão com o banco de dados
const { syncDatabase } = require('./models');

(async () => {
  const connected = await syncDatabase();
  if (!connected) {
    console.error('[❌ CRON WORKER] Falha ao conectar com o banco de dados. Encerrando...');
    process.exit(1);
  }

  // Iniciar cron
  require('./worker/cronScheduler');
})();
