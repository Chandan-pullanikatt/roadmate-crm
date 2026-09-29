module.exports = {
  apps: [
    {
      name: 'roadmate-server',
      script: 'src/index.js',

      // One process only. Every process runs its own node-cron jobs, so N
      // processes send every reminder N times and double-run the attendance
      // sweeps; and Socket.io events emitted in one process never reach users
      // connected to another. Scaling out needs a job lock and a Socket.io
      // adapter (e.g. Redis) first.
      instances: 1,
      exec_mode: 'fork',

      // Restart automatically if the process crashes
      autorestart: true,
      watch: false,

      // Restart if memory exceeds 500 MB (guards against leaks)
      max_memory_restart: '500M',

      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },

      // Log rotation paths (PM2 log-rotate plugin handles rotation)
      error_file: 'logs/err.log',
      out_file:   'logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Graceful shutdown: wait up to 5 s for in-flight requests to finish
      kill_timeout: 5000,
      listen_timeout: 10000,
    },
  ],
};
