require('dotenv').config({ path: '.env.local' });
require('dotenv').config();
const db = require('./db');

async function run() {
    try {
        console.log('Adding descuento_porcentaje column to pedidos table...');
        await db.query('ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS descuento_porcentaje INTEGER DEFAULT 0');
        console.log('Migration OK');
    } catch (e) {
        console.error('Migration failed:', e);
    }
    process.exit(0);
}

run();
