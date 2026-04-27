'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Clock, RefreshCcw, ChefHat, Bike, Store, ShoppingBag, Printer } from 'lucide-react';
import { CartItem } from '@/data/cart';
import { getSocket, API_URL } from '@/lib/socket';
import { cn } from '@/lib/utils';
import OrderCard from './OrderCard';

interface KitchenOrder {
    id: string;
    items: CartItem[];
    createdAt: string;
    timestamp: string;
    status: 'pending' | 'preparing' | 'ready';
    total: number;
    order_id: string;
    metodo_entrega?: string;
    direccion?: string;
    order_origin?: string;
}

// Intenta renovar el token silenciosamente; devuelve true si tuvo éxito
const refreshToken = async (): Promise<boolean> => {
    try {
        const token = localStorage.getItem('capriccio_token_cocina');
        if (!token) return false;
        const resp = await fetch(`${API_URL}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resp.ok) {
            const data = await resp.json();
            localStorage.setItem('capriccio_token_cocina', data.token);
            console.log('🔄 [Cocina] Token renovado automáticamente');
            return true;
        }
        return false;
    } catch {
        return false;
    }
};

const KitchenDisplay = () => {
    const [orders, setOrders] = useState<KitchenOrder[]>([]);
    const [repartidoresOnline, setRepartidoresOnline] = useState<any[]>([]);
    const [currentTime, setCurrentTime] = useState<string>('');
    const [isLoaded, setIsLoaded] = useState(false);
    const [lastSync, setLastSync] = useState<Date>(new Date());
    const [printEnabled, setPrintEnabled] = useState<boolean>(() => {
        if (typeof window === 'undefined') return true;
        const saved = localStorage.getItem('capriccio_cocina_print');
        return saved === null ? true : saved === 'true';
    });

    const fetchOrders = async () => {
        setIsLoaded(false);
        try {
            let token = localStorage.getItem('capriccio_token_cocina');
            let response = await fetch(`${API_URL}/api/pedidos`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            // Si token expirado: renovar y reintentar automáticamente
            if (response.status === 401 || response.status === 403) {
                console.warn('🔑 [Cocina] fetchOrders 401 — renovando token...');
                const renewed = await refreshToken();
                if (renewed) {
                    token = localStorage.getItem('capriccio_token_cocina');
                    response = await fetch(`${API_URL}/api/pedidos`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                }
            }

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            const activeOrders = data
                .filter((o: any) => o.status === 'recibido' || o.status === 'preparando' || o.status === 'pending' || o.status === 'pendiente' || o.status === 'en_preparacion')
                .map((o: any) => ({
                    ...o,
                    id: o.order_id || o.id,
                    order_id: o.order_id || o.id,
                    createdAt: o.created_at || o.createdAt || new Date().toISOString(),
                    status: (o.status === 'recibido' || o.status === 'pending' || o.status === 'pendiente') ? 'pending' : 'preparing'
                }))
                .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

            setOrders(activeOrders);
            setLastSync(new Date());
        } catch (error) {
            console.error("❌ [Cocina] Error al obtener pedidos:", error);
        } finally {
            setIsLoaded(true);
        }
    };

    // 1. Carga inicial: renovar token PRIMERO, luego cargar pedidos
    useEffect(() => {
        // Renovar token inmediatamente al montar (garantiza sesión fresca)
        refreshToken().then(() => fetchOrders());

        const updateTime = () => {
            setCurrentTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }));
        };
        updateTime();
        const timer = setInterval(updateTime, 10000);

        // Renovar token cada 30 minutos (mucho más frecuente que antes)
        const tokenRefreshInterval = setInterval(async () => {
            console.log('🔑 [Cocina] Renovación periódica de token...');
            await refreshToken();
        }, 30 * 60 * 1000);

        return () => {
            clearInterval(timer);
            clearInterval(tokenRefreshInterval);
        };
    }, []);

    // 2. Conexión Socket para Sincronización en Tiempo Real
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        const handleNuevoPedido = (pedido: any) => {
            console.log("🍕 [Cocina] SOCKET: Nuevo pedido!", pedido.id);

            try {
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                audio.play();
            } catch (e) { }

            setOrders(prev => {
                const resolvedId = pedido.order_id || pedido.id;
                if (prev.some(o => o.id === resolvedId)) return prev;
                const newOrder = {
                    ...pedido,
                    id: resolvedId,
                    order_id: resolvedId,
                    createdAt: pedido.created_at || pedido.createdAt || new Date().toISOString(),
                    status: 'pending' as const
                };
                return [...prev, newOrder].sort((a, b) =>
                    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                );
            });
        };

        socket.on('nuevo_pedido', handleNuevoPedido);
        socket.on('repartidores_online', (reps: any[]) => {
            console.log("🚛 [Cocina] Repartidores online:", reps);
            setRepartidoresOnline(reps);
        });

        // Re-fetch on reconnect (missed events while disconnected)
        const handleReconnect = () => {
            console.log("🔄 [Cocina] Socket reconectado — refrescando pedidos");
            fetchOrders();
        };
        socket.on('connect', handleReconnect);

        return () => {
            socket.off('nuevo_pedido', handleNuevoPedido);
            socket.off('repartidores_online');
            socket.off('connect', handleReconnect);
        };
    }, []);

    // 3. Re-sync cuando la pantalla vuelve a estar visible (tablet/móvil)
    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                console.log("👁️ [Cocina] Pantalla visible — renovando token y refrescando pedidos");
                // Renovar token primero, luego recargar pedidos
                refreshToken().then(() => fetchOrders());
                const socket = getSocket();
                if (socket && !socket.connected) socket.connect();
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, []);

    // Wrapper para PATCH con manejo automático de 401/403: renueva token y reintenta
    const patchWithAuth = async (url: string, body: object): Promise<boolean> => {
        const doFetch = async () => {
            const token = localStorage.getItem('capriccio_token_cocina');
            return fetch(url, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(body)
            });
        };
        try {
            let resp = await doFetch();
            if (resp.status === 401 || resp.status === 403) {
                console.warn('🔑 [Cocina] PATCH 401 — renovando token y reintentando...');
                await refreshToken();
                resp = await doFetch(); // siempre reintentar tras refresh
            }
            return resp.ok;
        } catch (error) {
            console.error('Error PATCH:', error);
            return false;
        }
    };

    const startPreparation = async (id: string) => {
        const order = orders.find(o => o.id === id);
        if (!order) return;
        const ok = await patchWithAuth(
            `${API_URL}/api/pedidos/${order.order_id || id}/status`,
            { status: 'en_preparacion' }
        );
        if (ok) {
            setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'preparing' } : o));
        }
    };

    const generateTicketPDF = (order: KitchenOrder) => {
        const items = order.items.map(item => {
            let line = `${item.quantity}x ${item.nombre}`;
            if ((item as any).size) line += ` (${(item as any).size})`;
            if ((item as any).crust) line += ` - ${(item as any).crust}`;
            const extras = item.extras?.map((e: any) => e.nombre).join(', ');
            if (extras) line += `\n   + ${extras}`;
            return line;
        }).join('\n');

        const orderId = order.order_id || order.id;
        const shortId = orderId.split('-')[1]?.toUpperCase() || orderId.slice(-6).toUpperCase();
        const fecha = new Date().toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

        const entregaLabel = (order as any).metodo_entrega === 'domicilio' ? '🚗 A DOMICILIO'
            : (order as any).metodo_entrega === 'para_llevar' ? '🛍 PARA LLEVAR'
            : (order as any).metodo_entrega === 'sucursal' ? '🏪 EN SUCURSAL'
            : ((order as any).metodo_entrega || '').toUpperCase();

        const ticketHTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Ticket #${shortId}</title>
<style>
    @page { margin: 0; size: 80mm auto; }
    * { box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; width: 76mm; margin: 0 auto; padding: 4mm 4mm 8mm; font-size: 12px; line-height: 1.4; }
    .center { text-align: center; }
    .right  { text-align: right; }
    .bold   { font-weight: bold; }
    .big    { font-size: 18px; font-weight: bold; letter-spacing: 2px; }
    .line   { border-top: 1px dashed #000; margin: 5px 0; }
    .line-s { border-top: 1px solid #000; margin: 5px 0; }
    h2 { margin: 2px 0; font-size: 16px; letter-spacing: 2px; }
    pre { white-space: pre-wrap; font-size: 12px; font-family: inherit; margin: 0; }
    .item { margin: 3px 0; }
</style></head>
<body>
<div class="center bold"><h2>★ CAPRICCIO PIZZERIA ★</h2></div>
<div class="center" style="font-size:9px;">(833)108-9948 | capricciopizzeria.com</div>
<div class="line-s"></div>
<div class="center big">PEDIDO #${shortId}</div>
<div class="center">${fecha}</div>
<div class="line"></div>
${(order as any).cliente_nombre ? `<div class="bold">Cliente: ${(order as any).cliente_nombre}</div>` : ''}
${(order as any).telefono ? `<div>Tel: ${(order as any).telefono}</div>` : ''}
${entregaLabel ? `<div class="bold">${entregaLabel}</div>` : ''}
${(order as any).direccion && (order as any).direccion !== 'Recoger en sucursal' ? `<div>Dir: ${(order as any).direccion}</div>` : ''}
<div class="line"></div>
<pre>${items}</pre>
<div class="line"></div>
${order.total ? `<div class="right bold" style="font-size:14px;">TOTAL: $${Number(order.total).toLocaleString('es-MX')}</div>` : ''}
${(order as any).notas ? `<div class="line"></div><div><b>NOTAS:</b> ${(order as any).notas}</div>` : ''}
<div class="line-s"></div>
<div class="center bold" style="font-size:11px;">✓ LISTO PARA ENTREGA ✓</div>
<div class="center" style="font-size:8px;margin-top:4px;">Gracias por su preferencia</div>
</body></html>`;

        // ── Imprimir vía iframe oculto ─────────────────────────────────────
        // Con Chrome lanzado como: chrome.exe --kiosk-printing --app=URL
        // window.print() dentro del iframe envía directo a la impresora
        // predeterminada SIN mostrar ningún diálogo.
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:80mm;height:1px;opacity:0;border:none;';
        document.body.appendChild(iframe);

        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc) { document.body.removeChild(iframe); return; }

        doc.open();
        doc.write(ticketHTML);
        doc.close();

        iframe.onload = () => {
            try {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
                console.log(`🖨️ Ticket #${shortId} enviado a impresora`);
            } catch (e) {
                console.error('❌ Error al imprimir ticket:', e);
            }
            // Limpiar iframe tras imprimir (o a los 15s por si acaso)
            const cleanup = () => {
                if (document.body.contains(iframe)) document.body.removeChild(iframe);
            };
            iframe.contentWindow?.addEventListener('afterprint', cleanup);
            setTimeout(cleanup, 15000);
        };
    };

    const completeOrder = async (id: string) => {
        const order = orders.find(o => o.id === id);
        if (!order) return;
        const ok = await patchWithAuth(
            `${API_URL}/api/pedidos/${order.order_id || id}/status`,
            { status: 'listo' }
        );
        if (ok) {
            if (printEnabled) generateTicketPDF(order);
            setOrders(prev => prev.filter(o => o.id !== id));
        }
    };

    const completeInStore = async (id: string) => {
        const order = orders.find(o => o.id === id);
        if (!order) return;
        const ok = await patchWithAuth(
            `${API_URL}/api/pedidos/${order.order_id || id}/status`,
            { status: 'entregado', repartidor: 'sucursal' }
        );
        if (ok) {
            setOrders(prev => prev.filter(o => o.id !== id));
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 p-4 md:p-8">
<header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12 border-b border-slate-800 pb-8">
                <div className="flex items-center gap-6">
                    <img src="/logohd.png" alt="Logo" className="h-20 w-auto drop-shadow-lg" />
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-4xl font-title font-black italic uppercase tracking-widest text-white leading-none">
                                CENTRO DE <span className="text-capriccio-gold">COCINA</span>
                            </h1>
                            <span className="bg-capriccio-gold/20 text-capriccio-gold text-[10px] font-black px-2 py-0.5 rounded-full border border-capriccio-gold/30">V2.1</span>
                        </div>
                        <p className="text-slate-500 font-medium italic mt-2">Gestión de Pedidos en Tiempo Real</p>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                    <button
                        onClick={fetchOrders}
                        className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-capriccio-gold px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border border-slate-800"
                    >
                        <RefreshCcw className={cn("w-4 h-4", !isLoaded && "animate-spin")} />
                        Sincronizar
                    </button>

                    {/* Toggle impresión automática */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                const next = !printEnabled;
                                setPrintEnabled(next);
                                localStorage.setItem('capriccio_cocina_print', String(next));
                            }}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border",
                                printEnabled
                                    ? "bg-emerald-900/40 border-emerald-700/40 text-emerald-400 hover:bg-emerald-900/60"
                                    : "bg-slate-900/60 border-slate-700/40 text-slate-500 hover:bg-slate-800"
                            )}
                            title={printEnabled ? "Impresión automática activa — clic para desactivar" : "Impresión desactivada — clic para activar"}
                        >
                            <Printer className="w-4 h-4" />
                            {printEnabled ? 'Auto-Print ON' : 'Auto-Print OFF'}
                        </button>

                        {/* Botón prueba de impresión */}
                        {printEnabled && (
                            <button
                                onClick={() => generateTicketPDF({
                                    id: 'TEST-001', order_id: 'TEST-001',
                                    items: [{ nombre: 'Pepperoni Capriccio', quantity: 1, size: 'Mediana', precio: 150, extras: [] } as any],
                                    total: 150, createdAt: new Date().toISOString(), timestamp: new Date().toISOString(),
                                    status: 'ready', metodo_entrega: 'para_llevar',
                                } as any)}
                                className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 transition-all"
                                title="Imprimir ticket de prueba"
                            >
                                Test 🖨️
                            </button>
                        )}
                    </div>

                    <div className="text-left md:text-right">
                        <p className="text-4xl font-black text-slate-100 tabular-nums italic uppercase">{currentTime}</p>
                        <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">Última sync: {lastSync.toLocaleTimeString()}</p>
                    </div>
                </div>
            </header>

            {!isLoaded && orders.length === 0 ? (
                <div className="py-32 flex flex-col items-center justify-center text-capriccio-gold">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-capriccio-gold mb-4"></div>
                    <p className="font-bold uppercase tracking-widest">Sincronizando pedidos...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {(() => {
                        // Clasificación:
                        // Para Llevar = para_llevar (POS take-away)
                        //             + sucursal con order_origin='web' (cliente recoge pedido online)
                        //             + direccion='Recoger en sucursal' (fallback legacy)
                        // Consumo en Sucursal = sucursal sin origin web (POS comer en restaurante)
                        const isParaLlevar = (o: KitchenOrder) =>
                            o.metodo_entrega === 'para_llevar' ||
                            (o.metodo_entrega === 'sucursal' && (o.order_origin === 'web' || o.direccion === 'Recoger en sucursal'));

                        const isConsumoSucursal = (o: KitchenOrder) =>
                            o.metodo_entrega === 'sucursal' && o.order_origin !== 'web' && o.direccion !== 'Recoger en sucursal';

                        const isDomicilio = (o: KitchenOrder) =>
                            o.metodo_entrega === 'domicilio' ||
                            (!o.metodo_entrega && o.direccion !== 'Recoger en sucursal' && !isConsumoSucursal(o));

                        const domicilioList = orders.filter(isDomicilio);
                        const paraLlevarList = orders.filter(isParaLlevar);
                        const consumoList = orders.filter(isConsumoSucursal);

                        const EmptyLane = () => (
                            <div className="py-16 text-center bg-slate-900/30 border border-dashed border-slate-800 rounded-[2rem]">
                                <p className="text-xs font-black italic uppercase tracking-widest text-slate-700 opacity-50">Sin pedidos</p>
                            </div>
                        );

                        return (
                            <>
                                {/* ── COLUMNA 1: A DOMICILIO ─────────────────────── */}
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-blue-900/40 border border-blue-700/40">
                                        <Bike className="text-blue-400" size={22} />
                                        <h2 className="text-sm font-black uppercase italic tracking-widest text-blue-300 flex-1">Entrega a Domicilio</h2>
                                        <span className="text-lg font-black italic text-blue-400">{domicilioList.length}</span>
                                    </div>
                                    <AnimatePresence mode="popLayout">
                                        {domicilioList.map(order => (
                                            <OrderCard key={order.id} order={order} onComplete={completeOrder} onCompleteInStore={completeInStore} onStartPreparation={startPreparation} />
                                        ))}
                                    </AnimatePresence>
                                    {isLoaded && domicilioList.length === 0 && <EmptyLane />}
                                </div>

                                {/* ── COLUMNA 2: PARA LLEVAR ─────────────────────── */}
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-green-900/40 border border-green-700/40">
                                        <ShoppingBag className="text-green-400" size={22} />
                                        <h2 className="text-sm font-black uppercase italic tracking-widest text-green-300 flex-1">Para Llevar / Recoger</h2>
                                        <span className="text-lg font-black italic text-green-400">{paraLlevarList.length}</span>
                                    </div>
                                    <AnimatePresence mode="popLayout">
                                        {paraLlevarList.map(order => (
                                            <OrderCard key={order.id} order={order} onComplete={completeOrder} onCompleteInStore={completeInStore} onStartPreparation={startPreparation} />
                                        ))}
                                    </AnimatePresence>
                                    {isLoaded && paraLlevarList.length === 0 && <EmptyLane />}
                                </div>

                                {/* ── COLUMNA 3: CONSUMO EN SUCURSAL ─────────────── */}
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-amber-900/40 border border-amber-700/40">
                                        <Store className="text-amber-400" size={22} />
                                        <h2 className="text-sm font-black uppercase italic tracking-widest text-amber-300 flex-1">Consumo en Sucursal</h2>
                                        <span className="text-lg font-black italic text-amber-400">{consumoList.length}</span>
                                    </div>
                                    <AnimatePresence mode="popLayout">
                                        {consumoList.map(order => (
                                            <OrderCard key={order.id} order={order} onComplete={completeOrder} onCompleteInStore={completeInStore} onStartPreparation={startPreparation} />
                                        ))}
                                    </AnimatePresence>
                                    {isLoaded && consumoList.length === 0 && <EmptyLane />}
                                </div>
                            </>
                        );
                    })()}
                </div>
            )}
        </div>
    );
};

export default KitchenDisplay;
