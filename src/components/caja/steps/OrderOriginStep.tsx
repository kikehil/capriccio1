'use client';

import React from 'react';
import { OrderOrigin, CajaTurno } from '@/data/caja-types';

interface StepProps {
  formData: any;
  updateFormData: (data: any) => void;
  turno: CajaTurno;
  onNext: () => void;
  onPrev: () => void;
}

const OrderOriginStep: React.FC<StepProps> = ({ formData, updateFormData, onNext }) => {
  const handleSelect = (origin: OrderOrigin) => {
    updateFormData({ order_origin: origin });
    onNext();
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-black text-gray-900">¿Cómo llega el pedido?</h2>
        <p className="text-sm text-gray-500 mt-1">Selecciona el canal de origen</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* LLAMADA TELEFÓNICA */}
        <button
          onClick={() => handleSelect('llamada')}
          className="flex flex-col items-center gap-3 p-7 sm:p-10 bg-white border-2 border-gray-200 rounded-2xl hover:border-red-600 hover:bg-red-50 transition-all duration-150 active:scale-95 shadow-sm text-center cursor-pointer"
        >
          <span className="text-5xl sm:text-6xl leading-none select-none">📞</span>
          <div>
            <p className="text-base sm:text-lg font-black text-gray-800 leading-tight">
              Llamada<br />Telefónica
            </p>
            <p className="text-xs sm:text-sm text-gray-500 mt-1.5 font-medium">Cliente llamó para pedir</p>
          </div>
        </button>

        {/* PRESENCIAL EN SUCURSAL */}
        <button
          onClick={() => handleSelect('presencial')}
          className="flex flex-col items-center gap-3 p-7 sm:p-10 bg-white border-2 border-gray-200 rounded-2xl hover:border-red-600 hover:bg-red-50 transition-all duration-150 active:scale-95 shadow-sm text-center cursor-pointer"
        >
          <span className="text-5xl sm:text-6xl leading-none select-none">🏠</span>
          <div>
            <p className="text-base sm:text-lg font-black text-gray-800 leading-tight">
              Presencial<br />en Sucursal
            </p>
            <p className="text-xs sm:text-sm text-gray-500 mt-1.5 font-medium">Cliente está en el local</p>
          </div>
        </button>
      </div>
    </div>
  );
};

export default OrderOriginStep;
