'use client';

import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Printer } from 'lucide-react';
import { CajaTurno } from '@/data/caja-types';
import { API_URL } from '@/lib/socket';

interface ShiftReportModalProps {
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

/* ─── Imprime corte via iframe oculto ─── */
function printCorteHtml(html: string) {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:80mm;height:1px;opacity:0;border:none;';
  document.body.appendChild(iframe);

  const cleanup = () => {
    if (document.body.contains(iframe)) document.body.removeChild(iframe);
  };

  let printed = false;
  const doPrint = () => {
    if (printed) return;
    printed = true;
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (_) {}
    iframe.contentWindow?.addEventListener('afterprint', cleanup);
    setTimeout(cleanup, 20000);
  };

  iframe.onload = doPrint;

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) { cleanup(); return; }
  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(doPrint, 600);
}

/* ─── Genera HTML del corte de caja ─── */
function buildCorteHtml(
  turno: CajaTurno,
  resumen: Resumen,
  articulos: Articulo[],
  gastos: Gasto[],
  efectivoContado: number,
  notas: string,
  horaApertura: string,
  horaCierre: string
): string {
  const cajero = turno.cajero_nombre || 'Cajero';
  const fmt = (n: number) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 });

  const totalGastos     = Number(resumen.total_gastos || 0);
  const efectivoEsperado = Number(turno.efectivo_inicial || 0) + Number(resumen.total_efectivo || 0) - totalGastos;
  const diferencia = efectivoContado - efectivoEsperado;
  const difLabel = diferencia >= 0 ? `+$${fmt(diferencia)} SOBRANTE` : `-$${fmt(Math.abs(diferencia))} FALTANTE`;

  const gastosHtml = gastos.length > 0 ? `
  <hr>
  <div class="sec">GASTOS REGISTRADOS</div>
  ${gastos.map(g => `<div class="row"><span>${g.hora} ${g.concepto}</span><span>-$${fmt(Number(g.monto))}</span></div>`).join('')}
  <div class="hr-solid"></div>
  <div class="row-bold"><span>TOTAL GASTOS:</span><span>-$${fmt(totalGastos)}</span></div>
  ` : '';

  const articulosHtml = articulos.map(a => `
    <tr>
      <td style="padding:2px 0;">${a.nombre} <span style="font-size:11px;color:#555;">(${a.size})</span></td>
      <td style="text-align:center;font-weight:bold;">${a.total_qty}</td>
      <td style="text-align:right;">$${fmt(a.total_monto)}</td>
    </tr>`).join('');

  const notasHtml = notas.trim()
    ? `<div style="margin-top:6px;font-size:12px;color:#333;"><b>Notas:</b> ${notas}</div>`
    : '';

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
    .big    { font-size: 16px; }
    hr  { border: none; border-top: 1px dashed #000; margin: 5px 0; }
    .hr-solid { border: none; border-top: 2px solid #000; margin: 5px 0; }
    table { width: 100%; border-collapse: collapse; }
    td  { padding: 1px 0; vertical-align: top; font-size: 12px; }
    .sec { font-weight: bold; font-size: 12px; border-bottom: 1px solid #000; margin: 6px 0 3px; padding-bottom: 2px; }
    .row  { display: flex; justify-content: space-between; font-size: 12px; margin: 2px 0; }
    .row-bold { display: flex; justify-content: space-between; font-size: 13px; font-weight: bold; margin: 3px 0; }
    .total-box { border: 2px solid #000; padding: 4px 6px; margin: 6px 0; }
    .diff-pos { color: #000; font-weight: bold; }
    .diff-neg { color: #000; font-weight: bold; }
  </style>
</head>
<body>

  <div class="center bold big">CAPRICCIO PIZZERÍA</div>
  <div class="center" style="font-size:11px;">Pánuco, Ver.</div>
  <hr>
  <div class="center bold" style="font-size:15px;">*** CORTE DE CAJA ***</div>
  <hr>

  <!-- INFO DEL TURNO -->
  <div class="sec">DATOS DEL TURNO</div>
  <div class="row"><span>Cajero:</span><span><b>${cajero}</b></span></div>
  <div class="row"><span>Apertura:</span><span>${horaApertura}</span></div>
  <div class="row"><span>Cierre:</span><span>${horaCierre}</span></div>
  <div class="row"><span>Efectivo Inicial:</span><span>$${fmt(Number(turno.efectivo_inicial || 0))}</span></div>

  <hr>

  <!-- RESUMEN DE VENTAS -->
  <div class="sec">RESUMEN DE VENTAS</div>
  <div class="row"><span>Total órdenes:</span><span><b>${resumen.total_ordenes}</b></span></div>
  <div class="row"><span>Órdenes pagadas:</span><span>${resumen.ordenes_pagadas}</span></div>
  ${Number(resumen.ordenes_sin_cobrar) > 0
    ? `<div class="row"><span>⚠️ Sin cobrar:</span><span>${resumen.ordenes_sin_cobrar} ($${fmt(resumen.monto_sin_cobrar)})</span></div>` : ''}

  <hr>

  <!-- INGRESOS POR MÉTODO DE PAGO -->
  <div class="sec">INGRESOS POR MÉTODO DE PAGO</div>
  <div class="row"><span>💵 Efectivo:</span><span><b>$${fmt(resumen.total_efectivo)}</b></span></div>
  <div class="row"><span>💳 Tarjeta:</span><span><b>$${fmt(resumen.total_tarjeta)}</b></span></div>
  <div class="row"><span>🏦 Transferencia:</span><span><b>$${fmt(resumen.total_transferencia)}</b></span></div>
  <div class="hr-solid"></div>
  <div class="row-bold"><span>TOTAL COBRADO:</span><span>$${fmt(resumen.total_cobrado)}</span></div>

  <hr>

  <!-- CANAL DE VENTAS -->
  <div class="sec">CANAL DE PEDIDOS</div>
  ${Number(resumen.ordenes_presencial) > 0 ? `<div class="row"><span>🏪 Presencial:</span><span>${resumen.ordenes_presencial}</span></div>` : ''}
  ${Number(resumen.ordenes_llamada)   > 0 ? `<div class="row"><span>📞 Llamada:</span><span>${resumen.ordenes_llamada}</span></div>` : ''}
  ${Number(resumen.ordenes_whatsapp)  > 0 ? `<div class="row"><span>💬 WhatsApp:</span><span>${resumen.ordenes_whatsapp}</span></div>` : ''}
  ${Number(resumen.ordenes_web)       > 0 ? `<div class="row"><span>🌐 Web:</span><span>${resumen.ordenes_web}</span></div>` : ''}

  <hr>

  <!-- ARTÍCULOS VENDIDOS -->
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

  <!-- ARQUEO DE CAJA -->
  <div class="sec">ARQUEO DE EFECTIVO</div>
  <div class="row"><span>Efectivo inicial:</span><span>$${fmt(Number(turno.efectivo_inicial || 0))}</span></div>
  <div class="row"><span>+ Ventas efectivo:</span><span>$${fmt(resumen.total_efectivo)}</span></div>
  ${totalGastos > 0 ? `<div class="row"><span>- Gastos:</span><span>-$${fmt(totalGastos)}</span></div>` : ''}
  <div class="row-bold"><span>= Esperado en caja:</span><span>$${fmt(efectivoEsperado)}</span></div>
  <div class="row"><span>Efectivo contado:</span><span>$${fmt(efectivoContado)}</span></div>
  <div class="hr-solid"></div>
  <div class="total-box">
    <div style="text-align:center;font-weight:bold;font-size:14px;">
      DIFERENCIA: ${difLabel}
    </div>
  </div>

  ${notasHtml}

  <hr>
  <div class="center bold" style="margin-top:4px;">FIN DEL CORTE</div>
  <div class="center" style="font-size:11px;">${new Date().toLocaleString('es-MX')}</div>
  <br><br><br>
</body>
</html>`;
}

/* ══════════════════════════════════════════════════════════ */

const ShiftReportModal: React.FC<ShiftReportModalProps> = ({ turno, onClose }) => {
  const [efectivoReportado, setEfectivoReportado] = useState<string>('');
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [resumen, setResumen]     = useState<Resumen | null>(null);
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [gastos, setGastos]       = useState<Gasto[]>([]);
  const [horaApertura, setHoraApertura] = useState('');
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${API_URL}/api/caja/reporte/turno/${turno.id}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('capriccio_token_caja')}` },
        });
        if (response.ok) {
          const data = await response.json();
          setResumen(data.resumen || null);
          setArticulos(data.articulos || []);
          setGastos(data.gastos || []);
          setHoraApertura(
            data.turno?.hora_apertura_utc ||
            (turno.abierto_at ? new Date(turno.abierto_at).toLocaleString('es-MX') : '')
          );
        }
      } catch (err) {
        console.error('Error cargando stats del turno:', err);
      } finally {
        setLoadingStats(false);
      }
    };
    fetchStats();
  }, [turno.id]);

  const handleCloseTurno = async () => {
    if (!efectivoReportado) { setError('Ingresa el efectivo contado'); return; }
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/caja/turno/${turno.id}/cerrar`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('capriccio_token_caja')}`,
        },
        body: JSON.stringify({
          efectivo_reportado: parseFloat(efectivoReportado),
          notas,
        }),
      });

      if (!response.ok) throw new Error('Error al cerrar turno');

      // Imprimir corte antes de recargar
      if (resumen) {
        const horaCierre = new Date().toLocaleString('es-MX');
        const html = buildCorteHtml(
          turno,
          resumen,
          articulos,
          gastos,
          parseFloat(efectivoReportado),
          notas,
          horaApertura,
          horaCierre
        );
        printCorteHtml(html);
      }

      setSuccess(true);
      setTimeout(() => { window.location.reload(); }, 3000);
    } catch (err) {
      console.error('Error:', err);
      setError('Error al cerrar turno. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Reimprimir corte manualmente ── */
  const handleReimprimirCorte = () => {
    if (!resumen) return;
    const html = buildCorteHtml(
      turno,
      resumen,
      articulos,
      gastos,
      parseFloat(efectivoReportado || '0'),
      notas,
      horaApertura,
      new Date().toLocaleString('es-MX')
    );
    printCorteHtml(html);
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">¡Turno Cerrado!</h2>
          <p className="text-gray-600 mb-2">El turno se ha finalizado correctamente.</p>
          <p className="text-gray-500 text-sm">🖨️ Imprimiendo corte de caja...</p>
          <p className="text-gray-400 text-xs mt-2">Redirigiendo...</p>
        </div>
      </div>
    );
  }

  const contado = parseFloat(efectivoReportado || '0');
  const efectivoVentas = Number(resumen?.total_efectivo || 0);
  const totalGastos    = Number(resumen?.total_gastos || 0);
  const esperado = Number(turno.efectivo_inicial || 0) + efectivoVentas - totalGastos;
  const diferencia = contado - esperado;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-5 sticky top-0 bg-white pb-3 border-b">
          <h2 className="text-xl font-bold text-gray-800">📊 Cierre de Turno</h2>
          <div className="flex gap-2">
            {resumen && (
              <button
                onClick={handleReimprimirCorte}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-xs font-black transition"
              >
                <Printer size={14} /> Vista previa corte
              </button>
            )}
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><X size={24} /></button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg flex gap-3">
            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* TURNO INFO */}
        <div className="bg-gray-50 rounded-xl p-4 mb-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-gray-500 text-xs font-bold uppercase">Cajero</p>
            <p className="font-bold text-gray-900">{turno.cajero_nombre}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs font-bold uppercase">Apertura</p>
            <p className="font-bold text-gray-900">{horaApertura || '—'}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs font-bold uppercase">Efectivo Inicial</p>
            <p className="font-bold text-gray-900">${Number(turno.efectivo_inicial).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs font-bold uppercase">Hora Actual</p>
            <p className="font-bold text-gray-900">{new Date().toLocaleTimeString('es-MX')}</p>
          </div>
        </div>

        {loadingStats ? (
          <div className="text-center py-6 text-gray-400 text-sm">Cargando estadísticas...</div>
        ) : resumen && (
          <>
            {/* INGRESOS POR MÉTODO */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
              <h3 className="font-black text-gray-800 mb-3 text-sm uppercase tracking-widest">💰 Ingresos por Método de Pago</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 rounded-xl p-3 text-center border border-green-100">
                  <p className="text-xs font-black text-green-500 uppercase">Efectivo</p>
                  <p className="text-xl font-black text-green-700">${Number(resumen.total_efectivo).toLocaleString()}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
                  <p className="text-xs font-black text-blue-500 uppercase">Tarjeta</p>
                  <p className="text-xl font-black text-blue-700">${Number(resumen.total_tarjeta).toLocaleString()}</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-3 text-center border border-purple-100">
                  <p className="text-xs font-black text-purple-500 uppercase">Transferencia</p>
                  <p className="text-xl font-black text-purple-700">${Number(resumen.total_transferencia).toLocaleString()}</p>
                </div>
              </div>
              <div className="mt-3 flex justify-between items-center bg-slate-900 text-white rounded-xl px-4 py-3">
                <span className="font-black text-sm uppercase">Total Cobrado</span>
                <span className="font-black text-2xl">${Number(resumen.total_cobrado).toLocaleString()}</span>
              </div>
              {Number(resumen.ordenes_sin_cobrar) > 0 && (
                <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-amber-800 font-semibold">
                  ⚠️ {resumen.ordenes_sin_cobrar} pedidos sin cobrar (${Number(resumen.monto_sin_cobrar).toLocaleString()})
                </div>
              )}
            </div>

            {/* ARTÍCULOS */}
            {articulos.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
                <h3 className="font-black text-gray-800 mb-3 text-sm uppercase tracking-widest">🍕 Artículos Vendidos</h3>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {articulos.map((a, i) => (
                    <div key={i} className="flex items-center justify-between py-1 border-b border-gray-50">
                      <div className="flex-1">
                        <span className="font-bold text-gray-900 text-sm">{a.nombre}</span>
                        <span className="text-xs text-gray-400 ml-1">({a.size})</span>
                      </div>
                      <span className="font-black text-amber-600 text-sm mr-3">×{a.total_qty}</span>
                      <span className="font-bold text-gray-700 text-sm">${Number(a.total_monto).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* GASTOS */}
        {gastos.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
            <h3 className="font-black text-orange-800 mb-2 text-sm uppercase tracking-widest">💸 Gastos Registrados</h3>
            <div className="space-y-1.5 mb-3">
              {gastos.map(g => (
                <div key={g.id} className="flex justify-between items-center text-sm">
                  <span className="text-orange-700">{g.hora} — {g.concepto}</span>
                  <span className="font-black text-orange-800">${Number(g.monto).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between font-black text-orange-900 border-t border-orange-200 pt-2">
              <span>Total gastos</span>
              <span>${Number(resumen?.total_gastos || 0).toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* ARQUEO DE EFECTIVO */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
          <h3 className="font-black text-blue-900 mb-3 text-sm">💵 Arqueo de Efectivo</h3>
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-gray-600 mb-2">
              Efectivo Contado ($) *
            </label>
            <input
              type="number"
              value={efectivoReportado}
              onChange={(e) => setEfectivoReportado(e.target.value)}
              className="w-full px-4 py-3 text-xl font-bold border-2 border-gray-300 rounded-xl focus:border-blue-500 outline-none text-gray-900 bg-white"
              placeholder="0"
              autoFocus
              inputMode="numeric"
            />
          </div>

          {efectivoReportado && !loadingStats && resumen && (
            <div className="mt-3 bg-white rounded-xl border-2 border-blue-200 p-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Efectivo Inicial:</span>
                <span className="font-bold">${Number(turno.efectivo_inicial).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>+ Ventas Efectivo:</span>
                <span className="font-bold text-green-700">+${efectivoVentas.toLocaleString()}</span>
              </div>
              {totalGastos > 0 && (
                <div className="flex justify-between text-orange-700">
                  <span>− Gastos:</span>
                  <span className="font-bold">-${totalGastos.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-800 border-t pt-1.5">
                <span>= Esperado:</span>
                <span>${esperado.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Contado:</span>
                <span className="font-bold">${contado.toLocaleString()}</span>
              </div>
              <div className={`flex justify-between font-black text-lg border-t-2 pt-1.5 ${
                diferencia > 0 ? 'text-green-700' : diferencia < 0 ? 'text-red-600' : 'text-gray-900'
              }`}>
                <span>Diferencia:</span>
                <span>{diferencia >= 0 ? '+' : ''}{diferencia.toLocaleString()}</span>
              </div>
            </div>
          )}

          <div className="mt-3">
            <label className="block text-xs font-black uppercase tracking-widest text-gray-600 mb-2">Notas (opcional)</label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl outline-none text-gray-900 bg-white text-sm resize-none focus:border-blue-400"
              placeholder="Diferencias, observaciones..."
              rows={2}
            />
          </div>
        </div>

        {/* BUTTONS */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-bold transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleCloseTurno}
            disabled={loading || !efectivoReportado}
            className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl font-black transition flex items-center justify-center gap-2"
          >
            {loading ? 'Cerrando...' : '🖨️ Cerrar e Imprimir Corte'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default ShiftReportModal;
