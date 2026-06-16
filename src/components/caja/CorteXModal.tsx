'use client';

import React, { useState, useEffect } from 'react';
import { X, Printer, RefreshCcw } from 'lucide-react';
import { CajaTurno } from '@/data/caja-types';
import { API_URL } from '@/lib/socket';

interface CorteXModalProps {
  turno: CajaTurno;
  onClose: () => void;
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

/* ─── Imprime via iframe oculto ─── */
function printHtml(html: string) {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:80mm;height:1px;opacity:0;border:none;';
  document.body.appendChild(iframe);
  const cleanup = () => { if (document.body.contains(iframe)) document.body.removeChild(iframe); };
  let printed = false;
  const doPrint = () => {
    if (printed) return;
    printed = true;
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

/* ─── Genera HTML del Corte X ─── */
function buildCorteXHtml(
  turno: CajaTurno,
  resumen: Resumen,
  articulos: Articulo[],
  gastos: Gasto[],
  horaApertura: string,
  horaCorte: string
): string {
  const cajero = turno.cajero_nombre || 'Cajero';
  const fmt = (n: number) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 });

  const articulosHtml = articulos.map(a => `
    <tr>
      <td style="padding:2px 0;">${a.nombre} <span style="font-size:11px;color:#555;">(${a.size})</span></td>
      <td style="text-align:center;font-weight:bold;">${a.total_qty}</td>
      <td style="text-align:right;">$${fmt(a.total_monto)}</td>
    </tr>`).join('');

  const totalGastos = Number(resumen.total_gastos || 0);
  const efectivoEsperado = Number(turno.efectivo_inicial || 0) + Number(resumen.total_efectivo) - totalGastos;

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
    .row      { display: flex; justify-content: space-between; font-size: 12px; margin: 2px 0; }
    .row-bold { display: flex; justify-content: space-between; font-size: 13px; font-weight: bold; margin: 3px 0; }
  </style>
</head>
<body>

  <div class="center bold" style="font-size:16px;">CAPRICCIO PIZZERÍA</div>
  <div class="center" style="font-size:11px;">Pánuco, Ver.</div>
  <hr>
  <div class="center bold" style="font-size:15px;">*** CORTE X (PARCIAL) ***</div>
  <div class="center" style="font-size:11px;">TURNO EN CURSO — NO CIERRA TURNO</div>
  <hr>

  <div class="sec">DATOS DEL TURNO</div>
  <div class="row"><span>Cajero:</span><span><b>${cajero}</b></span></div>
  <div class="row"><span>Apertura:</span><span>${horaApertura}</span></div>
  <div class="row"><span>Corte X:</span><span>${horaCorte}</span></div>
  <div class="row"><span>Efectivo Inicial:</span><span>$${fmt(Number(turno.efectivo_inicial || 0))}</span></div>

  <hr>

  <div class="sec">RESUMEN DE VENTAS</div>
  <div class="row"><span>Total órdenes:</span><span><b>${resumen.total_ordenes}</b></span></div>
  <div class="row"><span>Órdenes pagadas:</span><span>${resumen.ordenes_pagadas}</span></div>
  ${Number(resumen.ordenes_sin_cobrar) > 0
    ? `<div class="row"><span>⚠ Sin cobrar:</span><span>${resumen.ordenes_sin_cobrar} ($${fmt(resumen.monto_sin_cobrar)})</span></div>` : ''}

  <hr>

  <div class="sec">INGRESOS POR MÉTODO DE PAGO</div>
  <div class="row"><span>Efectivo:</span><span><b>$${fmt(resumen.total_efectivo)}</b></span></div>
  <div class="row"><span>Tarjeta:</span><span><b>$${fmt(resumen.total_tarjeta)}</b></span></div>
  <div class="row"><span>Transferencia:</span><span><b>$${fmt(resumen.total_transferencia)}</b></span></div>
  <div class="hr-solid"></div>
  <div class="row-bold"><span>TOTAL COBRADO:</span><span>$${fmt(resumen.total_cobrado)}</span></div>
  ${Number(resumen.monto_sin_cobrar) > 0
    ? `<div class="row-bold"><span>TOTAL ESPERADO:</span><span>$${fmt(Number(resumen.total_cobrado) + Number(resumen.monto_sin_cobrar))}</span></div>` : ''}

  ${gastosHtml}

  <hr>

  <div class="sec">ARQUEO DE EFECTIVO</div>
  <div class="row"><span>Efectivo inicial:</span><span>$${fmt(Number(turno.efectivo_inicial || 0))}</span></div>
  <div class="row"><span>+ Ventas efectivo:</span><span>$${fmt(resumen.total_efectivo)}</span></div>
  ${totalGastos > 0 ? `<div class="row"><span>- Gastos:</span><span>-$${fmt(totalGastos)}</span></div>` : ''}
  <div class="hr-solid"></div>
  <div class="row-bold"><span>= En caja ahora:</span><span>$${fmt(efectivoEsperado)}</span></div>

  <hr>

  <div class="sec">CANAL DE PEDIDOS</div>
  ${Number(resumen.ordenes_presencial) > 0 ? `<div class="row"><span>Presencial:</span><span>${resumen.ordenes_presencial}</span></div>` : ''}
  ${Number(resumen.ordenes_llamada)   > 0 ? `<div class="row"><span>Llamada:</span><span>${resumen.ordenes_llamada}</span></div>` : ''}
  ${Number(resumen.ordenes_whatsapp)  > 0 ? `<div class="row"><span>WhatsApp:</span><span>${resumen.ordenes_whatsapp}</span></div>` : ''}
  ${Number(resumen.ordenes_web)       > 0 ? `<div class="row"><span>Web:</span><span>${resumen.ordenes_web}</span></div>` : ''}

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
  <div class="center bold">-- CORTE PARCIAL --</div>
  <div class="center" style="font-size:11px;">El turno continúa activo</div>
  <div class="center" style="font-size:11px;">${horaCorte}</div>
  <br><br><br>
</body>
</html>`;
}

/* ══════════════════════════════════════════════════════════ */

const CorteXModal: React.FC<CorteXModalProps> = ({ turno, onClose }) => {
  const [resumen, setResumen]     = useState<Resumen | null>(null);
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [gastos, setGastos]       = useState<Gasto[]>([]);
  const [horaApertura, setHoraApertura] = useState('');
  const [loading, setLoading]     = useState(true);
  const [printing, setPrinting]   = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/caja/reporte/turno/${turno.id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('capriccio_token_caja')}` },
      });
      if (res.ok) {
        const data = await res.json();
        setResumen(data.resumen || null);
        setArticulos(data.articulos || []);
        setGastos(data.gastos || []);
        setHoraApertura(
          data.turno?.hora_apertura_utc ||
          (turno.abierto_at ? new Date(turno.abierto_at).toLocaleString('es-MX') : '')
        );
      }
    } catch (e) {
      console.error('Error cargando corte X:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [turno.id]);

  const handlePrint = () => {
    if (!resumen) return;
    setPrinting(true);
    const horaCorte = new Date().toLocaleString('es-MX');
    printHtml(buildCorteXHtml(turno, resumen, articulos, gastos, horaApertura, horaCorte));
    setTimeout(() => setPrinting(false), 2000);
  };

  const fmt = (n: number) => Number(n || 0).toLocaleString('es-MX');

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[92vh] sm:max-h-[88vh] flex flex-col">

        {/* HEADER */}
        <div className="flex items-center gap-3 p-5 border-b flex-shrink-0">
          <div className="flex-1">
            <h2 className="text-lg font-black text-gray-900">📊 Corte X — Parcial</h2>
            <p className="text-xs text-gray-400 font-semibold mt-0.5">El turno continúa activo después de imprimir</p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition"
            title="Actualizar datos"
          >
            <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition">
            <X size={22} />
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400 gap-3">
              <RefreshCcw size={20} className="animate-spin" />
              <span className="font-bold text-sm">Cargando datos del turno...</span>
            </div>
          ) : !resumen ? (
            <div className="text-center py-12 text-gray-400 text-sm">No se pudo cargar el reporte</div>
          ) : (
            <>
              {/* INFO TURNO */}
              <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm border border-slate-100">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cajero</p>
                  <p className="font-black text-slate-900">{turno.cajero_nombre}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Apertura</p>
                  <p className="font-bold text-slate-700 text-xs">{horaApertura}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Efectivo Inicial</p>
                  <p className="font-black text-slate-900">${fmt(Number(turno.efectivo_inicial || 0))}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hora actual</p>
                  <p className="font-bold text-slate-700 text-xs">{new Date().toLocaleTimeString('es-MX')}</p>
                </div>
              </div>

              {/* INGRESOS */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Ingresos por Método de Pago</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
                    <p className="text-[10px] font-black uppercase text-green-500">Efectivo</p>
                    <p className="text-lg font-black text-green-700">${fmt(resumen.total_efectivo)}</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
                    <p className="text-[10px] font-black uppercase text-blue-500">Tarjeta</p>
                    <p className="text-lg font-black text-blue-700">${fmt(resumen.total_tarjeta)}</p>
                  </div>
                  <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-center">
                    <p className="text-[10px] font-black uppercase text-purple-500">Transfer.</p>
                    <p className="text-lg font-black text-purple-700">${fmt(resumen.total_transferencia)}</p>
                  </div>
                </div>
                <div className="mt-2 flex justify-between items-center bg-slate-900 text-white rounded-xl px-4 py-3">
                  <span className="font-black text-sm uppercase">Total Cobrado</span>
                  <span className="font-black text-2xl">${fmt(resumen.total_cobrado)}</span>
                </div>
                {Number(resumen.ordenes_sin_cobrar) > 0 && (
                  <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800 font-bold">
                    ⚠️ {resumen.ordenes_sin_cobrar} pedidos sin cobrar — ${fmt(resumen.monto_sin_cobrar)}
                  </div>
                )}
              </div>

              {/* GASTOS */}
              {gastos.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Gastos Registrados</p>
                  <div className="bg-orange-50 border border-orange-100 rounded-xl overflow-hidden">
                    <div className="divide-y divide-orange-100">
                      {gastos.map((g, i) => (
                        <div key={i} className="flex justify-between items-center px-3 py-2">
                          <div>
                            <span className="font-bold text-orange-900 text-sm">{g.concepto}</span>
                            <span className="text-[10px] text-orange-400 ml-2">{g.hora}</span>
                          </div>
                          <span className="font-black text-orange-700">-${fmt(Number(g.monto))}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center px-3 py-2 bg-orange-100 border-t border-orange-200">
                      <span className="font-black text-orange-800 text-sm">Total gastos</span>
                      <span className="font-black text-orange-800">-${fmt(Number(resumen.total_gastos || 0))}</span>
                    </div>
                  </div>
                  {/* Arqueo rápido */}
                  <div className="mt-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-600">Efectivo en caja ahora</span>
                    <span className="font-black text-slate-900">
                      ${fmt(Number(turno.efectivo_inicial || 0) + Number(resumen.total_efectivo) - Number(resumen.total_gastos || 0))}
                    </span>
                  </div>
                </div>
              )}

              {/* CANAL */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Canal de Pedidos</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: '🏪 Presencial', val: resumen.ordenes_presencial },
                    { label: '📞 Llamada',    val: resumen.ordenes_llamada },
                    { label: '💬 WhatsApp',   val: resumen.ordenes_whatsapp },
                    { label: '🌐 Web',        val: resumen.ordenes_web },
                  ].filter(c => Number(c.val) > 0).map((c, i) => (
                    <div key={i} className="bg-slate-50 border border-slate-100 rounded-xl p-2 text-center">
                      <p className="text-[10px] font-bold text-slate-500">{c.label}</p>
                      <p className="text-xl font-black text-slate-900">{c.val}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ARTÍCULOS */}
              {articulos.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Artículos Vendidos</p>
                  <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
                    <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-3 py-1.5 bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <span>Producto</span>
                      <span className="text-center">Cant</span>
                      <span className="text-right">Monto</span>
                    </div>
                    <div className="max-h-52 overflow-y-auto divide-y divide-slate-50">
                      {articulos.map((a, i) => (
                        <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-3 py-2 items-center">
                          <div>
                            <span className="font-bold text-slate-900 text-sm">{a.nombre}</span>
                            <span className="text-xs text-slate-400 ml-1">({a.size})</span>
                          </div>
                          <span className="font-black text-amber-600 text-sm text-center">×{a.total_qty}</span>
                          <span className="font-bold text-slate-700 text-sm text-right">${fmt(a.total_monto)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-5 border-t flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-sm transition"
          >
            Cerrar
          </button>
          <button
            onClick={handlePrint}
            disabled={loading || !resumen || printing}
            className="flex-1 py-3 bg-slate-900 hover:bg-black disabled:opacity-40 text-white rounded-xl font-black text-sm transition flex items-center justify-center gap-2 active:scale-95"
          >
            <Printer size={16} />
            {printing ? 'Imprimiendo...' : 'Imprimir Corte X'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default CorteXModal;
