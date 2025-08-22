module.exports = {
  apps: [
    {
      name: 'barbershop-app',
      script: 'server.js',           
      instances: 1,                  
      exec_mode: 'fork',            
      watch: false,                  
      autorestart: true,
      max_memory_restart: '300M',   
      restart_delay: 4000,           
      exp_backoff_restart_delay: 100, 
      kill_timeout: 8000,            
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        NODE_OPTIONS: '--max-old-space-size=256',
        WHATSAPP_CHROME_BIN: '/usr/bin/google-chrome-stable' // limita V8
      }
    }
  ]
};
