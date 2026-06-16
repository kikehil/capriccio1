'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Printer, ChevronDown, ChevronUp, RefreshCcw, Calendar } from 'lucide-react';
import { API_URL } from '@/lib/socket';

/* ─────────────────────────────────────────────── */
interface TurnoRow {
  id: number;
  cajero_nombre: string;
  cajero_id: number;
  efectivo_inicial: number;
  hora_apertura: string;
  hora_cierre: string | null;
  abierto_at: string;
  cerrado_at: string | null;
  fecha: string;
  total_ordenes: number;
  total_efectivo: number;
  total_tarjeta: number;
  total_transferencia: number;
  total_cobrado: number;
}

interface Articulo {
  nombre: string;
  size: string;
  total_qty: number;
  total_monto: number;
}

interface Gasto {
  id: number;
  concepto: string;
  monto: number;
  hora: string;
}

interface Resumen {
  total_ordenes: number;
  ordenes_pagadas: number;
  total_efectivo: number;
  total_tarjeta: number;
  total_transferencia: number;
  ordenes_sin_cobrar: number;
  monto_sin_cobrar: number;
  total_cobrado: number;
  total_gastos: number;
  ordenes_web: number;
  ordenes_presencial: number;
  ordenes_llamada: number;
  ordenes_whatsapp: number;
}

/* ─── Imprime via iframe oculto ─────────────────── */
function printHtml(html: string) {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:80mm;height:1px;opacity:0;border:none;';
  document.body.appendChild(iframe);
  const cleanup = () => { if (document.body.contains(iframe)) document.body.removeChild(iframe); };
  let printed = false;
  const doPrint = () => {
    if (printed) return; printed = true;
    try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch (_) {}
    iframe.contentWindow?.addEventListener('afterprint', cleanup);
    setTimeout(cleanup, 20000);
  };
  iframe.onload = doPrint;
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) { cleanup(); return; }
  doc.open(); doc.write(html); doc.close();
  setTimeout(doPrint, 600);
}

/* ─── HTML del corte histórico ──────────────────── */
function buildCorteHtml(turno: TurnoRow, resumen: Resumen, articulos: Articulo[], gastos: Gasto[] = []): string {
  const fmt = (n: number) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 });
  const totalGastos     = Number(resumen.total_gastos || 0);
  const efectivoEsperado = Number(turno.efectivo_inicial || 0) + Number(resumen.total_efectivo || 0) - totalGastos;

  const articulosHtml = articulos.map(a => `
    <tr>
      <td style="padding:2px 0;">${a.nombre} <span style="font-size:11px;color:#555;">(${a.size})</span></td>
      <td style="text-align:center;font-weight:bold;">${a.total_qty}</td>
      <td style="text-align:right;">$${fmt(a.total_monto)}</td>
    </tr>`).join('');

  const gastosHtml = gastos.length > 0 ? `
  <hr>
  <div class="sec">GASTOS REGISTRADOS</div>
  ${gastos.map(g => `<div class="row"><span>${g.hora} ${g.concepto}</span><span>-$${fmt(Number(g.monto))}</span></div>`).join('')}
  <div class="hr-solid"></div>
  <div class="row-bold"><span>TOTAL GASTOS:</span><span>-$${fmt(totalGastos)}</span></div>
  ` : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    @page { margin: 3mm; size: 80mm auto; }
    * { box-sizing: border-box; }
    body { font-family: 'Courier New', Courier, monospace; font-size: 13px; width: 72mm; margin: 0 auto; color: #000; }
    .center { text-align: center; }
    .bold   { font-weight: bold; }
    hr  { border: none; border-top: 1px dashed #000; margin: 5px 0; }
    .hr-solid { border: none; border-top: 2px solid #000; margin: 5px 0; }
    table { width: 100%; border-collapse: collapse; }
    td  { padding: 1px 0; vertical-align: top; font-size: 12px; }
    .sec { font-weight: bold; font-size: 12px; border-bottom: 1px solid #000; margin: 6px 0 3px; padding-bottom: 2px; }
    .row  { display: flex; justify-content: space-between; font-size: 12px; margin: 2px 0; }
    .row-bold { display: flex; justify-content: space-between; font-size: 13px; font-weight: bold; margin: 3px 0; }
    .total-box { border: 2px solid #000; padding: 4px 6px; margin: 6px 0; }
  </style>
</head>
<body>
  <div class="center bold" style="font-size:16px;">CAPRICCIO PIZZERÍA</div>
  <div class="center" style="font-size:11px;">Pánuco, Ver.</div>
  <hr>
  <div class="center bold" style="font-size:14px;">*** REIMPRESIÓN CORTE Z ***</div>
  <hr>

  <div class="sec">DATOS DEL TURNO</div>
  <div class="row"><span>Cajero:</span><span><b>${turno.cajero_nombre}</b></span></div>
  <div class="row"><span>Apertura:</span><span>${turno.hora_apertura}</span></div>
  <div class="row"><span>Cierre:</span><span>${turno.hora_cierre || 'En curso'}</span></div>
  <div class="row"><span>Efectivo Inicial:</span><span>$${fmt(Number(turno.efectivo_inicial || 0))}</span></div>
  <hr>

  <div class="sec">RESUMEN DE VENTAS</div>
  <div class="row"><span>Total órdenes:</span><span><b>${resumen.total_ordenes}</b></span></div>
  <div class="row"><span>Órdenes pagadas:</span><span>${resumen.ordenes_pagadas}</span></div>
  ${Number(resumen.ordenes_sin_cobrar) > 0
    ? `<div class="row"><span>⚠ Sin cobrar:</span><span>${resumen.ordenes_sin_cobrar} ($${fmt(resumen.monto_sin_cobrar)})</span></div>` : ''}
  <hr>

  <div class="sec">INGRESOS POR MÉTODO DE PAGO</div>
  <div class="row"><span>💵 Efectivo:</span><span><b>$${fmt(resumen.total_efectivo)}</b></span></div>
  <div class="row"><span>💳 Tarjeta:</span><span><b>$${fmt(resumen.total_tarjeta)}</b></span></div>
  <div class="row"><span>🏦 Transferencia:</span><span><b>$${fmt(resumen.total_transferencia)}</b></span></div>
  <div class="hr-solid"></div>
  <div class="row-bold"><span>TOTAL COBRADO:</span><span>$${fmt(resumen.total_cobrado)}</span></div>
  <hr>

  <div class="sec">ARTÍCULOS VENDIDOS</div>
  <table>
    <tr>
      <td style="font-weight:bold;font-size:11px;">PRODUCTO</td>
      <td style="text-align:center;font-weight:bold;font-size:11px;">CANT</td>
      <td style="text-align:right;font-weight:bold;font-size:11px;">MONTO</td>
    </tr>
    <tr><td colspan="3"><hr style="margin:2px 0;"></td></tr>
    ${articulosHtml}
  </table>
  <hr>

  ${gastosHtml}

  <div class="sec">ARQUEO DE EFECTIVO</div>
  <div class="row"><span>Efectivo inicial:</span><span>$${fmt(Number(turno.efectivo_inicial || 0))}</span></div>
  <div class="row"><span>+ Ventas efectivo:</span><span>$${fmt(resumen.total_efectivo)}</span></div>
  ${totalGastos > 0 ? `<div class="row"><span>- Gastos:</span><span>-$${fmt(totalGastos)}</span></div>` : ''}
  <div class="row-bold"><span>= Esperado en caja:</span><span>$${fmt(efectivoEsperado)}</span></div>
  <hr>

  <div class="center bold">-- REIMPRESIÓN --</div>
  <div class="center" style="font-size:11px;">Impreso: ${new Date().toLocaleString('es-MX')}</div>
  <br><br><br>
</body>
</html>`;
}

/* ══════════════════════════════════════════════ */
const ReportesPanel: React.FC = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('capriccio_token_caja') : '';

  // Filtros
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [fechaDesde, setFechaDesde] = useState(weekAgo);
  const [fechaHasta, setFechaHasta] = useState(today);
  const [cajeroFiltro, setCajeroFiltro] = useState('');

  const [turnos, setTurnos]       = useState<TurnoRow[]>([]);
  const [loading, setLoading]     = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detalle, setDetalle]     = useState<Record<number, { resumen: Resumen; articulos: Articulo[]; gastos: Gasto[] }>>({});
  const [loadingDetalle, setLoadingDetalle] = useState<number | null>(null);
  const [printing, setPrinting]   = useState<number | null>(null);

  const fetchTurnos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ fecha_desde: fechaDesde, fecha_hasta: fechaHasta });
      if (cajeroFiltro.trim()) params.set('cajero', cajeroFiltro.trim());
      const res = await fetch(`${API_URL}/api/caja/reportes/turnos?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTurnos(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Error fetchTurnos:', e);
    } finally {
      setLoading(false);
    }
  }, [fechaDesde, fechaHasta, cajeroFiltro, token]);

  useEffect(() => { fetchTurnos(); }, [fetchTurnos]);

  const fetchDetalle = async (turnoId: number) => {
    if (detalle[turnoId]) return; // ya cargado
    setLoadingDetalle(turnoId);
    try {
      const res = await fetch(`${API_URL}/api/caja/reporte/turno/${turnoId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDetalle(prev => ({
          ...prev,
          [turnoId]: { resumen: data.resumen, articulos: data.articulos || [], gastos: data.gastos || [] },
        }));
      }
    } catch (e) {
      console.error('Error fetchDetalle:', e);
    } finally {
      setLoadingDetalle(null);
    }
  };

  const toggleExpand = async (turnoId: number) => {
    if (expandedId === turnoId) {
      setExpandedId(null);
    } else {
      setExpandedId(turnoId);
      await fetchDetalle(turnoId);
    }
  };

  const handlePrint = async (turno: TurnoRow) => {
    setPrinting(turno.id);
    try {
      let d = detalle[turno.id];
      if (!d) {
        const res = await fetch(`${API_URL}/api/caja/reporte/turno/${turno.id}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          d = { resumen: data.resumen, articulos: data.articulos || [], gastos: data.gastos || [] };
          setDetalle(prev => ({ ...prev, [turno.id]: d }));
        }
      }
      if (d?.resumen) printHtml(buildCorteHtml(turno, d.resumen, d.articulos, d.gastos));
    } finally {
      setTimeout(() => setPrinting(null), 2000);
    }
  };

  const fmt = (n: number) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 0 });

  /* ─────── RENDER ─────────────────────────────── */
  return (
    <div className="space-y-5 max-w-4xl mx-auto">

      {/* ── Título ── */}
      <div>
        <h2 className="text-2xl font-black text-gray-900">📈 Reportes de Turno</h2>
        <p className="text-sm text-gray-400 font-medium mt-0.5">Consulta y reimprime cortes de caja históricos</p>
      </div>

      {/* ── Filtros ── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[130px]">
          <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">
            <Calendar size={10} className="inline mr-1" />Desde
          </label>
          <input
            type="date"
            value={fechaDesde}
            onChange={e => setFechaDesde(e.target.value)}
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:border-red-500 outline-none"
          />
        </div>
        <div className="flex-1 min-w-[130px]">
          <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">
            <Calendar size={10} className="inline mr-1" />Hasta
          </label>
          <input
            type="date"
            value={fechaHasta}
            onChange={e => setFechaHasta(e.target.value)}
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:border-red-500 outline-none"
          />
        </div>
        <div className="flex-1 min-w-[130px]">
          <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">
            <Search size={10} className="inline mr-1" />Cajero
          </label>
          <input
            type="text"
            value={cajeroFiltro}
            onChange={e => setCajeroFiltro(e.target.value)}
            placeholder="Todos"
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:border-red-500 outline-none"
          />
        </div>
        <button
          onClick={fetchTurnos}
          disabled={loading}
          className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black rounded-xl text-sm flex items-center gap-2 transition active:scale-95"
        >
          <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
          Buscar
        </button>
      </div>

      {/* ── Lista de turnos ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 gap-3">
          <RefreshCcw size={22} className="animate-spin" />
          <span className="font-bold text-sm">Cargando turnos...</span>
        </div>
      ) : turnos.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
          <p className="text-gray-300 font-black uppercase tracking-widest text-sm">Sin resultados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {turnos.map(turno => {
            const isOpen    = !turno.cerrado_at;
            const isExpanded = expandedId === turno.id;
            const d         = detalle[turno.id];

            return (
              <div key={turno.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">

                {/* ── Card header ── */}
                <div className="p-4 flex flex-wrap gap-3 items-center">

                  {/* Info turno */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-gray-900 text-base">{turno.cajero_nombre}</span>
                      {isOpen ? (
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-green-100 text-green-700 uppercase">En curso</span>
                      ) : (
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 uppercase">Cerrado</span>
                      )}
                      <span className="text-xs text-gray-400 font-semibold">#{turno.id}</span>
                    </div>
                    <p className="text-xs text-gray-500 font-semibold mt-0.5">
                      {turno.hora_apertura}
                      {turno.hora_cierre ? ` → ${turno.hora_cierre}` : ' → ahora'}
                    </p>
                  </div>

                  {/* Totales rápidos */}
                  <div className="flex gap-3 text-center">
                    <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase">Órdenes</p>
                      <p className="font-black text-gray-900">{turno.total_ordenes}</p>
                    </div>
                    <div className="border-l border-gray-100 pl-3">
                      <p className="text-[9px] font-black text-gray-400 uppercase">Cobrado</p>
                      <p className="font-black text-green-700">${fmt(turno.total_cobrado)}</p>
                    </div>
                    {Number(turno.total_tarjeta) > 0 && (
                      <div className="border-l border-gray-100 pl-3">
                        <p className="text-[9px] font-black text-blue-400 uppercase">Tarjeta</p>
                        <p className="font-black text-blue-700">${fmt(turno.total_tarjeta)}</p>
                      </div>
                    )}
                    {Number(turno.total_transferencia) > 0 && (
                      <div className="border-l border-gray-100 pl-3">
                        <p className="text-[9px] font-black text-purple-400 uppercase">Transfer.</p>
                        <p className="font-black text-purple-700">${fmt(turno.total_transferencia)}</p>
                      </div>
                    )}
                  </div>

                  {/* Botones */}
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handlePrint(turno)}
                      disabled={printing === turno.id}
                      title="Reimprimir corte"
                      className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-black disabled:opacity-50 text-white font-black rounded-xl text-xs transition active:scale-95"
                    >
                      <Printer size={13} />
                      {printing === turno.id ? '...' : 'Imprimir'}
                    </button>
                    <button
                      onClick={() => toggleExpand(turno.id)}
                      className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition"
                    >
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>

                {/* ── Detalle expandido ── */}
                {isExpanded && (
                  <div className="border-t border-gray-50 px-4 pb-4 pt-3 space-y-3">
                    {loadingDetalle === turno.id ? (
                      <div className="flex items-center gap-2 text-gray-400 text-sm py-4 justify-center">
                        <RefreshCcw size={16} className="animate-spin" /> Cargando detalle...
                      </div>
                    ) : d ? (
                      <>
                        {/* Métodos de pago */}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-green-50 border border-green-100 rounded-xl p-2 text-center">
                            <p className="text-[9px] font-black text-green-500 uppercase">Efectivo</p>
                            <p className="font-black text-green-700">${fmt(d.resumen.total_efectivo)}</p>
                          </div>
                          <div className="bg-blue-50 border border-blue-100 rounded-xl p-2 text-center">
                            <p className="text-[9px] font-black text-blue-500 uppercase">Tarjeta</p>
                            <p className="font-black text-blue-700">${fmt(d.resumen.total_tarjeta)}</p>
                          </div>
                          <div className="bg-purple-50 border border-purple-100 rounded-xl p-2 text-center">
                            <p className="text-[9px] font-black text-purple-500 uppercase">Transfer.</p>
                            <p className="font-black text-purple-700">${fmt(d.resumen.total_transferencia)}</p>
                          </div>
                        </div>

                        {/* Canal de pedidos */}
                        {(d.resumen.ordenes_presencial > 0 || d.resumen.ordenes_web > 0 ||
                          d.resumen.ordenes_llamada > 0 || d.resumen.ordenes_whatsapp > 0) && (
                          <div className="flex flex-wrap gap-2">
                            {[
                              { l: '🏪 Presencial', v: d.resumen.ordenes_presencial },
                              { l: '📞 Llamada',    v: d.resumen.ordenes_llamada },
                              { l: '💬 WhatsApp',   v: d.resumen.ordenes_whatsapp },
                              { l: '🌐 Web',        v: d.resumen.ordenes_web },
                            ].filter(c => c.v > 0).map((c, i) => (
                              <span key={i} className="text-[10px] font-bold bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 text-slate-600">
                                {c.l}: {c.v}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Gastos */}
                        {d.gastos && d.gastos.length > 0 && (
                          <div className="bg-orange-50 border border-orange-100 rounded-xl overflow-hidden">
                            <div className="px-3 py-1.5 bg-orange-100 text-[9px] font-black uppercase tracking-widest text-orange-600">
                              💸 Gastos Registrados
                            </div>
                            <div className="divide-y divide-orange-100">
                              {d.gastos.map((g, i) => (
                                <div key={i} className="flex justify-between items-center px-3 py-1.5">
                                  <span className="text-xs font-bold text-orange-900">{g.hora} — {g.concepto}</span>
                                  <span className="text-xs font-black text-orange-700">-${fmt(Number(g.monto))}</span>
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-between items-center px-3 py-1.5 bg-orange-100 border-t border-orange-200">
                              <span className="text-xs font-black text-orange-800">Total gastos</span>
                              <span className="text-xs font-black text-orange-800">-${fmt(Number(d.resumen.total_gastos || 0))}</span>
                            </div>
                          </div>
                        )}

                        {/* Artículos */}
                        {d.articulos.length > 0 && (
                          <div className="bg-gray-50 rounded-xl overflow-hidden">
                            <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-3 py-1.5 bg-gray-100 text-[9px] font-black uppercase tracking-widest text-gray-500">
                              <span>Producto</span><span className="text-center">Cant</span><span className="text-right">Monto</span>
                            </div>
                            <div className="max-h-48 overflow-y-auto divide-y divide-gray-100">
                              {d.articulos.map((a, i) => (
                                <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-3 py-1.5 items-center">
                                  <span className="text-xs font-bold text-gray-800">{a.nombre} <span className="text-gray-400 font-normal">({a.size})</span></span>
                                  <span className="text-xs font-black text-amber-600 text-center">×{a.total_qty}</span>
                                  <span className="text-xs font-bold text-gray-600 text-right">${fmt(a.total_monto)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-4">No se pudo cargar el detalle</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ReportesPanel;
