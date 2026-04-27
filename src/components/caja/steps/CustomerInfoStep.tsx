'use client';

import React, { useState } from 'react';
import { CajaTurno } from '@/data/caja-types';

interface StepProps {
  formData: any;
  updateFormData: (data: any) => void;
  turno: CajaTurno;
  onNext: () => void;
  onPrev: () => void;
}

const CustomerInfoStep: React.FC<StepProps> = ({
  formData,
  updateFormData,
  turno,
  onNext,
  onPrev,
}) => {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: string, value: string) => {
    updateFormData({ [field]: value });
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.cliente_nombre?.trim()) newErrors.cliente_nombre = 'El nombre es requerido';
    if (!formData.telefono?.trim()) newErrors.telefono = 'El teléfono es requerido';
    if (formData.metodo_entrega === 'domicilio' && !formData.direccion?.trim())
      newErrors.direccion = 'La dirección es requerida para domicilio';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validate()) onNext();
  };

  const isDomicilio = formData.metodo_entrega === 'domicilio';

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Datos del Cliente</h2>
      <p className="text-gray-600 mb-6">Ingresa la información de contacto</p>

      <div className="space-y-4">
        {/* NOMBRE */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre del Cliente *
          </label>
          <input
            type="text"
            value={formData.cliente_nombre}
            onChange={(e) => handleChange('cliente_nombre', e.target.value)}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition text-gray-900 bg-white ${
              errors.cliente_nombre ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Ej: Carlos Gómez"
            autoFocus
          />
          {errors.cliente_nombre && (
            <p className="text-red-600 text-sm mt-1">{errors.cliente_nombre}</p>
          )}
        </div>

        {/* TELÉFONO */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Teléfono *
          </label>
          <input
            type="tel"
            value={formData.telefono}
            onChange={(e) => handleChange('telefono', e.target.value)}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition text-gray-900 bg-white ${
              errors.telefono ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Ej: 8331234567"
            maxLength={15}
          />
          {errors.telefono && (
            <p className="text-red-600 text-sm mt-1">{errors.telefono}</p>
          )}
        </div>

        {/* DIRECCIÓN (si es domicilio) */}
        {isDomicilio && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dirección *
              </label>
              <input
                type="text"
                value={formData.direccion || ''}
                onChange={(e) => handleChange('direccion', e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition text-gray-900 bg-white ${
                  errors.direccion ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Ej: Calle Principal 123, Depto 4B"
              />
              {errors.direccion && (
                <p className="text-red-600 text-sm mt-1">{errors.direccion}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Referencias (Opcional)
              </label>
              <textarea
                value={formData.referencias || ''}
                onChange={(e) => handleChange('referencias', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition text-gray-900 bg-white"
                placeholder="Ej: Casa blanca con puerta azul, esquina con pasaje"
                rows={2}
              />
            </div>
          </>
        )}
      </div>

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
          className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
};

export default CustomerInfoStep;
