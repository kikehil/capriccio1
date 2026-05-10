'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, ShoppingCart, ArrowLeft, Check } from 'lucide-react';
import { API_URL } from '@/lib/socket';

interface Pizza {
  id: number;
  nombre: string;
  descripcion: string;
  precio: number;
  imagen: string;
  categoria: string;
  activo: boolean;
  precios?: Record<string, number>;
  ingredientes?: string[];
}

// Precio de extras por tamaño (igual que portal)
const EXTRA_PRICE_BY_SIZE: Record<string, number> = {
  mini: 10, chica: 10, mediana: 25, grande: 30, jumbo: 50, unica: 10,
};
const ADEREZO_PRICE = 10;
const INGREDIENTE_LABELS: Record<string, string> = {
  'champiñon': 'Champiñón', 'champiñón': 'Champiñón', 'mushroom': 'Champiñón',
  'peperoni': 'Peperoni', 'pepperoni': 'Peperoni',
  'piña': 'Piña', 'pineapple': 'Piña',
  'salchicha': 'Salchicha',
  'tocino': 'Tocino', 'bacon': 'Tocino',
  'queso': 'Doble Queso', 'quesos': 'Doble Queso', 'doble queso': 'Doble Queso', 'mozzarella': 'Doble Queso',
  'jamón': 'Jamón Extra', 'jamon': 'Jamón Extra',
  'chorizo': 'Chorizo Extra',
  'jalapeño': 'Jalapeño Extra', 'jalapeños': 'Jalapeño Extra', 'jalapeno': 'Jalapeño Extra',
  'pollo': 'Pollo Extra',
  'salami': 'Salami Extra',
  'cebolla': 'Cebolla Extra',
  'pimiento': 'Pimiento Extra',
};

interface CajaExtraItem {
  id: string;
  nombre: string;
  precio: number;
}

function buildExtrasParaCaja(ingredientes: string[], sizeId: string): CajaExtraItem[] {
  const seen = new Set<string>();
  const result: CajaExtraItem[] = [];
  const precio = EXTRA_PRICE_BY_SIZE[sizeId] ?? 10;
  for (const ing of ingredientes) {
    const label = INGREDIENTE_LABELS[ing.toLowerCase().trim()];
    if (label && !seen.has(label)) {
      seen.add(label);
      result.push({ id: `extra-${label.toLowerCase().replace(/\s+/g, '-')}`, nombre: `EXT ${label}`, precio });
    }
  }
  result.push({ id: 'aderezo-extra', nombre: 'Aderezo Extra', precio: ADEREZO_PRICE });
  return result;
}

interface CustomizationOptions {
  size?: string;
  crust?: string;
  extras: { nombre: string; precio: number }[];
  cantidad: number;
  finalPrice?: number;
  displayName?: string;
  nota?: string;
  sauce?: string;
}

interface ProductCustomizationModalProps {
  selectedProductId?: number;
  onAdd: (pizza: Pizza, options: CustomizationOptions) => void;
  onClose: () => void;
}

const SIZES = ['chica', 'mediana', 'grande'];
const SIZE_PRICES: Record<string, number> = {
  mini: 0.65,
  chica: 0.85,
  mediana: 1,
  grande: 1.3,
};

const DEFAULT_CRUST_OPTIONS = [
  { id: 'sin-orilla',   nombre: 'Sin Orilla Rellena',         prices: { mini: 0,  chica: 0,  mediana: 0,  grande: 0,  jumbo: 0  } },
  { id: 'orilla-queso', nombre: '🧀 Orilla Rellena de Queso', prices: { mini: 10, chica: 10, mediana: 25, grande: 35, jumbo: 50 } },
  { id: 'dedos-queso',  nombre: '🥖 Orilla Dedos de Queso',   prices: { mini: 0,  chica: 0,  mediana: 35, grande: 45, jumbo: 65 } },
];

const PROMO_SIZES = [
  { id: '2_medianas', label: '2 Medianas', price: 245 },
  { id: '2_grandes', label: '2 Grandes', price: 275 },
];

const CATEGORY_KEYWORDS: Array<{ keywords: string[]; icon: string }> = [
  { keywords: ['pizza', 'pizzas'], icon: '🍕' },
  { keywords: ['hamburguesa', 'hamburguesas', 'burger', 'burgers'], icon: '🍔' },
  { keywords: ['bebida', 'bebidas', 'refresco', 'refrescos', 'agua', 'drink'], icon: '🥤' },
  { keywords: ['snack', 'snacks', 'papa', 'papas', 'frita'], icon: '🍟' },
  { keywords: ['postre', 'postres', 'dulce', 'helado', 'pastel'], icon: '🍰' },
  { keywords: ['ensalada', 'ensaladas', 'entrada', 'entradas', 'sopa'], icon: '🥗' },
  { keywords: ['ala', 'alas', 'pollo', 'boneless', 'alitas'], icon: '🍗' },
  { keywords: ['especial', 'especiales', 'promo', 'combo'], icon: '⭐' },
  { keywords: ['burrito', 'burritos', 'taco', 'tacos', 'mexicano'], icon: '🌯' },
];

const getCategoryIcon = (categoria: string): string => {
  const lower = categoria.toLowerCase();
  for (const { keywords, icon } of CATEGORY_KEYWORDS) {
    if (keywords.some(k => lower.includes(k))) return icon;
  }
  const emojiMatch = categoria.match(/^\p{Emoji}/u);
  if (emojiMatch) return emojiMatch[0];
  return '🍽️';
};

type Step = 'category-select' | 'product-select' | 'customize' | 'extras' | 'promo';

const ProductCustomizationModal: React.FC<ProductCustomizationModalProps> = ({
  selectedProductId,
  onAdd,
  onClose,
}) => {
  const [products, setProducts] = useState<Pizza[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Pizza | null>(null);
  const [options, setOptions] = useState<{ size: string; crust: string; cantidad: number }>({
    size: 'mediana',
    crust: 'sin-orilla',
    cantidad: 1,
  });
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('category-select');

  // Mitad y mitad state
  const [isMitadYMitad, setIsMitadYMitad] = useState(false);
  const [segundaMitad, setSegundaMitad] = useState<Pizza | null>(null);

  // JUMBO state
  const [numEspecialidades, setNumEspecialidades] = useState(1);
  const [selectedEspecialidades, setSelectedEspecialidades] = useState<string[]>(['', '', '', '']);

  // Extras state
  const [selectedExtras, setSelectedExtras] = useState<Record<string, number>>({});

  // Nota y salsa
  const [notaAdicional, setNotaAdicional] = useState('');
  const [selectedSauce, setSelectedSauce] = useState('');
  const SAUCE_OPTIONS = ['BBQ', 'Hot BBQ', 'Mango Habanero', 'Búfalo', 'Ranch Habanero', 'Tamarindo'];

  // Combo promo state
  const [promoSize, setPromoSize] = useState(PROMO_SIZES[0]);
  const [promoPizza1, setPromoPizza1] = useState<Pizza | null>(null);
  const [promoPizza2, setPromoPizza2] = useState<Pizza | null>(null);
  // Dynamic crust options loaded from DB (falls back to defaults)
  const [crustOptions, setCrustOptions] = useState(DEFAULT_CRUST_OPTIONS);
  const getCrustPrice = (crustId: string, sizeId: string): number => {
    const crust = crustOptions.find(c => c.id === crustId);
    return crust?.prices[sizeId as keyof typeof crust.prices] ?? 0;
  };

  const [promoCrust, setPromoCrust] = useState(DEFAULT_CRUST_OPTIONS[0]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch(`${API_URL}/api/productos`);
        if (!response.ok) throw new Error('Error al cargar productos');
        const data = await response.json();

        const allParsed = data
          .filter((p: any) => p.activo === 1 || p.activo === true)
          .map((p: any) => ({
            ...p,
            precios: typeof p.precios === 'string' ? (() => { try { return JSON.parse(p.precios); } catch { return {}; } })() : (p.precios || {}),
            ingredientes: typeof p.ingredientes === 'string'
              ? (() => { try { return JSON.parse(p.ingredientes); } catch { return []; } })()
              : (Array.isArray(p.ingredientes) ? p.ingredientes : []),
          }));

        // Extract crust options from products with "Orilla" in category
        const orillasFromDB = allParsed.filter((p: any) =>
          p.categoria?.toLowerCase().includes('orilla')
        );
        if (orillasFromDB.length > 0) {
          const dynamicCrusts = orillasFromDB.map((p: any) => ({
            id: (p.descripcion?.trim() || p.nombre.toLowerCase().replace(/[^a-z0-9]/g, '-')),
            nombre: p.nombre,
            prices: p.precios as Record<string, number>,
          }));
          // Ensure "sin-orilla" is always first
          if (!dynamicCrusts.find((c: any) => c.id === 'sin-orilla' || c.nombre.toLowerCase().includes('sin'))) {
            dynamicCrusts.unshift({ id: 'sin-orilla', nombre: 'Sin Orilla Rellena', prices: { mini: 0, chica: 0, mediana: 0, grande: 0, jumbo: 0 } });
          }
          setCrustOptions(dynamicCrusts);
        }

        // Only show non-crust products in the main selector
        const filtered = allParsed.filter((p: any) =>
          !p.categoria?.toLowerCase().includes('orilla')
        );

        setProducts(filtered);

        if (selectedProductId) {
          const selected = filtered.find((p: Pizza) => p.id === selectedProductId);
          if (selected) {
            setSelectedProduct(selected);
            setStep('customize');
          }
        }
      } catch (error) {
        console.error('Error cargando productos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [selectedProductId]);

  // Pizzas disponibles para mitad y mitad / JUMBO (solo pizzas, excluyendo jumbo)
  const pizzasForSpecialty = products.filter(
    p => p.categoria.toLowerCase().includes('pizza') && !p.nombre.toLowerCase().includes('jumbo')
  );

  const getProductPrice = (pizza: Pizza, size: string): number => {
    if (pizza.precios && pizza.precios[size]) {
      return pizza.precios[size];
    }
    return pizza.precio * (SIZE_PRICES[size] || 1);
  };

  // Helpers
  const isPizzaProduct = (pizza: Pizza) => pizza.categoria.toLowerCase().includes('pizza');
  const isJumbo = selectedProduct?.nombre?.toLowerCase().trim() === 'jumbo';

  // Available sizes for selected product (prepend mini if product has mini price, append jumbo if has jumbo price)
  const availableSizes = React.useMemo(() => {
    if (!selectedProduct) return SIZES;
    const sizes: string[] = [];
    if (selectedProduct.precios?.mini) sizes.push('mini');
    sizes.push(...SIZES);
    if (selectedProduct.precios?.jumbo) sizes.push('jumbo');
    return sizes;
  }, [selectedProduct]);

  const canHalfAndHalf =
    selectedProduct &&
    isPizzaProduct(selectedProduct) &&
    !isJumbo &&
    (options.size === 'mediana' || options.size === 'grande');

  // Price calculation
  const calculatePrice = (): number => {
    if (!selectedProduct) return 0;

    if (isJumbo) {
      // JUMBO: base price + crust price
      const jumboBase = selectedProduct.precios?.jumbo || selectedProduct.precio;
      const crustPrice = getCrustPrice(options.crust, 'jumbo');
      return (jumboBase + crustPrice) * options.cantidad;
    }

    const basePrice = getProductPrice(selectedProduct, options.size);

    if (isMitadYMitad && segundaMitad && canHalfAndHalf) {
      const segundaPrice = getProductPrice(segundaMitad, options.size);
      const mitadBase = Math.max(basePrice, segundaPrice);
      const crustPrice = getCrustPrice(options.crust, options.size);
      return (mitadBase + crustPrice) * options.cantidad;
    }

    const crustPrice = getCrustPrice(options.crust, options.size);
    return (basePrice + crustPrice) * options.cantidad;
  };

  const unitPrice = calculatePrice() / options.cantidad;
  const totalPrice = calculatePrice();

  const handleSelectCategory = (category: string) => {
    setSelectedCategory(category);
    setStep('product-select');
  };

  const handleSelectProduct = (pizza: Pizza) => {
    setSelectedProduct(pizza);
    setStep('customize');
    setOptions({ size: 'mediana', crust: 'sin-orilla', cantidad: 1 });
    setIsMitadYMitad(false);
    setSegundaMitad(null);
    setNumEspecialidades(1);
    const defaultName = pizzasForSpecialty[0]?.nombre || '';
    setSelectedEspecialidades([defaultName, defaultName, defaultName, defaultName]);
  };

  // Avanza del customize al paso extras (si hay ingredientes) o agrega directo
  const handleCustomizeNext = () => {
    if (!selectedProduct) return;
    const hasIngredientes = Array.isArray(selectedProduct.ingredientes) && selectedProduct.ingredientes.length > 0;
    if (hasIngredientes && !isJumbo) {
      setSelectedExtras({});
      setStep('extras');
    } else {
      commitAddToCart({});
    }
  };

  const commitAddToCart = (extrasMap: Record<string, number>) => {
    if (!selectedProduct) return;

    // Build expanded extras list from extrasMap
    const availableExtras = buildExtrasParaCaja(selectedProduct.ingredientes || [], options.size);
    const extrasFlat: { nombre: string; precio: number }[] = [];
    for (const extra of availableExtras) {
      const qty = extrasMap[extra.id] ?? 0;
      for (let i = 0; i < qty; i++) {
        extrasFlat.push({ nombre: extra.nombre, precio: extra.precio });
      }
    }
    const extrasTotal = extrasFlat.reduce((s, e) => s + e.precio, 0);

    let displayName = selectedProduct.nombre;
    let finalPrice = unitPrice;

    if (isJumbo) {
      const activeEsp = selectedEspecialidades.slice(0, numEspecialidades).filter(Boolean);
      const crustText = options.crust !== 'sin-orilla'
        ? ` + ${crustOptions.find(c => c.id === options.crust)?.nombre}`
        : '';
      displayName = activeEsp.length > 0
        ? `Jumbo (${numEspecialidades} Esp: ${activeEsp.join(', ')})${crustText}`
        : `Jumbo${crustText}`;
      const jumboBase = selectedProduct.precios?.jumbo || selectedProduct.precio;
      finalPrice = jumboBase + getCrustPrice(options.crust, 'jumbo');
    } else if (isMitadYMitad && segundaMitad && canHalfAndHalf) {
      const baseP = getProductPrice(selectedProduct, options.size);
      const segundaP = getProductPrice(segundaMitad, options.size);
      const crustP = getCrustPrice(options.crust, options.size);
      finalPrice = Math.max(baseP, segundaP) + crustP;
      const crustText = options.crust !== 'sin-orilla'
        ? ` + ${crustOptions.find(c => c.id === options.crust)?.nombre}`
        : '';
      displayName = `${selectedProduct.nombre} + ${segundaMitad.nombre} (${options.size} - Mitad y Mitad)${crustText}`;
    } else {
      const crustP = getCrustPrice(options.crust, options.size);
      finalPrice = getProductPrice(selectedProduct, options.size) + crustP;
      const sizeText = options.size ? ` (${options.size})` : '';
      const crustText = options.crust !== 'sin-orilla'
        ? ` + ${crustOptions.find(c => c.id === options.crust)?.nombre}`
        : '';
      displayName = `${selectedProduct.nombre}${sizeText}${crustText}`;
    }

    onAdd(selectedProduct, {
      size: options.size,
      crust: options.crust,
      extras: extrasFlat,
      cantidad: options.cantidad,
      finalPrice: finalPrice + extrasTotal,
      displayName,
      nota: notaAdicional.trim() || undefined,
      sauce: selectedSauce || undefined,
    });
    onClose();
  };

  const handleAddPromo = () => {
    if (!promoPizza1 || !promoPizza2) return;

    // Determinar tamaño base para la promo (medianas o grandes)
    const promoSizeId = promoSize.id.includes('grande') ? 'grande' : 'mediana';
    const crustPrice = getCrustPrice(promoCrust.id, promoSizeId);
    const finalPromoPrice = promoSize.price + crustPrice;

    const crustText = promoCrust.id !== 'sin-orilla' ? ` + ${promoCrust.nombre}` : '';
    const displayName = `Combo ${promoSize.label}: ${promoPizza1.nombre} + ${promoPizza2.nombre}${crustText}`;

    const virtualPizza: Pizza = {
      id: 0,
      nombre: `Combo Promo: ${promoSize.label}`,
      descripcion: `${promoPizza1.nombre} + ${promoPizza2.nombre}`,
      precio: finalPromoPrice,
      imagen: '',
      categoria: 'Promo',
      activo: true,
    };

    onAdd(virtualPizza, {
      size: promoSize.label,
      crust: promoCrust.id,
      extras: [],
      cantidad: 1,
      finalPrice: finalPromoPrice,
      displayName,
    });
    onClose();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-1 sm:p-4">
        <div className="bg-white rounded-xl p-6 text-center">
          <p className="text-gray-600">Cargando menú...</p>
        </div>
      </div>
    );
  }

  const categories = Array.from(new Set(products.map(p => p.categoria))).sort((a, b) =>
    a.localeCompare(b, 'es')
  );

  // ─── STEP: PROMO ────────────────────────────────────────────────────────────
  if (step === 'promo') {
    const isComplete = promoPizza1 !== null && promoPizza2 !== null;
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-1 sm:p-4">
        <div className="bg-white rounded-lg sm:rounded-xl shadow-2xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b p-3 sm:p-5 flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setStep('category-select')}
              className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 transition text-gray-600 flex-shrink-0"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex-1">
              <h2 className="text-base sm:text-2xl font-bold text-gray-900">🔥 Combo Promo</h2>
              <p className="text-xs sm:text-sm text-gray-500">Arma tu combo de 2 pizzas</p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 flex-shrink-0">
              <X size={22} />
            </button>
          </div>

          <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
            {/* Tamaño */}
            <div>
              <h3 className="font-bold text-gray-800 mb-3">1. Elige el tamaño</h3>
              <div className="grid grid-cols-2 gap-3">
                {PROMO_SIZES.map(size => (
                  <button
                    key={size.id}
                    onClick={() => setPromoSize(size)}
                    className={`p-4 rounded-xl border-2 font-bold transition flex items-center justify-between ${
                      promoSize.id === size.id
                        ? 'border-red-600 bg-red-50 text-red-700'
                        : 'border-gray-200 text-gray-700 hover:border-red-300'
                    }`}
                  >
                    <span>{size.label}</span>
                    <span className="text-lg">${size.price.toLocaleString()}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Pizza 1 */}
            <div>
              <h3 className="font-bold text-gray-800 mb-3">2. Primera Pizza</h3>
              <select
                value={promoPizza1?.id || ''}
                onChange={e => {
                  const p = pizzasForSpecialty.find(p => p.id === Number(e.target.value));
                  setPromoPizza1(p || null);
                }}
                className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-gray-800 focus:border-red-500 outline-none font-medium"
              >
                <option value="" disabled>Selecciona una pizza...</option>
                {[...pizzasForSpecialty].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
              {promoPizza1 && (
                <div className="mt-2 flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200">
                  {promoPizza1.imagen && (
                    <img src={promoPizza1.imagen} alt={promoPizza1.nombre} className="w-12 h-12 rounded-lg object-cover" />
                  )}
                  <span className="text-sm text-gray-600 italic">{promoPizza1.descripcion}</span>
                </div>
              )}
            </div>

            {/* Pizza 2 */}
            <div>
              <h3 className="font-bold text-gray-800 mb-3">3. Segunda Pizza</h3>
              <select
                value={promoPizza2?.id || ''}
                onChange={e => {
                  const p = pizzasForSpecialty.find(p => p.id === Number(e.target.value));
                  setPromoPizza2(p || null);
                }}
                className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-gray-800 focus:border-red-500 outline-none font-medium"
              >
                <option value="" disabled>Selecciona una pizza...</option>
                {[...pizzasForSpecialty].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
              {promoPizza2 && (
                <div className="mt-2 flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200">
                  {promoPizza2.imagen && (
                    <img src={promoPizza2.imagen} alt={promoPizza2.nombre} className="w-12 h-12 rounded-lg object-cover" />
                  )}
                  <span className="text-sm text-gray-600 italic">{promoPizza2.descripcion}</span>
                </div>
              )}
            </div>

            {/* Orilla de Queso para la Promo */}
            <div>
              <h3 className="font-bold text-gray-800 mb-3">4. Orilla Rellena (opcional)</h3>
              <div className="space-y-2">
                {crustOptions.map(crust => {
                  const promoSizeId = promoSize.id.includes('grande') ? 'grande' : 'mediana';
                  const crustP = getCrustPrice(crust.id, promoSizeId);
                  return (
                    <button key={crust.id} type="button" onClick={() => setPromoCrust(crust)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border-2 font-semibold transition text-left ${promoCrust.id === crust.id ? 'border-red-600 bg-red-50 text-red-700' : 'border-gray-200 text-gray-700 hover:border-red-300'}`}>
                      <span className="text-sm">{crust.nombre}</span>
                      <span className="text-sm font-bold">{crustP > 0 ? `+$${crustP}` : 'Sin cargo'}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Resumen */}
            {(() => {
              const promoSizeId = promoSize.id.includes('grande') ? 'grande' : 'mediana';
              const crustP = getCrustPrice(promoCrust.id, promoSizeId);
              const total = promoSize.price + crustP;
              return (
                <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200 rounded-xl p-4">
                  <div className="flex justify-between items-center text-xl font-bold text-gray-900">
                    <span>Total Combo:</span>
                    <span className="text-red-600">${total.toLocaleString()}</span>
                  </div>
                  {crustP > 0 && <p className="text-sm text-gray-500 mt-1">Incluye orilla: +${crustP}</p>}
                </div>
              );
            })()}
          </div>

          <div className="sticky bottom-0 bg-white border-t p-3 sm:p-5">
            {(() => {
              const promoSizeId = promoSize.id.includes('grande') ? 'grande' : 'mediana';
              const crustP = getCrustPrice(promoCrust.id, promoSizeId);
              const total = promoSize.price + crustP;
              return (
                <button onClick={handleAddPromo} disabled={!isComplete}
                  className="w-full py-4 bg-red-600 hover:bg-red-700 disabled:opacity-50 active:scale-95 text-white rounded-xl font-bold text-base sm:text-lg transition flex items-center justify-center gap-3">
                  <ShoppingCart size={20} />
                  {isComplete ? `Agregar Combo — $${total.toLocaleString()}` : 'Selecciona ambas pizzas'}
                </button>
              );
            })()}
          </div>
        </div>
      </div>
    );
  }

  // ─── STEP 1: CATEGORY SELECT ─────────────────────────────────────────────────
  if (step === 'category-select') {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-1 sm:p-4">
        <div className="bg-white rounded-lg sm:rounded-xl shadow-2xl max-w-3xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b p-4 sm:p-5 flex justify-between items-center">
            <h2 className="text-lg sm:text-2xl font-bold text-gray-900">¿Qué tipo de producto?</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X size={24} />
            </button>
          </div>

          <div className="p-3 sm:p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
              {/* Combo Promo button */}
              <button
                onClick={() => {
                  setPromoSize(PROMO_SIZES[0]);
                  setPromoPizza1(null);
                  setPromoPizza2(null);
                  setStep('promo');
                }}
                className="flex flex-col items-center justify-center gap-2 p-3 sm:p-6 bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-400 rounded-xl hover:border-red-600 transition-all active:scale-95 shadow-md"
              >
                <span className="text-3xl sm:text-5xl">🔥</span>
                <span className="font-bold text-red-700 text-center text-sm sm:text-base leading-tight">Combo Promo</span>
                <span className="text-[10px] sm:text-xs text-red-500 font-semibold text-center">2 pizzas especial</span>
              </button>

              {categories.map(category => {
                const icon = getCategoryIcon(category);
                const count = products.filter(p => p.categoria === category).length;
                return (
                  <button
                    key={category}
                    onClick={() => handleSelectCategory(category)}
                    className="flex flex-col items-center justify-center gap-2 p-3 sm:p-6 bg-white border-2 border-gray-200 rounded-xl hover:border-red-500 hover:bg-red-50 transition-all active:scale-95 shadow-sm"
                  >
                    <span className="text-3xl sm:text-5xl">{icon}</span>
                    <span className="font-bold text-gray-800 text-center text-xs sm:text-base leading-tight">{category}</span>
                    <span className="text-[10px] sm:text-xs text-gray-500">{count} prod{count !== 1 ? 's' : ''}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── STEP 2: PRODUCT SELECT ───────────────────────────────────────────────────
  if (step === 'product-select') {
    const categoryProducts = products.filter(p => p.categoria === selectedCategory);
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-1 sm:p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b p-3 sm:p-5 flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setStep('category-select')}
              className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 transition text-gray-600 flex-shrink-0"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-2xl font-bold text-gray-900 truncate">
                {getCategoryIcon(selectedCategory!)} {selectedCategory}
              </h2>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 flex-shrink-0">
              <X size={22} />
            </button>
          </div>

          <div className="p-3 sm:p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
              {[...categoryProducts]
                .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
                .map(pizza => (
                  <button
                    key={pizza.id}
                    onClick={() => handleSelectProduct(pizza)}
                    className="group relative overflow-hidden rounded-xl border-2 border-gray-200 hover:border-red-500 hover:shadow-lg transition-all active:scale-95 text-left"
                  >
                    {pizza.imagen ? (
                      <img
                        src={pizza.imagen}
                        alt={pizza.nombre}
                        className="w-full h-24 sm:h-36 object-cover group-hover:scale-105 transition"
                      />
                    ) : (
                      <div className="w-full h-24 sm:h-36 bg-gray-100 flex items-center justify-center text-3xl sm:text-4xl">
                        {getCategoryIcon(pizza.categoria)}
                      </div>
                    )}
                    <div className="p-2 sm:p-3 bg-white">
                      <p className="font-bold text-xs sm:text-sm text-gray-800 leading-tight">{pizza.nombre}</p>
                      <p className="text-red-600 font-bold text-xs sm:text-sm mt-0.5">
                        desde ${pizza.precio.toLocaleString()}
                      </p>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── STEP 4: EXTRAS ─────────────────────────────────────────────────────────
  if (step === 'extras' && selectedProduct) {
    const availableExtras = buildExtrasParaCaja(selectedProduct.ingredientes || [], options.size);
    const extrasTotal = availableExtras.reduce((s, e) => {
      const qty = selectedExtras[e.id] ?? 0;
      return s + e.precio * qty;
    }, 0);

    const toggleExtra = (extra: CajaExtraItem) => {
      setSelectedExtras(prev => {
        if (prev[extra.id]) {
          const next = { ...prev }; delete next[extra.id]; return next;
        }
        return { ...prev, [extra.id]: 1 };
      });
    };

    const setCantidadExtra = (extra: CajaExtraItem, delta: number) => {
      setSelectedExtras(prev => {
        const cur = prev[extra.id] ?? 0;
        const next = Math.max(0, cur + delta);
        if (next === 0) { const r = { ...prev }; delete r[extra.id]; return r; }
        return { ...prev, [extra.id]: next };
      });
    };

    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-1 sm:p-4">
        <div className="bg-white rounded-lg sm:rounded-xl shadow-2xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b p-3 sm:p-5 flex items-center gap-2 sm:gap-3">
            <button onClick={() => setStep('customize')} className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 transition text-gray-600 flex-shrink-0">
              <ArrowLeft size={20} />
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-xl font-bold text-gray-900 truncate">¿Extras para {selectedProduct.nombre}?</h2>
              <p className="text-xs sm:text-sm text-gray-500">
                {options.size} — ${EXTRA_PRICE_BY_SIZE[options.size] ?? 10} c/u · Aderezo $10
              </p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 flex-shrink-0"><X size={22} /></button>
          </div>

          <div className="p-3 sm:p-6 space-y-2 sm:space-y-3">
            {availableExtras.map(extra => {
              const qty = selectedExtras[extra.id] ?? 0;
              const isSelected = qty > 0;
              return (
                <div
                  key={extra.id}
                  className={`flex items-center justify-between p-4 rounded-xl border-2 transition ${
                    isSelected ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => toggleExtra(extra)}>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${
                      isSelected ? 'bg-red-600 border-red-600' : 'border-gray-400'
                    }`}>
                      {isSelected && <Check size={12} className="text-white" strokeWidth={3} />}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-gray-800">{extra.nombre}</p>
                      <p className="text-xs text-gray-500">+${extra.precio} c/u</p>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="flex items-center gap-2 ml-3">
                      <button onClick={() => setCantidadExtra(extra, -1)} className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition">
                        <Minus size={13} />
                      </button>
                      <span className="font-black text-sm w-4 text-center text-gray-800">{qty}</span>
                      <button onClick={() => setCantidadExtra(extra, 1)} className="w-7 h-7 rounded-full bg-red-100 hover:bg-red-200 flex items-center justify-center text-red-700 transition">
                        <Plus size={13} />
                      </button>
                    </div>
                  )}
                  {!isSelected && <span className="text-gray-400 text-xs font-bold ml-3">+${extra.precio}</span>}
                </div>
              );
            })}
          </div>

          <div className="sticky bottom-0 bg-white border-t p-3 sm:p-5 space-y-2">
            {extrasTotal > 0 && (
              <div className="flex justify-between text-sm text-gray-600 px-1 mb-1">
                <span>{Object.keys(selectedExtras).length} extra(s) seleccionados</span>
                <span className="font-black text-red-600">+${extrasTotal}</span>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => commitAddToCart(selectedExtras)}
                className="flex-1 py-4 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-xl font-bold text-lg transition flex items-center justify-center gap-3"
              >
                <ShoppingCart size={22} />
                {extrasTotal > 0
                  ? `Agregar (+$${extrasTotal}) — $${(totalPrice + extrasTotal).toLocaleString()}`
                  : `Agregar — $${totalPrice.toLocaleString()}`}
              </button>
              <button
                onClick={() => commitAddToCart({})}
                title="Sin extras"
                className="w-14 h-14 flex-shrink-0 bg-gray-100 hover:bg-gray-200 border-2 border-gray-300 hover:border-gray-400 text-gray-600 rounded-xl font-bold text-xs transition flex flex-col items-center justify-center gap-0.5 active:scale-95"
              >
                <X size={18} />
                <span className="text-[10px]">Sin ext.</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── STEP 3: CUSTOMIZE ───────────────────────────────────────────────────────
  // Effective size for crust pricing: Jumbo always uses 'jumbo' key
  const effectiveSizeForCrust = isJumbo ? 'jumbo' : options.size;

  const showCrustOptions =
    selectedProduct &&
    isPizzaProduct(selectedProduct) &&
    (isJumbo || options.size === 'mini' || options.size === 'chica' || options.size === 'mediana' || options.size === 'grande' || options.size === 'jumbo');

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* HEADER */}
        <div className="sticky top-0 bg-white border-b p-3 sm:p-5 flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => { setStep('product-select'); setSelectedProduct(null); }}
            className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 transition text-gray-600 flex-shrink-0"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-xl font-bold text-gray-900 truncate">{selectedProduct?.nombre}</h2>
            {selectedProduct?.descripcion && (
              <p className="text-gray-500 text-xs sm:text-sm mt-0.5 line-clamp-1">{selectedProduct.descripcion}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 flex-shrink-0">
            <X size={22} />
          </button>
        </div>

        {/* CONTENT */}
        <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
          {selectedProduct?.imagen && (
            <div className="flex justify-center">
              <img
                src={selectedProduct.imagen}
                alt={selectedProduct.nombre}
                className="w-28 h-28 sm:w-40 sm:h-40 object-cover rounded-xl shadow"
              />
            </div>
          )}

          {/* JUMBO: especialidades selector */}
          {isJumbo ? (
            <div>
              <h3 className="font-bold text-gray-800 mb-3">Especialidades (hasta 4)</h3>
              <div className="flex gap-2 mb-4">
                {[1, 2, 3, 4].map(num => (
                  <button
                    key={num}
                    onClick={() => setNumEspecialidades(num)}
                    className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition border-2 ${
                      numEspecialidades === num
                        ? 'border-red-600 bg-red-600 text-white'
                        : 'border-gray-200 text-gray-700 hover:border-red-300'
                    }`}
                  >
                    {num} Esp.
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                {Array.from({ length: numEspecialidades }).map((_, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <span className="text-red-600 font-bold text-sm w-5">{index + 1}.</span>
                    <select
                      value={selectedEspecialidades[index] || ''}
                      onChange={e => {
                        const newEsp = [...selectedEspecialidades];
                        newEsp[index] = e.target.value;
                        setSelectedEspecialidades(newEsp);
                      }}
                      className="flex-1 border-2 border-gray-300 rounded-xl px-3 py-2.5 text-gray-800 focus:border-red-500 outline-none font-medium text-sm"
                    >
                      <option value="" disabled>Selecciona especialidad...</option>
                      {[...pizzasForSpecialty]
                        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
                        .map(esp => (
                          <option key={esp.id} value={esp.nombre}>{esp.nombre}</option>
                        ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* TAMAÑO */}
              <div>
                <h3 className="font-bold text-gray-800 mb-3">Tamaño</h3>
                <div className={`grid gap-3`} style={{ gridTemplateColumns: `repeat(${availableSizes.length}, 1fr)` }}>
                  {availableSizes.map(size => {
                    const price = getProductPrice(selectedProduct!, size);
                    return (
                      <button
                        key={size}
                        onClick={() => {
                          setOptions(prev => ({ ...prev, size }));
                          setIsMitadYMitad(false);
                          setSegundaMitad(null);
                        }}
                        className={`p-4 rounded-xl border-2 transition font-semibold text-center active:scale-95 ${
                          options.size === size
                            ? 'border-red-600 bg-red-50 text-red-700'
                            : 'border-gray-200 bg-white text-gray-800 hover:border-red-300'
                        }`}
                      >
                        <div className="capitalize text-base">{size}</div>
                        <div className="text-sm mt-1 font-bold">${price.toLocaleString()}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* MITAD Y MITAD (pizza, mediana o grande) */}
              {canHalfAndHalf && (
                <div className="border-t pt-4">
                  <div
                    className="flex items-center gap-3 cursor-pointer group"
                    onClick={() => {
                      const newVal = !isMitadYMitad;
                      setIsMitadYMitad(newVal);
                      if (newVal && !segundaMitad) {
                        const options2 = pizzasForSpecialty.filter(
                          e => e.nombre !== selectedProduct?.nombre
                        );
                        if (options2.length > 0) setSegundaMitad(options2[0]);
                      }
                    }}
                  >
                    <div
                      className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition flex-shrink-0 ${
                        isMitadYMitad
                          ? 'bg-red-600 border-red-600'
                          : 'border-gray-400 group-hover:border-red-400'
                      }`}
                    >
                      {isMitadYMitad && <Check size={14} className="text-white" strokeWidth={3} />}
                    </div>
                    <span className="text-sm font-bold text-gray-700 select-none">
                      Mitad y Mitad — combinar con otra especialidad
                    </span>
                  </div>

                  {isMitadYMitad && (
                    <div className="mt-3 ml-9">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                        Selecciona la 2da Mitad:
                      </p>
                      <select
                        value={segundaMitad?.id || ''}
                        onChange={e => {
                          const p = pizzasForSpecialty.find(p => p.id === Number(e.target.value));
                          setSegundaMitad(p || null);
                        }}
                        className="w-full border-2 border-gray-300 rounded-xl px-3 py-2.5 text-gray-800 focus:border-red-500 outline-none font-medium text-sm"
                      >
                        {[...pizzasForSpecialty]
                          .filter(e => e.nombre !== selectedProduct?.nombre)
                          .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
                          .map(esp => (
                            <option key={esp.id} value={esp.id}>{esp.nombre}</option>
                          ))}
                      </select>
                      {segundaMitad && (
                        <p className="text-xs text-gray-500 mt-1 italic">
                          Precio: el más caro entre ambas mitades ($
                          {Math.max(
                            getProductPrice(selectedProduct!, options.size),
                            getProductPrice(segundaMitad, options.size)
                          ).toLocaleString()}
                          )
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ORILLA (si aplica) */}
          {showCrustOptions && (
            <div>
              <h3 className="font-bold text-gray-800 mb-3">Orilla Rellena</h3>
              <div className="space-y-2">
                {crustOptions
                  // Para cada tamaño solo mostrar opciones disponibles:
                  // sin-orilla siempre, las de pago solo si tienen precio > 0 para ese tamaño
                  .filter(crust => crust.id === 'sin-orilla' || getCrustPrice(crust.id, effectiveSizeForCrust) > 0)
                  .map(crust => {
                    const crustPrecio = getCrustPrice(crust.id, effectiveSizeForCrust);
                    return (
                      <label
                        key={crust.id}
                        className={`flex items-center p-3 border-2 rounded-xl cursor-pointer transition ${
                          options.crust === crust.id
                            ? 'border-red-500 bg-red-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="crust"
                          checked={options.crust === crust.id}
                          onChange={() => setOptions(prev => ({ ...prev, crust: crust.id }))}
                          className="w-4 h-4 text-red-600"
                        />
                        <span className="flex-1 ml-3 font-medium text-gray-800">{crust.nombre}</span>
                        {crustPrecio > 0 && (
                          <span className="text-red-600 font-bold">+${crustPrecio}</span>
                        )}
                      </label>
                    );
                  })}
              </div>
            </div>
          )}

          {/* CANTIDAD */}
          <div>
            <h3 className="font-bold text-gray-800 mb-3">Cantidad</h3>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setOptions(prev => ({ ...prev, cantidad: Math.max(1, prev.cantidad - 1) }))}
                className="w-12 h-12 flex items-center justify-center border-2 border-gray-300 rounded-xl hover:bg-gray-100 transition"
              >
                <Minus size={20} />
              </button>
              <span className="text-3xl font-bold text-gray-900 w-16 text-center">{options.cantidad}</span>
              <button
                onClick={() => setOptions(prev => ({ ...prev, cantidad: prev.cantidad + 1 }))}
                className="w-12 h-12 flex items-center justify-center border-2 border-green-400 rounded-xl hover:bg-green-50 transition text-green-700"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>

          {/* SELECTOR DE SALSA (hamburguesas/boneless) */}
          {(selectedProduct?.categoria?.toLowerCase().includes('hamburguesa') ||
            selectedProduct?.nombre?.toLowerCase().includes('boneless')) && (
            <div className="border border-orange-200 rounded-xl p-4 bg-orange-50">
              <p className="text-sm font-bold text-gray-700 mb-2">🥣 Tipo de Salsa</p>
              <div className="grid grid-cols-3 gap-2">
                {SAUCE_OPTIONS.map(s => (
                  <button key={s} type="button" onClick={() => setSelectedSauce(selectedSauce === s ? '' : s)}
                    className={`py-2 px-2 rounded-lg border-2 text-xs font-semibold transition ${selectedSauce === s ? 'border-orange-500 bg-orange-100 text-orange-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* NOTA ADICIONAL */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">📝 Nota adicional (opcional)</label>
            <input type="text" placeholder="Ej: sin cebolla, extra jalapeño, bien cocida..."
              value={notaAdicional} onChange={e => setNotaAdicional(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-gray-900 bg-white text-sm" />
          </div>

          {/* RESUMEN */}
          <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200 rounded-xl p-5">
            <div className="space-y-2">
              <div className="flex justify-between text-gray-700">
                <span>Precio unitario:</span>
                <span className="font-semibold">${unitPrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-700">
                <span>Cantidad:</span>
                <span className="font-semibold">{options.cantidad}</span>
              </div>
              <div className="border-t pt-2 flex justify-between text-xl font-bold text-gray-900">
                <span>Total:</span>
                <span className="text-red-600">${totalPrice.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="sticky bottom-0 bg-white border-t p-3 sm:p-5">
          <button
            onClick={handleCustomizeNext}
            className="w-full py-4 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-xl font-bold text-base sm:text-lg transition flex items-center justify-center gap-2 sm:gap-3"
          >
            <ShoppingCart size={22} />
            {Array.isArray(selectedProduct?.ingredientes) && selectedProduct!.ingredientes.length > 0 && !isJumbo
              ? `Siguiente — $${totalPrice.toLocaleString()}`
              : `Agregar al Pedido — $${totalPrice.toLocaleString()}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCustomizationModal;
