'use client';

import React, { useState } from 'react';
import { PaymentMethod, CajaTurno } from '@/data/caja-types';

interface StepProps {
  formData: any;
  updateFormData: (data: any) => void;
  turno: CajaTurno;
  onNext: () => void;
  onPrev: () => void;
}

const PRESET_AMOUNTS = [50, 100, 200, 500, 1000];

const PaymentStep: React.FC<StepProps> = ({
  formData,
  updateFormData,
  turno,
  onNext,
  onPrev,
}) => {
  const [montoRecibido, setMontoRecibido] = useState<string>('');
  const [errors, setErrors] = useState<string>('');

  // Se cobra en caja ahora: sucursal, para_llevar, o domicilio presencial
  const isPayAtCounter =
    formData.metodo_entrega === 'sucursal' ||
    formData.metodo_entrega === 'para_llevar' ||
    (formData.metodo_entrega === 'domicilio' && formData.order_origin === 'presencial');

  // Pedido a domicilio que NO es presencial → el repartidor cobra
  const isDomicilioExterno = formData.metodo_entrega === 'domicilio' && !isPayAtCounter;

  const handlePaymentMethodSelect = (method: PaymentMethod) => {
    updateFormData({ payment_method: method });
    setMontoRecibido('');
    setErrors('');
    if (method === 'efectivo' && isPayAtCounter) {
      setMontoRecibido(String(formData.total));
    }
  };

  const handleMontoChange = (value: string) => {
    setMontoRecibido(value);
    const num = parseFloat(value) || 0;
    if (isPayAtCounter && num < formData.total) {
      setErrors(`Monto insuficiente. Total: $${formData.total.toLocaleString()}`);
    } else {
      setErrors('');
    }
  };

  const setPreset = (amount: number) => {
    const rounded = Math.ceil(formData.total / amount) * amount;
    const val = rounded >= formData.total ? String(rounded) : String(amount);
    handleMontoChange(val);
  };

  const cambio = Math.max(0, parseFloat(montoRecibido || '0') - formData.total);

  const handleNext = () => {
    if (isDomicilioExterno) {
      if (!formData.payment_method) { setErrors('Selecciona cómo pagará el cliente'); return; }
      if (formData.payment_method === 'efectivo' && !montoRecibido) {
        setErrors('Ingresa con cuánto pagará el cliente'); return;
      }
      updateFormData({
        monto_recibido: formData.payment_method === 'efectivo' ? parseFloat(montoRecibido) || 0 : 0,
      });
      onNext(); return;
    }
    if (!isPayAtCounter) {
      updateFormData({ payment_method: 'no_pago', monto_recibido: null });
      onNext(); return;
    }
    if (!formData.payment_method) { setErrors('Selecciona un método de pago'); return; }
    if (formData.payment_method === 'efectivo') {
      if (!montoRecibido) { setErrors('Ingresa el monto recibido'); return; }
      if (parseFloat(montoRecibido) < formData.total) { setErrors('Monto insuficiente'); return; }
    }
    updateFormData({
      monto_recibido: formData.payment_method === 'efectivo'
        ? parseFloat(montoRecibido)
        : formData.total,
    });
    onNext();
  };

  /* ── Reusable payment card button ─── */
  const PayCard = ({
    method, icon, title, sub,
  }: { method: PaymentMethod; icon: string; title: string; sub: string }) => {
    const selected = formData.payment_method === method;
    return (
      <button
        onClick={() => handlePaymentMethodSelect(method)}
        className={`flex flex-col items-center gap-2 p-4 sm:p-5 lg:p-3 border-2 rounded-2xl transition-all active:scale-95 cursor-pointer text-center ${
          selected
            ? 'border-red-600 bg-red-50 shadow-[0_0_0_3px_rgba(220,38,38,0.12)]'
            : 'border-gray-200 bg-white hover:border-red-400 hover:bg-red-50'
        }`}
      >
        <span className="text-4xl sm:text-5xl lg:text-3xl leading-none select-none">{icon}</span>
        <div>
          <p className={`font-black text-sm sm:text-base leading-tight ${selected ? 'text-red-700' : 'text-gray-800'}`}>
            {title}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 font-medium">{sub}</p>
        </div>
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-4 lg:gap-3">
      <div>
        <h2 className="text-xl lg:text-lg font-black text-gray-900">Pago</h2>
        <p className="text-sm text-gray-500 mt-1">
          Total: <strong className="text-red-600 text-lg font-black">${formData.total?.toLocaleString()}</strong>
        </p>
      </div>

      {errors && (
        <div className="p-3 bg-red-50 border-2 border-red-400 text-red-700 rounded-xl text-sm font-semibold">
          ⚠️ {errors}
        </div>
      )}

      {/* ── DOMICILIO EXTERNO ───────────────────────────── */}
      {isDomicilioExterno && (
        <>
          <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-2xl">
            <p className="text-blue-800 font-black text-sm">🏍️ Pedido a domicilio — el repartidor cobrará al entregar.</p>
            <p className="text-blue-600 text-xs mt-1">Registra cómo pagará el cliente para que el repartidor lleve el cambio correcto.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <PayCard method="efectivo" icon="💵" title="Efectivo" sub="El repartidor lleva cambio" />
            <PayCard method="transferencia" icon="📲" title="Transferencia" sub="Pagó o pagará en línea" />
          </div>

          {formData.payment_method === 'efectivo' && (
            <div className="bg-white border-2 border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500">
                💵 ¿Con cuánto va a pagar el cliente?
              </label>
              <input
                type="number"
                value={montoRecibido}
                onChange={e => handleMontoChange(e.target.value)}
                className="w-full px-4 py-3 lg:py-2 text-2xl lg:text-xl font-bold border-2 border-gray-300 rounded-xl focus:border-red-600 outline-none bg-white text-gray-900 transition"
                placeholder={`Ej: ${formData.total + 50}`}
                min={formData.total}
                inputMode="numeric"
              />
              {/* Preset amounts */}
              <div className="flex gap-2 flex-wrap">
                {PRESET_AMOUNTS.filter(a => a >= formData.total * 0.4).map(a => {
                  const rounded = Math.ceil(formData.total / a) * a;
                  const label = rounded > a ? `$${rounded}` : `$${a}`;
                  return (
                    <button
                      key={a}
                      onClick={() => setPreset(a)}
                      className="flex-1 min-w-[60px] py-2.5 bg-gray-800 hover:bg-gray-900 text-white rounded-xl font-black text-sm transition active:scale-95"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {montoRecibido && parseFloat(montoRecibido) >= formData.total && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex justify-between items-center">
                  <span className="text-sm font-bold text-gray-600">Cambio que llevará el repartidor:</span>
                  <span className="font-black text-green-700 text-xl">${cambio.toLocaleString()}</span>
                </div>
              )}
            </div>
          )}

          {formData.payment_method === 'transferencia' && (
            <div className="p-4 bg-green-50 border-2 border-green-200 rounded-2xl text-sm font-semibold text-green-800">
              ✅ El cliente pagará por transferencia. El repartidor no necesita llevar cambio.
            </div>
          )}
        </>
      )}

      {/* ── COBRO EN CAJA ───────────────────────────────── */}
      {isPayAtCounter && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <PayCard method="efectivo" icon="💵" title="Efectivo" sub="Pago en efectivo" />
            <PayCard method="tarjeta" icon="💳" title="Tarjeta" sub="Débito o crédito" />
            <PayCard method="transferencia" icon="📲" title="Transferencia" sub="SPEI / Bancaria" />
          </div>

          {/* EFECTIVO: monto input + presets */}
          {formData.payment_method === 'efectivo' && (
            <div className="bg-white border-2 border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500">
                💵 Monto recibido
              </label>
              <input
                type="number"
                value={montoRecibido}
                onChange={e => handleMontoChange(e.target.value)}
                className="w-full px-4 py-3 lg:py-2 text-2xl lg:text-xl font-bold border-2 border-gray-300 rounded-xl focus:border-red-600 outline-none bg-white text-gray-900 transition"
                placeholder="$0"
                min="0"
                inputMode="numeric"
              />

              {/* Preset amount buttons */}
              <div className="flex gap-2 flex-wrap">
                {[50, 100, 200, 500, 1000].map(amount => {
                  const suggested = Math.ceil(formData.total / amount) * amount;
                  const label = suggested > amount && suggested < amount * 2 ? `$${suggested}` : `$${amount}`;
                  return (
                    <button
                      key={amount}
                      onClick={() => {
                        const val = suggested > formData.total ? String(suggested) : String(amount >= formData.total ? amount : suggested);
                        handleMontoChange(String(Math.max(amount, suggested)));
                      }}
                      className="flex-1 min-w-[54px] py-2.5 bg-gray-800 hover:bg-gray-900 text-white rounded-xl font-black text-sm transition active:scale-95"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Total / Recibido / Cambio */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm font-semibold text-gray-700">
                  <span>Total del pedido</span>
                  <span className="font-black">${formData.total?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold text-gray-700">
                  <span>Monto recibido</span>
                  <span className="font-black">${parseFloat(montoRecibido || '0').toLocaleString()}</span>
                </div>
                <div className="border-t border-gray-300 pt-2 flex justify-between items-center">
                  <span className="font-black text-gray-900">Cambio</span>
                  <span className={`font-black text-2xl ${cambio > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                    ${cambio.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {formData.payment_method === 'tarjeta' && (
            <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-2xl">
              <p className="text-blue-800 font-black text-sm">💳 Pago con tarjeta registrado.</p>
              <p className="text-blue-600 text-xs mt-1">Procesa el cobro con la terminal antes de continuar.</p>
            </div>
          )}

          {formData.payment_method === 'transferencia' && (
            <div className="p-4 bg-green-50 border-2 border-green-200 rounded-2xl">
              <p className="text-green-800 font-black text-sm">🏦 Transferencia registrada.</p>
              <p className="text-green-600 text-xs mt-1">Verifica que el comprobante haya llegado antes de continuar.</p>
            </div>
          )}
        </>
      )}

      {/* ── NAV BUTTONS ─────────────────────────────────── */}
      <div className="flex gap-3">
        <button
          onClick={onPrev}
          className="px-6 py-3 lg:py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-black text-sm transition-all active:scale-95"
        >
          ← Atrás
        </button>
        <button
          onClick={handleNext}
          disabled={!formData.payment_method}
          className="flex-1 py-3 lg:py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-xl font-black text-sm transition active:scale-95"
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
};

export default PaymentStep;
