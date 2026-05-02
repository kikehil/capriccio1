'use client';

import React, { useEffect, useState } from 'react';
import { Settings, MessageCircle, Save, CheckCircle, AlertCircle, Clock, Power, ShieldAlert } from 'lucide-react';
import { API_URL } from '@/lib/socket';

interface Config {
    whatsapp_negocio?: string;
    opening_time?: string;
    closing_time?: string;
    orders_enabled?: string;
}

type SaveStatus = 'idle' | 'ok' | 'error';

export default function SettingsModule() {
    const [config, setConfig] = useState<Config>({});
    const [loading, setLoading] = useState(true);
    const [waNumber, setWaNumber] = useState('');
    const [openingTime, setOpeningTime] = useState('10:00');
    const [closingTime, setClosingTime] = useState('21:30');
    const [ordersEnabled, setOrdersEnabled] = useState(true);

    const [waStatus, setWaStatus] = useState<SaveStatus>('idle');
    const [horarioStatus, setHorarioStatus] = useState<SaveStatus>('idle');
    const [toggleStatus, setToggleStatus] = useState<SaveStatus>('idle');
    const [savingWa, setSavingWa] = useState(false);
    const [savingHorario, setSavingHorario] = useState(false);
    const [savingToggle, setSavingToggle] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('capriccio_token_admin');
        fetch(`${API_URL}/api/config`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .then((data: Config) => {
                setConfig(data);
                setWaNumber(data.whatsapp_negocio || '5218181190257');
                setOpeningTime(data.opening_time || '10:00');
                setClosingTime(data.closing_time || '21:30');
                setOrdersEnabled(data.orders_enabled !== 'false');
            })
            .catch(() => setWaNumber('5218181190257'))
            .finally(() => setLoading(false));
    }, []);

    const patchConfig = async (payload: Record<string, string>) => {
        const token = localStorage.getItem('capriccio_token_admin');
        const r = await fetch(`${API_URL}/api/config`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload),
        });
        if (!r.ok) throw new Error();
    };

    const saveWa = async () => {
        setSavingWa(true);
        setWaStatus('idle');
        try {
            let num = waNumber.replace(/\D/g, '');
            if (num.length === 10) num = '521' + num;
            else if (num.startsWith('52') && num.length === 12) num = '521' + num.slice(2);
            await patchConfig({ whatsapp_negocio: num });
            setWaNumber(num);
            setWaStatus('ok');
        } catch {
            setWaStatus('error');
        } finally {
            setSavingWa(false);
            setTimeout(() => setWaStatus('idle'), 3000);
        }
    };

    const saveHorario = async () => {
        setSavingHorario(true);
        setHorarioStatus('idle');
        try {
            await patchConfig({ opening_time: openingTime, closing_time: closingTime });
            setHorarioStatus('ok');
        } catch {
            setHorarioStatus('error');
        } finally {
            setSavingHorario(false);
            setTimeout(() => setHorarioStatus('idle'), 3000);
        }
    };

    const toggleOrders = async () => {
        setSavingToggle(true);
        setToggleStatus('idle');
        const next = !ordersEnabled;
        try {
            await patchConfig({ orders_enabled: next ? 'true' : 'false' });
            setOrdersEnabled(next);
            setToggleStatus('ok');
        } catch {
            setToggleStatus('error');
        } finally {
            setSavingToggle(false);
            setTimeout(() => setToggleStatus('idle'), 3000);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-capriccio-gold border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-2xl space-y-8">
            <div>
                <h2 className="text-2xl font-black text-slate-900 italic">Configuración</h2>
                <p className="text-slate-500 text-sm mt-1">Ajustes generales del negocio</p>
            </div>

            {/* Botón de emergencia */}
            <div className={`rounded-[2rem] border-2 shadow-sm p-8 space-y-5 transition-colors ${ordersEnabled ? 'bg-white border-slate-200' : 'bg-red-50 border-red-300'}`}>
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${ordersEnabled ? 'bg-green-100' : 'bg-red-100'}`}>
                        <ShieldAlert size={20} className={ordersEnabled ? 'text-green-600' : 'text-red-600'} />
                    </div>
                    <div>
                        <h3 className="font-black text-slate-900 text-sm uppercase tracking-widest">Control de Pedidos</h3>
                        <p className="text-slate-400 text-xs">Activa o pausa la recepción de pedidos en cualquier momento</p>
                    </div>
                </div>

                <div className={`rounded-2xl px-5 py-4 flex items-center gap-3 ${ordersEnabled ? 'bg-green-50 border border-green-200' : 'bg-red-100 border border-red-300'}`}>
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${ordersEnabled ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                    <div>
                        <p className={`font-black text-sm ${ordersEnabled ? 'text-green-700' : 'text-red-700'}`}>
                            {ordersEnabled ? 'PEDIDOS ACTIVOS — recibiendo pedidos en línea' : 'PEDIDOS PAUSADOS — no se aceptan pedidos ahora'}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                            {ordersEnabled ? 'El portal de pedidos está abierto para clientes' : 'Los clientes verán un mensaje de pausa temporal'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={toggleOrders}
                        disabled={savingToggle}
                        className={`flex items-center gap-2 font-black text-xs uppercase tracking-widest px-6 py-3 rounded-xl transition-all active:scale-95 disabled:opacity-60 ${
                            ordersEnabled
                                ? 'bg-red-500 text-white hover:bg-red-600'
                                : 'bg-green-500 text-white hover:bg-green-600'
                        }`}
                    >
                        <Power size={15} />
                        {savingToggle ? 'Guardando...' : ordersEnabled ? 'Pausar pedidos' : 'Reactivar pedidos'}
                    </button>

                    {toggleStatus === 'ok' && (
                        <span className="flex items-center gap-1 text-green-600 text-sm font-bold">
                            <CheckCircle size={16} /> Listo
                        </span>
                    )}
                    {toggleStatus === 'error' && (
                        <span className="flex items-center gap-1 text-red-500 text-sm font-bold">
                            <AlertCircle size={16} /> Error
                        </span>
                    )}
                </div>
            </div>

            {/* Horario de atención */}
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                        <Clock size={20} className="text-blue-600" />
                    </div>
                    <div>
                        <h3 className="font-black text-slate-900 text-sm uppercase tracking-widest">Horario de Atención</h3>
                        <p className="text-slate-400 text-xs">Rango de horas en que se aceptan pedidos del portal web</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Apertura</label>
                        <input
                            type="time"
                            value={openingTime}
                            onChange={e => setOpeningTime(e.target.value)}
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-capriccio-gold focus:border-transparent"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Cierre</label>
                        <input
                            type="time"
                            value={closingTime}
                            onChange={e => setClosingTime(e.target.value)}
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-capriccio-gold focus:border-transparent"
                        />
                    </div>
                </div>

                <p className="text-xs text-slate-400">
                    Horario actual: <span className="font-mono bg-slate-100 px-1 rounded">{openingTime}</span> – <span className="font-mono bg-slate-100 px-1 rounded">{closingTime}</span> (hora de México)
                </p>

                <div className="flex items-center gap-4">
                    <button
                        onClick={saveHorario}
                        disabled={savingHorario}
                        className="flex items-center gap-2 bg-capriccio-gold text-capriccio-dark font-black text-xs uppercase tracking-widest px-6 py-3 rounded-xl hover:brightness-110 active:scale-95 transition-all disabled:opacity-60"
                    >
                        <Save size={15} />
                        {savingHorario ? 'Guardando...' : 'Guardar horario'}
                    </button>

                    {horarioStatus === 'ok' && (
                        <span className="flex items-center gap-1 text-green-600 text-sm font-bold">
                            <CheckCircle size={16} /> Guardado
                        </span>
                    )}
                    {horarioStatus === 'error' && (
                        <span className="flex items-center gap-1 text-red-500 text-sm font-bold">
                            <AlertCircle size={16} /> Error al guardar
                        </span>
                    )}
                </div>
            </div>

            {/* Tarjeta WhatsApp */}
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                        <MessageCircle size={20} className="text-green-600" />
                    </div>
                    <div>
                        <h3 className="font-black text-slate-900 text-sm uppercase tracking-widest">WhatsApp del Negocio</h3>
                        <p className="text-slate-400 text-xs">Número que recibe notificaciones de pedidos nuevos</p>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest">
                        Número (10 dígitos o formato completo)
                    </label>
                    <input
                        type="tel"
                        value={waNumber}
                        onChange={e => setWaNumber(e.target.value)}
                        placeholder="8181190257 o 5218181190257"
                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-capriccio-gold focus:border-transparent"
                    />
                    <p className="text-xs text-slate-400">
                        Se guarda como <span className="font-mono bg-slate-100 px-1 rounded">{
                            (() => {
                                let n = waNumber.replace(/\D/g, '');
                                if (n.length === 10) n = '521' + n;
                                else if (n.startsWith('52') && n.length === 12) n = '521' + n.slice(2);
                                return n ? `${n}@s.whatsapp.net` : '—';
                            })()
                        }</span>
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={saveWa}
                        disabled={savingWa}
                        className="flex items-center gap-2 bg-capriccio-gold text-capriccio-dark font-black text-xs uppercase tracking-widest px-6 py-3 rounded-xl hover:brightness-110 active:scale-95 transition-all disabled:opacity-60"
                    >
                        <Save size={15} />
                        {savingWa ? 'Guardando...' : 'Guardar'}
                    </button>

                    {waStatus === 'ok' && (
                        <span className="flex items-center gap-1 text-green-600 text-sm font-bold">
                            <CheckCircle size={16} /> Guardado
                        </span>
                    )}
                    {waStatus === 'error' && (
                        <span className="flex items-center gap-1 text-red-500 text-sm font-bold">
                            <AlertCircle size={16} /> Error al guardar
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
