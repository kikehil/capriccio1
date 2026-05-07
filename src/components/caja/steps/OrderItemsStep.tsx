'use client';

import React, { useState } from 'react';
import { Plus, Minus, X, ShoppingCart, ChevronUp, ChevronDown } from 'lucide-react';
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
  const [cartOpen, setCartOpen] = useState(false); // mobile cart drawer

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

  /* ── Cart items list (shared between sidebar and drawer) ── */
  const CartList = () => (
    <div className="space-y-2 max-h-64 sm:max-h-96 overflow-y-auto">
      {formData.items.map((item: CajaItem) => (
        <div key={item.pizza_nombre} className="bg-white p-2.5 rounded-lg border border-gray-200">
          <div className="flex justify-between items-start mb-1.5">
            <div className="flex-1 min-w-0 pr-1">
              <p className="font-semibold text-xs sm:text-sm text-gray-800 leading-tight">{item.pizza_nombre}</p>
              <p className="text-red-600 text-xs font-bold">${item.precio_unitario.toLocaleString()}</p>
              {item.nota && <p className="text-[10px] text-yellow-600 truncate">📝 {item.nota}</p>}
            </div>
            <button onClick={() => removeItem(item.pizza_nombre)} className="text-red-400 hover:text-red-600 flex-shrink-0 p-0.5">
              <X size={15} />
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => updateQuantity(item.pizza_nombre, -1)}
              className="w-7 h-7 flex items-center justify-center bg-gray-100 rounded hover:bg-gray-200 transition">
              <Minus size={13} />
            </button>
            <span className="px-2 font-bold text-gray-800 text-sm">{item.cantidad}</span>
            <button onClick={() => updateQuantity(item.pizza_nombre, 1)}
              className="w-7 h-7 flex items-center justify-center bg-green-100 rounded hover:bg-green-200 transition text-green-700">
              <Plus size={13} />
            </button>
            <span className="ml-auto font-bold text-gray-800 text-sm">
              ${(item.precio_unitario * item.cantidad).toLocaleString()}
            </span>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1">Selecciona Ítems</h2>
      <p className="text-gray-600 mb-4 text-sm">Busca y agrega productos al pedido</p>

      {/* ── DESKTOP: side-by-side layout ──────────────────────── */}
      <div className="hidden lg:grid lg:grid-cols-3 gap-6">
        {/* Left: add button */}
        <div className="lg:col-span-2">
          <button
            onClick={() => setShowModal(true)}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-6 rounded-xl transition flex items-center justify-center gap-3 text-lg active:scale-95"
          >
            <ShoppingCart size={24} />
            Agregar Producto
          </button>
          {formData.items.length === 0 && (
            <div className="mt-6 p-8 text-center bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl">
              <p className="text-gray-400 text-base">👆 Presiona el botón para agregar productos</p>
            </div>
          )}
        </div>

        {/* Right: cart sidebar */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 sticky top-20 h-fit">
          <h3 className="font-bold text-base text-gray-800 mb-3">
            🛒 Carrito ({itemCount})
          </h3>
          {itemCount === 0 ? (
            <p className="text-gray-400 text-center py-6 text-sm">Sin ítems</p>
          ) : (
            <>
              <CartList />
              <div className="border-t border-gray-300 pt-3 mt-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-700">Total:</span>
                  <span className="text-xl font-black text-red-600">${total.toLocaleString()}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{itemCount} ítem{itemCount !== 1 ? 's' : ''}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── MOBILE / TABLET: single column ────────────────────── */}
      <div className="lg:hidden space-y-3">
        {/* Add button + cart toggle in one bar */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowModal(true)}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl transition flex items-center justify-center gap-2 text-base active:scale-95"
          >
            <ShoppingCart size={20} />
            Agregar Producto
          </button>
          {/* Cart toggle button (shows count badge) */}
          {itemCount > 0 && (
            <button
              onClick={() => setCartOpen(o => !o)}
              className="relative px-4 py-4 bg-gray-800 hover:bg-gray-900 text-white rounded-xl transition flex items-center gap-1.5 text-sm font-bold"
            >
              <ShoppingCart size={18} />
              <span>{itemCount}</span>
              {cartOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          )}
        </div>

        {/* Collapsible cart on mobile */}
        {cartOpen && itemCount > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 animate-in slide-in-from-top-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-sm text-gray-800">🛒 Carrito</h3>
              <button onClick={() => setCartOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            <CartList />
            <div className="border-t border-gray-300 pt-2 mt-2 flex justify-between items-center">
              <span className="font-bold text-sm text-gray-700">Total:</span>
              <span className="text-lg font-black text-red-600">${total.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Empty state */}
        {itemCount === 0 && (
          <div className="p-6 text-center bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl">
            <p className="text-gray-400 text-sm">👆 Presiona el botón para agregar productos</p>
          </div>
        )}
      </div>

      {/* ── TOTAL BAR (mobile, always visible when items exist) ── */}
      {itemCount > 0 && (
        <div className="lg:hidden mt-3 flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
          <span className="text-sm font-bold text-gray-700">{itemCount} ítem{itemCount !== 1 ? 's' : ''}</span>
          <span className="text-xl font-black text-red-600">${total.toLocaleString()}</span>
        </div>
      )}

      {/* ── NAV BUTTONS ─────────────────────────────────────────── */}
      <div className="mt-5 flex gap-3">
        <button onClick={onPrev}
          className="px-5 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-semibold transition text-sm">
          Atrás
        </button>
        <button onClick={handleNext} disabled={itemCount === 0}
          className="flex-1 px-5 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-semibold transition text-sm">
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
