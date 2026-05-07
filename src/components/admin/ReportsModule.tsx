'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Download, Calendar, TrendingUp, Clock, BarChart3, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { API_URL } from '@/lib/socket';

interface Sale {
    id: string;
    createdAt?: string;
    created_at?: string;
    deliveredAt?: string;
    delivered_at?: string;
    cliente_nombre: string;
    total: number;
    items: any[];
    status?: string;
    repartidor?: string;
}

const ReportsModule: React.FC = () => {
    const [ventas, setVentas] = useState<Sale[]>([]);
    const [fechaInicio, setFechaInicio] = useState('');
    const [fechaFin, setFechaFin] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [hasMounted, setHasMounted] = useState(false);

    useEffect(() => {
        setHasMounted(true);
        fetchVentas();
    }, []);

    const fetchVentas = async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('capriccio_token_admin');
            const query = new URLSearchParams();
            if (fechaInicio) query.append('inicio', fechaInicio);
            if (fechaFin) query.append('fin', fechaFin);

            const res = await fetch(`${API_URL}/api/admin/reportes?${query.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                setVentas(data);
            }
        } catch (e) {
            console.error('Error fetching reportes:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const metrics = useMemo(() => {
        if (!ventas.length) return { avgDelivery: 0, growth: 12, total: 0, bestSellers: [] as [string, number][] };
        const total = ventas.reduce((acc, v) => acc + (Number(v.total) || 0), 0);

        const deliverys = ventas.filter(v => v.deliveredAt || v.delivered_at);
        const avg = deliverys.length ? deliverys.reduce((acc, v) => {
            const start = new Date(v.createdAt || v.created_at || Date.now()).getTime();
            const end = new Date(v.deliveredAt || v.delivered_at || Date.now()).getTime();
            return acc + (end - start) / 1000 / 60;
        }, 0) / deliverys.length : 30;

        const productCounts: Record<string, number> = {};
        ventas.forEach(v => {
            v.items?.forEach(it => {
                if (it.nombre) {
                    productCounts[it.nombre] = (productCounts[it.nombre] || 0) + (it.quantity || 1);
                }
            });
        });

        const best = Object.entries(productCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3) as [string, number][];

        return { avgDelivery: avg, growth: 12, total, bestSellers: best };
    }, [ventas]);

    const handleDownload = async () => {
        const { jsPDF } = await import('jspdf');
        const autoTable = (await import('jspdf-autotable')).default;
        const doc = new jsPDF() as any;

        doc.text("CAPRICCIO - REPORTE", 14, 20);

        const tableColumn = ['Ticket', 'Cliente', 'Estado', 'Total'];
        const tableRows = ventas.map(v => [
            String(v.id).slice(-6),
            v.cliente_nombre || 'Anónimo',
            v.status || 'Pendiente',
            `$${v.total}`
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 30
        });

        doc.save(`Reporte_Capriccio_${Date.now()}.pdf`);
    };

    if (!hasMounted) return null;

    return (
        <div className="bg-white p-6 md:p-10 rounded-[3rem] shadow-xl border border-slate-50 space-y-10 animate-in fade-in duration-500">
            {/* Header section */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className="bg-red-600 p-3 rounded-2xl text-white shadow-lg shadow-red-200">
                        <BarChart3 size={24} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black uppercase tracking-tighter italic text-slate-900 leading-none">Intelligence Center</h2>
                        <p className="text-slate-400 font-bold italic text-sm mt-1">Ventas y métricas operativas en tiempo real.</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <div className="text-center px-4 bg-slate-50 border border-slate-100 p-4 rounded-3xl shadow-inner">
                        <p className="text-[10px] font-black text-slate-400 uppercase">Total</p>
                        <p className="text-xl font-black italic text-slate-900">${metrics.total.toLocaleString()}</p>
                    </div>
                    <div className="text-center px-4 bg-slate-50 border border-slate-100 p-4 rounded-3xl shadow-inner">
                        <p className="text-[10px] font-black text-slate-400 uppercase">Órdenes</p>
                        <p className="text-xl font-black italic text-slate-900">{ventas.length}</p>
                    </div>
                </div>
            </div>

            {/* Filters section */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 flex items-center gap-2">
                        <Calendar size={12} /> INICIO
                    </label>
                    <input
                        type="date"
                        value={fechaInicio}
                        onChange={e => setFechaInicio(e.target.value)}
                        className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none font-bold text-slate-700"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 flex items-center gap-2">
                        <Calendar size={12} /> FIN
                    </label>
                    <input
                        type="date"
                        value={fechaFin}
                        onChange={e => setFechaFin(e.target.value)}
                        className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none font-bold text-slate-700"
                    />
                </div>
                <button
                    onClick={fetchVentas}
                    disabled={isLoading}
                    className="h-[56px] bg-red-600 text-white rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-red-700 transition-all active:scale-95 shadow-lg shadow-red-200"
                >
                    <Filter size={18} /> {isLoading ? 'CARGANDO...' : 'APLICAR FILTROS'}
                </button>
                <button
                    onClick={handleDownload}
                    disabled={ventas.length === 0}
                    className="h-[56px] bg-slate-900 text-white rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-black transition-all active:scale-95 shadow-lg shadow-slate-900/20"
                >
                    <Download size={18} /> REPORTE PDF
                </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 bg-slate-900 rounded-[2.5rem] text-white shadow-xl">
                    <Clock className="text-red-500 mb-2" size={24} />
                    <h4 className="text-4xl font-black italic">{metrics.avgDelivery.toFixed(0)} min</h4>
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">Promedio Entrega</p>
                </div>
                <div className="p-6 bg-red-600 rounded-[2.5rem] text-white shadow-xl shadow-red-100">
                    <TrendingUp className="text-white/50 mb-2" size={24} />
                    <h4 className="text-4xl font-black italic">+{metrics.growth}%</h4>
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Rendimiento Operativo</p>
                </div>
                <div className="p-6 bg-white border-2 border-slate-50 rounded-[2.5rem] space-y-2 shadow-sm">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 font-bold">­ƒöÑ Top Vendidos</p>
                    {metrics.bestSellers.length > 0 ? metrics.bestSellers.map(([name, qty], i) => (
                        <div key={i} className="flex justify-between items-center text-xs">
                            <span className="font-black text-slate-800 uppercase italic truncate pr-2 font-bold">{name}</span>
                            <span className="bg-slate-100 px-2 py-0.5 rounded font-black text-slate-900">{qty}</span>
                        </div>
                    )) : <p className="text-xs text-slate-300 italic">No hay datos suficientes</p>}
                </div>
            </div>

            {/* Main Table */}
            <div className="border border-slate-100 rounded-[3rem] overflow-hidden bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                            <tr>
                                <th className="p-5 pl-8 font-black">ID / Ticket</th>
                                <th className="p-5 font-black">Cliente</th>
                                <th className="p-5 font-black">Pedido Info</th>
                                <th className="p-5 text-center font-black">Tiempo Entrega</th>
                                <th className="p-5 font-black">Repartidor</th>
                                <th className="p-5 pr-8 text-right font-black">Monto Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 font-bold text-slate-800">
                            {ventas.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-12 text-center text-slate-300 italic font-medium">
                                        No se encontraron registros para el periodo seleccionado.
                                    </td>
                                </tr>
                            ) : (
                                ventas.map((v, i) => {
                                    const created = new Date(v.createdAt || v.created_at || Date.now());
                                    const delivered = (v.deliveredAt || v.delivered_at) ? new Date(v.deliveredAt || v.delivered_at!) : null;
                                    let timeDisplay = '---';
                                    if (delivered) {
                                        const totalMins = Math.max(0, (delivered.getTime() - created.getTime()) / 1000 / 60);
                                        timeDisplay = `${Math.floor(totalMins)} min`;
                                    }

                                    return (
                                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="p-5 pl-8 font-black text-slate-400">#{String(v.id).slice(-4)}</td>
                                            <td className="p-5 font-bold italic">{v.cliente_nombre || 'Interno'}</td>
                                            <td className="p-5 font-medium">
                                                <div className="max-w-[200px] truncate text-[11px] uppercase opacity-70">
                                                    {v.items?.map(it => `${it.cantidad ?? it.quantity ?? '?'}x ${it.nombre}`).join(', ')}
                                                </div>
                                            </td>
                                            <td className="p-5 text-center">
                                                <span className={cn(
                                                    "px-2 py-1 rounded-lg text-[10px] font-black",
                                                    timeDisplay !== '---' ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-400"
                                                )}>
                                                    {timeDisplay}
                                                </span>
                                            </td>
                                            <td className="p-5">
                                                {v.repartidor ? (
                                                    <span className="bg-green-50 text-green-700 px-2 py-1 rounded-md text-[10px] font-black uppercase">
                                                        {v.repartidor}
                                                    </span>
                                                ) : <span className="text-slate-200">SIN ASIGNAR</span>}
                                            </td>
                                            <td className="p-5 pr-8 text-right font-black italic text-xl text-slate-900">${v.total}</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ReportsModule;
