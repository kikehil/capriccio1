'use client';

import React, { useState } from 'react';
import CustomerInfoStep from './steps/CustomerInfoStep';
import OrderOriginStep from './steps/OrderOriginStep';
import DeliveryMethodStep from './steps/DeliveryMethodStep';
import OrderItemsStep from './steps/OrderItemsStep';
import PaymentStep from './steps/PaymentStep';
import ConfirmationStep from './steps/ConfirmationStep';
import { CajaTurno, OrderOrigin, DeliveryMethod, PaymentMethod, CajaItem } from '@/data/caja-types';

type StepType = 'origin' | 'delivery' | 'customer' | 'items' | 'payment' | 'confirmation';

interface FormData {
  order_origin?: OrderOrigin;
  metodo_entrega?: DeliveryMethod;
  cliente_nombre: string;
  telefono: string;
  direccion?: string;
  referencias?: string;
  items: CajaItem[];
  total: number;
  payment_method?: PaymentMethod;
  monto_recibido?: number;
}

interface NewOrderFormProps {
  turno: CajaTurno;
}

const stepOrder: StepType[] = ['origin', 'delivery', 'customer', 'items', 'payment', 'confirmation'];

const STEP_META: Record<StepType, { label: string; icon: string }> = {
  origin:       { label: 'Origen',    icon: '📡' },
  delivery:     { label: 'Entrega',   icon: '🛍️' },
  customer:     { label: 'Cliente',   icon: '👤' },
  items:        { label: 'Ítems',     icon: '🛒' },
  payment:      { label: 'Pago',      icon: '💳' },
  confirmation: { label: 'Confirmar', icon: '✅' },
};

const NewOrderForm: React.FC<NewOrderFormProps> = ({ turno }) => {
  const [currentStep, setCurrentStep] = useState<StepType>('origin');
  const [formData, setFormData] = useState<FormData>({
    cliente_nombre: '',
    telefono: '',
    items: [],
    total: 0,
  });

  const currentStepIndex = stepOrder.indexOf(currentStep);

  const handleNext = () => {
    if (currentStepIndex < stepOrder.length - 1)
      setCurrentStep(stepOrder[currentStepIndex + 1]);
  };

  const handlePrev = () => {
    if (currentStepIndex > 0)
      setCurrentStep(stepOrder[currentStepIndex - 1]);
  };

  const handleReset = () => {
    setCurrentStep('origin');
    setFormData({ cliente_nombre: '', telefono: '', items: [], total: 0 });
  };

  const updateFormData = (updates: Partial<FormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const renderStep = () => {
    const commonProps = { formData, updateFormData, turno, onNext: handleNext, onPrev: handlePrev };
    switch (currentStep) {
      case 'origin':       return <OrderOriginStep {...commonProps} />;
      case 'delivery':     return <DeliveryMethodStep {...commonProps} />;
      case 'customer':     return <CustomerInfoStep {...commonProps} />;
      case 'items':        return <OrderItemsStep {...commonProps} />;
      case 'payment':      return <PaymentStep {...commonProps} />;
      case 'confirmation': return <ConfirmationStep {...commonProps} onReset={handleReset} />;
      default: return null;
    }
  };

  return (
    /* ── Outer wrapper:
         < lg  → single-column centered (phones / tablets)
         ≥ lg  → two-column: sidebar + content (POS 1024x768 / 1280x1024)  */
    <div className="max-w-2xl mx-auto lg:max-w-none lg:flex lg:gap-4 lg:items-start">

      {/* ════════════════════════════════════════════════
          STEP INDICATOR — horizontal (< lg)
          ════════════════════════════════════════════ */}
      <div className="lg:hidden bg-white border border-gray-200 rounded-2xl px-4 py-3.5 mb-4 shadow-sm">
        <div className="flex items-center">
          {stepOrder.map((step, index) => {
            const isDone    = index < currentStepIndex;
            const isActive  = index === currentStepIndex;
            return (
              <React.Fragment key={step}>
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs transition-all duration-200 ${
                      isActive  ? 'bg-red-600 text-white shadow-[0_0_0_4px_rgba(220,38,38,0.15)]' :
                      isDone    ? 'bg-red-600 text-white' :
                      'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {isDone ? '✓' : STEP_META[step].icon}
                  </div>
                  <span className={`hidden sm:block text-[9px] font-black uppercase tracking-wide leading-none text-center ${
                    isActive ? 'text-red-600' : isDone ? 'text-gray-500' : 'text-gray-300'
                  }`}>
                    {STEP_META[step].label}
                  </span>
                </div>
                {index < stepOrder.length - 1 && (
                  <div className={`flex-1 h-[3px] mx-1 rounded-full transition-all duration-300 ${
                    index < currentStepIndex ? 'bg-red-600' : 'bg-gray-200'
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
        <p className="sm:hidden text-center text-xs font-black text-red-600 mt-2">
          {STEP_META[currentStep].icon} {STEP_META[currentStep].label} — Paso {currentStepIndex + 1} de {stepOrder.length}
        </p>
      </div>

      {/* ════════════════════════════════════════════════
          SIDEBAR — vertical step indicator (≥ lg, POS)
          ════════════════════════════════════════════ */}
      <aside className="hidden lg:flex flex-col bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex-shrink-0 w-[148px] sticky top-[74px]">
        {/* Sidebar header */}
        <div className="px-3 py-2.5 bg-gray-50 border-b border-gray-100">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Nuevo Pedido</p>
        </div>

        {/* Steps */}
        <div className="flex flex-col divide-y divide-gray-100">
          {stepOrder.map((step, index) => {
            const isDone    = index < currentStepIndex;
            const isActive  = index === currentStepIndex;
            const isPending = index > currentStepIndex;
            return (
              <div
                key={step}
                className={`flex items-center gap-2.5 px-3 py-2.5 transition-colors ${
                  isActive  ? 'bg-red-600 text-white' :
                  isDone    ? 'bg-green-50 text-gray-600' :
                  'bg-white text-gray-300'
                }`}
              >
                {/* Icon / check */}
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] flex-shrink-0 ${
                  isActive  ? 'bg-white/20 text-white' :
                  isDone    ? 'bg-green-500 text-white' :
                  'bg-gray-100 text-gray-300'
                }`}>
                  {isDone ? '✓' : <span className="leading-none">{STEP_META[step].icon}</span>}
                </div>
                {/* Label */}
                <div className="min-w-0">
                  <p className={`text-[11px] font-black leading-tight ${
                    isActive ? 'text-white' : isDone ? 'text-gray-700' : 'text-gray-400'
                  }`}>
                    {STEP_META[step].label}
                  </p>
                  <p className={`text-[9px] font-semibold leading-none mt-0.5 ${
                    isActive ? 'text-white/70' : isDone ? 'text-green-600' : 'text-gray-300'
                  }`}>
                    {isDone ? 'Completado' : isActive ? 'En curso' : 'Pendiente'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 mt-auto">
          <div className="flex justify-between text-[9px] font-black text-gray-400 mb-1">
            <span>Progreso</span>
            <span>{currentStepIndex + 1}/{stepOrder.length}</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-600 rounded-full transition-all duration-300"
              style={{ width: `${((currentStepIndex) / (stepOrder.length - 1)) * 100}%` }}
            />
          </div>
        </div>
      </aside>

      {/* ════════════════════════════════════════════════
          STEP CONTENT
          ════════════════════════════════════════════ */}
      <div className="flex-1 min-w-0 bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 lg:p-4 shadow-sm">
        {renderStep()}
      </div>
    </div>
  );
};

export default NewOrderForm;
