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
    setTimeout(cleanup, 15000);
  };

  // Asignar onload ANTES de escribir el documento para no perder el evento
  iframe.onload = doPrint;

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) { cleanup(); return; }
  doc.open();
  doc.write(html);
  doc.close();

  // Fallback: si onload no dispara (algunos navegadores), imprimir después de 500ms
  setTimeout(doPrint, 500);
}

const ConfirmationStep: React.FC<StepProps> = ({ formData, turno, onReset, onPrev }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [printEnabled, setPrintEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('capriccio_caja_print');
    return saved !== 'false'; // default ON (solo OFF si el usuario lo desactivó explícitamente)
  });

  const baseTotal = (formData.items || []).reduce(
    (sum: number, item: any) => sum + (item.precio_unitario ?? 0) * (item.cantidad ?? 1),
    0
  );
  const descuentoPorcentaje = formData.descuento_porcentaje || 0;
  const descuentoMonto = Math.round(baseTotal * (descuentoPorcentaje / 100));

  // Calcular total desde items si formData.total no fue propagado correctamente
  const computedTotal: number =
    formData.total && formData.total > 0
      ? formData.total
      : Math.max(0, Math.round(baseTotal * (1 - descuentoPorcentaje / 100)));

  /* ─── HTML base para ticket térmico 80mm ─── */
  const buildTicketHtml = (orderData: any, copy: 'CLIENTE' | 'COCINA' | 'REPARTIDOR') => {
    const shortId = (orderData.order_id || '')
      .split('-')[1]?.toUpperCase() || (orderData.order_id || '').slice(-6).toUpperCase();

    const cajeroNombre = turno.cajero_nombre || localStorage.getItem('capriccio_username') || 'Cajero';

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

    const itemsHtml = (formData.items || []).map((item: any) => {
      let detailsHtml = '';
      if (item.extras && item.extras.length > 0) {
        detailsHtml += `<div style="font-size:12px;color:#666;margin-left:12px;font-weight:normal;">+ Extras: ${item.extras.map((e: any) => e.nombre).join(', ')}</div>`;
      }
      if (item.sauce) {
        detailsHtml += `<div style="font-size:12px;font-weight:bold;color:#000;margin-left:12px;">🥣 Salsa: ${item.sauce.toUpperCase()}</div>`;
      }
      if (item.nota) {
        detailsHtml += `<div style="font-size:12px;font-style:italic;color:#555;margin-left:12px;font-weight:normal;">📝 Nota: ${item.nota}</div>`;
      }

      if (copy === 'COCINA' || copy === 'REPARTIDOR') {
        return `<tr>
          <td style="font-size:18px;font-weight:bold;padding:4px 0;border-bottom:1px dashed #ccc;">
            ${item.cantidad}x ${item.pizza_nombre}${item.size ? ` (${item.size})` : ''}
            ${detailsHtml ? `<div style="margin-top:2px;font-weight:normal;line-height:1.2;">${detailsHtml}</div>` : ''}
          </td>
          <td style="text-align:right;white-space:nowrap;font-size:18px;font-weight:bold;padding:4px 0;border-bottom:1px dashed #ccc;vertical-align:top;">
            $${(item.precio_unitario * item.cantidad).toLocaleString('es-MX')}
          </td>
        </tr>`;
      }
      return `<tr>
        <td style="padding:4px 0;border-bottom:1px dashed #ccc;">
          <b>${item.cantidad}x ${item.pizza_nombre}</b>${item.size ? ` <small>(${item.size})</small>` : ''}
          ${detailsHtml ? `<div style="margin-top:2px;line-height:1.2;">${detailsHtml}</div>` : ''}
        </td>
        <td style="text-align:right;white-space:nowrap;padding:4px 0;border-bottom:1px dashed #ccc;vertical-align:top;">
          $${(item.precio_unitario * item.cantidad).toLocaleString('es-MX')}
        </td>
      </tr>`;
    }).join('');

    const discountRowsHtml = descuentoPorcentaje > 0 ? `
      <tr><td>Subtotal</td><td style="text-align:right;">$${baseTotal.toLocaleString('es-MX')}</td></tr>
      <tr><td>Descuento (${descuentoPorcentaje}%)</td><td style="text-align:right;">-$${descuentoMonto.toLocaleString('es-MX')}</td></tr>
    ` : '';

    const pagoSection = (copy === 'CLIENTE' || copy === 'REPARTIDOR') ? `
      <tr><td colspan="2"><hr style="border:1px dashed #000;margin:4px 0;"></td></tr>
      ${discountRowsHtml}
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
      ${discountRowsHtml}
      <tr><td><b>TOTAL</b></td><td style="text-align:right;"><b>$${computedTotal.toLocaleString('es-MX')}</b></td></tr>
    `;

    const esDomicilio = formData.metodo_entrega === 'domicilio';

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    @page { margin: 3mm; size: 80mm auto; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 15px;
      width: 72mm;
      margin: 0 auto;
      color: #000;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .big { font-size: 18px; }
    .copy-label {
      text-align: center;
      border: 2px solid #000;
      padding: 2px 6px;
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 4px;
      display: inline-block;
    }
    hr { border: none; border-top: 1px dashed #000; margin: 5px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 1px 0; vertical-align: top; }
    .section-title { font-weight: bold; border-bottom: 1px solid #000; margin-top: 5px; margin-bottom: 3px; }
    .direccion-box {
      border: 2px solid #000;
      padding: 4px 6px;
      margin: 4px 0;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="center bold big">CAPRICCIO PIZZERÍA</div>
  <div class="center" style="font-size:13px;">Pánuco, Ver.</div>
  <hr>
  <div class="center"><span class="copy-label">COPIA: ${copy}</span></div>
  <div class="center bold" style="font-size:17px;">ORDEN #${shortId}</div>
  <div class="center" style="font-size:13px;">${new Date().toLocaleString('es-MX')}</div>
  <div class="center" style="font-size:13px;">Cajero: <b>${cajeroNombre}</b></div>
  <hr>

  <div class="section-title">CLIENTE</div>
  <table>
    <tr><td><b>${formData.cliente_nombre || 'Sin nombre'}</b></td></tr>
    ${formData.telefono ? `<tr><td>Tel: ${formData.telefono}</td></tr>` : ''}
  </table>

  <div class="section-title">ENTREGA: ${entregaLabel}</div>
  ${esDomicilio && formData.direccion ? `<div class="direccion-box">📍 ${formData.direccion}</div>` : ''}
  ${esDomicilio && formData.referencias ? `<div style="font-size:13px;">Ref: ${formData.referencias}</div>` : ''}

  <div class="section-title">ARTÍCULOS</div>
  <table>
    ${itemsHtml}
    ${pagoSection}
  </table>

  <hr>
  <div class="center bold" style="margin-top:6px;">¡GRACIAS POR SU PREFERENCIA!</div>
  <div class="center" style="font-size:11px;">capricciopizzeria.com</div>
  <br><br><br>
</body>
</html>`;
  };

  /* ─── Imprime 3 tickets: CLIENTE + COCINA + REPARTIDOR ─── */
  const printAllTickets = (orderData: any) => {
    // Ticket 1: CLIENTE
    printHtmlTicket(buildTicketHtml(orderData, 'CLIENTE'));
    // Ticket 2: COCINA (con pequeño delay para no saturar la cola de impresión)
    setTimeout(() => {
      printHtmlTicket(buildTicketHtml(orderData, 'COCINA'));
    }, 1800);
    // Ticket 3: REPARTIDOR
    setTimeout(() => {
      printHtmlTicket(buildTicketHtml(orderData, 'REPARTIDOR'));
    }, 3600);
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
        descuento_porcentaje: formData.descuento_porcentaje,
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

      // Imprimir solo si está activado
      if (printEnabled) printAllTickets(result);

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
          {printEnabled && (
            <p className="text-blue-700 text-sm mt-2">
              🖨️ Se están imprimiendo 3 tickets: uno para el cliente, uno para cocina y uno para el repartidor.
            </p>
          )}
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
                <div key={idx} className="border-b border-gray-100 py-2 last:border-0">
                  <div className="flex justify-between text-gray-900">
                    <span className="font-medium">{item.cantidad}x {item.pizza_nombre}{item.size ? ` (${item.size})` : ''}</span>
                    <span className="font-semibold">${(item.precio_unitario * item.cantidad).toLocaleString('es-MX')}</span>
                  </div>
                  {item.sauce && (
                    <p className="text-xs text-blue-600 font-semibold pl-4">🥣 Salsa: {item.sauce}</p>
                  )}
                  {item.nota && (
                    <p className="text-xs text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded mt-0.5 pl-4">📝 Nota: {item.nota}</p>
                  )}
                  {item.extras && item.extras.length > 0 && (
                    <p className="text-xs text-gray-500 pl-4">+ Extras: {item.extras.map((e: any) => e.nombre).join(', ')}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* PAGO */}
          <div className="bg-white p-3 rounded border border-gray-200">
            <h3 className="font-bold text-gray-800 mb-3">Pago</h3>
            <div className="space-y-2 text-sm">
              {descuentoPorcentaje > 0 && (
                <>
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal:</span>
                    <span>${baseTotal.toLocaleString('es-MX')}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>Descuento ({descuentoPorcentaje}%):</span>
                    <span>-${descuentoMonto.toLocaleString('es-MX')}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between font-bold text-lg border-t border-gray-150 pt-2">
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

      {/* PRINT TOGGLE */}
      <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 mt-2">
        <span className="text-sm font-semibold text-gray-600">🖨️ Imprimir tickets al confirmar</span>
        <button
          type="button"
          onClick={() => {
            const next = !printEnabled;
            setPrintEnabled(next);
            localStorage.setItem('capriccio_caja_print', String(next));
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition border-2 ${
            printEnabled
              ? 'bg-green-100 border-green-400 text-green-700'
              : 'bg-gray-100 border-gray-300 text-gray-500'
          }`}
        >
          {printEnabled ? '✓ ON' : 'OFF'}
        </button>
      </div>

      {/* BUTTONS */}
      <div className="mt-4 flex gap-3">
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
