const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function cleanup() {
  const client = await pool.connect();
  try {
    console.log('--- Resumen de Turnos Abiertos ---');
    const res = await client.query(`
      SELECT id, cajero_nombre, abierto_at,
             (SELECT COUNT(*) FROM pedidos p WHERE p.created_at >= t.abierto_at AND p.created_at <= NOW()) as order_count
      FROM caja_turno t
      WHERE cerrado_at IS NULL
      ORDER BY abierto_at DESC
    `);
    
    if (res.rows.length <= 1) {
      console.log('No hay turnos duplicados que limpiar.');
      return;
    }

    console.table(res.rows);

    // El plan: cerrar todos los turnos que tengan 0 órdenes, 
    // y para los que tengan órdenes, dejar solo el más reciente (o avisar).
    // Para simplificar esta emergencia: cerraremos los turnos más RECIENTES que estén vacíos,
    // permitiendo que el turno anterior (que sí tiene órdenes) vuelva a ser el "activo".

    const emptyTurns = res.rows.filter(r => parseInt(r.order_count) === 0).map(r => r.id);
    
    if (emptyTurns.length > 0) {
      console.log(`Cerrando ${emptyTurns.length} turnos vacíos: ${emptyTurns.join(', ')}...`);
      await client.query('UPDATE caja_turno SET cerrado_at = NOW() WHERE id = ANY($1)', [emptyTurns]);
      console.log('✅ Turnos vacíos cerrados.');
    }

    // Volver a revisar
    const finalRes = await client.query('SELECT id, order_count FROM (SELECT id, (SELECT COUNT(*) FROM pedidos p WHERE p.created_at >= t.abierto_at AND p.created_at <= NOW()) as order_count FROM caja_turno t WHERE cerrado_at IS NULL) sub');
    console.log('\nEstado final de turnos abiertos:');
    console.table(finalRes.rows);

  } catch (e) {
    console.error('Error:', e);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanup();
