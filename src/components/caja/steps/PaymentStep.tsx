'use client';

import React, { useState } from 'react';
import { DollarSign, CreditCard } from 'lucide-react';
import { PaymentMethod, CajaTurno } from '@/data/caja-types';

interface StepProps {
  formData: any;
  updateFormData: (data: any) => void;
  turno: CajaTurno;
  onNext: () => void;
  onPrev: () => void;
}

const PaymentStep: React.FC<StepProps> = ({
  formData,
  updateFormData,
  turno,
  onNext,
  onPrev,
}) => {
  const [montoRecibido, setMontoRecibido] = useState<string>('');
  const [errors, setErrors] = useState<string>('');

  // Determinar si se cobra en caja
  const isPayAtCounter =
    (formData.metodo_entrega === 'sucursal' || formData.metodo_entrega === 'para_llevar') ||
    (formData.metodo_entrega === 'domicilio' && formData.order_origin === 'presencial');

  const handlePaymentMethodSelect = (method: PaymentMethod) => {
    updateFormData({ payment_method: method });
    if (method === 'efectivo') {
      // Pre-llenar con el total exacto; cajero puede modificar si recibe más
      setMontoRecibido(String(formData.total));
      setErrors('');
    } else {
      setMontoRecibido('');
      setErrors('');
    }
  };

  const handleMontoChange = (value: string) => {
    const num = parseFloat(value) || 0;
    setMontoRecibido(value);

    // Validar que sea suficiente
    if (num < formData.total) {
      setErrors(`Monto insuficiente. Total: $${formData.total.toLocaleString()}`);
    } else {
      setErrors('');
    }
  };

  const cambio = Math.max(0, parseFloat(montoRecibido) - formData.total);

  const handleNext = () => {
    if (!isPayAtCounter) {
      // Si no se cobra en caja, marcar como no_pago
      updateFormData({ payment_method: 'no_pago', monto_recibido: null });
      onNext();
      return;
    }

    if (!formData.payment_method) {
      setErrors('Selecciona un método de pago');
      return;
    }

    if (formData.payment_method === 'efectivo' && !montoRecibido) {
      setErrors('Ingresa el monto recibido');
      return;
    }

    if (formData.payment_method === 'efectivo' && parseFloat(montoRecibido) < formData.total) {
      setErrors(`Monto insuficiente`);
      return;
    }

    // Para efectivo: enviar el monto ingresado
    // Para tarjeta: enviar el total como monto (se procesará después)
    updateFormData({
      monto_recibido: formData.payment_method === 'efectivo' ? parseFloat(montoRecibido) : formData.total,
    });
    onNext();
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Pago</h2>
      <p className="text-gray-600 mb-6">Total a cobrar: ${formData.total.toLocaleString()}</p>

      {errors && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {errors}
        </div>
      )}

      {/* MOSTRAR AVISO SI NO SE COBRA EN CAJA */}
      {!isPayAtCounter && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-300 rounded-lg">
          <p className="text-blue-800 font-semibold">
            💳 Este pedido se pagará al momento de la entrega (repartidor cobra)
          </p>
          <p className="text-blue-700 text-sm mt-2">
            No es necesario cobrar en caja ahora.
          </p>
        </div>
      )}

      {/* MÉTODO DE PAGO (si aplica cobro en caja) */}
      {isPayAtCounter && (
        <>
          <div className="space-y-3 mb-6">
            {/* EFECTIVO */}
            <button
              onClick={() => handlePaymentMethodSelect('efectivo')}
              className={`w-full p-4 border-2 rounded-lg transition text-left ${
                formData.payment_method === 'efectivo'
                  ? 'border-red-600 bg-red-50'
                  : 'border-gray-200 hover:border-red-300'
              }`}
            >
              <div className="flex items-center gap-4">
                <DollarSign
                  size={32}
                  className={
                    formData.payment_method === 'efectivo' ? 'text-red-600' : 'text-gray-600'
                  }
                />
                <div>
                  <h3 className="font-bold text-gray-800">Efectivo</h3>
                  <p className="text-sm text-gray-600">Pago en efectivo</p>
                </div>
              </div>
            </button>

            {/* TARJETA */}
            <button
              onClick={() => handlePaymentMethodSelect('tarjeta')}
              className={`w-full p-4 border-2 rounded-lg transition text-left ${
                formData.payment_method === 'tarjeta'
                  ? 'border-red-600 bg-red-50'
                  : 'border-gray-200 hover:border-red-300'
              }`}
            >
              <div className="flex items-center gap-4">
                <CreditCard
                  size={32}
                  className={
                    formData.payment_method === 'tarjeta' ? 'text-red-600' : 'text-gray-600'
                  }
                />
                <div>
                  <h3 className="font-bold text-gray-800">Tarjeta</h3>
                  <p className="text-sm text-gray-600">Débito o Crédito</p>
                </div>
              </div>
            </button>
          </div>

          {/* INPUT MONTO (si efectivo) */}
          {formData.payment_method === 'efectivo' && (
            <div className="mb-6 p-4 bg-gray-50 border border-gray-300 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monto Recibido ($)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={montoRecibido}
                  onChange={(e) => handleMontoChange(e.target.value)}
                  className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none text-gray-900 bg-white"
                  placeholder="0"
                  min="0"
                />
              </div>

              {/* RESUMEN */}
              <div className="mt-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-700">Total:</span>
                  <span className="font-bold text-gray-900">${formData.total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Monto Recibido:</span>
                  <span className="font-bold text-gray-900">${parseFloat(montoRecibido || '0').toLocaleString()}</span>
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span className="font-bold text-lg text-gray-900">Cambio:</span>
                  <span className={`font-bold text-lg ${cambio > 0 ? 'text-green-600' : 'text-gray-900'}`}>
                    ${cambio.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {formData.payment_method === 'tarjeta' && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-300 rounded-lg">
              <p className="text-blue-800 font-semibold">💳 Tarjeta Registrada</p>
              <p className="text-blue-700 text-sm mt-2">
                El cliente pagará con su tarjeta. Asegúrate de procesar el pago después.
              </p>
            </div>
          )}
        </>
      )}

      {/* BUTTONS */}
      <div className="mt-8 flex gap-4">
        <button
          onClick={onPrev}
          className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-semibold transition"
        >
          Atrás
        </button>
        <button
          onClick={handleNext}
          disabled={isPayAtCounter && !formData.payment_method}
          className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-semibold transition"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
};

export default PaymentStep;
