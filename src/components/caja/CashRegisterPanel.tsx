'use client';

import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, User, Globe, Monitor, Phone, MessageCircle, AlertTriangle, CheckCircle, Trash2, Plus } from 'lucide-react';
import { CajaTurno } from '@/data/caja-types';
import { API_URL } from '@/lib/socket';

interface CashRegisterStats {
  total_ordenes: number;
  ordenes_pagadas: number;
  total_efectivo: number;
  total_tarjeta: number;
  total_transferencia: number;
  ordenes_sin_cobrar: number;
  monto_sin_cobrar: number;
  ordenes_web: number;
  ordenes_presencial: number;
  ordenes_llamada: number;
  ordenes_whatsapp: number;
  ordenes_sin_canal: number;
  monto_web: number;
  monto_presencial: number;
  monto_llamada: number;
  monto_whatsapp: number;
  total_cobrado: number;
  total_gastos: number;
  gastos_count: number;
}

interface Gasto {
  id: number;
  concepto: string;
  monto: number;
  cajero_nombre: string;
  hora: string;
}

interface OrdenDetalle {
  id: number;
  order_id: string;
  cliente_nombre: string;
  total: number;
  payment_method?: string;
  metodo_entrega?: string;
  order_origin?: string;
  cajero_nombre?: string;
  liquidado_por?: string;
  liquidado: number;
  status: string;
  created_at: string;
}

interface CashRegisterPanelProps {
  turno: CajaTurno;
  isAdmin?: boolean;
}

const fmt = (n: number) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CashRegisterPanel: React.FC<CashRegisterPanelProps> = ({ turno, isAdmin = false }) => {
  const [viewMode, setViewMode] = useState<'turno' | 'dia'>(isAdmin ? 'dia' : 'turno');
  const [statsTurno, setStatsTurno] = useState<any>(null);
  const [stats, setStats] = useState<CashRegisterStats | null>(null);
  const [ordenes, setOrdenes] = useState<OrdenDetalle[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);
  const [duracionBase, setDuracionBase] = useState<number>(0);
  const [duracionBaseAt, setDuracionBaseAt] = useState<number>(Date.now());
  const [horaAperturaUTC, setHoraAperturaUTC] = useState<string>('');
  const [tickSecs, setTickSecs] = useState<number>(0);
  const [seccionActiva, setSeccionActiva] = useState<'conciliacion' | 'canales' | 'pendientes' | 'detalle' | 'gastos'>(isAdmin ? 'conciliacion' : 'gastos');

  /* ── Gastos form state ── */
  const [gastoConcepto, setGastoConcepto] = useState('');
  const [gastoMonto, setGastoMonto]       = useState('');
  const [gastoLoading, setGastoLoading]   = useState(false);
  const [gastoError, setGastoError]       = useState('');

  useEffect(() => {
    const t = setInterval(() => setTickSecs(Math.floor((Date.now() - duracionBaseAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [duracionBaseAt]);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [turno.id, viewMode]);

  const fetchStats = async () => {
    try {
      const url = viewMode === 'dia'
        ? `${API_URL}/api/caja/reporte/dia`
        : `${API_URL}/api/caja/reporte/turno/${turno.id}`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('capriccio_token_caja')}` },
      });
      if (response.ok) {
        const data = await response.json();
        const r = data.resumen;
        setStats({
          total_ordenes:       Number(r.total_ordenes       || 0),
          ordenes_pagadas:     Number(r.ordenes_pagadas     || 0),
          total_efectivo:      Number(r.total_efectivo      || 0),
          total_tarjeta:       Number(r.total_tarjeta       || 0),
          total_transferencia: Number(r.total_transferencia || 0),
          ordenes_sin_cobrar:  Number(r.ordenes_sin_cobrar  || 0),
          monto_sin_cobrar:    Number(r.monto_sin_cobrar    || 0),
          ordenes_web:         Number(r.ordenes_web         || 0),
          ordenes_presencial:  Number(r.ordenes_presencial  || 0),
          ordenes_llamada:     Number(r.ordenes_llamada     || 0),
          ordenes_whatsapp:    Number(r.ordenes_whatsapp    || 0),
          ordenes_sin_canal:   Number(r.ordenes_sin_canal   || 0),
          monto_web:           Number(r.monto_web           || 0),
          monto_presencial:    Number(r.monto_presencial    || 0),
          monto_llamada:       Number(r.monto_llamada       || 0),
          monto_whatsapp:      Number(r.monto_whatsapp      || 0),
          total_cobrado:       Number(r.total_cobrado       || 0),
          total_gastos:        Number(r.total_gastos        || 0),
          gastos_count:        Number(r.gastos_count        || 0),
        });
        if (data.ordenes) setOrdenes(data.ordenes);
        if (data.gastos)  setGastos(data.gastos);
        if (data.turno)   setStatsTurno(data.turno);
        if (data.turno?.duracion_segundos != null) {
          setDuracionBase(Number(data.turno.duracion_segundos));
          setDuracionBaseAt(Date.now());
          setTickSecs(0);
        }
        if (data.turno?.hora_apertura_utc) setHoraAperturaUTC(data.turno.hora_apertura_utc);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8 text-gray-600">Cargando datos...</div>;
  if (!stats) return null;

  const currentTurnoInfo = statsTurno || turno;
  const efectivoInicial = Number(currentTurnoInfo.efectivo_inicial || 0);
  const totalGastos     = stats.total_gastos || 0;
  const esperadoEnCaja  = efectivoInicial + stats.total_efectivo - totalGastos;
  const totalGeneral    = stats.monto_web + stats.monto_presencial + stats.monto_llamada + stats.monto_whatsapp;

  const duracionStr = (() => {
    const s = duracionBase + tickSecs;
    if (s < 0) return '0h 0m';
    return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  })();

  const handleAgregarGasto = async () => {
    if (!gastoConcepto.trim() || !gastoMonto) { setGastoError('Ingresa concepto y monto'); return; }
    setGastoLoading(true);
    setGastoError('');
    try {
      const r = await fetch(`${API_URL}/api/caja/gasto`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('capriccio_token_caja')}`,
        },
        body: JSON.stringify({ turno_id: turno.id, concepto: gastoConcepto.trim(), monto: parseFloat(gastoMonto) }),
      });
      if (!r.ok) throw new Error('Error al registrar gasto');
      setGastoConcepto('');
      setGastoMonto('');
      fetchStats(); // refresh todo
    } catch (e: unknown) {
      setGastoError(e instanceof Error ? e.message : 'Error');
    } finally {
      setGastoLoading(false);
    }
  };

  const handleEliminarGasto = async (id: number) => {
    if (!confirm('¿Eliminar este gasto?')) return;
    try {
      await fetch(`${API_URL}/api/caja/gasto/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('capriccio_token_caja')}` },
      });
      fetchStats();
    } catch (e) {
      console.error('Error eliminando gasto:', e);
    }
  };

  const tabs = [
    { id: 'conciliacion' as const, label: 'Conciliación de Caja', icon: <DollarSign size={16} />, adminOnly: true },
    { id: 'gastos'       as const, label: `Gastos (${stats.gastos_count || 0})`, icon: <Trash2 size={16} /> },
    { id: 'canales'      as const, label: 'Ventas por Canal',     icon: <TrendingUp size={16} />, adminOnly: true },
    { id: 'pendientes'   as const, label: `Sin Cobrar (${stats.ordenes_sin_cobrar})`, icon: <AlertTriangle size={16} />, adminOnly: true },
    { id: 'detalle'      as const, label: 'Detalle de Pedidos',   icon: <User size={16} />, adminOnly: true },
  ].filter(t => !t.adminOnly || isAdmin);

  const pagoLabel: Record<string, string> = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', no_pago: 'Sin cobro' };
  const entregaLabel: Record<string, string> = { domicilio: 'Domicilio', sucursal: 'Sucursal', para_llevar: 'Para Llevar' };
  const origenColor: Record<string, string> = {
    web:        'bg-blue-100 text-blue-700',
    llamada:    'bg-yellow-100 text-yellow-700',
    presencial: 'bg-purple-100 text-purple-700',
    whatsapp:   'bg-green-100 text-green-700',
  };

  const ordenesSinCobrar = ordenes.filter(o => o.payment_method === 'no_pago');

  return (
    <div className="space-y-6">

      {/* ── SELECTOR DE MODO DE VISTA (ADMIN ONLY) ─────────── */}
      {isAdmin && (
        <div className="flex bg-gray-150 p-1 rounded-xl max-w-md border border-gray-250">
          <button
            onClick={() => setViewMode('turno')}
            className={`flex-1 py-2 text-center text-xs font-black uppercase tracking-wider rounded-lg transition-all ${
              viewMode === 'turno'
                ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            📋 Turno de {turno.cajero_nombre}
          </button>
          <button
            onClick={() => setViewMode('dia')}
            className={`flex-1 py-2 text-center text-xs font-black uppercase tracking-wider rounded-lg transition-all ${
              viewMode === 'dia'
                ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            📅 Acumulado del Día (Todos)
          </button>
        </div>
      )}

      {/* ── TARJETAS RESUMEN ─────────────────────────────────── */}
      {isAdmin && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {[
            { label: 'Pedidos',       value: stats.total_ordenes,          icon: <TrendingUp size={20} className="text-blue-600" />,   color: 'bg-blue-50 border-blue-200' },
            { label: 'Efectivo',      value: fmt(stats.total_efectivo),    icon: <DollarSign size={20} className="text-green-600" />,  color: 'bg-green-50 border-green-200' },
            { label: 'Tarjeta/Trans', value: fmt(stats.total_tarjeta + stats.total_transferencia), icon: <DollarSign size={20} className="text-purple-600" />, color: 'bg-purple-50 border-purple-200' },
            { label: 'Sin Cobrar',    value: fmt(stats.monto_sin_cobrar),  icon: <AlertTriangle size={20} className="text-red-500" />, color: stats.ordenes_sin_cobrar > 0 ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-200' },
          ].map((c, i) => (
            <div key={i} className={`border-2 rounded-lg p-3 sm:p-4 ${c.color}`}>
              <div className="flex items-center gap-2 sm:gap-3">
                {c.icon}
                <div className="min-w-0">
                  <p className="text-gray-500 text-[10px] sm:text-xs font-medium">{c.label}</p>
                  <p className="text-base sm:text-xl font-black text-gray-800 mt-0.5 truncate">{c.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── INFO TURNO (compacta) ─────────────────────────────── */}
      <div className={`bg-white border border-gray-200 rounded-lg px-3 sm:px-6 py-3 sm:py-4 grid grid-cols-2 ${isAdmin ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-3 sm:gap-4 text-sm`}>
        {[
          { label: viewMode === 'dia' ? 'Modo' : 'Cajero', value: currentTurnoInfo.cajero_nombre },
          { label: viewMode === 'dia' ? 'Primera Apertura' : 'Apertura (hora)', value: (horaAperturaUTC || '—') + ' CDT' },
          ...(isAdmin ? [{ label: viewMode === 'dia' ? 'Efectivo Inicial (Total)' : 'Efectivo Inicial', value: fmt(efectivoInicial) }] : []),
          { label: viewMode === 'dia' ? 'Tiempo Transcurrido' : 'Duración', value: duracionStr },
        ].map((f, i) => (
          <div key={i}>
            <p className="text-gray-400 font-medium">{f.label}</p>
            <p className="font-bold text-gray-800 mt-0.5">{f.value}</p>
          </div>
        ))}
      </div>

      {/* ── TABS ─────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setSeccionActiva(tab.id)}
              className={`flex items-center gap-1.5 px-3 sm:px-5 py-3 text-xs sm:text-sm font-bold whitespace-nowrap transition border-b-2 flex-shrink-0 ${
                seccionActiva === tab.id
                  ? 'border-red-600 text-red-600 bg-red-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.icon}<span className="hidden xs:inline sm:inline">{tab.label}</span>
              <span className="xs:hidden sm:hidden">{tab.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        <div className="p-3 sm:p-6">

          {/* ══ CONCILIACIÓN DE CAJA ══════════════════════════════ */}
          {seccionActiva === 'conciliacion' && (
            <div className="max-w-lg mx-auto space-y-3">
              <h3 className="font-black text-gray-800 text-lg mb-4">
                {viewMode === 'dia' ? 'Conciliación Acumulada del Día (Todos)' : 'Conciliación de Caja — Turno Actual'}
              </h3>

              <Row label="Efectivo Inicial (fondo de caja)" value={fmt(efectivoInicial)} neutral />
              <Row label="+ Ventas cobradas en Efectivo"    value={fmt(stats.total_efectivo)} positive />
              {totalGastos > 0 && (
                <Row label={`− Gastos registrados (${stats.gastos_count})`} value={fmt(totalGastos)} warn />
              )}
              <div className="border-t-2 border-gray-300 pt-3">
                <Row label="= Efectivo esperado en caja"   value={fmt(esperadoEnCaja)} bold />
              </div>

              <div className="h-px bg-gray-100 my-2" />

              <Row label="Ventas en Tarjeta / Transferencia" value={fmt(stats.total_tarjeta + stats.total_transferencia)} neutral />
              <Row label="Pedidos pendientes de cobro"       value={`${fmt(stats.monto_sin_cobrar)} (${stats.ordenes_sin_cobrar} pedido${stats.ordenes_sin_cobrar !== 1 ? 's' : ''})`} warn={stats.ordenes_sin_cobrar > 0} />

              <div className="border-t-2 border-gray-300 pt-3">
                <Row label={viewMode === 'dia' ? "Total facturado en el día" : "Total facturado en el turno"} value={fmt(totalGeneral)} bold />
              </div>

              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                💡 Al contar la caja, deberías encontrar <strong>{fmt(esperadoEnCaja)}</strong>.
                {totalGastos > 0 && (
                  <span> Ya se descontaron <strong>{fmt(totalGastos)}</strong> de gastos registrados.</span>
                )}
                {stats.ordenes_sin_cobrar > 0 && (
                  <span className="text-orange-700"> Tienes <strong>{stats.ordenes_sin_cobrar} pedido(s)</strong> pendientes de cobrar por <strong>{fmt(stats.monto_sin_cobrar)}</strong> — cóbralos antes de cerrar.</span>
                )}
              </div>
            </div>
          )}

          {/* ══ GASTOS ════════════════════════════════════════════ */}
          {seccionActiva === 'gastos' && (
            <div className="max-w-lg mx-auto space-y-4">
              <h3 className="font-black text-gray-800 text-lg">
                {viewMode === 'dia' ? '💸 Gastos del Día' : '💸 Gastos del Turno'}
              </h3>
              <p className="text-sm text-gray-400 -mt-2">Registra salidas de efectivo de caja (se descuentan del arqueo).</p>

              {/* Formulario */}
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
                <p className="text-xs font-black uppercase tracking-widest text-orange-600">Registrar Gasto</p>
                <input
                  type="text"
                  placeholder="Concepto (ej. Cambio de gas, compra insumos...)"
                  value={gastoConcepto}
                  onChange={e => setGastoConcepto(e.target.value)}
                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-800 outline-none focus:border-orange-400 bg-white"
                  onKeyDown={e => e.key === 'Enter' && handleAgregarGasto()}
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Monto $"
                    value={gastoMonto}
                    onChange={e => setGastoMonto(e.target.value)}
                    inputMode="numeric"
                    className="flex-1 px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-800 outline-none focus:border-orange-400 bg-white"
                    onKeyDown={e => e.key === 'Enter' && handleAgregarGasto()}
                  />
                  <button
                    onClick={handleAgregarGasto}
                    disabled={gastoLoading}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-black rounded-xl transition text-sm active:scale-95"
                  >
                    <Plus size={16} />
                    Agregar
                  </button>
                </div>
                {gastoError && <p className="text-red-500 text-xs font-semibold">{gastoError}</p>}
                {viewMode === 'dia' && (
                  <p className="text-[10px] text-orange-600 font-bold mt-1">
                    ⚠️ El Gasto se registrará en tu turno actual ({turno.cajero_nombre}).
                  </p>
                )}
              </div>

              {/* Lista de gastos */}
              {gastos.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-3xl mb-2">🧾</p>
                  <p className="text-sm font-semibold">Sin gastos registrados</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {gastos.map(g => (
                      <div key={g.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 text-sm truncate">{g.concepto}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{g.hora} · {g.cajero_nombre}</p>
                        </div>
                        <span className="font-black text-orange-600 text-base flex-shrink-0">{fmt(Number(g.monto))}</span>
                        {isAdmin && (
                          <button
                            onClick={() => handleEliminarGasto(g.id)}
                            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition flex-shrink-0"
                            title="Eliminar gasto"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center bg-orange-100 border border-orange-200 rounded-xl px-4 py-3">
                    <span className="font-black text-orange-800 text-sm">Total gastos</span>
                    <span className="font-black text-orange-700 text-lg">{fmt(totalGastos)}</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ══ VENTAS POR CANAL ══════════════════════════════════ */}
          {seccionActiva === 'canales' && (
            <div className="space-y-4">
              <h3 className="font-black text-gray-800 text-lg mb-4">Ventas por Canal de Venta</h3>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <CanalCard
                  icon={<Globe size={24} className="text-blue-600" />}
                  label="Web / App"
                  color="border-blue-300 bg-blue-50"
                  pedidos={stats.ordenes_web}
                  monto={stats.monto_web}
                  total={totalGeneral}
                />
                <CanalCard
                  icon={<Monitor size={24} className="text-purple-600" />}
                  label="POS (Presencial)"
                  color="border-purple-300 bg-purple-50"
                  pedidos={stats.ordenes_presencial}
                  monto={stats.monto_presencial}
                  total={totalGeneral}
                />
                <CanalCard
                  icon={<MessageCircle size={24} className="text-green-600" />}
                  label="WhatsApp"
                  color="border-green-300 bg-green-50"
                  pedidos={stats.ordenes_whatsapp}
                  monto={stats.monto_whatsapp}
                  total={totalGeneral}
                />
                <CanalCard
                  icon={<Phone size={24} className="text-yellow-600" />}
                  label="Llamada"
                  color="border-yellow-300 bg-yellow-50"
                  pedidos={stats.ordenes_llamada}
                  monto={stats.monto_llamada}
                  total={totalGeneral}
                />
              </div>

              {/* Tabla comparativa */}
              <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Canal</th>
                      <th className="px-4 py-3 text-right">Pedidos</th>
                      <th className="px-4 py-3 text-right">Monto</th>
                      <th className="px-4 py-3 text-right">% del total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[
                      { label: '🌐 Web / App',      pedidos: stats.ordenes_web,        monto: stats.monto_web },
                      { label: '🖥️ POS Presencial', pedidos: stats.ordenes_presencial, monto: stats.monto_presencial },
                      { label: '💬 WhatsApp',        pedidos: stats.ordenes_whatsapp,   monto: stats.monto_whatsapp },
                      { label: '📞 Llamada',         pedidos: stats.ordenes_llamada,    monto: stats.monto_llamada },
                      ...(stats.ordenes_sin_canal > 0
                        ? [{ label: '❓ Sin canal',  pedidos: stats.ordenes_sin_canal,  monto: 0 }]
                        : []),
                    ].map((c, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-gray-700">{c.label}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{c.pedidos}</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-800">{fmt(c.monto)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-bold text-red-600">
                            {totalGeneral > 0 ? ((c.monto / totalGeneral) * 100).toFixed(1) : '0.0'}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                    <tr>
                      <td className="px-4 py-3 font-black text-gray-800">TOTAL</td>
                      <td className="px-4 py-3 text-right font-black text-gray-800">{stats.total_ordenes}</td>
                      <td className="px-4 py-3 text-right font-black text-red-600 text-base">{fmt(totalGeneral)}</td>
                      <td className="px-4 py-3 text-right font-black text-gray-600">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ══ PENDIENTES DE COBRO ═══════════════════════════════ */}
          {seccionActiva === 'pendientes' && (
            <div>
              <h3 className="font-black text-gray-800 text-lg mb-1">Pedidos Sin Cobrar</h3>
              <p className="text-sm text-gray-400 mb-4">
                {viewMode === 'dia'
                  ? 'Pedidos registrados como "Sin cobro" que deben cobrarse.'
                  : 'Pedidos registrados como "Sin cobro" que deben cobrarse antes de cerrar el turno.'}
              </p>

              {ordenesSinCobrar.length === 0 ? (
                <div className="text-center py-10">
                  <CheckCircle className="mx-auto text-green-500 mb-3" size={48} />
                  <p className="font-bold text-green-700 text-lg">¡Todo cobrado!</p>
                  <p className="text-gray-400 text-sm">No hay pedidos pendientes de cobro.</p>
                </div>
              ) : (
                <>
                  <div className="mb-4 p-3 bg-orange-50 border border-orange-300 rounded-lg text-sm text-orange-800 font-semibold">
                    ⚠️ {ordenesSinCobrar.length} pedido(s) pendiente(s) — Total: {fmt(stats.monto_sin_cobrar)}
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                        <tr>
                          <th className="px-4 py-3 text-left">Pedido</th>
                          <th className="px-4 py-3 text-left">Cliente</th>
                          <th className="px-4 py-3 text-left">Canal</th>
                          <th className="px-4 py-3 text-left">Entrega</th>
                          <th className="px-4 py-3 text-left">Hora</th>
                          <th className="px-4 py-3 text-right">Total</th>
                          <th className="px-4 py-3 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {ordenesSinCobrar.map(o => (
                          <tr key={o.order_id} className="hover:bg-orange-50">
                            <td className="px-4 py-3 font-mono font-bold text-red-600">{o.order_id}</td>
                            <td className="px-4 py-3 text-gray-700">{o.cliente_nombre || '—'}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${origenColor[o.order_origin || ''] || 'bg-gray-100 text-gray-600'}`}>
                                {o.order_origin || '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600">{entregaLabel[o.metodo_entrega || ''] || o.metodo_entrega || '—'}</td>
                            <td className="px-4 py-3 text-gray-500 text-xs">{new Date(o.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true })}</td>
                            <td className="px-4 py-3 text-right font-black text-gray-800">{fmt(o.total)}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-orange-100 text-orange-700 uppercase">{o.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                        <tr>
                          <td colSpan={5} className="px-4 py-3 font-bold text-gray-700">Total pendiente</td>
                          <td className="px-4 py-3 text-right font-black text-orange-600 text-base">{fmt(stats.monto_sin_cobrar)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ══ DETALLE DE PEDIDOS ════════════════════════════════ */}
          {seccionActiva === 'detalle' && (
            <div>
              <h3 className="font-black text-gray-800 text-lg mb-1">
                {viewMode === 'dia' ? 'Todos los Pedidos del Día' : 'Todos los Pedidos del Turno'}
              </h3>
              <p className="text-sm text-gray-400 mb-4">
                {viewMode === 'dia'
                  ? `${ordenes.length} pedido(s) registrados hoy.`
                  : `${ordenes.length} pedido(s) registrados en este turno.`}
              </p>

              {ordenes.length === 0 ? (
                <p className="text-center py-8 text-gray-400 font-semibold">Sin pedidos registrados</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                      <tr>
                        <th className="px-4 py-3 text-left">Pedido</th>
                        <th className="px-4 py-3 text-left">Cliente</th>
                        <th className="px-4 py-3 text-left">Canal</th>
                        <th className="px-4 py-3 text-left">Entrega</th>
                        <th className="px-4 py-3 text-left">Pago</th>
                        <th className="px-4 py-3 text-right">Total</th>
                        <th className="px-4 py-3 text-left">Cobró</th>
                        <th className="px-4 py-3 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {ordenes.map(o => {
                        const cobrador = o.cajero_nombre || o.liquidado_por || (o.liquidado ? 'Caja' : '—');
                        return (
                          <tr key={o.order_id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-mono font-bold text-gray-900">{o.order_id}</td>
                            <td className="px-4 py-3 text-gray-700">{o.cliente_nombre || '—'}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${origenColor[o.order_origin || ''] || 'bg-gray-100 text-gray-600'}`}>
                                {o.order_origin || '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600">{entregaLabel[o.metodo_entrega || ''] || o.metodo_entrega || '—'}</td>
                            <td className="px-4 py-3 text-gray-700">{pagoLabel[o.payment_method || ''] || o.payment_method || '—'}</td>
                            <td className="px-4 py-3 text-right font-black text-red-600">{fmt(o.total)}</td>
                            <td className="px-4 py-3 text-gray-500 text-xs">{cobrador}</td>
                            <td className="px-4 py-3 text-center">
                              {o.liquidado ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-green-100 text-green-700 uppercase">Liquidado</span>
                              ) : (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                  o.status === 'entregado' ? 'bg-slate-100 text-slate-600' :
                                  o.status === 'listo'     ? 'bg-green-100 text-green-700' :
                                  o.payment_method === 'no_pago' ? 'bg-orange-100 text-orange-700' :
                                  'bg-yellow-100 text-yellow-700'
                                }`}>{o.status}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                      <tr>
                        <td colSpan={5} className="px-4 py-3 font-bold text-gray-700">
                          {viewMode === 'dia' ? 'Total del Día' : 'Total del Turno'}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-xl text-red-600">
                          {fmt(ordenes.reduce((s, o) => s + Number(o.total || 0), 0))}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

/* ── Componentes auxiliares ─────────────────────────────────── */

function Row({ label, value, positive, bold, warn, neutral }: {
  label: string; value: string;
  positive?: boolean; bold?: boolean; warn?: boolean; neutral?: boolean;
}) {
  return (
    <div className={`flex justify-between items-center py-1 ${bold ? 'font-black text-base' : 'text-sm'}`}>
      <span className={warn ? 'text-orange-700 font-semibold' : neutral ? 'text-gray-500' : 'text-gray-700'}>{label}</span>
      <span className={
        bold    ? 'text-gray-900 text-lg' :
        positive? 'text-green-700 font-bold' :
        warn    ? 'text-orange-600 font-bold' :
        'text-gray-800 font-semibold'
      }>{value}</span>
    </div>
  );
}

function CanalCard({ icon, label, color, pedidos, monto, total }: {
  icon: React.ReactNode; label: string; color: string;
  pedidos: number; monto: number; total: number;
}) {
  const pct = total > 0 ? ((monto / total) * 100).toFixed(1) : '0.0';
  return (
    <div className={`border-2 rounded-xl p-5 ${color}`}>
      <div className="flex items-center gap-3 mb-3">{icon}<span className="font-black text-gray-800">{label}</span></div>
      <p className="text-3xl font-black text-gray-900">${Number(monto).toLocaleString('es-MX', { minimumFractionDigits: 0 })}</p>
      <p className="text-sm text-gray-500 mt-1">{pedidos} pedido{pedidos !== 1 ? 's' : ''} · <span className="font-bold text-red-600">{pct}%</span> del total</p>
      <div className="mt-3 h-2 bg-white/60 rounded-full overflow-hidden">
        <div className="h-full bg-current rounded-full transition-all" style={{ width: `${pct}%`, opacity: 0.5 }} />
      </div>
    </div>
  );
}

export default CashRegisterPanel;
