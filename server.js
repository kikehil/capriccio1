require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./db');
const fs = require('fs');
const webpush = require('web-push');

// ─── VAPID config ─────────────────────────────────────────────────────────────
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        process.env.VAPID_EMAIL || 'mailto:admin@capricciopizzeria.com',
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
    console.log('✅ Web Push VAPID configurado');
} else {
    console.warn('⚠️  VAPID keys no configuradas — push notifications desactivadas');
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PATCH", "PUT", "DELETE"]
    }
});

const JWT_SECRET = process.env.JWT_SECRET || 'pizza-capriccio-super-secret-2026';

// --- MIDDLEWARES DE SEGURIDAD ---
const authorize = (roles = []) => {
    return (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Token requerido' });

        const token = authHeader.split(' ')[1];
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) return res.status(403).json({ error: 'Token inválido o expirado' });
            
            // RBAC: Si se definieron roles, validar que el usuario tenga el permiso adecuado
            if (roles.length > 0 && !roles.includes(user.role)) {
                return res.status(403).json({ error: 'No tienes permisos para esta acción' });
            }

            req.user = user;
            next();
        });
    };
};

// Aliases para facilitar lectura
const authenticateJWT = authorize([]); // Cualquier rol válido
const adminOnly = authorize(['admin']);
const adminPanelAccess = authorize(['admin', 'caja', 'responsable', 'marketing']); // Panel admin extendido
const kitchenOrAdmin = authorize(['admin', 'cocina']);
const deliveryOrAdmin = authorize(['admin', 'repartidor']);
const staffOnly = authorize(['admin', 'cocina', 'repartidor', 'caja', 'responsable', 'marketing']);

// --- NEGOCIO CONFIG HELPER ---
async function getConfig(key, defaultValue = '') {
    try {
        const r = await db.query('SELECT value FROM negocio_config WHERE key = $1', [key]);
        return r.rows.length ? r.rows[0].value : defaultValue;
    } catch { return defaultValue; }
}

// GET /api/config
app.get('/api/config', adminOnly, async (req, res) => {
    try {
        const r = await db.query('SELECT key, value FROM negocio_config');
        const config = {};
        r.rows.forEach(row => { config[row.key] = row.value; });
        res.json(config);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// PATCH /api/config
app.patch('/api/config', adminOnly, async (req, res) => {
    try {
        const entries = Object.entries(req.body);
        for (const [key, value] of entries) {
            await db.query(`
                INSERT INTO negocio_config (key, value, updated_at)
                VALUES ($1, $2, NOW())
                ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
            `, [key, value]);
        }
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- AUTH ENDPOINTS ---

// Endpoint para recuperar datos del usuario autenticado desde el token
app.get('/api/auth/me', authenticateJWT, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT u.username, u.role, u.nombre_completo, n.nombre as negocio_nombre, n.plan FROM usuarios u LEFT JOIN negocios n ON u.negocio_id = n.id WHERE LOWER(u.username) = LOWER($1)',
            [req.user.username]
        );
        if (result.rows.length > 0) {
            const u = result.rows[0];
            return res.json({
                username: u.username,
                role: u.role,
                nombre: u.nombre_completo,
                plan: u.plan || 'basico',
                negocio: u.negocio_nombre || u.username
            });
        }
        // Para el master admin (platform)
        if (req.user.role === 'platform') {
            return res.json({ username: req.user.username, role: 'platform', plan: 'master', negocio: 'Admin Demo' });
        }
        res.status(404).json({ error: 'Usuario no encontrado' });
    } catch (e) {
        res.status(500).json({ error: 'Error del servidor' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password, role_request } = req.body;
    console.log('[LOGIN] Intento:', { username, role_request });
    try {
        const MASTER_PASS = process.env.MASTER_ADMIN_PASSWORD || 'CapriccioAdmin2026!';
        if (role_request === 'admin' && username?.toLowerCase() === 'admin' && password === MASTER_PASS) {
            console.log('[LOGIN] Maestro OK');
            const token = jwt.sign({ username: 'admin', role: 'platform', plan: 'master' }, JWT_SECRET, { expiresIn: '7d' });
            return res.json({ token, role: 'platform', plan: 'master', negocio: 'Admin Demo' });
        }

        // Roles permitidos para el panel /admin
        const adminPanelRoles = ['admin', 'caja', 'responsable', 'marketing'];
        let result;
        if (role_request === 'admin') {
            result = await db.query(
                'SELECT u.*, n.nombre as negocio_nombre, n.plan FROM usuarios u LEFT JOIN negocios n ON u.negocio_id = n.id WHERE LOWER(u.username) = LOWER($1) AND u.role IN (\'admin\',\'caja\',\'responsable\',\'marketing\') AND u.activo = 1',
                [username]
            );
        } else {
            result = await db.query(
                'SELECT u.*, n.nombre as negocio_nombre, n.plan FROM usuarios u LEFT JOIN negocios n ON u.negocio_id = n.id WHERE LOWER(u.username) = LOWER($1) AND u.role = $2 AND u.activo = 1',
                [username, role_request]
            );
        }

        console.log('[LOGIN] Coincidencias en DB:', result.rows.length);

        if (result.rows.length === 0) {
            console.log('[LOGIN] No se encontró el usuario o rol incorrecto');
            return res.status(401).json({ error: 'Credenciales invalidas' });
        }

        const user = result.rows[0];
        const validPass = await bcrypt.compare(password, user.password);
        console.log('[LOGIN] Password vÁlida:', validPass);

        if (validPass) {
            // Roles que permanecen en pantalla de forma continua reciben tokens de larga duración
            const longLivedRoles = ['cocina', 'repartidor', 'caja'];
            const tokenExpiry = longLivedRoles.includes(user.role) ? '365d' : '7d';
            const token = jwt.sign({
                id: user.id,
                username: user.username,
                role: user.role,
                negocio_id: user.negocio_id,
                plan: user.plan || 'basico'
            }, JWT_SECRET, { expiresIn: tokenExpiry });

            return res.json({
                token,
                role: user.role,
                username: user.username,
                nombre: user.nombre_completo,
                plan: user.plan || 'basico',
                negocio: user.negocio_nombre || 'S/N'
            });
        }
        res.status(401).json({ error: 'Credenciales invalidas' });
    } catch (err) {
        console.error('[LOGIN] Error:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// POST /api/auth/refresh — Renueva un token válido (sin necesidad de contraseña)
// Útil para pantallas que permanecen abiertas indefinidamente (cocina, repartidor)
app.post('/api/auth/refresh', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token requerido' });
    const token = authHeader.split(' ')[1];
    // ignoreExpiration: permite renovar aunque el token ya haya expirado
    // (pantallas de cocina/repartidor permanecen abiertas indefinidamente)
    jwt.verify(token, JWT_SECRET, { ignoreExpiration: true }, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido' });
        const longLivedRoles = ['cocina', 'repartidor', 'caja'];
        const tokenExpiry = longLivedRoles.includes(user.role) ? '365d' : '7d';
        const newToken = jwt.sign({
            id: user.id,
            username: user.username,
            role: user.role,
            negocio_id: user.negocio_id,
            plan: user.plan || 'basico'
        }, JWT_SECRET, { expiresIn: tokenExpiry });
        res.json({ token: newToken });
    });
});

// --- API USUARIOS ---
app.get('/api/usuarios', adminOnly, async (req, res) => {
    try {
        const result = await db.query('SELECT id, username, role, nombre_completo, activo, created_at FROM usuarios ORDER BY role, username');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/usuarios', adminOnly, async (req, res) => {
    const { username, password, role, nombre_completo } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await db.query(
            'INSERT INTO usuarios (username, password, role, nombre_completo) VALUES ($1, $2, $3, $4) RETURNING id, username, role, nombre_completo',
            [username, hashedPassword, role, nombre_completo]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/usuarios/:id', adminOnly, async (req, res) => {
    const { username, password, role, nombre_completo, activo } = req.body;
    try {
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            await db.query(
                'UPDATE usuarios SET username=$1, password=$2, role=$3, nombre_completo=$4, activo=$5 WHERE id=$6',
                [username, hashedPassword, role, nombre_completo, activo, req.params.id]
            );
        } else {
            await db.query(
                'UPDATE usuarios SET username=$1, role=$2, nombre_completo=$3, activo=$4 WHERE id=$5',
                [username, role, nombre_completo, activo, req.params.id]
            );
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/usuarios/:id', adminOnly, async (req, res) => {
    try {
        await db.query('DELETE FROM usuarios WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- API PRODUCTOS ---
app.get('/api/productos', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM productos ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/productos', adminOnly, async (req, res) => {
    const { nombre, descripcion, precio, imagen, categoria, activo, precios } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO productos (nombre, descripcion, precio, imagen, categoria, activo, precios) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [nombre, descripcion, precio, imagen, categoria, activo ?? true, precios ?? null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/productos/:id', adminOnly, async (req, res) => {
    const { id } = req.params;
    const fields = req.body;
    const keys = Object.keys(fields);
    if (keys.length === 0) return res.sendStatus(400);

    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
    const values = [...Object.values(fields), id];

    try {
        const result = await db.query(`UPDATE productos SET ${setClause} WHERE id = $${values.length} RETURNING *`, values);
        const allProducts = await db.query('SELECT * FROM productos ORDER BY id ASC');
        io.emit('menu_actualizado', allProducts.rows);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/productos/:id', adminOnly, async (req, res) => {
    try {
        await db.query('DELETE FROM productos WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- API PROMOCIONES ---
app.get('/api/promos', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM promociones WHERE activo = 1 ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/promos', adminOnly, async (req, res) => {
    const { titulo, subtitulo, precio, color, imagen, badge } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO promociones (titulo, subtitulo, precio, color, imagen, badge, activo) VALUES ($1, $2, $3, $4, $5, $6, 1) RETURNING *',
            [titulo, subtitulo, precio, color, imagen, badge]
        );
        const all = await db.query('SELECT * FROM promociones WHERE activo = 1 ORDER BY id ASC');
        io.emit('promos_actualizadas', all.rows);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/promos/:id', adminOnly, async (req, res) => {
    const { id } = req.params;
    const { titulo, subtitulo, precio, color, imagen, badge } = req.body;
    try {
        const result = await db.query(
            'UPDATE promociones SET titulo=$1, subtitulo=$2, precio=$3, color=$4, imagen=$5, badge=$6 WHERE id=$7 RETURNING *',
            [titulo, subtitulo, precio, color, imagen, badge, id]
        );
        const all = await db.query('SELECT * FROM promociones WHERE activo = 1 ORDER BY id ASC');
        io.emit('promos_actualizadas', all.rows);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/promos/:id', adminOnly, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('UPDATE promociones SET activo = 0 WHERE id = $1', [id]);
        const all = await db.query('SELECT * FROM promociones WHERE activo = 1 ORDER BY id ASC');
        io.emit('promos_actualizadas', all.rows);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- API PEDIDOS ---
app.get('/api/pedidos', staffOnly, async (req, res) => {
    try {
        let baseQuery = "SELECT * FROM pedidos";
        let params = [];
        
        // Seguridad: Si el usuario es repartidor, solo mostramos pedidos recolectados por él
        // o pedidos listos para ser tomados por cualquiera.
        if (req.user.role === 'repartidor') {
            baseQuery += " WHERE status IN ('listo', 'en_camino', 'entregado')";
        }
        
        const result = await db.query(`${baseQuery} ORDER BY created_at DESC LIMIT 100`, params);
        const pedidosConItems = await Promise.all(result.rows.map(async (pedido) => {
            const itemsRes = await db.query('SELECT d.id, d.pizza_nombre as nombre, d.cantidad as quantity, d.precio_unitario as "totalItemPrice", d.size, d.crust FROM detalle_pedidos d WHERE d.pedido_id = $1', [pedido.id]);
            for (let item of itemsRes.rows) {
                const ext = await db.query('SELECT extra_nombre as nombre, precio_extra as precio FROM extras_pedidos WHERE detalle_id = $1', [item.id]);
                item.extras = ext.rows || [];
            }

            // Confidencialidad: Ocultar datos sensibles si no es SU pedido o no está asignado
            const isAuthorizedToSeeDetails = req.user.role === 'admin' || 
                                           req.user.role === 'cocina' || 
                                           (req.user.role === 'repartidor' && (pedido.repartidor === req.user.username || pedido.status === 'listo'));

            return {
                ...pedido,
                id: pedido.order_id || pedido.id,
                items: itemsRes.rows,
                // Si no está autorizado, ofuscamos el teléfono y dirección exacta
                telefono: isAuthorizedToSeeDetails ? pedido.telefono : pedido.telefono.replace(/.(?=.{4})/g, '*'),
                direccion: isAuthorizedToSeeDetails ? pedido.direccion : "DIRECCIÓN PROTEGIDA (Asignate el pedido para ver)"
            };
        }));
        res.json(pedidosConItems);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/pedidos', async (req, res) => {
    const { cliente_nombre, telefono, direccion, referencias, items, lat, lng, telefono_cliente } = req.body;
    console.log('📦 [PEDIDO] Recibido:', { cliente_nombre, items_count: items?.length });
    
    // 1. Basic Field Validation
    if (!cliente_nombre || !telefono || !direccion || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Faltan datos obligatorios para el pedido' });
    }

    const connection = await db.getTransaction();
    const crypto = require('crypto');
    const orderId = `ord-${crypto.randomBytes(3).toString('hex')}`;

    try {
        await connection.begin();
        
        let validatedTotal = 0;
        const validatedItems = [];

        // 2. Fetch all active products for validation
        const productsRes = await db.query("SELECT * FROM productos WHERE activo = 1");
        const catalog = productsRes.rows;

        for (const item of items) {
            // Validate Quantity
            if (!item.quantity || item.quantity <= 0) {
                throw new Error(`Cantidad inválida para ${item.nombre || 'el producto'}`);
            }

            let unitPrice = 0;
            const isPromo = item.nombre && item.nombre.toLowerCase().startsWith('promo:');

            if (isPromo) {
                // Hardcoded validation for Combo Builder
                if (item.nombre.includes('2 Medianas')) unitPrice = 245;
                else if (item.nombre.includes('2 Grandes')) unitPrice = 275;
                else unitPrice = Number(item.totalItemPrice); // Fallback if unknown
            } else {
                // Find product in catalog
                const product = catalog.find(p => p.nombre.toLowerCase() === item.nombre.toLowerCase());
                if (product) {
                    const prices = typeof product.precios === 'string' ? JSON.parse(product.precios) : product.precios;
                    if (item.size && prices && prices[item.size.toLowerCase()]) {
                        unitPrice = prices[item.size.toLowerCase()];
                    } else {
                        unitPrice = product.precio || 0;
                    }

                    // Add extras cost if any
                    if (item.extras && Array.isArray(item.extras)) {
                        for (const ex of item.extras) {
                            unitPrice += Number(ex.precio || 0);
                        }
                    }
                } else {
                    // Item not in DB? Fallback to client price but flag it if we were strict
                    unitPrice = Number(item.totalItemPrice);
                }
            }

            validatedTotal += (unitPrice * item.quantity);
            validatedItems.push({ ...item, totalItemPrice: unitPrice });
        }

        const metodo_entrega = req.body.metodo_entrega || 'domicilio';
        const pedidoRes = await connection.client.query(
            `INSERT INTO pedidos (order_id, cliente_nombre, telefono, direccion, referencias, total, lat, lng, negocio_id, telefono_cliente, metodo_entrega)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9, $10) RETURNING id`,
            [orderId, cliente_nombre, telefono, direccion, referencias, validatedTotal, lat, lng, telefono_cliente || telefono, metodo_entrega]
        );
        const pedidoId = pedidoRes.rows[0].id;

        for (const item of validatedItems) {
            const itemRes = await connection.client.query(
                `INSERT INTO detalle_pedidos (pedido_id, pizza_nombre, cantidad, precio_unitario, size, crust) 
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
                [pedidoId, item.nombre, item.quantity, item.totalItemPrice, item.size || null, item.crust || null]
            );
            const detailId = itemRes.rows[0].id;

            if (item.extras && item.extras.length > 0) {
                for (const extra of item.extras) {
                    await connection.client.query(
                        `INSERT INTO extras_pedidos (detalle_id, extra_nombre, precio_extra) VALUES ($1, $2, $3)`,
                        [detailId, extra.nombre, extra.precio]
                    );
                }
            }
        }

        await connection.commit();
        io.emit('nuevo_pedido', {
            cliente_nombre,
            direccion,
            order_id: orderId,
            total: validatedTotal,
            status: 'pendiente',
            metodo_entrega: metodo_entrega || 'domicilio',
            items: validatedItems,
            created_at: new Date().toISOString()
        });
        console.log('✅ [PEDIDO] Guardado exitoso:', orderId);
        res.status(201).json({ success: true, order_id: orderId });

        // Notificaciones WhatsApp (async, no bloquea la respuesta)
        const shortId = orderId.split('-')[1]?.toUpperCase() || orderId.slice(-6).toUpperCase();
        const esEntregaLocal = metodo_entrega === 'sucursal' || metodo_entrega === 'para_llevar';
        const tiempoEstimado = esEntregaLocal ? '20-25 minutos' : '~40 minutos';
        const resumenItems = validatedItems.map(i =>
            `• ${i.quantity}x ${i.nombre}${i.size ? ` (${i.size})` : ''} — $${i.totalItemPrice * i.quantity}`
        ).join('\n');

        const msgCliente = `🍕 *¡Hola ${cliente_nombre}!*\n\nTu pedido *#${shortId}* fue recibido correctamente.\n\n*Resumen:*\n${resumenItems}\n\n💰 *Total: $${validatedTotal}*\n⏱ Tiempo estimado: ${tiempoEstimado}\n\n¡Gracias por tu preferencia! 🙌`;

        const modoEntrega = metodo_entrega === 'domicilio' ? `🚗 *A domicilio*\n📍 ${direccion || 'Sin dirección'}${referencias ? `\n📝 Ref: ${referencias}` : ''}` : `🏪 *Recoger en sucursal*`;
        const msgNegocio = `🔔 *NUEVO PEDIDO #${shortId}*\n🌐 *Origen: Página Web*\n\n👤 ${cliente_nombre}\n📞 ${telefono}\n${modoEntrega}\n\n*Artículos:*\n${resumenItems}\n\n💰 *Total: $${validatedTotal}*`;

        // Enviar WhatsApp al cliente y al negocio
        const clienteNum = (telefono_cliente || telefono || '').replace(/\D/g, '');
        if (clienteNum) sendWA(clienteNum, msgCliente, '[Web-Cliente]');
        getWANegocio().then(num => sendWA(num, msgNegocio, '[Web-Negocio]'));
    } catch (err) {
        await connection.rollback();
        console.error("❌ [PEDIDO] Error:", err.message);
        res.status(400).json({ error: err.message });
    } finally {
        connection.release();
    }
});

app.patch('/api/pedidos/:id/status', staffOnly, async (req, res) => {
    const { id } = req.params;
    const { status, repartidor } = req.body;
    try {
        let updateQuery = 'UPDATE pedidos SET status = $1, repartidor = $2 WHERE order_id = $3 RETURNING *';
        let values = [status, repartidor || 'S/A', id];
        if (status === 'listo') {
            // Listo = preparado por cocina, sin repartidor aún
            updateQuery = 'UPDATE pedidos SET status = $1 WHERE order_id = $2 RETURNING *';
            values = [status, id];
        } else if (status === 'en_reparto') {
            // Repartidor se auto-asigna o es despachado
            updateQuery = 'UPDATE pedidos SET status = $1, repartidor = $2, asignado_at = CURRENT_TIMESTAMP WHERE order_id = $3 RETURNING *';
        } else if (status === 'entregado') {
            updateQuery = 'UPDATE pedidos SET status = $1, repartidor = $2, delivered_at = CURRENT_TIMESTAMP WHERE order_id = $3 RETURNING *';
        } else if (status === 'en_preparacion') {
            updateQuery = 'UPDATE pedidos SET status = $1 WHERE order_id = $2 RETURNING *';
            values = [status, id];
        }
        const result = await db.query(updateQuery, values);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Pedido no encontrado' });

        const pedido = result.rows[0];
        const updatedOrder = pedido;

        if (status === 'listo' || status === 'en_reparto') {
            // Incluir items y extras para que el repartidor vea el detalle en tiempo real
            const itemsRes = await db.query(
                'SELECT d.id, d.pizza_nombre as nombre, d.cantidad as quantity, d.precio_unitario as "totalItemPrice", d.size, d.crust FROM detalle_pedidos d WHERE d.pedido_id = $1',
                [pedido.id]
            );
            for (const item of itemsRes.rows) {
                const ext = await db.query('SELECT extra_nombre as nombre, precio_extra as precio FROM extras_pedidos WHERE detalle_id = $1', [item.id]);
                item.extras = ext.rows;
            }
            if (status === 'listo') {
                io.emit('pedido_listo_reparto', { ...pedido, items: itemsRes.rows });
            }
            // Emitir actualización general para que todos los módulos se enteren
            io.emit('pedido_status_update', { ...pedido, items: itemsRes.rows, status });
        } else {
            io.emit('pedido_entregado_remoto', pedido);
        }
        // Emit tracking event for customer (socket en tiempo real)
        io.emit('pedido_tracking_update', {
            order_id: id,
            status: status,
            repartidor: repartidor || null,
            telefono_cliente: updatedOrder.telefono_cliente || null
        });

        // 🔔 Push notification al cliente según el estado
        const telefono = updatedOrder.telefono_cliente;
        if (telefono) {
            const shortId = id.split('-')[1] || id.slice(-4).toUpperCase();
            const pushMap = {
                en_preparacion: {
                    title: '👨‍🍳 ¡Tu pizza está en el horno!',
                    body: `Pedido #${shortId} — Estamos preparando tu orden con todo el sabor Capriccio.`,
                    url: '/?open=pedidos',
                    tag: `pedido-${id}`,
                },
                listo: {
                    title: '✅ ¡Tu pedido está listo!',
                    body: `Pedido #${shortId} — Tu orden ya está preparada. En un momento sale a entrega.`,
                    url: '/?open=pedidos',
                    tag: `pedido-${id}`,
                },
                en_reparto: {
                    title: '🛵 ¡Ya va en camino!',
                    body: `Pedido #${shortId} — ${repartidor && repartidor !== 'S/A' ? repartidor + ' lleva' : 'Tu repartidor lleva'} tu pizza. ¡Prepara el hambre!`,
                    url: '/?open=pedidos',
                    tag: `pedido-${id}`,
                },
                entregado: {
                    title: '🍕 ¡Buen provecho!',
                    body: `Pedido #${shortId} entregado. ¿Qué tal estuvo? Califica tu experiencia.`,
                    url: '/?open=pedidos',
                    tag: `pedido-${id}`,
                },
                cancelado: {
                    title: '❌ Pedido cancelado',
                    body: `Tu pedido #${shortId} fue cancelado. Llámanos al 846-123-4567 si tienes dudas.`,
                    url: '/',
                    tag: `pedido-${id}`,
                },
            };
            const pushData = pushMap[status];
            if (pushData) {
                sendPushToCliente(telefono, {
                    ...pushData,
                    icon: '/icons/icon-192x192.png',
                    badge: '/icons/icon-72x72.png',
                });
            }
        }

        res.json({ success: true, pedido });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/pedidos/status/:status', staffOnly, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM pedidos WHERE status = $1 ORDER BY created_at DESC', [req.params.status]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Helper to get current day in Business Timezone (Pánuco UTC-6)
const getBusinessDate = (dateParam = null) => {
    // Si no hay dateParam, usamos la fecha actual del sistema
    const d = dateParam ? new Date(dateParam) : new Date();
    
    // Convertimos la fecha actual a la zona horaria especificada (America/Mexico_City para Pánuco)
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
};

// --- ADMIN STATS & REPORTS ---
app.get('/api/admin/stats', adminPanelAccess, async (req, res) => {
    try {
        const today = getBusinessDate();
        const negocio_id = req.user.negocio_id;
        const logMsg = `[Stats] User: ${req.user.username}, Negocio: ${negocio_id}, Date: ${today}\n`;
        fs.appendFileSync('stats_debug.log', logMsg);

        // Simple query without offset first to see if it works, 
        // using date(created_at) because it's already local in DB
        let baseQuery = "WHERE date(created_at) = $1 AND status != 'cancelado'";
        let params = [today];

        if (negocio_id) {
            if (negocio_id == 1) baseQuery += " AND (negocio_id = $2 OR negocio_id IS NULL)";
            else baseQuery += " AND negocio_id = $2";
            params.push(negocio_id);
        }

        const revenueRes = await db.query(`SELECT SUM(total) as revenue FROM pedidos ${baseQuery}`, params);
        const countsRes = await db.query(`SELECT COUNT(*) as count FROM pedidos ${baseQuery}`, params);
        
        let liqQuery = "WHERE date(created_at) = $1 AND liquidado = 1";
        if (negocio_id) {
            if (negocio_id == 1) liqQuery += " AND (negocio_id = $2 OR negocio_id IS NULL)";
            else liqQuery += " AND negocio_id = $2";
        }
        const liquidatedRes = await db.query(`SELECT SUM(total) as total FROM pedidos ${liqQuery}`, params);
        
        const recentRes = await db.query("SELECT * FROM pedidos ORDER BY created_at DESC LIMIT 10");
        const recentOrdersWithItems = await Promise.all(recentRes.rows.map(async (p) => {
            const items = await db.query('SELECT d.*, d.pizza_nombre as nombre FROM detalle_pedidos d WHERE d.pedido_id = $1', [p.id]);
            const itemsWithExtras = await Promise.all(items.rows.map(async (item) => {
                const extras = await db.query('SELECT extra_nombre as nombre, precio_extra as precio FROM extras_pedidos WHERE detalle_id = $1', [item.id]);
                return { ...item, extras: extras.rows };
            }));
            return { ...p, items: itemsWithExtras };
        }));

        const stats = {
            revenueToday: Number(revenueRes.rows[0]?.revenue || 0),
            orderCount: Number(countsRes.rows[0]?.count || 0),
            liquidatedToday: Number(liquidatedRes.rows[0]?.total || 0),
            recentOrders: recentOrdersWithItems,
            pendingRevenue: 0,
            liquidatedAfterCorte: 0,
            ultimoCorte: null
        };

        // Para roles caja y responsable: calcular stats desde el último corte de turno
        if (['caja', 'responsable'].includes(req.user.role) && negocio_id) {
            const negocioRes = await db.query('SELECT ultimo_corte_turno FROM negocios WHERE id = $1', [negocio_id]);
            const ultimoCorte = negocioRes.rows[0]?.ultimo_corte_turno;
            stats.ultimoCorte = ultimoCorte;

            if (ultimoCorte) {
                const pendingRes = await db.query(
                    "SELECT SUM(total) as revenue FROM pedidos WHERE created_at > $1 AND liquidado = 0 AND status != 'cancelado'",
                    [ultimoCorte]
                );
                const liqPostCorte = await db.query(
                    'SELECT SUM(total) as total FROM pedidos WHERE created_at > $1 AND liquidado = 1',
                    [ultimoCorte]
                );
                stats.pendingRevenue = Number(pendingRes.rows[0]?.revenue || 0);
                stats.liquidatedAfterCorte = Number(liqPostCorte.rows[0]?.total || 0);
            } else {
                // Sin corte previo: pending = todo lo no liquidado de hoy
                stats.pendingRevenue = stats.revenueToday - stats.liquidatedToday;
                stats.liquidatedAfterCorte = stats.liquidatedToday;
            }
        }

        fs.appendFileSync('stats_debug.log', `[Stats] Result: ${JSON.stringify(stats)}\n`);
        res.json(stats);
    } catch (err) {
        fs.appendFileSync('stats_debug.log', `[Stats] ERROR: ${err.message}\n`);
        res.status(500).json({ error: err.message });
    }
});

// Dashboard Analytics — solo para usuario capriccio
app.get('/api/admin/dashboard', adminOnly, async (req, res) => {
    try {
        const today = getBusinessDate();

        // 1. Tarjetas: recibidos y liquidados del día
        const recibidos = await db.query(
            "SELECT SUM(total) as monto, COUNT(*) as cantidad FROM pedidos WHERE date(created_at) = $1 AND status != 'cancelado'", [today]);
        const liquidados = await db.query(
            "SELECT SUM(total) as monto, COUNT(*) as cantidad FROM pedidos WHERE date(created_at) = $1 AND liquidado = 1", [today]);

        // 2. Gráfica semanal (últimos 7 días) — ::text fuerza formato 'YYYY-MM-DD' en JSON
        const semanal = await db.query(`
            SELECT created_at::date::text as dia,
                   SUM(total) as ventas,
                   COUNT(*) as pedidos
            FROM pedidos
            WHERE created_at::date >= CURRENT_DATE - INTERVAL '6 days' AND status != 'cancelado'
            GROUP BY dia ORDER BY dia
        `);

        // 3. Top 5 productos más pedidos (histórico + hoy)
        const topProductos = await db.query(`
            SELECT dp.pizza_nombre as nombre, SUM(dp.cantidad) as total_pedidos,
                   SUM(dp.cantidad * dp.precio_unitario) as total_venta
            FROM detalle_pedidos dp
            JOIN pedidos p ON dp.pedido_id = p.id
            WHERE p.status != 'cancelado'
            GROUP BY dp.pizza_nombre ORDER BY total_pedidos DESC LIMIT 5
        `);

        // 4. Promedio de tiempo de entrega HOY (created_at → delivered_at), max 3h para filtrar outliers
        const avgEntrega = await db.query(`
            SELECT ROUND(AVG(diff_mins)::numeric, 0) as promedio_minutos,
                   COUNT(*) as total_entregados
            FROM (
                SELECT EXTRACT(EPOCH FROM (delivered_at - created_at)) / 60 as diff_mins
                FROM pedidos
                WHERE status = 'entregado'
                  AND delivered_at IS NOT NULL
                  AND created_at::date = $1
                  AND EXTRACT(EPOCH FROM (delivered_at - created_at)) / 60 BETWEEN 1 AND 180
            ) as t
        `, [today]);

        // 5. Clientes registrados (total y nuevos hoy)
        const clientesStats = await db.query(`
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN created_at::date = $1 THEN 1 ELSE 0 END) as nuevos_hoy
            FROM clientes WHERE verificado = 1
        `, [today]);

        // 6. Top repartidores: eficiencia (asignado_at → delivered_at), pedidos hoy y semana
        let topRepartidores = { rows: [] };
        try {
            topRepartidores = await db.query(`
                SELECT repartidor,
                       ROUND(AVG(EXTRACT(EPOCH FROM (d_at - a_at)) / 60)::numeric, 1) as avg_minutos,
                       SUM(CASE WHEN d_at::date = $1 THEN 1 ELSE 0 END) as pedidos_hoy,
                       SUM(CASE WHEN d_at::date >= CURRENT_DATE - INTERVAL '6 days' THEN 1 ELSE 0 END) as pedidos_semana
                FROM (
                    SELECT repartidor,
                           delivered_at::timestamptz as d_at,
                           asignado_at::timestamptz  as a_at
                    FROM pedidos
                    WHERE status = 'entregado'
                      AND delivered_at ~ '^\\d{4}-\\d{2}-\\d{2}'
                      AND asignado_at ~ '^\\d{4}-\\d{2}-\\d{2}'
                      AND repartidor NOT IN ('S/A','sucursal')
                ) sub
                GROUP BY repartidor
                ORDER BY avg_minutos ASC LIMIT 10
            `, [today]);
        } catch(e) {
            console.warn('⚠️ topRepartidores query skipped:', e.message);
        }

        res.json({
            tarjetas: {
                recibidosMonto: Number(recibidos.rows[0]?.monto || 0),
                recibidosCantidad: Number(recibidos.rows[0]?.cantidad || 0),
                liquidadosMonto: Number(liquidados.rows[0]?.monto || 0),
                liquidadosCantidad: Number(liquidados.rows[0]?.cantidad || 0),
            },
            semanal: semanal.rows,
            topProductos: topProductos.rows,
            entrega: {
                promedioMinutos: Number(avgEntrega.rows[0]?.promedio_minutos || 0),
                totalEntregados: Number(avgEntrega.rows[0]?.total_entregados || 0),
            },
            clientes: {
                total: Number(clientesStats.rows[0]?.total || 0),
                nuevosHoy: Number(clientesStats.rows[0]?.nuevos_hoy || 0),
            },
            topRepartidores: topRepartidores.rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Top productos por periodo (dia / semana / mes)
app.get('/api/admin/top-productos', adminOnly, async (req, res) => {
    try {
        const periodo = req.query.periodo || 'dia';
        const today = getBusinessDate();

        let dateFilter;
        if (periodo === 'semana') dateFilter = `p.created_at::date >= CURRENT_DATE - INTERVAL '6 days'`;
        else if (periodo === 'mes') dateFilter = `TO_CHAR(p.created_at, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM')`;
        else dateFilter = `p.created_at::date = '${today}'`;

        const result = await db.query(`
            SELECT dp.pizza_nombre as nombre,
                   SUM(dp.cantidad) as total_pedidos,
                   SUM(dp.cantidad * dp.precio_unitario) as total_venta
            FROM detalle_pedidos dp
            JOIN pedidos p ON dp.pedido_id = p.id
            WHERE p.status != 'cancelado'
              AND ${dateFilter}
            GROUP BY dp.pizza_nombre
            ORDER BY total_pedidos DESC LIMIT 5
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Corte de Turno — registra timestamp del cambio de turno
app.post('/api/admin/corte-turno', authorize(['admin', 'responsable']), async (req, res) => {
    try {
        const negocio_id = req.user.negocio_id;
        const now = new Date().toISOString().replace('T', ' ').split('.')[0];
        await db.query('UPDATE negocios SET ultimo_corte_turno = $1 WHERE id = $2', [now, negocio_id]);
        io.emit('corte_turno', { corte_at: now, por: req.user.username });
        res.json({ success: true, corte_at: now });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/reportes', adminOnly, async (req, res) => {
    const { inicio, fin } = req.query;
    try {
        let queryStr = "SELECT * FROM pedidos";
        let params = [];
        if (inicio && fin) {
            queryStr += " WHERE (created_at - INTERVAL '6 hours')::date >= $1 AND (created_at - INTERVAL '6 hours')::date <= $2";
            params = [inicio, fin];
        } else if (inicio) {
            queryStr += " WHERE (created_at - INTERVAL '6 hours')::date = $1";
            params = [inicio];
        }
        queryStr += " ORDER BY created_at DESC";
        const result = await db.query(queryStr, params);

        const data = await Promise.all(result.rows.map(async (p) => {
            const items = await db.query('SELECT d.*, d.pizza_nombre as nombre FROM detalle_pedidos d WHERE d.pedido_id = $1', [p.id]);
            const itemsWithExtras = await Promise.all(items.rows.map(async (item) => {
                const extras = await db.query('SELECT extra_nombre as nombre, precio_extra as precio FROM extras_pedidos WHERE detalle_id = $1', [item.id]);
                return { ...item, extras: extras.rows };
            }));
            return { ...p, items: itemsWithExtras };
        }));
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/admin/liquidar-pedidos', adminOnly, async (req, res) => {
    const { order_ids, liquidado_por } = req.body;
    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) return res.status(400).json({ error: 'Lista vacia' });
    try {
        const idsString = order_ids.map(id => `'${id}'`).join(',');
        await db.query(`UPDATE pedidos SET liquidado = 1, liquidado_at = CURRENT_TIMESTAMP, liquidado_por = $1 WHERE order_id IN (${idsString})`, [liquidado_por || 'Cajero Admin']);
        io.emit('pedidos_liquidados', { order_ids });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/corte-caja', adminOnly, async (req, res) => {
    try {
        const rows = await db.query("SELECT * FROM pedidos WHERE (status = 'entregado' OR status = 'despachado' OR status = 'listo') AND liquidado = 0");
        const aggs = {};
        rows.rows.forEach(r => {
            let key = r.repartidor || 'Sin Asignar';
            if(!aggs[key]) aggs[key] = { repartidor: key, total_pedidos: 0, total_efectivo: 0, pedidos: [] };
            aggs[key].total_pedidos++;
            aggs[key].total_efectivo += Number(r.total);
            aggs[key].pedidos.push(r);
        });
        res.json(Object.values(aggs));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- PLATFORM ---
app.get('/api/platform/negocios', adminOnly, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM negocios ORDER BY fecha_alta DESC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// REPARTIDORES ONLINE - endpoint REST para cocina
const repartidoresOnline = {};

app.get('/api/repartidores/online', (req, res) => {
    res.json(Object.values(repartidoresOnline));
});

// SOCKETS & START
io.on('connection', (socket) => {
    socket.on('actualizar_menu', (m) => io.emit('menu_actualizado', m));

    // Al conectar, enviarle al nuevo cliente la lista actual de repartidores
    socket.emit('repartidores_online', Object.values(repartidoresOnline));

    // Repartidor se registra como disponible
    socket.on('registro_repartidor', (nombre) => {
        repartidoresOnline[socket.id] = { nombre, socketId: socket.id };
        io.emit('repartidores_online', Object.values(repartidoresOnline));
        console.log(`🛵 Repartidor online: ${nombre}`);
    });

    // Al desconectarse, remover de la lista
    socket.on('disconnect', () => {
        if (repartidoresOnline[socket.id]) {
            console.log(`🛵 Repartidor offline: ${repartidoresOnline[socket.id].nombre}`);
            delete repartidoresOnline[socket.id];
            io.emit('repartidores_online', Object.values(repartidoresOnline));
        }
    });
});

// ============================================================
// MÓDULO DE CLIENTES — LOYALTY PROGRAM
// ============================================================

// Inicializar tablas clientes al arranque si no existen
(async () => {
    try {
        await db.query(`
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
        console.log('✅ Tabla clientes lista');

        // Tabla historial de puntos
        await db.query(`
            CREATE TABLE IF NOT EXISTS puntos_historial (
                id SERIAL PRIMARY KEY,
                cliente_id INTEGER NOT NULL REFERENCES clientes(id),
                puntos INTEGER NOT NULL,
                motivo TEXT NOT NULL,
                descripcion TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ Tabla puntos_historial lista');

        // Tabla suscripciones push
        await db.query(`
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id SERIAL PRIMARY KEY,
                cliente_id INTEGER REFERENCES clientes(id),
                endpoint TEXT UNIQUE NOT NULL,
                p256dh TEXT NOT NULL,
                auth TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ Tabla push_subscriptions lista');

        await db.query(`
            CREATE TABLE IF NOT EXISTS negocio_config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ Tabla negocio_config lista');

        // Verificar columnas en pedidos
        // (En PG es mejor usar setup-pg.js para esto, pero mantenemos una versión compatible aquí)
        console.log('✅ Verificación de tablas completada');
    } catch (e) {
        console.error('❌ Error al inicializar tablas:', e.message);
    }
})();

// ─── PUSH NOTIFICATION HELPERS ────────────────────────────────────────────────

// Enviar push a todas las suscripciones de un cliente (por telefono o cliente_id)
async function sendPushToCliente(clienteIdOrTel, payload) {
    try {
        // Buscar cliente_id si se pasa teléfono
        let clienteId = clienteIdOrTel;
        if (typeof clienteIdOrTel === 'string' && isNaN(clienteIdOrTel)) {
            const r = await db.query('SELECT id FROM clientes WHERE telefono = $1', [clienteIdOrTel]);
            if (!r.rows.length) return;
            clienteId = r.rows[0].id;
        }
        const subs = await db.query(
            'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE cliente_id = $1',
            [clienteId]
        );
        const msg = JSON.stringify(payload);
        for (const sub of subs.rows) {
            try {
                await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, msg);
            } catch (e) {
                // Suscripción expirada → limpiar
                if (e.statusCode === 410 || e.statusCode === 404) {
                    await db.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [sub.endpoint]);
                }
            }
        }
    } catch (e) {
        console.error('[push]', e.message);
    }
}

// Enviar push a TODOS los clientes suscritos (para promos masivas)
async function sendPushToAll(payload) {
    try {
        const subs = await db.query('SELECT endpoint, p256dh, auth FROM push_subscriptions');
        const msg = JSON.stringify(payload);
        for (const sub of subs.rows) {
            try {
                await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, msg);
            } catch (e) {
                if (e.statusCode === 410 || e.statusCode === 404) {
                    await db.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [sub.endpoint]);
                }
            }
        }
        console.log(`[push-all] Enviado a ${subs.rows.length} suscripciones`);
    } catch (e) {
        console.error('[push-all]', e.message);
    }
}

// ─── LOYALTY HELPERS ─────────────────────────────────────────────────────────
async function agregarPuntos(clienteId, puntos, motivo, descripcion = null) {
    await db.query(
        'UPDATE clientes SET puntos = MAX(0, puntos + $1) WHERE id = $2',
        [puntos, clienteId]
    );
    await db.query(
        'INSERT INTO puntos_historial (cliente_id, puntos, motivo, descripcion) VALUES ($1,$2,$3,$4)',
        [clienteId, puntos, motivo, descripcion]
    );
}

// Helper: generar código alfanumérico
function generarCodigo(len = 6) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < len; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

// Helper: POST con https nativo — rechaza si status >= 400
function httpPost(url, body, extraHeaders = {}, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const isHttps = parsed.protocol === 'https:';
        const lib = isHttps ? require('https') : require('http');
        const payload = JSON.stringify(body);
        const options = {
            hostname: parsed.hostname,
            port: parsed.port || (isHttps ? 443 : 80),
            path: parsed.pathname + parsed.search,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), ...extraHeaders },
            timeout: timeoutMs
        };
        const req = lib.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 400) {
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                } else {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });
        req.on('timeout', () => { req.destroy(new Error(`Timeout después de ${timeoutMs}ms`)); });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

// ─── Helper centralizado WhatsApp (Evolution API local en puerto 8080) ───────
const WA_EVOLUTION_URL  = 'http://76.13.24.103:8080';
const WA_EVOLUTION_KEY  = 'DF0ACCC20D48-4293-A570-A30D6C532231';
const WA_INSTANCE       = 'pizza';
const WA_NEGOCIO_DEFAULT = '5218181190257';
async function getWANegocio() {
    const num = await getConfig('whatsapp_negocio', WA_NEGOCIO_DEFAULT);
    return `${num}@s.whatsapp.net`;
}

async function sendWA(numero, texto, tag = '') {
    let numLimpio = String(numero).replace(/\D/g, '');
    if (!numLimpio) { console.warn(`[WA${tag}] Número inválido:`, numero); return; }
    // Normalizar a formato México: 10 dígitos → 521XXXXXXXXXX
    if (numLimpio.length === 10) numLimpio = '521' + numLimpio;
    else if (numLimpio.startsWith('52') && numLimpio.length === 12) numLimpio = '521' + numLimpio.slice(2);
    const destino = numLimpio.includes('@') ? numLimpio : `${numLimpio}@s.whatsapp.net`;
    try {
        const r = await httpPost(
            `${WA_EVOLUTION_URL}/message/sendText/${WA_INSTANCE}`,
            { number: destino, textMessage: { text: texto } },
            { apikey: WA_EVOLUTION_KEY },
            12000
        );
        console.log(`[WA${tag}] ✅ Enviado a ${destino} — HTTP ${r.status}`);
    } catch (e) {
        console.error(`[WA${tag}] ❌ Fallo al enviar a ${destino}: ${e.message}`);
    }
}

// Helper: enviar código WhatsApp
// Soporta: Evolution API directo, n8n webhook, o log en consola si no hay config
async function enviarCodigoWhatsApp(telefono, nombre, codigo) {
    const evolutionUrl    = process.env.EVOLUTION_API_URL;      // ej: https://evo.tudominio.com
    const evolutionKey    = process.env.EVOLUTION_API_KEY;      // Global API Key de Evolution
    const evolutionInst   = process.env.EVOLUTION_INSTANCE;     // nombre de la instancia
    const webhookUrl      = process.env.WHATSAPP_CODIGO_WEBHOOK;

    const mensaje = `🍕 *Capriccio Pizza*\n\n¡Hola ${nombre}! 👋\n\nTu código de verificación es:\n\n*${codigo}*\n\n⏰ Válido por 15 minutos.\n\nIngresa este código en la app para activar tu cuenta. 🎉`;

    // — OPCIÓN 1: Evolution API directo —
    if (evolutionUrl && evolutionKey && evolutionInst) {
        try {
            // Normalizar número México → 521XXXXXXXXXX (mismo formato que flujo n8n)
            let num = telefono.toString().replace(/[^0-9]/g, '');
            if (num.length === 10) num = '521' + num;
            else if (num.startsWith('52') && num.length === 12) num = '521' + num.slice(2);

            const url = `${evolutionUrl}/message/sendText/${evolutionInst}`;
            console.log(`[2FA] Enviando a ${num} via Evolution (${evolutionInst})...`);
            const resp = await httpPost(url, { number: num, text: mensaje }, { apikey: evolutionKey });
            console.log(`[2FA] ✅ Respuesta Evolution: ${resp.status} ${resp.body}`);
            return;
        } catch (e) {
            console.error('[2FA] ❌ Error Evolution API:', e.message);
        }
    } else {
        console.warn('[2FA] ⚠️  Variables Evolution no configuradas:', { evolutionUrl: !!evolutionUrl, evolutionKey: !!evolutionKey, evolutionInst: !!evolutionInst });
    }

    // — OPCIÓN 2: n8n webhook —
    if (webhookUrl) {
        try {
            await httpPost(webhookUrl, {
                tipo: 'codigo_verificacion',
                telefono,
                nombre,
                codigo,
                mensaje
            });
            console.log(`[2FA] ✅ Código enviado via n8n webhook a ${telefono}`);
            return;
        } catch (e) {
            console.error('[2FA] Error webhook:', e.message);
        }
    }

    // — FALLBACK: log en consola (desarrollo) —
    console.log(`\n📱 [2FA CÓDIGO] ${nombre} (${telefono}): ${codigo}\n`);
}

// JWT para clientes (tipo diferente al staff)
const CLIENTE_JWT_SECRET = process.env.CLIENTE_JWT_SECRET || JWT_SECRET + '_cliente';

const authenticateCliente = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token requerido' });
    jwt.verify(token, CLIENTE_JWT_SECRET, (err, decoded) => {
        if (err || decoded.type !== 'cliente') return res.status(403).json({ error: 'Token inválido' });
        req.cliente = decoded;
        next();
    });
};

// POST /api/clientes/registro
app.post('/api/clientes/registro', async (req, res) => {
    const { nombre, telefono, email, password } = req.body;
    if (!nombre || !telefono || !password) return res.status(400).json({ error: 'Nombre, teléfono y contraseña son requeridos' });

    try {
        // Verificar si ya existe
        const existe = await db.query('SELECT id, verificado FROM clientes WHERE telefono = $1', [telefono]);
        if (existe.rows.length > 0) {
            const c = existe.rows[0];
            if (c.verificado) return res.status(409).json({ error: 'Este número ya tiene una cuenta activa' });
            // Si existe pero no verificado, reenviar código
        }

        const hash = await bcrypt.hash(password, 10);
        const codigo = generarCodigo(6);
        const expira = new Date(Date.now() + 15 * 60 * 1000).toISOString();

        if (existe.rows.length > 0) {
            await db.query(
                'UPDATE clientes SET nombre=$1, email=$2, password_hash=$3, codigo_verificacion=$4, codigo_expira=$5 WHERE telefono=$6',
                [nombre, email || null, hash, codigo, expira, telefono]
            );
        } else {
            await db.query(
                'INSERT INTO clientes (nombre, telefono, email, password_hash, codigo_verificacion, codigo_expira) VALUES ($1,$2,$3,$4,$5,$6)',
                [nombre, telefono, email || null, hash, codigo, expira]
            );
        }

        await enviarCodigoWhatsApp(telefono, nombre, codigo);
        res.json({ ok: true, mensaje: `Código enviado a WhatsApp al número ${telefono}` });
    } catch (e) {
        console.error('[registro]', e);
        res.status(500).json({ error: 'Error al registrar' });
    }
});

// POST /api/clientes/verificar
app.post('/api/clientes/verificar', async (req, res) => {
    const { telefono, codigo } = req.body;
    if (!telefono || !codigo) return res.status(400).json({ error: 'Teléfono y código requeridos' });

    try {
        const result = await db.query(
            'SELECT * FROM clientes WHERE telefono = $1',
            [telefono]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Cuenta no encontrada' });

        const cliente = result.rows[0];
        if (cliente.verificado) return res.status(400).json({ error: 'Cuenta ya verificada' });
        if (cliente.codigo_verificacion !== codigo.toUpperCase()) return res.status(400).json({ error: 'Código incorrecto' });
        if (new Date(cliente.codigo_expira) < new Date()) return res.status(400).json({ error: 'Código expirado. Solicita uno nuevo.' });

        await db.query('UPDATE clientes SET verificado=1, codigo_verificacion=NULL, codigo_expira=NULL WHERE telefono=$1', [telefono]);

        // 🎁 +30 puntos de bienvenida al registrarse
        await agregarPuntos(cliente.id, 30, 'registro', '¡Bienvenido al programa de lealtad Capriccio!');
        const puntosFinales = (cliente.puntos || 0) + 30;

        const token = jwt.sign({ id: cliente.id, telefono: cliente.telefono, nombre: cliente.nombre, type: 'cliente' }, CLIENTE_JWT_SECRET, { expiresIn: '30d' });
        res.json({ ok: true, token, nombre: cliente.nombre, telefono: cliente.telefono, puntos: puntosFinales, nuevo: true });
    } catch (e) {
        console.error('[verificar]', e);
        res.status(500).json({ error: 'Error al verificar' });
    }
});

// POST /api/clientes/login
app.post('/api/clientes/login', async (req, res) => {
    const { telefono, password } = req.body;
    if (!telefono || !password) return res.status(400).json({ error: 'Teléfono y contraseña requeridos' });

    try {
        const result = await db.query('SELECT * FROM clientes WHERE telefono = $1', [telefono]);
        if (result.rows.length === 0) return res.status(401).json({ error: 'Credenciales incorrectas' });

        const cliente = result.rows[0];
        if (!cliente.verificado) return res.status(403).json({ error: 'Cuenta no verificada. Revisa tu WhatsApp.', pendiente: true });

        const match = await bcrypt.compare(password, cliente.password_hash);
        if (!match) return res.status(401).json({ error: 'Credenciales incorrectas' });

        const token = jwt.sign({ id: cliente.id, telefono: cliente.telefono, nombre: cliente.nombre, type: 'cliente' }, CLIENTE_JWT_SECRET, { expiresIn: '30d' });
        res.json({ ok: true, token, nombre: cliente.nombre, telefono: cliente.telefono, puntos: cliente.puntos || 0 });
    } catch (e) {
        console.error('[login cliente]', e);
        res.status(500).json({ error: 'Error al iniciar sesión' });
    }
});

// ─── PUSH ENDPOINTS ──────────────────────────────────────────────────────────

// POST /api/push/subscribe — guardar suscripción del cliente
app.post('/api/push/subscribe', authenticateCliente, async (req, res) => {
    const { endpoint, p256dh, auth } = req.body;
    if (!endpoint || !p256dh || !auth) return res.status(400).json({ error: 'Datos de suscripción incompletos' });
    try {
        await db.query(
            `INSERT INTO push_subscriptions (cliente_id, endpoint, p256dh, auth)
             VALUES ($1,$2,$3,$4)
             ON CONFLICT(endpoint) DO UPDATE SET cliente_id=$1, p256dh=$3, auth=$4`,
            [req.cliente.id, endpoint, p256dh, auth]
        );
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: 'Error al guardar suscripción' });
    }
});

// DELETE /api/push/unsubscribe — eliminar suscripción
app.delete('/api/push/unsubscribe', authenticateCliente, async (req, res) => {
    const { endpoint } = req.body;
    await db.query('DELETE FROM push_subscriptions WHERE endpoint=$1 AND cliente_id=$2', [endpoint, req.cliente.id]);
    res.json({ ok: true });
});

// POST /api/push/promo — enviar notificación masiva (solo admin)
app.post('/api/push/promo', adminOnly, async (req, res) => {
    const { titulo, cuerpo, url } = req.body;
    if (!titulo || !cuerpo) return res.status(400).json({ error: 'Título y cuerpo requeridos' });
    await sendPushToAll({
        title: titulo,
        body: cuerpo,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        url: url || '/',
        tag: 'promo-' + Date.now(),
    });
    res.json({ ok: true, mensaje: 'Notificación enviada a todos los suscriptores' });
});

// GET /api/push/stats — total suscriptores (solo admin/marketing)
app.get('/api/push/stats', adminPanelAccess, async (req, res) => {
    try {
        const r = await db.query('SELECT COUNT(*) as total FROM push_subscriptions');
        res.json({ total: Number(r.rows[0]?.total || 0) });
    } catch (e) {
        res.status(500).json({ error: 'Error' });
    }
});

// GET /api/clientes/puntos — historial de puntos del cliente autenticado
app.get('/api/clientes/puntos', authenticateCliente, async (req, res) => {
    try {
        const clienteRes = await db.query('SELECT puntos FROM clientes WHERE id = $1', [req.cliente.id]);
        const historialRes = await db.query(
            `SELECT puntos, motivo, descripcion, created_at
             FROM puntos_historial
             WHERE cliente_id = $1
             ORDER BY created_at DESC
             LIMIT 30`,
            [req.cliente.id]
        );
        res.json({ puntos: clienteRes.rows[0]?.puntos || 0, historial: historialRes.rows });
    } catch (e) {
        console.error('[puntos]', e);
        res.status(500).json({ error: 'Error al obtener puntos' });
    }
});

// GET /api/clientes/perfil
app.get('/api/clientes/perfil', authenticateCliente, async (req, res) => {
    try {
        const result = await db.query('SELECT id, nombre, telefono, email, puntos, created_at FROM clientes WHERE id = $1', [req.cliente.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: 'Error' });
    }
});

// POST /api/clientes/reenviar-codigo
app.post('/api/clientes/reenviar-codigo', async (req, res) => {
    const { telefono } = req.body;
    if (!telefono) return res.status(400).json({ error: 'Teléfono requerido' });
    try {
        const result = await db.query('SELECT * FROM clientes WHERE telefono = $1 AND verificado = 0', [telefono]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Cuenta no encontrada o ya verificada' });
        const cliente = result.rows[0];
        const codigo = generarCodigo(6);
        const expira = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        await db.query('UPDATE clientes SET codigo_verificacion=$1, codigo_expira=$2 WHERE telefono=$3', [codigo, expira, telefono]);
        await enviarCodigoWhatsApp(telefono, cliente.nombre, codigo);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: 'Error' });
    }
});

// ============================================================

// GET /api/clientes/mis-pedidos — pedidos del cliente autenticado
app.get('/api/clientes/mis-pedidos', authenticateCliente, async (req, res) => {
    try {
        // Buscar por telefono_cliente O por telefono de entrega (cubre pedidos antes del registro)
        const result = await db.query(
            `SELECT id, order_id, total, status, created_at, delivered_at, repartidor, calificacion, calificacion_comentario
             FROM pedidos
             WHERE telefono_cliente = $1 OR telefono = $1
             ORDER BY created_at DESC LIMIT 20`,
            [req.cliente.telefono]
        );

        // Agregar items desde detalle_pedidos
        const pedidosConItems = await Promise.all(result.rows.map(async (p) => {
            const itemsRes = await db.query(
                `SELECT pizza_nombre as nombre, cantidad as quantity, precio_unitario as "totalItemPrice", size, crust
                 FROM detalle_pedidos WHERE pedido_id = $1`,
                [p.id]
            );
            return { ...p, items: itemsRes.rows };
        }));

        res.json(pedidosConItems);
    } catch (e) {
        console.error('[mis-pedidos]', e);
        res.status(500).json({ error: 'Error' });
    }
});

// POST /api/pedidos/:id/calificacion — guardar calificación del cliente
app.post('/api/pedidos/:id/calificacion', authenticateCliente, async (req, res) => {
    const { id } = req.params;
    const { estrellas, comentario } = req.body;
    if (!estrellas || estrellas < 1 || estrellas > 5) return res.status(400).json({ error: 'Calificación inválida' });
    try {
        await db.query(
            'UPDATE pedidos SET calificacion = $1, calificacion_comentario = $2 WHERE order_id = $3 AND (telefono_cliente = $4 OR telefono = $4)',
            [estrellas, comentario || null, id, req.cliente.telefono]
        );
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: 'Error' });
    }
});

// ============================================================
// ───── ENDPOINTS DE CAJA (POS - PUNTO DE VENTA) ────────────
// ============================================================

// POST /api/caja/turno/abrir — Abre un turno de caja
app.post('/api/caja/turno/abrir', authorize(['admin', 'caja', 'responsable']), async (req, res) => {
    const { efectivo_inicial } = req.body;
    const negocio_id = 1; // En producción, obtener del negocio del usuario

    try {
        const result = await db.query(
            `INSERT INTO caja_turno (cajero_id, cajero_nombre, negocio_id, efectivo_inicial)
             VALUES ($1, $2, $3, $4)
             RETURNING id, abierto_at, efectivo_inicial`,
            [req.user.id, req.user.username, negocio_id, efectivo_inicial || 0]
        );
        res.json(result.rows[0]);
        io.emit('turno_abierto', { turno_id: result.rows[0].id, cajero: req.user.username });
    } catch (e) {
        console.error('Error al abrir turno:', e);
        res.status(500).json({ error: 'Error al abrir turno' });
    }
});

// GET /api/caja/turno/activo — Obtiene el turno activo del cajero
app.get('/api/caja/turno/activo', authorize(['admin', 'caja', 'responsable']), async (req, res) => {
    const negocio_id = 1;

    try {
        const result = await db.query(
            `SELECT *,
                CAST((julianday('now') - julianday(abierto_at)) * 86400 AS INTEGER) AS duracion_segundos,
                TO_CHAR(abierto_at, 'HH24:MI:SS') AS hora_apertura_utc,
                TO_CHAR(abierto_at, 'YYYY-MM-DD') AS fecha_apertura_utc
             FROM caja_turno
             WHERE cajero_id = $1 AND cerrado_at IS NULL AND negocio_id = $2
             ORDER BY abierto_at DESC LIMIT 1`,
            [req.user.id, negocio_id]
        );
        if (result.rows.length === 0) {
            return res.json(null);
        }
        res.json(result.rows[0]);
    } catch (e) {
        console.error('Error al obtener turno activo:', e);
        res.status(500).json({ error: 'Error' });
    }
});

// PATCH /api/caja/turno/:id/cerrar — Cierra un turno de caja
app.patch('/api/caja/turno/:id/cerrar', authorize(['admin', 'caja', 'responsable']), async (req, res) => {
    const { id } = req.params;
    const { efectivo_reportado, notas } = req.body;

    try {
        // Obtener el turno
        const turnoResult = await db.query(
            'SELECT * FROM caja_turno WHERE id = $1',
            [id]
        );
        if (turnoResult.rows.length === 0) {
            return res.status(404).json({ error: 'Turno no encontrado' });
        }

        const turno = turnoResult.rows[0];

        // Calcular dinero recibido (suma de pagos en este turno)
        const pagosResult = await db.query(
            'SELECT SUM(monto) as total FROM caja_pagos_detalle WHERE turno_id = $1',
            [id]
        );
        const efectivo_recibido = pagosResult.rows[0].total || 0;

        // Calcular diferencia
        const diferencia = efectivo_recibido - (efectivo_reportado || 0);

        // Actualizar turno
        const updateResult = await db.query(
            `UPDATE caja_turno
             SET cerrado_at = CURRENT_TIMESTAMP, efectivo_recibido = $1, efectivo_reportado = $2, diferencia = $3
             WHERE id = $4
             RETURNING *`,
            [efectivo_recibido, efectivo_reportado || 0, diferencia, id]
        );

        res.json(updateResult.rows[0]);
        io.emit('turno_cerrado', { turno_id: id, cajero: turno.cajero_nombre, total: efectivo_recibido });
    } catch (e) {
        console.error('Error al cerrar turno:', e);
        res.status(500).json({ error: 'Error al cerrar turno' });
    }
});

// POST /api/caja/pedidos — Crear pedido desde POS (Punto de Venta)
app.post('/api/caja/pedidos', authorize(['admin', 'caja', 'responsable']), async (req, res) => {
    const {
        cliente_nombre, telefono, direccion, referencias, items,
        order_origin, metodo_entrega, payment_method, monto_recibido, turno_id
    } = req.body;

    try {
        // Validar datos básicos
        if (!cliente_nombre || !items || items.length === 0) {
            return res.status(400).json({ error: 'Datos incompletos' });
        }

        // Generar order_id único
        const order_id = 'ord-' + Math.random().toString(16).substr(2, 8).toUpperCase();

        // Calcular total validando precios en servidor
        let total = 0;
        for (const item of items) {
            total += (item.precio_unitario || 0) * item.cantidad;
            if (item.extras) {
                for (const extra of item.extras) {
                    total += (extra.precio || 0) * item.cantidad;
                }
            }
        }

        // Si se paga en caja pero no se ingresó monto, asumir pago exacto
        const montoFinal = (payment_method !== 'no_pago' && (!monto_recibido || isNaN(Number(monto_recibido))))
            ? total
            : Number(monto_recibido);

        // Validar que monto_recibido >= total si se paga con efectivo
        if (payment_method === 'efectivo' && montoFinal < total) {
            return res.status(400).json({ error: 'Monto insuficiente' });
        }

        const negocio_id = 1;

        // Crear pedido
        const pedidoResult = await db.query(
            `INSERT INTO pedidos
             (order_id, cliente_nombre, telefono, direccion, referencias, total, status,
              negocio_id, telefono_cliente, metodo_entrega,
              order_origin, cajero_id, cajero_nombre, payment_method, monto_recibido, pagado_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
             RETURNING id, order_id, total`,
            [
                order_id, cliente_nombre, telefono, direccion, referencias || null, total,
                'recibido', negocio_id, telefono || null, metodo_entrega,
                order_origin, req.user.id, req.user.username, payment_method,
                payment_method !== 'no_pago' ? montoFinal : null, payment_method !== 'no_pago' ? new Date().toISOString() : null
            ]
        );

        const pedido_id = pedidoResult.rows[0].id;

        // Agregar detalles de pedido
        for (const item of items) {
            const detalleResult = await db.query(
                `INSERT INTO detalle_pedidos
                 (pedido_id, pizza_nombre, cantidad, precio_unitario, size, crust)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING id`,
                [pedido_id, item.pizza_nombre, item.cantidad, item.precio_unitario || 0, item.size || null, item.crust || null]
            );

            // Agregar extras si existen
            if (item.extras && item.extras.length > 0) {
                for (const extra of item.extras) {
                    await db.query(
                        `INSERT INTO extras_pedidos (detalle_id, extra_nombre, precio_extra)
                         VALUES ($1, $2, $3)`,
                        [detalleResult.rows[0].id, extra.nombre, extra.precio || 0]
                    );
                }
            }
        }

        // Registrar pago si se realizó
        if (payment_method !== 'no_pago' && turno_id) {
            const cambio = monto_recibido - total;
            await db.query(
                `INSERT INTO caja_pagos_detalle (turno_id, pedido_id, monto, payment_method, cambio_entregado)
                 VALUES ($1, $2, $3, $4, $5)`,
                [turno_id, pedido_id, total, payment_method, cambio > 0 ? cambio : 0]
            );
        }

        // 📱 Enviar notificación push al cliente
        if (telefono) {
            const shortId = order_id.split('-')[1] || order_id.slice(-4).toUpperCase();
            sendPushToCliente(telefono, {
                title: '🍕 ¡Pedido Confirmado en Capriccio!',
                body: `Tu orden #${shortId} fue recibida. Estamos preparando tu pizza con todo el sabor.`,
                url: '/?open=pedidos',
                tag: `pedido-${order_id}`,
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-72x72.png',
            });
        }

        // Emitir evento Socket para Kitchen Display (mismo evento que pedidos web)
        io.emit('nuevo_pedido', {
            cliente_nombre,
            telefono,
            direccion,
            order_id,
            total,
            status: 'recibido',
            metodo_entrega,
            order_origin,
            items: items.map(i => ({
                nombre: i.pizza_nombre,
                quantity: i.cantidad,
                totalItemPrice: i.precio_unitario,
                size: i.size || null,
                crust: i.crust || null,
                extras: i.extras || []
            })),
            created_at: new Date().toISOString()
        });
        // También emitir evento específico de caja para otros módulos
        io.emit('nuevo_pedido_caja', {
            pedido: pedidoResult.rows[0],
            origin: order_origin,
            turno_id,
            items_count: items.length
        });

        res.json({
            success: true,
            order_id: pedidoResult.rows[0].order_id,
            cambio: monto_recibido > 0 ? monto_recibido - total : 0,
            total: total
        });

        // 📲 WhatsApp al CLIENTE y al NEGOCIO (Evolution API directa)
        {
            const shortIdCaja = order_id.split('-')[1]?.toUpperCase() || order_id.slice(-6).toUpperCase();
            const origenLabel =
                order_origin === 'whatsapp' || order_origin === 'bot' ? '💬 WhatsApp Bot' :
                order_origin === 'web' ? '🌐 Página Web' : '🏪 Punto de Venta';
            const modoEntregaCaja = metodo_entrega === 'domicilio'
                ? `🚗 *A domicilio*\n📍 ${direccion || 'Sin dirección'}`
                : metodo_entrega === 'para_llevar' ? '🏃 *Para llevar*' : '🏪 *Recoger en sucursal*';
            const resumenCaja = items.map(i =>
                `• ${i.cantidad || i.quantity}x ${i.pizza_nombre || i.nombre}${i.size ? ` (${i.size})` : ''} — $${(i.precio_unitario || i.totalItemPrice) * (i.cantidad || i.quantity)}`
            ).join('\n');
            const metodoPagoCaja = payment_method === 'tarjeta' ? '💳 Tarjeta' : payment_method === 'no_pago' ? '⏳ Pago en entrega' : '💵 Efectivo';

            // Mensaje para el NEGOCIO
            const msgNegocioCaja = `🔔 *NUEVO PEDIDO #${shortIdCaja}*\n${origenLabel}\n\n👤 ${cliente_nombre}\n📞 ${telefono || 'Sin teléfono'}\n${modoEntregaCaja}\n\n*Artículos:*\n${resumenCaja}\n\n💰 *Total: $${total}*\n${metodoPagoCaja}`;
            getWANegocio().then(num => sendWA(num, msgNegocioCaja, '[Caja-Negocio]'));

            // Mensaje para el CLIENTE (solo si tiene teléfono)
            if (telefono) {
                const tiempoEstCaja = metodo_entrega === 'domicilio' ? '~40 minutos' : '20-25 minutos';
                const msgClienteCaja = `🍕 *¡Hola ${cliente_nombre || 'Cliente'}!*\n\nTu pedido *#${shortIdCaja}* fue recibido en caja.\n\n*Resumen:*\n${resumenCaja}\n\n💰 *Total: $${total}*\n${metodoPagoCaja}\n⏱ Tiempo estimado: ${tiempoEstCaja}\n\n¡Gracias por tu preferencia! 🙌`;
                sendWA(telefono, msgClienteCaja, '[Caja-Cliente]');
            }
        }
    } catch (e) {
        console.error('Error al crear pedido en caja:', e);
        res.status(500).json({ error: 'Error al crear pedido' });
    }
});

// GET /api/caja/pedidos/turno/:turno_id — Obtiene todos los pedidos activos del turno
// Incluye pedidos POS y pedidos web creados dentro del rango horario del turno
app.get('/api/caja/pedidos/turno/:turno_id', authorize(['admin', 'caja', 'responsable']), async (req, res) => {
    const { turno_id } = req.params;

    try {
        // Obtener rango del turno
        const turnoRes = await db.query('SELECT * FROM caja_turno WHERE id = $1', [turno_id]);
        if (turnoRes.rows.length === 0) return res.status(404).json({ error: 'Turno no encontrado' });
        const turno = turnoRes.rows[0];
        const cerradoAt = turno.cerrado_at || new Date().toISOString();

        // Todos los pedidos activos creados durante el turno (POS + web)
        const result = await db.query(
            `SELECT p.* FROM pedidos p
             WHERE p.created_at >= $1
               AND p.created_at <= $2
               AND p.status NOT IN ('cancelado', 'entregado')
             ORDER BY p.created_at DESC`,
            [turno.abierto_at, cerradoAt]
        );
        res.json(result.rows);
    } catch (e) {
        console.error('Error:', e);
        res.status(500).json({ error: 'Error' });
    }
});

// GET /api/caja/reporte/turno/:turno_id — Obtiene reporte de un turno
app.get('/api/caja/reporte/turno/:turno_id', authorize(['admin', 'caja', 'responsable']), async (req, res) => {
    const { turno_id } = req.params;

    try {
        const turnoResult = await db.query(
            `SELECT *,
                CAST((julianday('now') - julianday(abierto_at)) * 86400 AS INTEGER) AS duracion_segundos,
                TO_CHAR(abierto_at, 'HH24:MI:SS') AS hora_apertura_utc
             FROM caja_turno WHERE id = $1`,
            [turno_id]
        );

        if (turnoResult.rows.length === 0) {
            return res.status(404).json({ error: 'Turno no encontrado' });
        }

        const turno = turnoResult.rows[0];
        // Si el turno está abierto, usar hora actual como límite
        const cerradoAt = turno.cerrado_at || new Date().toISOString();

        // Obtener órdenes del turno:
        //   - Pedidos POS del cajero en la fecha del turno
        //   - Pedidos web para recoger/consumir en sucursal creados durante el turno
        // Todos los pedidos creados durante el rango del turno (POS + web, todos los métodos)
        const ordenesResult = await db.query(
            `SELECT p.*, COUNT(dp.id) as items_count
             FROM pedidos p
             LEFT JOIN detalle_pedidos dp ON p.id = dp.pedido_id
             WHERE p.created_at >= $1 AND p.created_at <= $2
             GROUP BY p.id
             ORDER BY p.created_at DESC`,
            [turno.abierto_at, cerradoAt]
        );

        // Resumen de todos los pedidos del turno
        const resumenResult = await db.query(
            `SELECT
                COUNT(*) as total_ordenes,
                SUM(CASE WHEN payment_method != 'no_pago' AND payment_method IS NOT NULL THEN 1 ELSE 0 END) as ordenes_pagadas,
                SUM(CASE WHEN payment_method = 'efectivo' THEN COALESCE(total, 0) ELSE 0 END) as total_efectivo,
                SUM(CASE WHEN payment_method = 'tarjeta' THEN COALESCE(total, 0) ELSE 0 END) as total_tarjeta,
                SUM(CASE WHEN order_origin = 'llamada' THEN 1 ELSE 0 END) as ordenes_llamada,
                SUM(CASE WHEN order_origin = 'presencial' THEN 1 ELSE 0 END) as ordenes_presencial,
                SUM(CASE WHEN order_origin = 'web' THEN 1 ELSE 0 END) as ordenes_web
             FROM pedidos
             WHERE created_at >= $1 AND created_at <= $2`,
            [turno.abierto_at, cerradoAt]
        );

        res.json({
            turno,
            ordenes: ordenesResult.rows,
            resumen: resumenResult.rows[0]
        });
    } catch (e) {
        console.error('Error:', e);
        res.status(500).json({ error: 'Error al obtener reporte' });
    }
});

// GET /api/caja/buscar-pedido?q=... — Busca un pedido por número para cobro en caja
app.get('/api/caja/buscar-pedido', authorize(['admin', 'caja', 'responsable']), async (req, res) => {
    const { q } = req.query;
    if (!q || String(q).trim().length < 2) {
        return res.status(400).json({ error: 'Ingresa al menos 2 caracteres' });
    }
    const search = `%${String(q).trim().toUpperCase()}%`;
    try {
        const result = await db.query(
            `SELECT p.*
             FROM pedidos p
             WHERE UPPER(p.order_id) LIKE $1
             ORDER BY p.created_at DESC
             LIMIT 5`,
            [search]
        );
        // Parsear items (JSON string)
        const rows = result.rows.map((r) => ({
            ...r,
            items: typeof r.items === 'string' ? (() => { try { return JSON.parse(r.items); } catch { return []; } })() : (r.items || []),
        }));
        res.json(rows);
    } catch (e) {
        console.error('Error buscar-pedido:', e);
        res.status(500).json({ error: 'Error en búsqueda' });
    }
});

// PATCH /api/caja/cobrar-pedido/:order_id — Cobra y liquida un pedido en caja
app.patch('/api/caja/cobrar-pedido/:order_id', authorize(['admin', 'caja', 'responsable']), async (req, res) => {
    const { order_id } = req.params;
    const { payment_method, monto_recibido, turno_id, cajero_nombre } = req.body;

    if (!payment_method) return res.status(400).json({ error: 'Método de pago requerido' });

    try {
        // Buscar el pedido
        const pedidoResult = await db.query(
            'SELECT * FROM pedidos WHERE order_id = $1',
            [order_id]
        );
        if (pedidoResult.rows.length === 0) {
            return res.status(404).json({ error: 'Pedido no encontrado' });
        }
        const pedido = pedidoResult.rows[0];

        // Actualizar pedido: marcar como pagado y liquidado
        await db.query(
            `UPDATE pedidos
             SET payment_method = $1,
                 monto_recibido = $2,
                 pagado_at = CURRENT_TIMESTAMP,
                 liquidado = 1,
                 liquidado_at = CURRENT_TIMESTAMP,
                 liquidado_por = $3
             WHERE order_id = $4`,
            [payment_method, monto_recibido || pedido.total, cajero_nombre || 'Cajero', order_id]
        );

        // Registrar en caja_pagos_detalle si hay turno activo
        if (turno_id) {
            try {
                await db.query(
                    `INSERT INTO caja_pagos_detalle (turno_id, pedido_id, monto, metodo, cajero_nombre)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [turno_id, pedido.id, pedido.total, payment_method, cajero_nombre || 'Cajero']
                );
            } catch (e) {
                console.warn('caja_pagos_detalle insert error:', e.message);
            }
        }

        // Notificar via socket
        io.emit('pedidos_liquidados', { order_ids: [order_id] });
        io.emit('pedido_status_update', { order_id, liquidado: 1, payment_method });

        res.json({ ok: true, order_id, payment_method, total: pedido.total });
    } catch (e) {
        console.error('Error cobrar-pedido:', e);
        res.status(500).json({ error: 'Error al cobrar pedido' });
    }
});

// ============================================================
// ─── FACTURACIÓN EN LÍNEA ────────────────────────────────────────────────────

function facturamaRequest(method, path, body = null) {
    const baseUrl = process.env.FACTURAMA_URL || 'https://apisandbox.facturama.mx';
    const user = process.env.FACTURAMA_USER || 'pruebas';
    const pass = process.env.FACTURAMA_PASS || 'pruebas2011';
    const auth = Buffer.from(`${user}:${pass}`).toString('base64');

    return new Promise((resolve, reject) => {
        const parsed = new URL(baseUrl + path);
        const isHttps = parsed.protocol === 'https:';
        const lib = isHttps ? require('https') : require('http');
        const payload = body ? JSON.stringify(body) : null;
        const headers = { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' };
        if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

        const req = lib.request({
            hostname: parsed.hostname,
            port: parsed.port || (isHttps ? 443 : 80),
            path: parsed.pathname + parsed.search,
            method,
            headers
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
                catch { resolve({ status: res.statusCode, body: data }); }
            });
        });
        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

// GET /api/facturacion/pedido/:order_id — buscar pedido (público)
app.get('/api/facturacion/pedido/:order_id', async (req, res) => {
    try {
        const { order_id } = req.params;
        const result = await db.query(
            'SELECT order_id, total, created_at, metodo_entrega, status, facturado FROM pedidos WHERE LOWER(order_id) = LOWER($1)',
            [order_id]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Pedido no encontrado' });
        const p = result.rows[0];

        if (p.status === 'cancelado') return res.status(400).json({ error: 'Este pedido fue cancelado y no puede facturarse' });
        if (p.facturado) return res.status(400).json({ error: 'Este pedido ya fue facturado. Revisa tu correo electrónico.' });

        const pedidoDate = new Date(p.created_at);
        const now = new Date();
        if (pedidoDate.getMonth() !== now.getMonth() || pedidoDate.getFullYear() !== now.getFullYear()) {
            return res.status(400).json({ error: 'Solo se puede facturar pedidos del mes en curso' });
        }

        res.json({ order_id: p.order_id, total: p.total, created_at: p.created_at, metodo_entrega: p.metodo_entrega });
    } catch (e) {
        console.error('[facturacion GET]', e);
        res.status(500).json({ error: 'Error al buscar pedido' });
    }
});

// POST /api/facturacion/solicitar — generar CFDI (público)
app.post('/api/facturacion/solicitar', async (req, res) => {
    try {
        const { order_id, rfc, nombre, cp_fiscal, regimen_fiscal, uso_cfdi, forma_pago, email } = req.body;

        if (!order_id || !rfc || !nombre || !cp_fiscal || !regimen_fiscal || !uso_cfdi || !forma_pago || !email) {
            return res.status(400).json({ error: 'Todos los campos son requeridos' });
        }
        if (!/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i.test(rfc.trim())) {
            return res.status(400).json({ error: 'RFC inválido' });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Email inválido' });
        }

        const result = await db.query('SELECT * FROM pedidos WHERE LOWER(order_id) = LOWER($1)', [order_id]);
        if (!result.rows.length) return res.status(404).json({ error: 'Pedido no encontrado' });
        const pedido = result.rows[0];

        if (pedido.facturado) return res.status(400).json({ error: 'Este pedido ya fue facturado' });
        if (pedido.status === 'cancelado') return res.status(400).json({ error: 'Pedido cancelado' });

        const pedidoDate = new Date(pedido.created_at);
        const now = new Date();
        if (pedidoDate.getMonth() !== now.getMonth() || pedidoDate.getFullYear() !== now.getFullYear()) {
            return res.status(400).json({ error: 'Solo se puede facturar pedidos del mes en curso' });
        }

        const total = parseFloat(pedido.total);
        const subtotal = +(total / 1.16).toFixed(2);
        const iva = +(total - subtotal).toFixed(2);

        // CFDI 3.3 — compatible con sandbox Facturama (pruebas/pruebas2011)
        const cfdi = {
            "Folio": pedido.order_id,
            "Serie": "F",
            "Date": new Date().toISOString().slice(0, 19),
            "PaymentForm": forma_pago,
            "PaymentMethod": "PUE",
            "Currency": "MXN",
            "ExpeditionPlace": process.env.FACTURAMA_CP_EMISOR || "93990",
            "CfdiType": "I",
            "Issuer": {
                "FiscalRegime": process.env.FACTURAMA_REGIMEN_EMISOR || "621",
                "Rfc": process.env.FACTURAMA_RFC_EMISOR || "EKU9003173C9",
                "Name": process.env.FACTURAMA_NOMBRE_EMISOR || "Capriccio Pizzeria SA de CV"
            },
            "Receiver": {
                "Rfc": rfc.trim().toUpperCase(),
                "Name": nombre.trim().toUpperCase(),
                "CfdiUse": uso_cfdi,
                "FiscalRegime": regimen_fiscal,
                "TaxZipCode": cp_fiscal.trim()
            },
            "Items": [
                {
                    "ProductCode": "90101501",
                    "IdentificationNumber": pedido.order_id,
                    "Description": `Servicio de restaurante - Pedido ${pedido.order_id}`,
                    "Unit": "Servicio",
                    "UnitCode": "E48",
                    "UnitPrice": subtotal,
                    "Quantity": 1,
                    "Subtotal": subtotal,
                    "TaxObject": "02",
                    "Taxes": [
                        {
                            "Total": iva,
                            "Name": "IVA",
                            "Base": subtotal,
                            "Rate": 0.16,
                            "IsRetention": false
                        }
                    ],
                    "Total": total
                }
            ]
        };

        const createRes = await facturamaRequest('POST', '/3/cfdis', cfdi);
        if (createRes.status !== 201 && createRes.status !== 200) {
            console.error('[facturacion] Facturama error:', JSON.stringify(createRes.body));
            const msg = createRes.body?.Message
                || (createRes.body?.ModelState ? Object.values(createRes.body.ModelState).flat().join(' ') : null)
                || 'Error al timbrar CFDI';
            return res.status(500).json({ error: msg });
        }

        const cfdiData = createRes.body;
        const cfdiId = cfdiData.Id;
        const uuid = cfdiData.Complement?.TaxStamp?.Uuid || cfdiData.Id;

        // Descargar PDF en base64
        let pdfBase64 = null;
        try {
            const pdfRes = await facturamaRequest('GET', `/cfdi/issued/pdf/${cfdiId}`);
            if (pdfRes.status === 200 && pdfRes.body?.Content) pdfBase64 = pdfRes.body.Content;
        } catch (pdfErr) {
            console.warn('[facturacion] PDF download warning:', pdfErr.message);
        }

        // Marcar pedido como facturado
        await db.query(
            `UPDATE pedidos SET facturado = 1, factura_uuid = $1, facturado_at = NOW() WHERE order_id = $2`,
            [uuid, pedido.order_id]
        );

        res.json({ ok: true, uuid, cfdi_id: cfdiId, pdf_base64: pdfBase64 });

    } catch (e) {
        console.error('[facturacion] Error:', e);
        res.status(500).json({ error: 'Error al generar factura: ' + e.message });
    }
});

// ============================================================

// ─── Facebook Posts API ───────────────────────────────────────────────────────
// GET /api/facebook/posts — devuelve los últimos posts de la página de Facebook
// El token se guarda en .env como FACEBOOK_PAGE_TOKEN y nunca se expone al frontend
app.get('/api/facebook/posts', async (req, res) => {
    const token = process.env.FACEBOOK_PAGE_TOKEN;
    const pageId = process.env.FACEBOOK_PAGE_ID;

    if (!token || !pageId) {
        return res.status(503).json({ error: 'Facebook no configurado', posts: [] });
    }

    try {
        const url = `https://graph.facebook.com/v19.0/${pageId}/posts` +
            `?fields=message,full_picture,created_time,permalink_url,attachments` +
            `&limit=6&access_token=${token}`;

        const fbRes = await fetch(url);
        const data = await fbRes.json();

        if (data.error) {
            console.warn('⚠️ Facebook API error:', data.error.message);
            return res.status(502).json({ error: data.error.message, posts: [] });
        }

        const posts = (data.data || []).map((p) => ({
            id: p.id,
            message: p.message || '',
            full_picture: p.full_picture || null,
            created_time: p.created_time,
            permalink_url: p.permalink_url || 'https://www.facebook.com',
        }));

        res.json({ posts });
    } catch (e) {
        console.error('❌ Facebook fetch error:', e.message);
        res.status(500).json({ error: 'Error al obtener posts', posts: [] });
    }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`🚀 SERVIDOR EN PUERTO ${PORT}`));
