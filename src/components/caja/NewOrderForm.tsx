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
  origin:       { label: 'Origen',   icon: '📡' },
  delivery:     { label: 'Entrega',  icon: '🛍️' },
  customer:     { label: 'Cliente',  icon: '👤' },
  items:        { label: 'Ítems',    icon: '🛒' },
  payment:      { label: 'Pago',     icon: '💳' },
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
    <div className="max-w-2xl mx-auto">
      {/* ── STEP INDICATOR ────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl px-4 sm:px-6 py-4 mb-5 shadow-sm">
        <div className="flex items-center">
          {stepOrder.map((step, index) => {
            const isDone    = index < currentStepIndex;
            const isActive  = index === currentStepIndex;
            const isPending = index > currentStepIndex;
            return (
              <React.Fragment key={step}>
                {/* Step dot + label */}
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div
                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-black text-xs sm:text-sm transition-all duration-200 ${
                      isActive  ? 'bg-red-600 text-white shadow-[0_0_0_4px_rgba(220,38,38,0.15)]' :
                      isDone    ? 'bg-red-600 text-white' :
                      'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {isDone ? '✓' : STEP_META[step].icon}
                  </div>
                  <span
                    className={`hidden sm:block text-[9px] font-black uppercase tracking-wide leading-none text-center ${
                      isActive ? 'text-red-600' : isDone ? 'text-gray-500' : 'text-gray-300'
                    }`}
                  >
                    {STEP_META[step].label}
                  </span>
                </div>

                {/* Connector line */}
                {index < stepOrder.length - 1 && (
                  <div
                    className={`flex-1 h-[3px] mx-1 sm:mx-2 rounded-full transition-all duration-300 ${
                      index < currentStepIndex ? 'bg-red-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
        {/* Mobile step label */}
        <p className="sm:hidden text-center text-xs font-black text-red-600 mt-2.5">
          {STEP_META[currentStep].icon} {STEP_META[currentStep].label} — Paso {currentStepIndex + 1} de {stepOrder.length}
        </p>
      </div>

      {/* ── STEP CONTENT ─────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 shadow-sm">
        {renderStep()}
      </div>
    </div>
  );
};

export default NewOrderForm;
