module.exports = {
  apps: [
    {
      name: 'barbershop-app',
      script: 'server.js',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'barbershop-cron',
      script: 'cron-worker.js',
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
