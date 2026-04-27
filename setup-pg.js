/**
 * setup-pg.js — Inicializa la base de datos PostgreSQL local
 * Uso: node setup-pg.js
 */
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function setup() {
  const client = await pool.connect();
  try {
    console.log('✅ Conectado a PostgreSQL');

    // ── negocios ──────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS negocios (
        id SERIAL PRIMARY KEY,
        nombre TEXT NOT NULL DEFAULT 'Capriccio Pizzeria',
        plan TEXT NOT NULL DEFAULT 'premium',
        fecha_alta TIMESTAMP DEFAULT NOW(),
        ultimo_corte_turno TIMESTAMP
      )
    `);
    console.log('✅ negocios');

    const negocioExiste = await client.query("SELECT id FROM negocios LIMIT 1");
    if (negocioExiste.rows.length === 0) {
      await client.query("INSERT INTO negocios (nombre, plan) VALUES ('Capriccio Pizzeria', 'premium')");
      console.log('   → negocio creado');
    }

    // ── usuarios ──────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        nombre_completo TEXT,
        negocio_id INTEGER DEFAULT 1 REFERENCES negocios(id),
        activo INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ usuarios');

    const adminPass = await bcrypt.hash('CapriccioAdmin2026!', 10);
    const cocinaPass = await bcrypt.hash('CocinaCap2026!', 10);
    const cajaPass   = await bcrypt.hash('CajaCap2026!', 10);

    const users = [
      { username: 'admin',  password: adminPass,  role: 'admin',  nombre: 'Administrador' },
      { username: 'cocina', password: cocinaPass, role: 'cocina', nombre: 'Cocina' },
      { username: 'caja',   password: cajaPass,   role: 'caja',   nombre: 'Cajero' },
    ];
    for (const u of users) {
      try {
        await client.query(
          'INSERT INTO usuarios (username, password, role, nombre_completo) VALUES ($1,$2,$3,$4)',
          [u.username, u.password, u.role, u.nombre]
        );
        console.log(`   → usuario '${u.username}' creado`);
      } catch (e) {
        if (e.code === '23505') console.log(`   → usuario '${u.username}' ya existe`);
        else throw e;
      }
    }

    // ── productos ─────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS productos (
        id SERIAL PRIMARY KEY,
        nombre TEXT NOT NULL,
        descripcion TEXT,
        precio NUMERIC(10,2),
        imagen TEXT,
        categoria TEXT,
        activo INTEGER DEFAULT 1,
        precios TEXT
      )
    `);
    console.log('✅ productos');

    // ── pedidos ───────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS pedidos (
        id SERIAL PRIMARY KEY,
        order_id TEXT UNIQUE NOT NULL,
        cliente_nombre TEXT,
        telefono TEXT,
        direccion TEXT,
        referencias TEXT,
        total NUMERIC(10,2),
        lat NUMERIC(10,7),
        lng NUMERIC(10,7),
        negocio_id INTEGER DEFAULT 1,
        telefono_cliente TEXT,
        metodo_entrega TEXT DEFAULT 'domicilio',
        status TEXT DEFAULT 'recibido',
        repartidor TEXT,
        liquidado INTEGER DEFAULT 0,
        liquidado_por TEXT,
        liquidado_at TIMESTAMP,
        delivered_at TIMESTAMP,
        asignado_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        calificacion INTEGER DEFAULT 0,
        calificacion_comentario TEXT,
        facturado INTEGER DEFAULT 0,
        factura_uuid TEXT,
        facturado_at TIMESTAMP,
        order_origin TEXT DEFAULT 'web',
        cajero_id INTEGER,
        cajero_nombre TEXT,
        payment_method TEXT,
        monto_recibido NUMERIC(10,2),
        pagado_at TIMESTAMP
      )
    `);
    console.log('✅ pedidos');

    // ── detalle_pedidos ───────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS detalle_pedidos (
        id SERIAL PRIMARY KEY,
        pedido_id INTEGER REFERENCES pedidos(id) ON DELETE CASCADE,
        pizza_nombre TEXT,
        cantidad INTEGER,
        precio_unitario NUMERIC(10,2),
        size TEXT,
        crust TEXT
      )
    `);
    console.log('✅ detalle_pedidos');

    // ── extras_pedidos ────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS extras_pedidos (
        id SERIAL PRIMARY KEY,
        detalle_id INTEGER REFERENCES detalle_pedidos(id) ON DELETE CASCADE,
        extra_nombre TEXT,
        precio_extra NUMERIC(10,2)
      )
    `);
    console.log('✅ extras_pedidos');

    // ── promociones ───────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS promociones (
        id SERIAL PRIMARY KEY,
        titulo TEXT,
        subtitulo TEXT,
        precio NUMERIC(10,2),
        color TEXT,
        imagen TEXT,
        badge TEXT,
        activo INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ promociones');

    // ── caja_turno ────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS caja_turno (
        id SERIAL PRIMARY KEY,
        cajero_id INTEGER,
        cajero_nombre TEXT,
        negocio_id INTEGER DEFAULT 1,
        efectivo_inicial NUMERIC(10,2) DEFAULT 0,
        abierto_at TIMESTAMP DEFAULT NOW(),
        cerrado_at TIMESTAMP,
        total_efectivo NUMERIC(10,2) DEFAULT 0,
        total_tarjeta NUMERIC(10,2) DEFAULT 0,
        total_transferencia NUMERIC(10,2) DEFAULT 0,
        total_general NUMERIC(10,2) DEFAULT 0,
        monto_entregado NUMERIC(10,2),
        diferencia NUMERIC(10,2)
      )
    `);
    console.log('✅ caja_turno');

    // ── caja_pagos_detalle ────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS caja_pagos_detalle (
        id SERIAL PRIMARY KEY,
        turno_id INTEGER REFERENCES caja_turno(id),
        pedido_id INTEGER,
        monto NUMERIC(10,2),
        payment_method TEXT,
        metodo TEXT,
        cambio_entregado NUMERIC(10,2) DEFAULT 0,
        cajero_nombre TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ caja_pagos_detalle');

    // ── clientes (loyalty) ────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS clientes (
        id SERIAL PRIMARY KEY,
        nombre TEXT NOT NULL,
        telefono TEXT UNIQUE NOT NULL,
        email TEXT,
        password_hash TEXT NOT NULL,
        verificado INTEGER DEFAULT 0,
        codigo_verificacion TEXT,
        codigo_expira TEXT,
        puntos INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ clientes');

    // ── puntos_historial ──────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS puntos_historial (
        id SERIAL PRIMARY KEY,
        cliente_id INTEGER REFERENCES clientes(id),
        puntos INTEGER NOT NULL,
        motivo TEXT NOT NULL,
        descripcion TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ puntos_historial');

    // ── push_subscriptions ────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        cliente_id INTEGER,
        endpoint TEXT UNIQUE NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ push_subscriptions');

    console.log('\n🎉 Base de datos lista. Usuarios creados:');
    console.log('   admin  → CapriccioAdmin2026!');
    console.log('   cocina → CocinaCap2026!');
    console.log('   caja   → CajaCap2026!');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

setup();
