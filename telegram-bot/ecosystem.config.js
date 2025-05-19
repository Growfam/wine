module.exports = {
  apps: [{
    name: 'winix-telegram-bot',
    script: 'bot.js',
    cwd: './telegram-bot',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      BACKEND_URL: 'https://winixbot.com',
      FRONTEND_URL: 'https://winixbot.com'
    },
    env_development: {
      NODE_ENV: 'development',
      BACKEND_URL: 'http://localhost:8080',
      FRONTEND_URL: 'http://localhost:3000'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: 2000
  }]
};
