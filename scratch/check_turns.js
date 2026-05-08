const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkTurns() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT id, cajero_nombre, abierto_at, cerrado_at, 
             (SELECT COUNT(*) FROM pedidos p WHERE p.created_at >= t.abierto_at AND p.created_at <= COALESCE(t.cerrado_at, NOW())) as approximate_orders
      FROM caja_turno t
      WHERE cerrado_at IS NULL
      ORDER BY abierto_at DESC
    `);
    console.log('Open turns:');
    console.table(res.rows);
  } finally {
    client.release();
    await pool.end();
  }
}

checkTurns();
