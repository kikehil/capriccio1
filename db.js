const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('connect', () => console.log('✅ Conectado a PostgreSQL'));
pool.on('error', (err) => console.error('❌ Pool error:', err.message));

module.exports = {
  query: async (text, params = []) => {
    try {
      const result = await pool.query(text, params);
      return { rows: result.rows, rowCount: result.rowCount };
    } catch (e) {
      console.error('PG ERROR:', e.message, '\nQUERY:', text);
      throw e;
    }
  },
  getTransaction: async () => {
    const client = await pool.connect();
    await client.query('BEGIN');
    return {
      client: {
        query: async (text, params = []) => {
          const result = await client.query(text, params);
          return { rows: result.rows, rowCount: result.rowCount };
        }
      },
      release: () => client.release(),
      begin:    async () => {},
      commit:   async () => { await client.query('COMMIT');   client.release(); },
      rollback: async () => { await client.query('ROLLBACK'); client.release(); }
    };
  },
  pool
};
