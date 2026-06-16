'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from '@/lib/socket';

/* ─── Types ──────────────────────────────────────────────── */
interface Metricas {
  total_pedidos: number;
  pedidos_activos: number;
  pendientes_cobro: number;
  total_monto: number;
  efectivo_cobrado: number;
  tarjeta_cobrado: number;
  transferencia_cobrada: number;
  total_cobrado: number;
  monto_sin_cobrar: number;
  ordenes_sin_cobrar: number;
}

interface Pedido {
  order_id: string;
  cajero_nombre: string;
  cliente_nombre: string;
  telefono: string;
  total: number;
  status: string;
  metodo_entrega: string;
  order_origin: string;
  payment_method: string;
  liquidado: number;
  hora: string;
}

interface ResumenData {
  fecha: string;
  hora_actualizacion: string;
  metricas: Metricas;
  pedidos: Pedido[];
}

/* ─── Helpers ────────────────────────────────────────────── */
const fmt = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 });

function entregaInfo(metodo: string): { label: string; emoji: string; color: string } {
  if (metodo === 'domicilio')   return { label: 'Domicilio',  emoji: '🛵', color: 'bg-blue-100 text-blue-700' };
  if (metodo === 'sucursal')    return { label: 'Sucursal',   emoji: '🍽️', color: 'bg-purple-100 text-purple-700' };
  if (metodo === 'para_llevar') return { label: 'Para llevar',emoji: '🛍️', color: 'bg-amber-100 text-amber-700' };
  return { label: metodo, emoji: '📦', color: 'bg-gray-100 text-gray-600' };
}

function statusInfo(status: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    pendiente:    { label: 'Pendiente',   color: 'bg-yellow-100 text-yellow-700' },
    confirmado:   { label: 'Confirmado',  color: 'bg-blue-100 text-blue-700'    },
    en_cocina:    { label: 'En cocina',   color: 'bg-orange-100 text-orange-700'},
    listo:        { label: 'Listo',       color: 'bg-green-100 text-green-700'  },
    en_camino:    { label: 'En camino',   color: 'bg-indigo-100 text-indigo-700'},
    entregado:    { label: 'Entregado',   color: 'bg-emerald-100 text-emerald-700'},
    cancelado:    { label: 'Cancelado',   color: 'bg-red-100 text-red-600'      },
  };
  return map[status] ?? { label: status, color: 'bg-gray-100 text-gray-600' };
}

function pagoInfo(method: string): { label: string; emoji: string } {
  if (method === 'efectivo')       return { label: 'Efectivo',      emoji: '💵' };
  if (method === 'tarjeta')        return { label: 'Tarjeta',       emoji: '💳' };
  if (method === 'transferencia')  return { label: 'Transferencia', emoji: '🏦' };
  return { label: 'Sin cobrar', emoji: '⏳' };
}

/* ─── Login screen ───────────────────────────────────────── */
function LoginScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [user, setUser]   = useState('');
  const [pass, setPass]   = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`${API_URL}/api/caja/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass }),
      });
      if (!r.ok) throw new Error('Credenciales incorrectas');
      const data = await r.json();
      localStorage.setItem('capriccio_token_caja', data.token);
      localStorage.setItem('capriccio_user_role',  data.role);
      onLogin(data.token);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full border border-gray-100">
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">🍕</div>
          <h1 className="text-xl font-black text-gray-900">Resumen del Día</h1>
          <p className="text-xs text-gray-400 mt-1">Capriccio Pizzería</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Usuario"
            value={user}
            onChange={e => setUser(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 outline-none text-gray-800 font-semibold"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={pass}
            onChange={e => setPass(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 outline-none text-gray-800 font-semibold"
          />
          {error && <p className="text-red-500 text-sm font-semibold text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black py-3 rounded-xl transition active:scale-95"
          >
            {loading ? 'Entrando...' : 'Ver Resumen'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────── */
export default function ResumenPage() {
  const [token, setToken]     = useState<string | null>(null);
  const [data, setData]       = useState<ResumenData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [lastRefresh, setLastRefresh] = useState('');
  const [countdown, setCountdown]     = useState(30);

  /* Read token from localStorage once mounted */
  useEffect(() => {
    const t = localStorage.getItem('capriccio_token_caja');
    if (t) setToken(t);
  }, []);

  const fetchData = useCallback(async (tok: string) => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`${API_URL}/api/resumen/dia`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (r.status === 401 || r.status === 403) {
        localStorage.removeItem('capriccio_token_caja');
        setToken(null);
        return;
      }
      if (!r.ok) throw new Error('Error al obtener datos');
      const json: ResumenData = await r.json();
      setData(json);
      setLastRefresh(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
      setCountdown(30);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  /* Initial fetch when token is known */
  useEffect(() => {
    if (token) fetchData(token);
  }, [token, fetchData]);

  /* Auto-refresh every 30 s */
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => fetchData(token), 30_000);
    return () => clearInterval(interval);
  }, [token, fetchData]);

  /* Countdown display */
  useEffect(() => {
    if (!token) return;
    const tick = setInterval(() => setCountdown(c => (c <= 1 ? 30 : c - 1)), 1_000);
    return () => clearInterval(tick);
  }, [token]);

  if (!token) return <LoginScreen onLogin={t => setToken(t)} />;

  const m = data?.metricas;

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Header ── */}
      <div className="bg-red-600 text-white px-4 py-4 sticky top-0 z-30 shadow-lg">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🍕</span>
              <h1 className="text-lg font-black leading-tight">Resumen del Día</h1>
            </div>
            {data && (
              <p className="text-red-100 text-xs mt-0.5 capitalize">{data.fecha}</p>
            )}
          </div>
          <div className="text-right">
            <button
              onClick={() => token && fetchData(token)}
              disabled={loading}
              className="bg-white/20 hover:bg-white/30 active:scale-95 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition"
            >
              {loading ? '⌛' : '🔄'} Actualizar
            </button>
            <p className="text-red-200 text-[10px] mt-1">
              Refresca en {countdown}s {lastRefresh && `· ${lastRefresh}`}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-3 py-4 space-y-4">

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-semibold">
            ⚠️ {error}
          </div>
        )}

        {!data && loading && (
          <div className="text-center py-16 text-gray-400 text-sm font-semibold">
            Cargando datos...
          </div>
        )}

        {m && (
          <>
            {/* ── MONTO EN CAJA (efectivo) ── */}
            <div className="bg-emerald-600 rounded-2xl p-5 text-white shadow-lg">
              <p className="text-emerald-100 text-xs font-black uppercase tracking-widest mb-1">
                💵 Monto en Caja (Efectivo)
              </p>
              <p className="text-4xl font-black">{fmt(m.efectivo_cobrado)}</p>
              <p className="text-emerald-200 text-xs mt-1">Efectivo cobrado y liquidado hoy</p>
            </div>

            {/* ── 3 counters ── */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 text-center">
                <p className="text-2xl font-black text-gray-900">{m.total_pedidos}</p>
                <p className="text-[10px] font-black uppercase tracking-wide text-gray-500 mt-0.5">Total</p>
              </div>
              <div className="bg-white rounded-2xl p-3 shadow-sm border border-orange-100 text-center">
                <p className="text-2xl font-black text-orange-500">{m.pedidos_activos}</p>
                <p className="text-[10px] font-black uppercase tracking-wide text-orange-400 mt-0.5">Activos</p>
              </div>
              <div className="bg-white rounded-2xl p-3 shadow-sm border border-amber-100 text-center">
                <p className="text-2xl font-black text-amber-500">{m.pendientes_cobro}</p>
                <p className="text-[10px] font-black uppercase tracking-wide text-amber-400 mt-0.5">Por cobrar</p>
              </div>
            </div>

            {/* ── Desglose cobros ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50">
              <div className="px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Cobros del día</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-700">💵 Efectivo</span>
                    <span className="font-black text-emerald-600">{fmt(m.efectivo_cobrado)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-700">💳 Tarjeta</span>
                    <span className="font-black text-blue-600">{fmt(m.tarjeta_cobrado)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-700">🏦 Transferencia</span>
                    <span className="font-black text-purple-600">{fmt(m.transferencia_cobrada)}</span>
                  </div>
                  <div className="border-t border-gray-100 pt-2 flex justify-between items-center">
                    <span className="text-sm font-black text-gray-800">Total cobrado</span>
                    <span className="font-black text-gray-900 text-base">{fmt(m.total_cobrado)}</span>
                  </div>
                </div>
              </div>
              {m.ordenes_sin_cobrar > 0 && (
                <div className="px-4 py-3 bg-amber-50 rounded-b-2xl">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-amber-700">
                      ⏳ Sin cobrar ({m.ordenes_sin_cobrar} orden{m.ordenes_sin_cobrar !== 1 ? 'es' : ''})
                    </span>
                    <span className="font-black text-amber-600">{fmt(m.monto_sin_cobrar)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* ── Order list ── */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 px-1">
                Pedidos del día — más viejos primero
              </p>
              <div className="space-y-2">
                {data.pedidos.length === 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 px-4 py-8 text-center text-gray-400 text-sm">
                    Sin pedidos hoy
                  </div>
                )}
                {data.pedidos.map((p, idx) => {
                  const entrega = entregaInfo(p.metodo_entrega);
                  const st      = statusInfo(p.status);
                  const pago    = pagoInfo(p.payment_method);
                  const cobrado = p.liquidado === 1;
                  return (
                    <div
                      key={p.order_id}
                      className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
                        p.status === 'entregado' ? 'border-emerald-100 opacity-80' : 'border-gray-100'
                      }`}
                    >
                      {/* Row top */}
                      <div className="flex items-center gap-2 px-3 py-2.5">
                        {/* Index + order */}
                        <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center">
                          <span className="text-xs font-black text-gray-500">{idx + 1}</span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-black text-gray-900 text-sm"># {p.order_id}</span>
                            {/* Hora */}
                            <span className="text-[10px] font-mono text-gray-400">{p.hora}</span>
                          </div>
                          <p className="text-xs text-gray-500 truncate">
                            {p.cliente_nombre || 'Sin nombre'}{p.cajero_nombre ? ` · ${p.cajero_nombre}` : ''}
                          </p>
                        </div>

                        {/* Monto */}
                        <div className="text-right flex-shrink-0">
                          <p className="font-black text-gray-900 text-sm">{fmt(Number(p.total))}</p>
                          <p className="text-[10px] text-gray-400">{pago.emoji} {pago.label}</p>
                        </div>
                      </div>

                      {/* Row bottom badges */}
                      <div className="flex items-center gap-1.5 px-3 pb-2.5 flex-wrap">
                        {/* Entrega */}
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${entrega.color}`}>
                          {entrega.emoji} {entrega.label}
                        </span>

                        {/* Status */}
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${st.color}`}>
                          {st.label}
                        </span>

                        {/* Cobrado / pendiente */}
                        {cobrado ? (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                            ✅ Cobrado
                          </span>
                        ) : (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            ⏳ Pendiente
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="text-center py-4 text-xs text-gray-300 font-semibold">
              Capriccio Pizzería · {data.fecha}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
