'use client';

import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { API_URL } from '@/lib/socket';
import { TrendingUp, ShoppingBag, CheckCircle, Clock, Bike, Package, RefreshCcw, Users } from 'lucide-react';

interface DashboardData {
    tarjetas: {
        recibidosMonto: number;
        recibidosCantidad: number;
        liquidadosMonto: number;
        liquidadosCantidad: number;
    };
    semanal: { dia: string; ventas: number; pedidos: number }[];
    topProductos: { nombre: string; total_pedidos: number; total_venta: number }[];
    entrega: { promedioMinutos: number; totalEntregados: number };
    clientes: { total: number; nuevosHoy: number };
    topRepartidores: { repartidor: string; avg_minutos: number; pedidos_hoy: number; pedidos_semana: number }[];
}

const DAYS_ES: Record<string, string> = {
    '0': 'Dom', '1': 'Lun', '2': 'Mar', '3': 'Mié', '4': 'Jue', '5': 'Vie', '6': 'Sáb'
};

function formatDay(dateStr: string) {
    const d = new Date(dateStr + 'T12:00:00');
    return DAYS_ES[String(d.getDay())] || dateStr.slice(5);
}

function formatMins(raw: number | string | null | undefined) {
    const mins = Number(raw);
    if (!mins || isNaN(mins) || mins <= 0) return '—';
    if (mins < 60) return `${Math.round(mins)} min`;
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

type TopPeriod = 'dia' | 'semana' | 'mes';

export default function CapriccioDashboard() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
    const [topPeriod, setTopPeriod] = useState<TopPeriod>('dia');
    const [topProductos, setTopProductos] = useState<DashboardData['topProductos']>([]);
    const [loadingTop, setLoadingTop] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('capriccio_token_admin');
            const res = await fetch(`${API_URL}/api/admin/dashboard`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const json = await res.json();
                setData(json);
                setLastUpdate(new Date());
            }
        } catch (e) {
            console.error('Error cargando dashboard:', e);
        } finally {
            setLoading(false);
        }
    };

    const fetchTopProductos = async (period: TopPeriod) => {
        setLoadingTop(true);
        try {
            const token = localStorage.getItem('capriccio_token_admin');
            const res = await fetch(`${API_URL}/api/admin/top-productos?periodo=${period}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setTopProductos(await res.json());
        } catch (e) {
            console.error('Error cargando top productos:', e);
        } finally {
            setLoadingTop(false);
        }
    };

    const handleTopPeriod = (p: TopPeriod) => {
        setTopPeriod(p);
        fetchTopProductos(p);
    };

    useEffect(() => {
        fetchData();
        fetchTopProductos('dia');
    }, []);

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-capriccio-gold border-t-transparent" />
        </div>
    );

    if (!data) return <p className="text-slate-400 text-center">Error cargando datos.</p>;

    const { tarjetas, semanal, entrega, clientes, topRepartidores } = data;

    // Build full 7-day chart (fill missing days with 0)
    const chartDays: { dia: string; ventas: number; pedidos: number }[] = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        // s.dia puede llegar como "2026-04-27" o "2026-04-27T00:00:00.000Z"
        const found = semanal.find(s => (s.dia ?? '').slice(0, 10) === dateStr);
        chartDays.push({
            dia: i === 0 ? 'Hoy' : formatDay(dateStr),
            ventas: found ? Number(found.ventas) : 0,
            pedidos: found ? Number(found.pedidos) : 0,
        });
    }

    const maxVenta = Math.max(...chartDays.map(d => d.ventas), 1);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900 flex items-center gap-3">
                        <div className="p-3 bg-capriccio-gold rounded-2xl shadow-lg shadow-capriccio-gold/20">
                            <TrendingUp className="text-slate-900" size={24} />
                        </div>
                        Dashboard Capriccio
                    </h2>
                    <p className="text-slate-400 font-bold italic text-sm mt-1">
                        Actualizado: {lastUpdate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>
                <button
                    onClick={fetchData}
                    className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-3 rounded-2xl font-black italic text-xs uppercase tracking-widest transition-all"
                >
                    <RefreshCcw size={14} /> Actualizar
                </button>
            </div>

            {/* Tarjetas principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-red-600 p-7 rounded-[2.5rem] shadow-2xl shadow-red-600/30 text-white relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-28 h-28 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-700" />
                    <ShoppingBag size={20} className="mb-3 opacity-80" />
                    <p className="text-[10px] uppercase font-black tracking-[0.25em] opacity-80 mb-1">Pedidos Recibidos</p>
                    <h4 className="text-4xl font-black italic leading-none">${tarjetas.recibidosMonto.toLocaleString()}</h4>
                    <p className="text-xs font-bold opacity-70 mt-2">{tarjetas.recibidosCantidad} pedidos hoy</p>
                </div>

                <div className="bg-green-600 p-7 rounded-[2.5rem] shadow-2xl shadow-green-600/30 text-white relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-28 h-28 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-700" />
                    <CheckCircle size={20} className="mb-3 opacity-80" />
                    <p className="text-[10px] uppercase font-black tracking-[0.25em] opacity-80 mb-1">Pedidos Liquidados</p>
                    <h4 className="text-4xl font-black italic leading-none">${tarjetas.liquidadosMonto.toLocaleString()}</h4>
                    <p className="text-xs font-bold opacity-70 mt-2">{tarjetas.liquidadosCantidad} liquidados hoy</p>
                </div>

                <div className="bg-slate-900 p-7 rounded-[2.5rem] shadow-2xl text-white relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-28 h-28 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-700" />
                    <Clock size={20} className="mb-3 text-capriccio-gold" />
                    <p className="text-[10px] uppercase font-black tracking-[0.25em] opacity-80 mb-1">Espera Promedio</p>
                    <h4 className="text-4xl font-black italic leading-none text-capriccio-gold">
                        {formatMins(entrega.promedioMinutos)}
                    </h4>
                    <p className="text-xs font-bold opacity-50 mt-2">{entrega.totalEntregados} entregas hoy</p>
                </div>

                <div className="bg-white p-7 rounded-[2.5rem] shadow-xl border border-slate-100 group">
                    <Package size={20} className="mb-3 text-slate-400" />
                    <p className="text-[10px] uppercase font-black tracking-[0.25em] text-slate-400 mb-1">Total Pedidos Hoy</p>
                    <h4 className="text-5xl font-black italic leading-none text-slate-900">{tarjetas.recibidosCantidad}</h4>
                    <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 rounded-full bg-capriccio-gold flex-1" style={{ width: `${Math.min(tarjetas.recibidosCantidad * 10, 100)}%` }} />
                    </div>
                </div>

                <div className="bg-white p-7 rounded-[2.5rem] shadow-xl border border-slate-100 group">
                    <Users size={20} className="mb-3 text-capriccio-gold" />
                    <p className="text-[10px] uppercase font-black tracking-[0.25em] text-slate-400 mb-1">Clientes Registrados</p>
                    <h4 className="text-5xl font-black italic leading-none text-slate-900">{(clientes?.total ?? 0).toLocaleString()}</h4>
                    <p className="text-xs font-bold text-emerald-600 mt-2">
                        {clientes?.nuevosHoy ? `+${clientes.nuevosHoy} nuevos hoy` : 'Sin nuevos hoy'}
                    </p>
                </div>

                {/* Pedidos Activos */}
                <div className="bg-white p-7 rounded-[2.5rem] shadow-xl border border-slate-100 group">
                    <Bike size={20} className="mb-3 text-blue-500" />
                    <p className="text-[10px] uppercase font-black tracking-[0.25em] text-slate-400 mb-1">Pedidos Activos</p>
                    <h4 className="text-5xl font-black italic leading-none text-blue-600">
                        {Math.max(0, tarjetas.recibidosCantidad - tarjetas.liquidadosCantidad)}
                    </h4>
                    <p className="text-xs font-bold text-slate-400 mt-2">En proceso ahora</p>
                </div>

                {/* Ticket Promedio */}
                <div className="bg-white p-7 rounded-[2.5rem] shadow-xl border border-slate-100 group">
                    <TrendingUp size={20} className="mb-3 text-emerald-500" />
                    <p className="text-[10px] uppercase font-black tracking-[0.25em] text-slate-400 mb-1">Ticket Promedio</p>
                    <h4 className="text-4xl font-black italic leading-none text-emerald-600">
                        ${tarjetas.recibidosCantidad > 0
                            ? Math.round(tarjetas.recibidosMonto / tarjetas.recibidosCantidad).toLocaleString()
                            : '0'}
                    </h4>
                    <p className="text-xs font-bold text-slate-400 mt-2">Por pedido hoy</p>
                </div>

                {/* Repartidores Activos */}
                <div className="bg-white p-7 rounded-[2.5rem] shadow-xl border border-slate-100 group">
                    <CheckCircle size={20} className="mb-3 text-purple-500" />
                    <p className="text-[10px] uppercase font-black tracking-[0.25em] text-slate-400 mb-1">Tasa de Cierre</p>
                    <h4 className="text-5xl font-black italic leading-none text-purple-600">
                        {tarjetas.recibidosCantidad > 0
                            ? Math.round((tarjetas.liquidadosCantidad / tarjetas.recibidosCantidad) * 100)
                            : 0}%
                    </h4>
                    <p className="text-xs font-bold text-slate-400 mt-2">{tarjetas.liquidadosCantidad} de {tarjetas.recibidosCantidad} pedidos</p>
                </div>
            </div>

            {/* Gráfica semanal + Top Productos */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                {/* Gráfica */}
                <div className="lg:col-span-3 bg-white p-8 rounded-[3rem] shadow-xl border border-slate-50">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-black uppercase italic tracking-tight">Ventas Semanales</h3>
                        <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">En Vivo</span>
                    </div>
                    <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartDays} barSize={32}>
                                <XAxis
                                    dataKey="dia"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }}
                                    dy={8}
                                />
                                <YAxis hide />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc', radius: 8 }}
                                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}
                                    formatter={(v: any) => [`$${Number(v).toLocaleString()}`, 'Ventas']}
                                />
                                <Bar dataKey="ventas" radius={[8, 8, 8, 8]}>
                                    {chartDays.map((entry, index) => (
                                        <Cell
                                            key={index}
                                            fill={entry.dia === 'Hoy' ? '#dc2626' : index === chartDays.length - 1 ? '#dc2626' : '#0f172a'}
                                            opacity={entry.ventas === 0 ? 0.2 : 1}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top 5 Productos */}
                <div className="lg:col-span-2 bg-white p-8 rounded-[3rem] shadow-xl border border-slate-50">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-lg font-black uppercase italic tracking-tight">Top 5 Productos</h3>
                        <div className="flex bg-slate-100 rounded-2xl p-1 gap-1">
                            {(['dia', 'semana', 'mes'] as TopPeriod[]).map(p => (
                                <button
                                    key={p}
                                    onClick={() => handleTopPeriod(p)}
                                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                        topPeriod === p
                                            ? 'bg-slate-900 text-white shadow-sm'
                                            : 'text-slate-400 hover:text-slate-600'
                                    }`}
                                >
                                    {p === 'dia' ? 'Hoy' : p === 'semana' ? 'Semana' : 'Mes'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-4 relative">
                        {loadingTop && (
                            <div className="absolute inset-0 bg-white/70 rounded-2xl flex items-center justify-center z-10">
                                <div className="animate-spin rounded-full h-6 w-6 border-2 border-capriccio-gold border-t-transparent" />
                            </div>
                        )}
                        {topProductos.map((p, i) => {
                            const maxPedidos = topProductos[0]?.total_pedidos || 1;
                            const pct = Math.round((Number(p.total_pedidos) / maxPedidos) * 100);
                            return (
                                <div key={i} className="space-y-1">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-capriccio-gold w-4">#{i + 1}</span>
                                            <span className="text-sm font-black italic text-slate-800 uppercase">{p.nombre}</span>
                                        </div>
                                        <span className="text-xs font-black text-slate-500">{p.total_pedidos} uds</span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-700"
                                            style={{
                                                width: `${pct}%`,
                                                background: i === 0 ? '#dc2626' : i === 1 ? '#0f172a' : '#94a3b8'
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                        {topProductos.length === 0 && !loadingTop && (
                            <p className="text-slate-300 text-center font-bold italic text-sm py-8">Sin datos aún</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Top Repartidores */}
            <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-50">
                <h3 className="text-lg font-black uppercase italic tracking-tight mb-6 flex items-center gap-3">
                    <Bike size={20} className="text-capriccio-gold" />
                    Eficiencia de Repartidores
                </h3>
                {topRepartidores.length === 0 ? (
                    <p className="text-slate-300 text-center font-bold italic py-8">Sin datos de entregas aún</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">
                                    <th className="pb-4 pr-8">#</th>
                                    <th className="pb-4 pr-8">Repartidor</th>
                                    <th className="pb-4 pr-8 text-center">⏱ Tiempo Prom.</th>
                                    <th className="pb-4 pr-8 text-center">Pedidos Hoy</th>
                                    <th className="pb-4 text-center">Pedidos Semana</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {topRepartidores.map((r, i) => (
                                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="py-4 pr-8">
                                            <span className={`text-sm font-black italic ${i === 0 ? 'text-capriccio-gold' : 'text-slate-300'}`}>
                                                #{i + 1}
                                            </span>
                                        </td>
                                        <td className="py-4 pr-8">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-capriccio-gold rounded-xl flex items-center justify-center text-slate-900 font-black text-xs">
                                                    {r.repartidor.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="font-black italic uppercase text-sm text-slate-800">{r.repartidor}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 pr-8 text-center">
                                            <span className={`font-black text-sm ${Number(r.avg_minutos) <= 30 ? 'text-green-600' : Number(r.avg_minutos) <= 45 ? 'text-amber-500' : 'text-red-500'}`}>
                                                {formatMins(Number(r.avg_minutos))}
                                            </span>
                                        </td>
                                        <td className="py-4 pr-8 text-center">
                                            <span className="font-black text-slate-800">{r.pedidos_hoy}</span>
                                        </td>
                                        <td className="py-4 text-center">
                                            <span className="font-black text-slate-800">{r.pedidos_semana}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
