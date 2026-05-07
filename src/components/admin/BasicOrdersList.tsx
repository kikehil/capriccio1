'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ChevronDown, ChevronUp, Clock, User, Phone, MapPin, CheckCircle2, Bike, Store, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { API_URL, getSocket } from '@/lib/socket';

interface OrderItem {
    nombre: string;
    quantity: number;
    size?: string;
    crust?: string;
    totalItemPrice?: number;
    precio_unitario?: number;
    extras?: { nombre: string; precio?: number }[];
}

interface Order {
    id: string;
    order_id: string;
    cliente_nombre: string;
    telefono: string;
    direccion: string;
    total: number;
    status: string;
    liquidado: number;
    created_at: string;
    delivered_at?: string;
    repartidor?: string;
    metodo_entrega?: string;
    order_origin?: string;
    notas?: string;
    items: OrderItem[];
}

interface BasicOrdersListProps {
    onStatusChange?: () => void;
}

// Parse SQLite UTC date string (no Z suffix) correctly
const parseDate = (str: string): number => {
    if (!str) return Date.now();
    let s = str.trim();
    if (s.includes('Z') || s.includes('+')) {
        const d = new Date(s);
        return isNaN(d.getTime()) ? Date.now() : d.getTime();
    }
    if (s.includes('T')) {
        const d = new Date(s + 'Z');
        return isNaN(d.getTime()) ? Date.now() : d.getTime();
    }
    s = s.replace(' ', 'T') + 'Z';
    const d = new Date(s);
    return isNaN(d.getTime()) ? Date.now() : d.getTime();
};

const formatElapsed = (ms: number): string => {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}H ${m}M`;
    if (m > 0) return `${m}M ${s}S`;
    return `${s}S`;
};

const ElapsedTimer: React.FC<{ createdAt: string; className?: string }> = ({ createdAt, className }) => {
    const [elapsed, setElapsed] = useState(0);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const start = parseDate(createdAt);
        const tick = () => setElapsed(Math.max(0, Date.now() - start));
        tick();
        intervalRef.current = setInterval(tick, 1000);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [createdAt]);

    const minutes = Math.floor(elapsed / 60000);
    const colorClass = minutes < 15
        ? 'text-blue-600'
        : minutes < 30
        ? 'text-amber-600'
        : 'text-red-600';

    return <span className={cn(colorClass, className)}>{formatElapsed(elapsed)}</span>;
};

const StatusLabel: React.FC<{ status: string }> = ({ status }) => {
    const map: Record<string, { label: string; cls: string }> = {
        pendiente: { label: 'PENDIENTE', cls: 'bg-yellow-100 text-yellow-700' },
        recibido: { label: 'RECIBIDO', cls: 'bg-yellow-100 text-yellow-700' },
        preparando: { label: 'PREPARANDO', cls: 'bg-blue-100 text-blue-700' },
        listo: { label: 'LISTO', cls: 'bg-green-100 text-green-700' },
        en_reparto: { label: 'EN REPARTO', cls: 'bg-purple-100 text-purple-700' },
        entregado: { label: 'ENTREGADO', cls: 'bg-slate-100 text-slate-600' },
        despachado: { label: 'DESPACHADO', cls: 'bg-slate-100 text-slate-600' },
    };
    const entry = map[status?.toLowerCase()] || { label: status?.toUpperCase() || '—', cls: 'bg-slate-100 text-slate-600' };
    return (
        <span className={cn('px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest', entry.cls)}>
            {entry.label}
        </span>
    );
};

const OrderCard: React.FC<{
    order: Order;
    isExpanded: boolean;
    onToggle: () => void;
    onLiquidar: (id: string) => void;
    isLiquidating: boolean;
}> = ({ order, isExpanded, onToggle, onLiquidar, isLiquidating }) => {
    const isDelivered = order.status === 'entregado' || order.status === 'despachado';

    return (
        <div className={cn(
            "bg-white rounded-[2rem] border overflow-hidden transition-all hover:shadow-lg",
            order.liquidado ? "border-green-100 bg-green-50/10" : "border-slate-100"
        )}>
            {/* Card Header */}
            <div className="p-5 cursor-pointer" onClick={onToggle}>
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className={cn(
                        "w-11 h-11 rounded-2xl flex items-center justify-center font-black text-xs italic shadow flex-shrink-0",
                        order.liquidado ? "bg-green-600 text-white" : "bg-slate-900 text-yellow-400"
                    )}>
                        {order.liquidado ? <CheckCircle2 size={18} /> : `#${String(order.order_id || order.id).slice(-4).toUpperCase()}`}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-black text-slate-900 uppercase italic text-sm leading-tight truncate">
                            {order.cliente_nombre || 'Cliente Final'}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <StatusLabel status={order.status} />
                            {order.liquidado === 1 && (
                                <span className="text-[8px] bg-green-100 text-green-600 px-2 py-0.5 rounded-full uppercase tracking-widest font-black">LIQ</span>
                            )}
                        </div>
                    </div>
                    <button className="p-1.5 bg-slate-50 rounded-full text-slate-400 flex-shrink-0">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                </div>

                {/* Timer + Total row */}
                <div className="flex items-center justify-between gap-3">
                    <div className="text-left">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                            <Clock size={8} className="inline mr-1" />
                            {new Date(parseDate(order.created_at)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {isDelivered && order.delivered_at ? (
                            <div className="bg-green-50 rounded-xl px-3 py-1.5">
                                <p className="text-[9px] font-black text-green-500 uppercase tracking-widest">Entregado en</p>
                                <p className="text-base font-black italic text-green-700 leading-none">
                                    {formatElapsed(parseDate(order.delivered_at) - parseDate(order.created_at))}
                                </p>
                            </div>
                        ) : !isDelivered ? (
                            <div className={cn(
                                "rounded-xl px-3 py-1.5",
                                (() => {
                                    const mins = Math.floor((Date.now() - parseDate(order.created_at)) / 60000);
                                    return mins < 15 ? 'bg-blue-50' : mins < 30 ? 'bg-amber-50' : 'bg-red-50';
                                })()
                            )}>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tiempo</p>
                                <ElapsedTimer createdAt={order.created_at} className="text-base font-black italic leading-none" />
                            </div>
                        ) : null}
                    </div>
                    <div className="text-right">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total</p>
                        <p className="text-2xl font-black italic text-slate-900 leading-none">${order.total}</p>
                    </div>
                </div>
            </div>

            {/* Expanded Detail */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-slate-50 bg-slate-50/50"
                    >
                        <div className="p-5 space-y-4">
                            {/* Items */}
                            <div>
                                <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Productos</h4>
                                <div className="space-y-2">
                                    {order.items?.map((item: any, idx) => {
                                        const price = Number(item.totalItemPrice) || (Number(item.precio_unitario || 0) * Number(item.quantity || 1));
                                        return (
                                            <div key={idx} className="flex justify-between items-start bg-white p-3 rounded-xl border border-slate-100">
                                                <div>
                                                    <p className="font-black text-slate-800 uppercase italic text-xs">
                                                        <span className="text-red-600 mr-1.5">{item.cantidad ?? item.quantity}x</span>
                                                        {item.nombre}
                                                    </p>
                                                    {(item.size || item.crust) && (
                                                        <p className="text-[9px] text-slate-400 font-bold mt-0.5 uppercase italic flex gap-2 flex-wrap">
                                                            {item.size && <span className="bg-slate-100 px-1.5 py-0.5 rounded">{item.size}</span>}
                                                            {item.crust && <span className="bg-slate-100 px-1.5 py-0.5 rounded">{item.crust}</span>}
                                                        </p>
                                                    )}
                                                    {item.extras && item.extras.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {item.extras.map((ex: any, i: number) => (
                                                                <span key={i} className="text-[8px] font-bold bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded border border-yellow-100 uppercase italic">
                                                                    +{ex.nombre}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="font-black italic text-slate-900 text-xs flex-shrink-0 ml-2">${price}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Delivery info */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex items-start gap-2">
                                    <Phone size={12} className="text-slate-400 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase">Teléfono</p>
                                        <p className="text-xs font-bold text-slate-700">{order.telefono || '—'}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <MapPin size={12} className="text-slate-400 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase">Dirección</p>
                                        <p className="text-xs font-bold text-slate-700 leading-tight">{order.direccion || '—'}</p>
                                    </div>
                                </div>
                                {order.repartidor && (
                                    <div className="flex items-start gap-2">
                                        <Bike size={12} className="text-slate-400 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="text-[8px] font-black text-slate-400 uppercase">Repartidor</p>
                                            <p className="text-xs font-bold text-slate-700">{order.repartidor}</p>
                                        </div>
                                    </div>
                                )}
                                {order.notas && (
                                    <div className="flex items-start gap-2 col-span-2">
                                        <div>
                                            <p className="text-[8px] font-black text-slate-400 uppercase">Notas</p>
                                            <p className="text-xs font-bold text-slate-700">{order.notas}</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Liquidar button */}
                            {!order.liquidado && (
                                <button
                                    onClick={() => onLiquidar(order.order_id)}
                                    disabled={isLiquidating}
                                    className="w-full px-4 py-3 bg-red-600 text-white rounded-xl font-black italic uppercase text-xs hover:bg-black transition-all shadow-lg shadow-red-200 disabled:opacity-50"
                                >
                                    {isLiquidating ? '...' : 'Liquidar Pedido'}
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const ColumnSection: React.FC<{
    title: string;
    count: number;
    icon: React.ReactNode;
    colorClass: string;
    orders: Order[];
    expandedOrder: string | null;
    onToggle: (id: string) => void;
    onLiquidar: (id: string) => void;
    liquidatingId: string | null;
}> = ({ title, count, icon, colorClass, orders, expandedOrder, onToggle, onLiquidar, liquidatingId }) => (
    <div className="flex flex-col gap-3">
        {/* Column Header */}
        <div className={cn("flex items-center gap-3 p-4 rounded-2xl border", colorClass)}>
            <div className="opacity-80">{icon}</div>
            <div className="flex-1">
                <h3 className="font-black uppercase italic text-sm leading-none">{title}</h3>
            </div>
            <span className="font-black text-lg italic leading-none">{count}</span>
        </div>

        {/* Cards */}
        {orders.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-[2rem] border border-dashed border-slate-200">
                <p className="font-bold text-slate-300 uppercase tracking-widest text-[10px] italic">Sin pedidos</p>
            </div>
        ) : (
            <div className="space-y-3">
                {orders.map(order => (
                    <OrderCard
                        key={order.id}
                        order={order}
                        isExpanded={expandedOrder === order.id}
                        onToggle={() => onToggle(order.id)}
                        onLiquidar={onLiquidar}
                        isLiquidating={liquidatingId === order.order_id}
                    />
                ))}
            </div>
        )}
    </div>
);

const BasicOrdersList: React.FC<BasicOrdersListProps> = ({ onStatusChange }) => {
    const getLocalDate = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [orders, setOrders] = useState<Order[]>([]);
    const [filterDate, setFilterDate] = useState(getLocalDate());
    const [isLoading, setIsLoading] = useState(false);
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
    const [isLiquidating, setIsLiquidating] = useState<string | null>(null);

    const fetchOrders = async (date: string) => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('capriccio_token_admin');
            const res = await fetch(`${API_URL}/api/admin/reportes?inicio=${date}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setOrders(data);
            }
        } catch (e) {
            console.error('Error fetching orders:', e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders(filterDate);

        const socket = getSocket();
        if (!socket) return;

        const handleNewOrder = (pedido: any) => {
            if (filterDate === getLocalDate()) {
                setOrders(prev => {
                    if (prev.find(o => o.order_id === pedido.order_id)) return prev;
                    return [pedido, ...prev];
                });
            }
        };

        const handleStatusUpdate = (data: any) => {
            setOrders(prev => prev.map(o =>
                o.order_id === data.order_id ? { ...o, ...data } : o
            ));
        };

        socket.on('nuevo_pedido', handleNewOrder);
        socket.on('pedido_status_update', handleStatusUpdate);
        return () => {
            socket.off('nuevo_pedido', handleNewOrder);
            socket.off('pedido_status_update', handleStatusUpdate);
        };
    }, [filterDate]);

    const handleLiquidar = async (orderId: string) => {
        setIsLiquidating(orderId);
        try {
            const token = localStorage.getItem('capriccio_token_admin');
            const res = await fetch(`${API_URL}/api/admin/liquidar-pedidos`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    order_ids: [orderId],
                    liquidado_por: 'Administrador (Básico)'
                })
            });
            if (res.ok) {
                await fetchOrders(filterDate);
                if (onStatusChange) onStatusChange();
            }
        } catch (e) {
            console.error('Error liquidating order:', e);
        } finally {
            setIsLiquidating(null);
        }
    };

    const toggleExpand = (id: string) => {
        setExpandedOrder(expandedOrder === id ? null : id);
    };

    // Classify orders by delivery method
    const sortByOldest = (arr: Order[]) =>
        [...arr].sort((a, b) => parseDate(a.created_at) - parseDate(b.created_at));

    // Pedidos activos: no entregado/despachado/cancelado
    const isActive = (o: Order) =>
        o.status !== 'entregado' && o.status !== 'despachado' && o.status !== 'cancelado';

    const domicilioOrders = sortByOldest(orders.filter(o =>
        isActive(o) && (
            o.metodo_entrega === 'domicilio' ||
            (!o.metodo_entrega && o.direccion !== 'Recoger en sucursal')
        )
    ));

    // Para Llevar: POS para_llevar + web sucursal (legacy) + legacy "Recoger en sucursal" address
    const paraLlevarOrders = sortByOldest(orders.filter(o =>
        isActive(o) && (
            o.metodo_entrega === 'para_llevar' ||
            (o.metodo_entrega === 'sucursal' && o.order_origin === 'web') ||
            (!o.metodo_entrega && o.direccion === 'Recoger en sucursal')
        )
    ));

    // Consumo en Sucursal: POS sucursal only (caja, not web)
    const consumoSucursalOrders = sortByOldest(orders.filter(o =>
        isActive(o) && o.metodo_entrega === 'sucursal' && o.order_origin !== 'web'
    ));

    // Historial del día: entregados y despachados (para seguimiento y liquidación)
    const historialOrders = [...orders]
        .filter(o => o.status === 'entregado' || o.status === 'despachado' || o.status === 'cancelado')
        .sort((a, b) => parseDate(b.created_at) - parseDate(a.created_at));

    return (
        <div className="space-y-6">
            {/* Header + date filter */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                <div>
                    <h2 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">Listado de Pedidos</h2>
                    <p className="text-slate-400 font-bold italic text-sm mt-1">Pedidos clasificados por método de entrega.</p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:flex-none">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="date"
                            value={filterDate}
                            onChange={(e) => setFilterDate(e.target.value)}
                            className="pl-12 pr-6 py-3 bg-slate-50 rounded-xl border-none outline-none font-bold text-slate-700 w-full"
                        />
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="p-20 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto mb-4"></div>
                    <p className="font-bold text-slate-400 uppercase tracking-widest text-xs">Cargando pedidos...</p>
                </div>
            ) : orders.length === 0 ? (
                <div className="p-20 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
                    <p className="font-bold text-slate-300 uppercase tracking-widest text-sm italic">No hay pedidos registrados para esta fecha</p>
                </div>
            ) : (
                <>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <ColumnSection
                        title="A Domicilio"
                        count={domicilioOrders.length}
                        icon={<Bike size={20} />}
                        colorClass="bg-blue-50 border-blue-100 text-blue-800"
                        orders={domicilioOrders}
                        expandedOrder={expandedOrder}
                        onToggle={toggleExpand}
                        onLiquidar={handleLiquidar}
                        liquidatingId={isLiquidating}
                    />
                    <ColumnSection
                        title="Para Recoger / Para Llevar"
                        count={paraLlevarOrders.length}
                        icon={<ShoppingBag size={20} />}
                        colorClass="bg-amber-50 border-amber-100 text-amber-800"
                        orders={paraLlevarOrders}
                        expandedOrder={expandedOrder}
                        onToggle={toggleExpand}
                        onLiquidar={handleLiquidar}
                        liquidatingId={isLiquidating}
                    />
                    <ColumnSection
                        title="Consumo en Sucursal"
                        count={consumoSucursalOrders.length}
                        icon={<Store size={20} />}
                        colorClass="bg-green-50 border-green-100 text-green-800"
                        orders={consumoSucursalOrders}
                        expandedOrder={expandedOrder}
                        onToggle={toggleExpand}
                        onLiquidar={handleLiquidar}
                        liquidatingId={isLiquidating}
                    />
                </div>

                {/* Historial del día — entregados, despachados, cancelados */}
                {historialOrders.length > 0 && (
                    <div className="mt-6">
                        <div className="flex items-center gap-3 mb-4 px-2">
                            <CheckCircle2 size={16} className="text-slate-400" />
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 italic">
                                Historial del día — {historialOrders.length} pedido{historialOrders.length !== 1 ? 's' : ''} completado{historialOrders.length !== 1 ? 's' : ''}
                            </h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                            {historialOrders.map(order => (
                                <OrderCard
                                    key={order.id}
                                    order={order}
                                    isExpanded={expandedOrder === order.id}
                                    onToggle={() => toggleExpand(order.id)}
                                    onLiquidar={handleLiquidar}
                                    isLiquidating={isLiquidating === order.order_id}
                                />
                            ))}
                        </div>
                    </div>
                )}
                </>
            )}
        </div>
    );
};

export default BasicOrdersList;
