'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  X, Search, CheckCircle, AlertCircle, CreditCard, Banknote,
  Loader2, Printer, XCircle, ShieldAlert, ChevronLeft
} from 'lucide-react';
import { CajaTurno } from '@/data/caja-types';
import { API_URL } from '@/lib/socket';

interface OrderItem {
  id?: number;
  nombre: string;
  quantity: number;
  size?: string;
  crust?: string;
  nota?: string;
  sauce?: string;
  totalItemPrice?: number;
  precio_unitario?: number;
}

interface Pedido {
  id: number;
  order_id: string;
  cliente_nombre: string;
  telefono: string;
  direccion: string;
  referencias?: string;
  total: number;
  status: string;
  liquidado: number;
  payment_method?: string;
  metodo_entrega?: string;
  order_origin?: string;
  created_at: string;
  items: OrderItem[];
}

interface BuscarPedidoModalProps {
  turno: CajaTurno;
  onClose: () => void;
}

/* ─── Imprimir ticket HTML en ventana oculta ─── */
function printHtmlTicket(html: string) {
  const win = window.open('', '_blank', 'width=320,height=600,left=-1000,top=-1000');
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.onload = () => { win.focus(); win.print(); setTimeout(() => win.close(), 1200); };
  setTimeout(() => { try { win.focus(); win.print(); setTimeout(() => win.close(), 1200); } catch (_) {} }, 600);
}

/* ─── Construir HTML de ticket a partir de un Pedido ─── */
function buildReprintTicketHtml(pedido: Pedido, copy: 'CLIENTE' | 'COCINA'): string {
  const shortId = (pedido.order_id || '').split('-')[1]?.toUpperCase()
    || (pedido.order_id || '').slice(-6).toUpperCase();

  const total = Number(pedido.total) || 0;

  const entregaLabel =
    pedido.metodo_entrega === 'sucursal' ? 'COMER EN SUCURSAL' :
    pedido.metodo_entrega === 'para_llevar' ? 'PARA LLEVAR' :
    pedido.metodo_entrega === 'domicilio' ? 'DOMICILIO' :
    (pedido.metodo_entrega || '').toUpperCase();

  const metodoPagoLabel =
    pedido.payment_method === 'efectivo' ? '💵 EFECTIVO' :
    pedido.payment_method === 'tarjeta' ? '💳 TARJETA' :
    pedido.payment_method === 'transferencia' ? '🏦 TRANSFERENCIA' : '⏳ PAGO EN ENTREGA';

  const itemsHtml = (pedido.items || []).map(item => {
    const price = Number(item.precio_unitario || item.totalItemPrice || 0);
    const qty = Number(item.quantity || 1);
    return `<tr>
      <td>${qty}x ${item.nombre}${item.size ? ` <small>(${item.size})</small>` : ''}</td>
      <td style="text-align:right;white-space:nowrap;">$${(price * qty).toLocaleString('es-MX')}</td>
    </tr>`;
  }).join('');

  const pagoSection = copy === 'CLIENTE'
    ? `<tr><td colspan="2"><hr style="border:1px dashed #000;margin:4px 0;"></td></tr>
       <tr><td><b>TOTAL</b></td><td style="text-align:right;"><b>$${total.toLocaleString('es-MX')}</b></td></tr>
       <tr><td>Pago</td><td style="text-align:right;">${metodoPagoLabel}</td></tr>`
    : `<tr><td colspan="2"><hr style="border:1px dashed #000;margin:4px 0;"></td></tr>
       <tr><td><b>TOTAL</b></td><td style="text-align:right;"><b>$${total.toLocaleString('es-MX')}</b></td></tr>`;

  const fecha = pedido.created_at
    ? new Date(pedido.created_at).toLocaleString('es-MX')
    : new Date().toLocaleString('es-MX');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    @page { margin: 3mm; size: 80mm auto; }
    * { box-sizing: border-box; }
    body { font-family: 'Courier New', Courier, monospace; font-size: 11px; width: 72mm; margin: 0 auto; color: #000; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .big { font-size: 14px; }
    .copy-label { text-align: center; border: 2px solid #000; padding: 2px 6px; font-size: 10px; font-weight: bold; margin-bottom: 4px; display: inline-block; }
    hr { border: none; border-top: 1px dashed #000; margin: 5px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 1px 0; vertical-align: top; }
    .section-title { font-weight: bold; border-bottom: 1px solid #000; margin-top: 5px; margin-bottom: 3px; }
    .reprint-notice { text-align: center; font-size: 9px; color: #555; }
  </style>
</head>
<body>
  <div class="center bold big">CAPRICCIO PIZZERÍA</div>
  <div class="center" style="font-size:9px;">Pánuco, Ver.</div>
  <hr>
  <div class="center"><span class="copy-label">COPIA: ${copy} — REIMPRESIÓN</span></div>
  <div class="center bold" style="font-size:13px;">ORDEN #${shortId}</div>
  <div class="center" style="font-size:9px;">${fecha}</div>
  <hr>

  <div class="section-title">CLIENTE</div>
  <table>
    <tr><td><b>${pedido.cliente_nombre || 'Sin nombre'}</b></td></tr>
    ${pedido.telefono ? `<tr><td>Tel: ${pedido.telefono}</td></tr>` : ''}
    ${pedido.direccion ? `<tr><td>Dir: ${pedido.direccion}</td></tr>` : ''}
    ${pedido.referencias ? `<tr><td>Ref: ${pedido.referencias}</td></tr>` : ''}
  </table>

  <div class="section-title">ENTREGA: ${entregaLabel}</div>

  <div class="section-title">ARTÍCULOS</div>
  <table>
    ${itemsHtml}
    ${pagoSection}
  </table>

  <hr>
  <div class="reprint-notice">*** REIMPRESIÓN ***</div>
  <div class="center bold" style="margin-top:6px;">¡GRACIAS POR SU PREFERENCIA!</div>
  <div class="center" style="font-size:9px;">capricciopizzeria.com</div>
  <br><br><br>
</body>
</html>`;
}

const STATUS_LABEL: Record<string, string> = {
  pendiente: 'PENDIENTE',
  recibido: 'RECIBIDO',
  en_preparacion: 'EN PREPARACIÓN',
  preparando: 'PREPARANDO',
  listo: 'LISTO',
  en_reparto: 'EN REPARTO',
  entregado: 'ENTREGADO',
  cancelado: 'CANCELADO',
};

const SIMPLE_CANCEL = ['recibido', 'pendiente'];
const SUPERVISED_CANCEL = ['en_preparacion', 'preparando', 'listo', 'en_reparto', 'entregado'];

type ViewMode = 'search' | 'detail' | 'cobro' | 'cancelar';

const BuscarPedidoModal: React.FC<BuscarPedidoModalProps> = ({ turno, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Pedido[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('search');

  // Cobro state
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'tarjeta'>('efectivo');
  const [montoRecibido, setMontoRecibido] = useState('');
  const [cobrandoId, setCobrandoId] = useState<string | null>(null);

  // Cancel state
  const [cancelLoading, setCancelLoading] = useState(false);
  const [supervisorUsername, setSupervisorUsername] = useState('');
  const [supervisorPassword, setSupervisorPassword] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [cancelSuccess, setCancelSuccess] = useState('');

  // General state
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSearch = (val: string) => {
    setQuery(val);
    setError('');
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (val.trim().length < 2) { setResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const token = localStorage.getItem('capriccio_token_caja');
        const res = await fetch(`${API_URL}/api/caja/buscar-pedido?q=${encodeURIComponent(val.trim())}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) setResults(await res.json());
      } catch (e) { console.error(e); }
      finally { setSearching(false); }
    }, 350);
  };

  const handleSelectPedido = (pedido: Pedido) => {
    setSelectedPedido(pedido);
    setMontoRecibido(String(pedido.total));
    setError(''); setSuccessMsg(''); setCancelError(''); setCancelSuccess('');
    setViewMode('detail');
  };

  const handleBack = () => {
    setSelectedPedido(null);
    setViewMode('search');
    setSupervisorUsername('');
    setSupervisorPassword('');
    setCancelError('');
    setCancelSuccess('');
  };

  /* ─── COBRAR ─── */
  const handleCobrar = async () => {
    if (!selectedPedido) return;
    setCobrandoId(selectedPedido.order_id);
    setError('');
    try {
      const token = localStorage.getItem('capriccio_token_caja');
      const res = await fetch(`${API_URL}/api/caja/cobrar-pedido/${selectedPedido.order_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          payment_method: paymentMethod,
          monto_recibido: parseFloat(montoRecibido) || selectedPedido.total,
          turno_id: turno.id,
          cajero_nombre: turno.cajero_nombre,
        })
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Error al cobrar'); }
      setSuccessMsg(`✅ Pedido ${selectedPedido.order_id} cobrado y liquidado`);
      setResults(prev => prev.filter(p => p.order_id !== selectedPedido.order_id));
      setSelectedPedido(null);
      setViewMode('search');
      setQuery('');
    } catch (e: any) {
      setError(e.message || 'Error al cobrar');
    } finally { setCobrandoId(null); }
  };

  /* ─── REIMPRIMIR ─── */
  const handleReprint = (pedido: Pedido) => {
    printHtmlTicket(buildReprintTicketHtml(pedido, 'CLIENTE'));
    setTimeout(() => printHtmlTicket(buildReprintTicketHtml(pedido, 'COCINA')), 1800);
  };

  /* ─── CANCELAR ─── */
  const handleCancelar = async (supervised: boolean) => {
    if (!selectedPedido) return;
    setCancelLoading(true);
    setCancelError('');
    try {
      const token = localStorage.getItem('capriccio_token_caja');
      const body: any = {};
      if (supervised) {
        body.supervisor_username = supervisorUsername.trim();
        body.supervisor_password = supervisorPassword;
      }
      const res = await fetch(`${API_URL}/api/caja/cancelar-pedido/${selectedPedido.order_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cancelar');

      setCancelSuccess(`✅ Pedido ${selectedPedido.order_id} cancelado${data.supervisor ? ` — autorizado por ${data.supervisor}` : ''}`);
      // Actualizar estado local
      setSelectedPedido(prev => prev ? { ...prev, status: 'cancelado' } : null);
      setResults(prev => prev.map(p => p.order_id === selectedPedido.order_id ? { ...p, status: 'cancelado' } : p));
      setViewMode('detail');
    } catch (e: any) {
      setCancelError(e.message || 'Error al cancelar');
    } finally { setCancelLoading(false); }
  };

  const cambio = selectedPedido ? (parseFloat(montoRecibido) || 0) - selectedPedido.total : 0;

  const statusBadge = (s: string, liq: number) => {
    if (liq) return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-green-100 text-green-700 uppercase">LIQUIDADO</span>;
    const map: Record<string, string> = {
      pendiente: 'bg-yellow-100 text-yellow-700',
      recibido: 'bg-yellow-100 text-yellow-700',
      preparando: 'bg-blue-100 text-blue-700',
      en_preparacion: 'bg-blue-100 text-blue-700',
      listo: 'bg-green-100 text-green-700',
      en_reparto: 'bg-purple-100 text-purple-700',
      entregado: 'bg-slate-100 text-slate-600',
      cancelado: 'bg-red-100 text-red-700',
    };
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${map[s] || 'bg-slate-100 text-slate-600'}`}>{STATUS_LABEL[s] || s}</span>;
  };

  /* ─── VISTA: CANCELAR CON SUPERVISOR ─── */
  const renderCancelarView = () => {
    if (!selectedPedido) return null;
    const needsSupervisor = SUPERVISED_CANCEL.includes(selectedPedido.status);

    return (
      <div className="space-y-4">
        <button onClick={() => setViewMode('detail')} className="text-xs text-gray-500 hover:text-gray-700 font-bold flex items-center gap-1">
          <ChevronLeft size={14} /> Volver al pedido
        </button>

        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <XCircle size={20} className="text-red-600 flex-shrink-0" />
            <span className="font-black text-red-800">Cancelar Pedido {selectedPedido.order_id}</span>
          </div>
          <p className="text-red-700 text-sm">
            Estatus actual: <strong>{STATUS_LABEL[selectedPedido.status] || selectedPedido.status}</strong>
          </p>
          {needsSupervisor && (
            <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
              <ShieldAlert size={12} /> Este pedido ya fue recibido por cocina. Se requiere autorización de supervisor.
            </p>
          )}
        </div>

        {cancelSuccess && (
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
            <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
            <p className="text-green-800 font-bold text-sm">{cancelSuccess}</p>
          </div>
        )}

        {cancelError && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
            <AlertCircle size={20} className="text-red-600 flex-shrink-0" />
            <p className="text-red-800 font-bold text-sm">{cancelError}</p>
          </div>
        )}

        {!cancelSuccess && (
          needsSupervisor ? (
            <div className="space-y-3">
              <p className="text-sm font-black text-gray-700">Credenciales del Supervisor</p>
              <input
                type="text"
                placeholder="Usuario del supervisor"
                value={supervisorUsername}
                onChange={e => setSupervisorUsername(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-gray-900 font-bold text-sm focus:border-red-500 focus:outline-none"
                autoComplete="off"
              />
              <input
                type="password"
                placeholder="Contraseña del supervisor"
                value={supervisorPassword}
                onChange={e => setSupervisorPassword(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-gray-900 font-bold text-sm focus:border-red-500 focus:outline-none"
                autoComplete="new-password"
              />
              <button
                onClick={() => handleCancelar(true)}
                disabled={cancelLoading || !supervisorUsername || !supervisorPassword}
                className="w-full py-4 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl font-black text-base transition flex items-center justify-center gap-2"
              >
                {cancelLoading ? <Loader2 size={18} className="animate-spin" /> : <ShieldAlert size={18} />}
                {cancelLoading ? 'Verificando...' : 'Autorizar y Cancelar Pedido'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleCancelar(false)}
              disabled={cancelLoading}
              className="w-full py-4 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl font-black text-base transition flex items-center justify-center gap-2"
            >
              {cancelLoading ? <Loader2 size={18} className="animate-spin" /> : <XCircle size={18} />}
              {cancelLoading ? 'Cancelando...' : 'Confirmar Cancelación'}
            </button>
          )
        )}
      </div>
    );
  };

  /* ─── VISTA: DETALLE + ACCIONES ─── */
  const renderDetailView = () => {
    if (!selectedPedido) return null;
    const canCobrar = !selectedPedido.liquidado && selectedPedido.status !== 'cancelado';
    const canCancel = selectedPedido.status !== 'cancelado' && selectedPedido.status !== 'entregado';
    const canCancelAdvanced = selectedPedido.status === 'entregado';

    return (
      <div className="space-y-4">
        <button onClick={handleBack} className="text-xs text-gray-500 hover:text-gray-700 font-bold flex items-center gap-1">
          <ChevronLeft size={14} /> Volver a resultados
        </button>

        {/* Resumen del pedido */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="font-black text-gray-900">{selectedPedido.order_id}</span>
            {statusBadge(selectedPedido.status, selectedPedido.liquidado)}
          </div>
          <p className="text-sm font-semibold text-gray-700">{selectedPedido.cliente_nombre}</p>
          <p className="text-xs text-gray-500 mb-3 capitalize">
            {selectedPedido.telefono && `📞 ${selectedPedido.telefono} · `}
            {selectedPedido.metodo_entrega} · {selectedPedido.order_origin}
          </p>

          {/* Items */}
          <div className="space-y-1 mb-3">
            {(selectedPedido.items || []).map((item, i) => {
              const price = Number(item.precio_unitario || item.totalItemPrice || 0);
              const qty = Number(item.quantity || 1);
              return (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-700">{qty}x {item.nombre}{item.size ? ` (${item.size})` : ''}</span>
                  <span className="font-bold text-gray-900">${(price * qty).toLocaleString()}</span>
                </div>
              );
            })}
          </div>

          <div className="border-t pt-2 flex justify-between font-black text-lg">
            <span>Total:</span>
            <span className="text-red-600">${selectedPedido.total?.toLocaleString()}</span>
          </div>
        </div>

        {/* Mensajes */}
        {successMsg && (
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
            <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
            <p className="text-green-800 font-bold text-sm">{successMsg}</p>
          </div>
        )}
        {cancelSuccess && (
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
            <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
            <p className="text-green-800 font-bold text-sm">{cancelSuccess}</p>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
            <AlertCircle size={20} className="text-red-600 flex-shrink-0" />
            <p className="text-red-800 font-bold text-sm">{error}</p>
          </div>
        )}

        {/* BOTONES DE ACCIÓN */}
        <div className="grid grid-cols-2 gap-2">
          {/* REIMPRIMIR */}
          <button
            onClick={() => handleReprint(selectedPedido)}
            className="flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-sm transition"
          >
            <Printer size={16} /> Reimprimir
          </button>

          {/* CANCELAR */}
          {(canCancel || canCancelAdvanced) && (
            <button
              onClick={() => {
                setCancelError(''); setCancelSuccess('');
                setViewMode('cancelar');
              }}
              className="flex items-center justify-center gap-2 py-3 bg-red-100 hover:bg-red-200 text-red-700 border border-red-300 rounded-xl font-black text-sm transition"
            >
              <XCircle size={16} /> Cancelar
            </button>
          )}
        </div>

        {/* COBRAR (si no está liquidado) */}
        {canCobrar && (
          <div className="space-y-3 pt-2 border-t border-gray-200">
            <p className="text-sm font-black text-gray-700">Método de Pago</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPaymentMethod('efectivo')}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm border-2 transition ${paymentMethod === 'efectivo' ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600 hover:border-green-400'}`}
              >
                <Banknote size={18} /> Efectivo
              </button>
              <button
                onClick={() => setPaymentMethod('tarjeta')}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm border-2 transition ${paymentMethod === 'tarjeta' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-blue-400'}`}
              >
                <CreditCard size={18} /> Tarjeta
              </button>
            </div>

            {paymentMethod === 'efectivo' && (
              <div>
                <p className="text-sm font-black text-gray-700 mb-2">Monto Recibido ($)</p>
                <input
                  type="number"
                  value={montoRecibido}
                  onChange={e => setMontoRecibido(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-gray-900 font-bold text-lg focus:border-red-500 focus:outline-none"
                />
                {parseFloat(montoRecibido) > 0 && (
                  <div className={`mt-2 flex justify-between font-black text-base px-1 ${cambio >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    <span>Cambio:</span>
                    <span>${cambio.toLocaleString()}</span>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleCobrar}
              disabled={!!cobrandoId || (paymentMethod === 'efectivo' && parseFloat(montoRecibido) < selectedPedido.total)}
              className="w-full py-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-xl font-black text-lg transition flex items-center justify-center gap-3"
            >
              {cobrandoId ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle size={20} />}
              {cobrandoId ? 'Procesando...' : `Cobrar $${selectedPedido.total?.toLocaleString()} y Liquidar`}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[92vh] sm:max-h-[90vh] flex flex-col">

        {/* HEADER */}
        <div className="flex items-center gap-3 p-5 border-b">
          <Search size={22} className="text-red-600" />
          <h2 className="text-xl font-black text-gray-900 flex-1">Buscar Pedido</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={24} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* BUSCADOR — siempre visible */}
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => handleSearch(e.target.value)}
              placeholder="# de orden (ej: ORD-1234) o teléfono"
              className="w-full pl-11 pr-4 py-3 border-2 border-gray-300 rounded-xl text-gray-900 font-bold text-sm focus:border-red-500 focus:outline-none"
            />
            {searching && <Loader2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />}
          </div>

          {/* ÉXITO GENERAL */}
          {successMsg && viewMode === 'search' && (
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
              <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
              <p className="text-green-800 font-bold text-sm">{successMsg}</p>
            </div>
          )}

          {/* ERROR GENERAL */}
          {error && viewMode === 'search' && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0" />
              <p className="text-red-800 font-bold text-sm">{error}</p>
            </div>
          )}

          {/* RESULTADOS */}
          {viewMode === 'search' && results.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">{results.length} resultado(s)</p>
              {results.map(pedido => (
                <button
                  key={pedido.order_id}
                  onClick={() => handleSelectPedido(pedido)}
                  className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-red-500 hover:bg-red-50 transition"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-black text-gray-900 text-sm">{pedido.order_id}</span>
                    {statusBadge(pedido.status, pedido.liquidado)}
                  </div>
                  <p className="text-xs text-gray-600 font-semibold">{pedido.cliente_nombre || 'Sin nombre'}</p>
                  {pedido.telefono && <p className="text-xs text-gray-400">📞 {pedido.telefono}</p>}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-500 capitalize">{pedido.metodo_entrega || '—'}</span>
                    <span className="font-black text-red-600">${pedido.total?.toLocaleString()}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {viewMode === 'search' && results.length === 0 && query.length >= 2 && !searching && (
            <p className="text-center text-sm text-gray-400 font-bold py-4">No se encontraron pedidos con "{query}"</p>
          )}

          {/* VISTAS SECUNDARIAS */}
          {viewMode === 'detail' && renderDetailView()}
          {viewMode === 'cancelar' && renderCancelarView()}
          {viewMode === 'cobro' && renderDetailView()}
        </div>
      </div>
    </div>
  );
};

export default BuscarPedidoModal;
