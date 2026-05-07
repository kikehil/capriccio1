'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DollarSign, Clock, Bike, ShoppingBag, Store, CheckCircle2, AlertCircle, RefreshCcw } from 'lucide-react';
import { CajaTurno } from '@/data/caja-types';
import { API_URL, getSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';

interface OrderItem {
  nombre: string;
  quantity: number;
  size?: string;
  crust?: string;
  precio_unitario?: number;
}

interface PendingOrder {
  order_id: string;
  id: number;
  cliente_nombre: string;
  status: string;
  total: number;
  metodo_entrega: string;
  order_origin: string;
  created_at: string;
  repartidor?: string;
  liquidado: number;
  items: OrderItem[];
}

interface ActiveOrdersListProps {
  turno: CajaTurno;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  recibido:       { label: 'Recibido',       color: 'bg-blue-100 text-blue-800' },
  en_preparacion: { label: 'En Preparación', color: 'bg-amber-100 text-amber-800' },
  preparando:     { label: 'Preparando',     color: 'bg-orange-100 text-orange-800' },
  listo:          { label: 'Listo ✓',        color: 'bg-green-100 text-green-800' },
  en_reparto:     { label: 'En Reparto',     color: 'bg-purple-100 text-purple-800' },
  entregado:      { label: 'Entregado',      color: 'bg-slate-100 text-slate-600' },
};

const ENTREGA_MAP: Record<string, { label: string; icon: React.ReactNode }> = {
  domicilio:   { label: 'Domicilio',   icon: <Bike size={12} /> },
  para_llevar: { label: 'Para Llevar', icon: <ShoppingBag size={12} /> },
  sucursal:    { label: 'Sucursal',    icon: <Store size={12} /> },
};

const ActiveOrdersList: React.FC<ActiveOrdersListProps> = ({ turno }) => {
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [cobrandoId, setCobrandoId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'todos' | 'pendientes' | 'entregados'>('todos');

  const fetchOrders = useCallback(async () => {
    try {
      const token = localStorage.getItem('capriccio_token_caja');
      const response = await fetch(`${API_URL}/api/caja/pedidos/turno/${turno.id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setOrders(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  }, [turno.id]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 8000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  useEffect(() => {
    const socket = getSocket();
    const refresh = () => fetchOrders();
    socket.on('nuevo_pedido', refresh);
    socket.on('nuevo_pedido_caja', refresh);
    socket.on('pedido_status_update', refresh);
    socket.on('pedidos_liquidados', refresh);
    return () => {
      socket.off('nuevo_pedido', refresh);
      socket.off('nuevo_pedido_caja', refresh);
      socket.off('pedido_status_update', refresh);
      socket.off('pedidos_liquidados', refresh);
    };
  }, [fetchOrders]);

  const handleCobrar = async (order: PendingOrder) => {
    setCobrandoId(order.order_id);
    try {
      const token = localStorage.getItem('capriccio_token_caja');
      const cajeroNombre = localStorage.getItem('capriccio_username') || 'Cajero';
      const res = await fetch(`${API_URL}/api/caja/cobrar-pedido/${order.order_id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payment_method: 'efectivo',
          monto_recibido: order.total,
          turno_id: turno.id,
          cajero_nombre: cajeroNombre,
        }),
      });
      if (res.ok) {
        setOrders(prev => prev.filter(o => o.order_id !== order.order_id));
      } else {
        const err = await res.json().catch(() => ({}));
        console.error('Error cobrar:', res.status, err);
      }
    } catch (e) {
      console.error('Error al cobrar:', e);
    } finally {
      setCobrandoId(null);
    }
  };

  const filtered = orders.filter(o => {
    if (filter === 'pendientes') return o.status !== 'entregado';
    if (filter === 'entregados') return o.status === 'entregado';
    return true;
  });

  const totalPendiente = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const totalEntregados = orders.filter(o => o.status === 'entregado').reduce((sum, o) => sum + Number(o.total || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <RefreshCcw size={24} className="animate-spin mr-3" />
        <span className="font-bold uppercase tracking-widest text-sm">Cargando pedidos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Resumen financiero del turno */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 sm:p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1">Por Cobrar</p>
          <p className="text-xl sm:text-3xl font-black italic text-amber-700">${totalPendiente.toLocaleString('es-MX', { minimumFractionDigits: 0 })}</p>
          <p className="text-[10px] text-amber-400 font-bold mt-1">{orders.length} pedido{orders.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-2xl p-3 sm:p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-green-500 mb-1">Sin Cobrar</p>
          <p className="text-xl sm:text-3xl font-black italic text-green-700">${totalEntregados.toLocaleString('es-MX', { minimumFractionDigits: 0 })}</p>
          <p className="text-[10px] text-green-400 font-bold mt-1">{orders.filter(o => o.status === 'entregado').length} entregado{orders.filter(o => o.status === 'entregado').length !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 sm:p-5 col-span-2 md:col-span-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">En Proceso</p>
          <p className="text-xl sm:text-3xl font-black italic text-slate-700">
            {orders.filter(o => o.status !== 'entregado').length}
          </p>
          <p className="text-[10px] text-slate-400 font-bold mt-1">pedidos activos</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {([
          { key: 'todos',      label: `Todos (${orders.length})`, short: `Todos (${orders.length})` },
          { key: 'pendientes', label: `En proceso (${orders.filter(o => o.status !== 'entregado').length})`, short: `Proceso (${orders.filter(o => o.status !== 'entregado').length})` },
          { key: 'entregados', label: `Entregados sin cobrar (${orders.filter(o => o.status === 'entregado').length})`, short: `Cobrar (${orders.filter(o => o.status === 'entregado').length})` },
        ] as const).map(({ key, label, short }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              'px-3 sm:px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap flex-shrink-0',
              filter === key
                ? 'bg-slate-900 text-white shadow-lg'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            )}
          >
            <span className="sm:hidden">{short}</span>
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Lista de pedidos */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-[2rem] border border-dashed border-slate-200">
          <CheckCircle2 className="mx-auto text-slate-200 mb-3" size={48} />
          <p className="font-black text-slate-300 uppercase tracking-widest text-sm italic">
            {filter === 'entregados' ? 'No hay pedidos entregados sin cobrar' : 'No hay pedidos pendientes'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((order) => {
            const st = STATUS_MAP[order.status] ?? { label: order.status, color: 'bg-slate-100 text-slate-600' };
            const et = ENTREGA_MAP[order.metodo_entrega] ?? { label: order.metodo_entrega, icon: null };
            const hora = new Date(order.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });
            const isEntregado = order.status === 'entregado';

            return (
              <div
                key={order.order_id}
                className={cn(
                  'bg-white rounded-[1.5rem] border overflow-hidden transition-all shadow-sm',
                  isEntregado ? 'border-green-200 ring-1 ring-green-100' : 'border-slate-100'
                )}
              >
                {/* Header */}
                <div className="p-4 border-b border-slate-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-black text-slate-900 uppercase italic text-sm leading-tight">
                        {order.cliente_nombre || 'Cliente Final'}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={cn('px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest', st.color)}>
                          {st.label}
                        </span>
                        <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
                          {et.icon} {et.label}
                        </span>
                        {order.order_origin === 'web' && (
                          <span className="text-[9px] font-black bg-blue-50 text-blue-500 px-2 py-0.5 rounded-full uppercase">WEB</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <p className="text-xs font-black text-slate-400 italic">#{String(order.order_id).slice(-6)}</p>
                      <div className="flex items-center gap-1 text-[9px] text-slate-400 mt-0.5 justify-end">
                        <Clock size={9} />{hora}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Items */}
                {order.items && order.items.length > 0 && (
                  <div className="px-4 py-3 bg-slate-50/60 border-b border-slate-50 space-y-1">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[11px]">
                        <span className="font-black text-slate-700 uppercase italic">
                          <span className="text-amber-600 mr-1">{item.quantity}×</span>
                          {item.nombre}
                          {item.size && <span className="text-slate-400 font-normal ml-1">({item.size})</span>}
                        </span>
                        <span className="font-bold text-slate-500">${((item.precio_unitario || 0) * item.quantity).toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Total + botón cobrar */}
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total</p>
                    <p className="text-xl font-black italic text-slate-900">${Number(order.total).toFixed(2)}</p>
                  </div>
                  <button
                    onClick={() => handleCobrar(order)}
                    disabled={cobrandoId === order.order_id}
                    className={cn(
                      'px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50',
                      isEntregado
                        ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-200'
                        : 'bg-slate-900 hover:bg-black text-white shadow-lg'
                    )}
                  >
                    {cobrandoId === order.order_id ? '...' : isEntregado ? '💰 COBRAR' : '💰 Cobrar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ActiveOrdersList;
