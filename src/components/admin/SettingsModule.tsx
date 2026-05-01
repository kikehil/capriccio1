'use client';

import React, { useEffect, useState } from 'react';
import { Settings, MessageCircle, Save, CheckCircle, AlertCircle } from 'lucide-react';
import { API_URL } from '@/lib/socket';

interface Config {
    whatsapp_negocio?: string;
}

export default function SettingsModule() {
    const [config, setConfig] = useState<Config>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');
    const [waNumber, setWaNumber] = useState('');

    useEffect(() => {
        const token = localStorage.getItem('capriccio_token_admin');
        fetch(`${API_URL}/api/config`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .then((data: Config) => {
                setConfig(data);
                setWaNumber(data.whatsapp_negocio || '5218181190257');
            })
            .catch(() => setWaNumber('5218181190257'))
            .finally(() => setLoading(false));
    }, []);

    const save = async () => {
        setSaving(true);
        setStatus('idle');
        try {
            const token = localStorage.getItem('capriccio_token_admin');
            // Normalizar: quitar no-dígitos, asegurar prefijo 521 para México
            let num = waNumber.replace(/\D/g, '');
            if (num.length === 10) num = '521' + num;
            else if (num.startsWith('52') && num.length === 12) num = '521' + num.slice(2);

            const r = await fetch(`${API_URL}/api/config`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ whatsapp_negocio: num }),
            });
            if (!r.ok) throw new Error();
            setWaNumber(num);
            setStatus('ok');
        } catch {
            setStatus('error');
        } finally {
            setSaving(false);
            setTimeout(() => setStatus('idle'), 3000);
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
                        onClick={save}
                        disabled={saving}
                        className="flex items-center gap-2 bg-capriccio-gold text-capriccio-dark font-black text-xs uppercase tracking-widest px-6 py-3 rounded-xl hover:brightness-110 active:scale-95 transition-all disabled:opacity-60"
                    >
                        <Save size={15} />
                        {saving ? 'Guardando...' : 'Guardar'}
                    </button>

                    {status === 'ok' && (
                        <span className="flex items-center gap-1 text-green-600 text-sm font-bold">
                            <CheckCircle size={16} /> Guardado
                        </span>
                    )}
                    {status === 'error' && (
                        <span className="flex items-center gap-1 text-red-500 text-sm font-bold">
                            <AlertCircle size={16} /> Error al guardar
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
