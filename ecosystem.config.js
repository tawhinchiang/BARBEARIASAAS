module.exports = {
  apps: [
    {
      name: 'barbershop-app',
      script: 'server.js',
      instances: 1,               // garanta 1 instância
      exec_mode: 'fork',          // evite cluster pra não duplicar cron
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
    // REMOVIDO: barbershop-cron
  ]
};
