'use client';

import React, { useState } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { CajaTurno, NewOrderRequest } from '@/data/caja-types';
import { API_URL } from '@/lib/socket';

interface StepProps {
  formData: any;
  updateFormData: (data: any) => void;
  turno: CajaTurno;
  onReset: () => void;
  onPrev: () => void;
}

/* ─── Imprime ticket via iframe oculto (sin popup de ventana) ─── */
/* Con Chrome lanzado con --kiosk-printing: envía directo a impresora  */
/* sin mostrar ningún diálogo. Sin ese flag muestra el diálogo normal. */
function printHtmlTicket(html: string) {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:80mm;height:1px;opacity:0;border:none;';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) { document.body.removeChild(iframe); return; }
  doc.open();
  doc.write(html);
  doc.close();
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (_) {}
    const cleanup = () => { if (document.body.contains(iframe)) document.body.removeChild(iframe); };
    iframe.contentWindow?.addEventListener('afterprint', cleanup);
    setTimeout(cleanup, 15000);
  };
}

const ConfirmationStep: React.FC<StepProps> = ({ formData, turno, onReset, onPrev }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState('');

  // Calcular total desde items si formData.total no fue propagado correctamente
  const computedTotal: number =
    formData.total && formData.total > 0
      ? formData.total
      : (formData.items || []).reduce(
          (sum: number, item: any) => sum + (item.precio_unitario ?? 0) * (item.cantidad ?? 1),
          0
        );

  /* ─── HTML base para ticket térmico 80mm ─── */
  const buildTicketHtml = (orderData: any, copy: 'CLIENTE' | 'COCINA') => {
    const shortId = (orderData.order_id || '')
      .split('-')[1]?.toUpperCase() || (orderData.order_id || '').slice(-6).toUpperCase();

    const entregaLabel =
      formData.metodo_entrega === 'sucursal' ? 'COMER EN SUCURSAL' :
      formData.metodo_entrega === 'para_llevar' ? 'PARA LLEVAR' :
      formData.metodo_entrega === 'domicilio' ? 'DOMICILIO' : formData.metodo_entrega?.toUpperCase();

    const metodoPagoLabel =
      formData.payment_method === 'efectivo' ? '💵 EFECTIVO' :
      formData.payment_method === 'tarjeta' ? '💳 TARJETA' :
      formData.payment_method === 'transferencia' ? '🏦 TRANSFERENCIA' : '⏳ PAGO EN ENTREGA';

    const cambio = formData.payment_method === 'efectivo' && formData.monto_recibido
      ? formData.monto_recibido - computedTotal
      : 0;

    const itemsHtml = (formData.items || []).map((item: any) => `
      <tr>
        <td>${item.cantidad}x ${item.pizza_nombre}${item.size ? ` <small>(${item.size})</small>` : ''}</td>
        <td style="text-align:right;white-space:nowrap;">$${(item.precio_unitario * item.cantidad).toLocaleString('es-MX')}</td>
      </tr>
    `).join('');

    const pagoSection = copy === 'CLIENTE' ? `
      <tr><td colspan="2"><hr style="border:1px dashed #000;margin:4px 0;"></td></tr>
      <tr><td><b>TOTAL</b></td><td style="text-align:right;"><b>$${computedTotal.toLocaleString('es-MX')}</b></td></tr>
      ${formData.payment_method && formData.payment_method !== 'no_pago' ? `
        <tr><td>Pago</td><td style="text-align:right;">${metodoPagoLabel}</td></tr>
        ${formData.payment_method === 'efectivo' && formData.monto_recibido ? `
          <tr><td>Recibido</td><td style="text-align:right;">$${Number(formData.monto_recibido).toLocaleString('es-MX')}</td></tr>
          <tr><td><b>Cambio</b></td><td style="text-align:right;"><b>$${cambio.toLocaleString('es-MX')}</b></td></tr>
        ` : ''}
      ` : `<tr><td colspan="2" style="text-align:center;">⏳ Pago al recibir</td></tr>`}
    ` : `
      <tr><td colspan="2"><hr style="border:1px dashed #000;margin:4px 0;"></td></tr>
      <tr><td><b>TOTAL</b></td><td style="text-align:right;"><b>$${computedTotal.toLocaleString('es-MX')}</b></td></tr>
    `;

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    @page { margin: 3mm; size: 80mm auto; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      width: 72mm;
      margin: 0 auto;
      color: #000;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .big { font-size: 14px; }
    .copy-label {
      text-align: center;
      border: 2px solid #000;
      padding: 2px 6px;
      font-size: 10px;
      font-weight: bold;
      margin-bottom: 4px;
      display: inline-block;
    }
    hr { border: none; border-top: 1px dashed #000; margin: 5px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 1px 0; vertical-align: top; }
    .section-title { font-weight: bold; border-bottom: 1px solid #000; margin-top: 5px; margin-bottom: 3px; }
  </style>
</head>
<body>
  <div class="center bold big">CAPRICCIO PIZZERÍA</div>
  <div class="center" style="font-size:9px;">Pánuco, Ver.</div>
  <hr>
  <div class="center"><span class="copy-label">COPIA: ${copy}</span></div>
  <div class="center bold" style="font-size:13px;">ORDEN #${shortId}</div>
  <div class="center" style="font-size:9px;">${new Date().toLocaleString('es-MX')}</div>
  <hr>

  <div class="section-title">CLIENTE</div>
  <table>
    <tr><td><b>${formData.cliente_nombre || 'Sin nombre'}</b></td></tr>
    ${formData.telefono ? `<tr><td>Tel: ${formData.telefono}</td></tr>` : ''}
    ${formData.direccion ? `<tr><td>Dir: ${formData.direccion}</td></tr>` : ''}
    ${formData.referencias ? `<tr><td>Ref: ${formData.referencias}</td></tr>` : ''}
  </table>

  <div class="section-title">ENTREGA: ${entregaLabel}</div>

  <div class="section-title">ARTÍCULOS</div>
  <table>
    ${itemsHtml}
    ${pagoSection}
  </table>

  <hr>
  <div class="center bold" style="margin-top:6px;">¡GRACIAS POR SU PREFERENCIA!</div>
  <div class="center" style="font-size:9px;">capricciopizzeria.com</div>
  <br><br><br>
</body>
</html>`;
  };

  /* ─── Imprime 2 tickets: CLIENTE + COCINA ─── */
  const printBothTickets = (orderData: any) => {
    // Ticket 1: CLIENTE
    printHtmlTicket(buildTicketHtml(orderData, 'CLIENTE'));
    // Ticket 2: COCINA (con pequeño delay para no saturar la cola de impresión)
    setTimeout(() => {
      printHtmlTicket(buildTicketHtml(orderData, 'COCINA'));
    }, 1800);
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError('');

    try {
      const payload: NewOrderRequest = {
        cliente_nombre: formData.cliente_nombre,
        telefono: formData.telefono,
        direccion: formData.direccion,
        referencias: formData.referencias,
        items: formData.items,
        order_origin: formData.order_origin,
        metodo_entrega: formData.metodo_entrega,
        payment_method: formData.payment_method || 'no_pago',
        monto_recibido: formData.monto_recibido,
        turno_id: turno.id,
      };

      console.log('📤 Enviando pedido:', payload);

      const response = await fetch(`${API_URL}/api/caja/pedidos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('capriccio_token_caja')}`,
        },
        body: JSON.stringify(payload),
      });

      console.log('📥 Respuesta del servidor:', response.status);

      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ Error del servidor:', errorData);
        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem('capriccio_token_caja');
          setTimeout(() => window.location.reload(), 1500);
          throw new Error('Sesión expirada. Recargando para iniciar sesión nuevamente...');
        }
        throw new Error(`Error ${response.status}: ${errorData}`);
      }

      const result = await response.json();
      console.log('✅ Pedido creado:', result);

      setOrderId(result.order_id || result.id || 'SIN_ID');
      setSuccess(true);

      // Imprimir 2 tickets automáticamente para todos los tipos de entrega
      printBothTickets(result);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('❌ Error:', errorMsg);
      setError(`Error: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center py-8">
        <CheckCircle className="mx-auto text-green-600 mb-4" size={64} />
        <h2 className="text-3xl font-bold text-gray-800 mb-2">¡Pedido Creado!</h2>
        <p className="text-gray-600 mb-6">
          Orden: <span className="font-mono font-bold text-green-600 text-xl">{orderId}</span>
        </p>

        <div className="bg-blue-50 p-4 rounded-lg mb-6 border border-blue-200">
          <p className="text-blue-800 font-semibold">✅ El pedido ha sido enviado a cocina</p>
          <p className="text-blue-700 text-sm mt-2">
            🖨️ Se están imprimiendo 2 tickets: uno para el cliente y uno para cocina.
          </p>
        </div>

        <button
          onClick={onReset}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-lg transition text-lg"
        >
          Crear Otro Pedido
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-2">🎫 Valida el Pedido con el Cliente</h2>
      <p className="text-gray-600 mb-6">Muéstrale este detalle para que confirme su pedido</p>

      {/* ERROR */}
      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg flex gap-3">
          <AlertCircle size={20} className="flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* TICKET VISUAL */}
      <div className="mb-6 bg-gradient-to-br from-gray-50 to-white border-2 border-gray-300 rounded-lg p-6 shadow-md" style={{ fontFamily: 'monospace' }}>

        {/* ENCABEZADO */}
        <div className="text-center mb-4 pb-4 border-b-2 border-gray-400">
          <h3 className="text-lg font-bold">🍕 CAPRICCIO PIZZERÍA 🍕</h3>
          <p className="text-xs text-gray-600 mt-1">{new Date().toLocaleString('es-MX')}</p>
        </div>

        <div className="space-y-3">
          {/* CLIENTE */}
          <div className="bg-white p-3 rounded border border-gray-200">
            <h3 className="font-bold text-gray-800 mb-3">Cliente</h3>
            <div className="space-y-1 text-sm">
              <p><span className="text-gray-600">Nombre:</span>{' '}<span className="font-semibold text-gray-900">{formData.cliente_nombre}</span></p>
              <p><span className="text-gray-600">Teléfono:</span>{' '}<span className="font-semibold text-gray-900">{formData.telefono}</span></p>
              {formData.direccion && <p><span className="text-gray-600">Dirección:</span>{' '}<span className="font-semibold text-gray-900">{formData.direccion}</span></p>}
            </div>
          </div>

          {/* PEDIDO */}
          <div className="bg-white p-3 rounded border border-gray-200">
            <h3 className="font-bold text-gray-800 mb-3">Pedido</h3>
            <div className="space-y-1 text-sm">
              <p><span className="text-gray-600">Origen:</span>{' '}<span className="font-semibold text-gray-900 capitalize">{formData.order_origin}</span></p>
              <p><span className="text-gray-600">Entrega:</span>{' '}<span className="font-semibold text-gray-900 capitalize">{formData.metodo_entrega}</span></p>
            </div>
          </div>

          {/* ITEMS */}
          <div className="bg-white p-3 rounded border border-gray-200">
            <h3 className="font-bold text-gray-800 mb-3">Items ({formData.items.length})</h3>
            <div className="space-y-2 text-sm">
              {formData.items.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between text-gray-900">
                  <span>{item.cantidad}x {item.pizza_nombre}{item.size ? ` (${item.size})` : ''}</span>
                  <span className="font-semibold">${(item.precio_unitario * item.cantidad).toLocaleString('es-MX')}</span>
                </div>
              ))}
            </div>
          </div>

          {/* PAGO */}
          <div className="bg-white p-3 rounded border border-gray-200">
            <h3 className="font-bold text-gray-800 mb-3">Pago</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between font-bold text-lg">
                <span>Total:</span>
                <span className="text-red-600">${computedTotal.toLocaleString('es-MX')}</span>
              </div>
              {formData.payment_method && formData.payment_method !== 'no_pago' && (
                <>
                  <p><span className="text-gray-600">Método:</span>{' '}<span className="font-semibold text-gray-900 capitalize">{formData.payment_method}</span></p>
                  {formData.payment_method === 'efectivo' && formData.monto_recibido && (
                    <>
                      <p><span className="text-gray-600">Recibido:</span>{' '}<span className="font-semibold">${Number(formData.monto_recibido).toLocaleString('es-MX')}</span></p>
                      <p><span className="text-gray-600">Cambio:</span>{' '}<span className="font-semibold text-green-600">${(formData.monto_recibido - computedTotal).toLocaleString('es-MX')}</span></p>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* BUTTONS */}
      <div className="mt-8 flex gap-3">
        <button
          onClick={onPrev}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-4 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-gray-800 font-bold rounded-lg transition text-base"
        >
          ← Regresar
        </button>
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-4 rounded-lg transition text-lg flex items-center justify-center gap-2"
        >
          {loading ? 'Procesando...' : '✅ Confirmar y Enviar a Cocina'}
        </button>
      </div>
    </div>
  );
};

export default ConfirmationStep;
