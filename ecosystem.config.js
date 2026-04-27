module.exports = {
  apps: [
    {
      name: 'capriccio-api',
      script: 'server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 3081,
      }
    },
    {
      name: 'capriccio-web',
      script: 'node_modules/.bin/next',
      args: 'start -p 3080',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3080,
      }
    },
    {
      name: 'n8n',
      script: '/usr/bin/n8n',
      args: 'start',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        N8N_PORT: 5678,
        N8N_HOST: '0.0.0.0',
        N8N_PROTOCOL: 'https',
        N8N_EDITOR_BASE_URL: 'https://capricciopizzeria.com/n8n/',
        N8N_PATH: '/n8n/',
        DB_TYPE: 'postgresdb',
        DB_POSTGRESDB_HOST: 'localhost',
        DB_POSTGRESDB_PORT: 5432,
        DB_POSTGRESDB_DATABASE: 'capriccio_db',
        DB_POSTGRESDB_USER: 'capriccio',
        DB_POSTGRESDB_PASSWORD: 'CAP_DB_PASS_2026',
        DB_POSTGRESDB_SCHEMA: 'n8n',
        N8N_BASIC_AUTH_ACTIVE: 'true',
        N8N_BASIC_AUTH_USER: 'admin',
        N8N_BASIC_AUTH_PASSWORD: 'Capriccio2026!',
        WEBHOOK_URL: 'https://capricciopizzeria.com/n8n/',
        GENERIC_TIMEZONE: 'America/Mexico_City',
        N8N_LOG_LEVEL: 'warn',
        N8N_PROXY_HOPS: '1',
        N8N_RUNNERS_DISABLED: 'true',
      }
    }
  ]
};
