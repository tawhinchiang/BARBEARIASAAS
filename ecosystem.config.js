module.exports = {
  apps: [
    {
      name: 'barbershop-app',
      script: "./server.js",
      cwd: "/root/BARBEARIASAAS",          // ← GARANTE caminhos relativos
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      time: true,
      merge_logs: true,
      out_file: '/var/log/barbershop/out.log',
      error_file: '/var/log/barbershop/error.log',
      autorestart: true,
      max_memory_restart: '0',
      restart_delay: 4000,
      exp_backoff_restart_delay: 2000,
      kill_timeout: 8000,
      wait_ready: false,                   // ← evite kill por timeout
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        TZ: 'America/Sao_Paulo'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        TZ: 'America/Sao_Paulo',
        LANG: 'pt_BR.UTF-8',
        LC_ALL: 'pt_BR.UTF-8',
        NODE_OPTIONS: '--max-old-space-size=512',
        PUPPETEER_SKIP_CHROMIUM_DOWNLOAD: '0',
        PUPPETEER_CACHE_DIR: '/root/.cache/puppeteer',
        FORCE_PUPPETEER: '1'
      }
    }
  ]
};
