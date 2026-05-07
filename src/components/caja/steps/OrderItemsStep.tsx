'use client';

import React, { useState } from 'react';
import { Plus, Minus, X, ShoppingCart } from 'lucide-react';
import { CajaItem, CajaTurno } from '@/data/caja-types';
import ProductCustomizationModal from '../ProductCustomizationModal';

interface Pizza {
  id: number;
  nombre: string;
  precio: number;
  categoria: string;
  activo: boolean;
  precios?: Record<string, number>;
  imagen?: string;
  descripcion?: string;
}

interface StepProps {
  formData: any;
  updateFormData: (data: any) => void;
  turno: CajaTurno;
  onNext: () => void;
  onPrev: () => void;
}

const OrderItemsStep: React.FC<StepProps> = ({
  formData,
  updateFormData,
  turno,
  onNext,
  onPrev,
}) => {
  const [showModal, setShowModal] = useState(false);

  const handleAddWithCustomization = (pizza: Pizza, options: any) => {
    let itemName: string;
    let finalPrice: number;

    if (options.displayName) {
      itemName = options.displayName;
    } else {
      const sizeText = options.size ? ` (${options.size})` : '';
      const crustText = options.crust && options.crust !== 'sin-orilla' ? ` + ${options.crust}` : '';
      itemName = `${pizza.nombre}${sizeText}${crustText}`;
    }

    if (options.finalPrice !== undefined) {
      finalPrice = options.finalPrice;
    } else {
      const basePrice = pizza.precios && pizza.precios[options.size || 'mediana']
        ? pizza.precios[options.size || 'mediana']
        : pizza.precio;
      const sizeId = options.size || 'mediana';
      const crustPricesBySizeMap: Record<string, Record<string, number>> = {
        'orilla-queso': { chica: 10, mediana: 25, grande: 35, jumbo: 50 },
        'dedos-queso':  { chica: 0,  mediana: 35, grande: 45, jumbo: 50 },
        'sin-orilla':   { chica: 0,  mediana: 0,  grande: 0,  jumbo: 0  },
      };
      const crustExtra = crustPricesBySizeMap[options.crust]?.[sizeId] ?? 0;
      const extrasExtra = (options.extras || []).reduce((s: number, e: any) => s + (e.precio || 0), 0);
      finalPrice = basePrice + crustExtra + extrasExtra;
    }

    const newItem: CajaItem = {
      pizza_nombre: itemName,
      cantidad: options.cantidad,
      precio_unitario: finalPrice,
      extras: options.extras && options.extras.length > 0 ? options.extras : undefined,
      nota: options.nota || undefined,
      sauce: options.sauce || undefined,
    };

    updateFormData({ items: [...formData.items, newItem] });
    setShowModal(false);
  };

  const removeItem = (itemName: string) => {
    const updated = formData.items.filter((i: CajaItem) => i.pizza_nombre !== itemName);
    updateFormData({ items: updated });
  };

  const updateQuantity = (itemName: string, delta: number) => {
    const updated = formData.items.map((i: CajaItem) => {
      if (i.pizza_nombre === itemName) {
        const newQty = i.cantidad + delta;
        return newQty > 0 ? { ...i, cantidad: newQty } : i;
      }
      return i;
    });
    updateFormData({ items: updated });
  };

  const total = formData.items.reduce(
    (sum: number, item: CajaItem) => sum + item.precio_unitario * item.cantidad,
    0
  );

  const handleNext = () => {
    if (formData.items.length === 0) { alert('Debes agregar al menos un ítem'); return; }
    updateFormData({ total });
    onNext();
  };

  const itemCount = formData.items.length;

  return (
    <div className="flex flex-col gap-3">

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xl lg:text-lg font-black text-gray-900 leading-tight">Selecciona Ítems</h2>
        <p className="text-gray-500 text-sm mt-0.5">Busca y agrega productos al pedido</p>
      </div>

      {/* ── BOTÓN AGREGAR ──────────────────────────────────────── */}
      <button
        onClick={() => setShowModal(true)}
        className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-3 lg:py-2.5 rounded-2xl transition flex items-center justify-center gap-2.5 text-base active:scale-95 shadow-sm"
      >
        <ShoppingCart size={20} />
        Agregar Producto
      </button>

      {/* ── CARRITO ────────────────────────────────────────────── */}
      {itemCount === 0 ? (
        <div className="py-10 text-center bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl">
          <ShoppingCart size={32} className="mx-auto text-gray-300 mb-2" />
          <p className="text-gray-400 text-sm font-semibold">El carrito está vacío</p>
          <p className="text-gray-300 text-xs mt-1">Presiona el botón para agregar productos</p>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden">
          {/* Header del carrito */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-200">
            <span className="font-black text-sm text-gray-700">
              🛒 Carrito
              <span className="ml-1.5 bg-red-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                {itemCount}
              </span>
            </span>
            <span className="text-xs text-gray-400 font-semibold">
              {itemCount} ítem{itemCount !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Lista de ítems — sin límite de altura, crece con el contenido */}
          <div className="divide-y divide-gray-100">
            {formData.items.map((item: CajaItem, idx: number) => (
              <div key={`${item.pizza_nombre}-${idx}`} className="flex items-center gap-2 px-3 py-2.5 bg-white hover:bg-gray-50 transition-colors">
                {/* Nombre + precio unitario */}
                <div className="flex-1 min-w-0">
                  <p className="font-black text-xs text-gray-800 leading-tight truncate">{item.pizza_nombre}</p>
                  <p className="text-red-600 text-[11px] font-bold mt-0.5">${item.precio_unitario.toLocaleString()} c/u</p>
                  {item.nota && (
                    <p className="text-[10px] text-amber-600 mt-0.5 truncate">📝 {item.nota}</p>
                  )}
                </div>

                {/* Controles de cantidad */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => updateQuantity(item.pizza_nombre, -1)}
                    className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg transition active:scale-90"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="w-6 text-center font-black text-sm text-gray-800">{item.cantidad}</span>
                  <button
                    onClick={() => updateQuantity(item.pizza_nombre, 1)}
                    className="w-7 h-7 flex items-center justify-center bg-green-100 hover:bg-green-200 rounded-lg transition text-green-700 active:scale-90"
                  >
                    <Plus size={12} />
                  </button>
                </div>

                {/* Subtotal */}
                <span className="font-black text-sm text-gray-900 w-14 text-right flex-shrink-0">
                  ${(item.precio_unitario * item.cantidad).toLocaleString()}
                </span>

                {/* Eliminar */}
                <button
                  onClick={() => removeItem(item.pizza_nombre)}
                  className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition flex-shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="flex items-center justify-between px-4 py-3 bg-white border-t-2 border-gray-200">
            <span className="font-black text-sm text-gray-700">Total:</span>
            <span className="text-2xl font-black text-red-600">${total.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* ── NAV BUTTONS ─────────────────────────────────────────── */}
      <div className="flex gap-3">
        <button
          onClick={onPrev}
          className="px-6 py-3 lg:py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-black text-sm transition active:scale-95"
        >
          ← Atrás
        </button>
        <button
          onClick={handleNext}
          disabled={itemCount === 0}
          className="flex-1 py-3 lg:py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-xl font-black text-sm transition active:scale-95"
        >
          Siguiente →
        </button>
      </div>

      {/* ── MODAL ───────────────────────────────────────────────── */}
      {showModal && (
        <ProductCustomizationModal onAdd={handleAddWithCustomization} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
};

export default OrderItemsStep;
