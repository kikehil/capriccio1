'use client';

import React from 'react';
import { DeliveryMethod, CajaTurno } from '@/data/caja-types';

interface StepProps {
  formData: any;
  updateFormData: (data: any) => void;
  turno: CajaTurno;
  onNext: () => void;
  onPrev: () => void;
}

const DeliveryMethodStep: React.FC<StepProps> = ({ formData, updateFormData, onNext, onPrev }) => {
  const handleSelect = (method: DeliveryMethod) => {
    updateFormData({ metodo_entrega: method });
    onNext();
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-black text-gray-900">¿Cómo se entrega?</h2>
        <p className="text-sm text-gray-500 mt-1">Método de entrega del pedido</p>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {/* COMER EN SUCURSAL */}
        <button
          onClick={() => handleSelect('sucursal')}
          className="flex flex-col items-center gap-2 sm:gap-3 p-4 sm:p-7 bg-white border-2 border-gray-200 rounded-2xl hover:border-red-600 hover:bg-red-50 transition-all duration-150 active:scale-95 shadow-sm text-center cursor-pointer"
        >
          <span className="text-4xl sm:text-5xl leading-none select-none">🍽️</span>
          <div>
            <p className="text-sm sm:text-base font-black text-gray-800 leading-tight">
              Comer en<br className="hidden sm:block" /> Sucursal
            </p>
            <p className="text-xs text-gray-500 mt-1 font-medium hidden sm:block">Come en el local</p>
          </div>
        </button>

        {/* PARA LLEVAR */}
        <button
          onClick={() => handleSelect('para_llevar')}
          className="flex flex-col items-center gap-2 sm:gap-3 p-4 sm:p-7 bg-white border-2 border-gray-200 rounded-2xl hover:border-red-600 hover:bg-red-50 transition-all duration-150 active:scale-95 shadow-sm text-center cursor-pointer"
        >
          <span className="text-4xl sm:text-5xl leading-none select-none">🛍️</span>
          <div>
            <p className="text-sm sm:text-base font-black text-gray-800 leading-tight">
              Para<br /> Llevar
            </p>
            <p className="text-xs text-gray-500 mt-1 font-medium hidden sm:block">Retira en caja</p>
          </div>
        </button>

        {/* A DOMICILIO */}
        <button
          onClick={() => handleSelect('domicilio')}
          className="flex flex-col items-center gap-2 sm:gap-3 p-4 sm:p-7 bg-white border-2 border-gray-200 rounded-2xl hover:border-red-600 hover:bg-red-50 transition-all duration-150 active:scale-95 shadow-sm text-center cursor-pointer"
        >
          <span className="text-4xl sm:text-5xl leading-none select-none">🏍️</span>
          <div>
            <p className="text-sm sm:text-base font-black text-gray-800 leading-tight">
              A<br /> Domicilio
            </p>
            <p className="text-xs text-gray-500 mt-1 font-medium hidden sm:block">Entrega en casa</p>
          </div>
        </button>
      </div>

      <div className="flex gap-3 mt-1">
        <button
          onClick={onPrev}
          className="px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-black text-sm transition-all active:scale-95"
        >
          ← Atrás
        </button>
      </div>
    </div>
  );
};

export default DeliveryMethodStep;
