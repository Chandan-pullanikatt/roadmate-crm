module.exports = {
  apps: [
    {
      name: 'roadmate-server',
      script: 'src/index.js',

      // Cluster mode: one process per CPU core — maximises throughput
      instances: 'max',
      exec_mode: 'cluster',

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
