'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Pizza as PizzaIcon, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Pizza, pizzas as menuOriginal } from '@/data/menu';

interface PromoBuilderProps {
    onAddPromo: (promoItem: any) => void;
    menu?: Pizza[];
}

const PROMO_SIZES = [
    { id: '2_medianas', label: '2 Medianas', price: 245 },
    { id: '2_grandes', label: '2 Grandes', price: 275 }
];

const PROMO_CRUST_OPTIONS = [
    { id: 'normal',  label: 'Sin Orilla Rellena',         prices: { mediana: 0,  grande: 0  } },
    { id: 'rellena', label: '🧀 Orilla Rellena de Queso', prices: { mediana: 25, grande: 35 } },
    { id: 'dedos',   label: '🥖 Orilla Dedos de Queso',   prices: { mediana: 35, grande: 45 } },
];

export default function PromoBuilder({ onAddPromo, menu = menuOriginal }: PromoBuilderProps) {
    const [selectedSize, setSelectedSize] = useState(PROMO_SIZES[0]);
    const [pizza1, setPizza1] = useState<Pizza | null>(null);
    const [pizza2, setPizza2] = useState<Pizza | null>(null);
    const [selectedCrust, setSelectedCrust] = useState(PROMO_CRUST_OPTIONS[0]);

    // Días válidos: Lunes (1), Miércoles (3), Viernes (5)
    const today = new Date().getDay();
    const isValidDay = [1, 3, 5].includes(today);

    // Solo mostrar items que son pizzas de la base de datos
    const pizzasOnly = menu.filter(p => p.categoria.includes("Pizzas") && p.activo);

    const isComplete = pizza1 !== null && pizza2 !== null;

    const handleAdd = () => {
        if (!isComplete) return;

        const promoSizeKey = selectedSize.id.includes('grande') ? 'grande' : 'mediana';
        const crustPrice = selectedCrust.prices[promoSizeKey as keyof typeof selectedCrust.prices] ?? 0;
        const totalPrice = selectedSize.price + crustPrice;
        const crustText = selectedCrust.id !== 'normal' ? ` + ${selectedCrust.label}` : '';

        const promoItem = {
            id: `promo_${Date.now()}`,
            nombre: `Promo: ${selectedSize.label}`,
            descripcion: `Pizza 1: ${pizza1!.nombre} | Pizza 2: ${pizza2!.nombre}`,
            precio: totalPrice,
            imagen: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=800',
            categoria: '🔥 Promos',
            activo: true,
            size: selectedSize.label,
            crust: selectedCrust.id !== 'normal' ? selectedCrust.label : undefined,
            totalItemPrice: totalPrice,
            quantity: 1,
            cartId: `promo_${selectedSize.id}_${pizza1!.id}_${pizza2!.id}_${selectedCrust.id}`,
            extras: []
        };

        onAddPromo(promoItem);

        // Reset
        setPizza1(null);
        setPizza2(null);
    };

    return (
        <div className="bg-capriccio-card rounded-[2rem] shadow-2xl border border-white/5 p-6 md:p-10 max-w-4xl mx-auto">
            <div className="text-center mb-10">
                <h2 className="text-4xl font-title font-black italic uppercase text-white mb-2">¡Super Promo!</h2>
                <p className="text-capriccio-gold font-bold italic tracking-widest uppercase">Arma tu combo perfecto en 3 pasos</p>
            </div>

            <div className="space-y-12">
                {/* Paso 1: Tamaño */}
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <span className="bg-capriccio-gold text-capriccio-dark w-8 h-8 rounded-full flex items-center justify-center font-black text-lg">1</span>
                        <h3 className="text-xl font-black text-white uppercase italic">Elige el tamaño</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {PROMO_SIZES.map(size => (
                            <div
                                key={size.id}
                                onClick={() => setSelectedSize(size)}
                                className={cn(
                                    "flex items-center justify-between p-5 rounded-2xl border-2 cursor-pointer transition-all duration-300",
                                    selectedSize.id === size.id
                                        ? "border-capriccio-gold bg-capriccio-gold/10 shadow-[0_0_20px_rgba(250,204,21,0.2)]"
                                        : "border-white/10 bg-black/40 hover:bg-black hover:border-white/20"
                                )}
                            >
                                <span className={cn(
                                    "font-black text-lg tracking-wide uppercase italic",
                                    selectedSize.id === size.id ? "text-capriccio-gold" : "text-white"
                                )}>
                                    {size.label}
                                </span>
                                <span className={cn(
                                    "font-black text-xl",
                                    selectedSize.id === size.id ? "text-white" : "text-gray-400"
                                )}>
                                    ${size.price}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Paso 2 y 3: Pizzas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Pizza 1 */}
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <span className="bg-capriccio-gold text-capriccio-dark w-8 h-8 rounded-full flex items-center justify-center font-black text-lg">2</span>
                            <h3 className="text-xl font-black text-white uppercase italic">Tu Pizza 1</h3>
                        </div>
                        <select
                            value={pizza1?.id || ''}
                            onChange={(e) => {
                                const p = pizzasOnly.find(p => p.id === Number(e.target.value));
                                setPizza1(p || null);
                            }}
                            disabled={!isValidDay}
                            className={cn(
                                "w-full bg-black border-2 border-white/10 text-white rounded-xl p-4 font-bold outline-none transition-all appearance-none cursor-pointer",
                                !isValidDay ? "opacity-50 cursor-not-allowed" : "focus:border-capriccio-gold"
                            )}
                        >
                            <option value="" disabled>Selecciona una pizza...</option>
                            {pizzasOnly.map(p => (
                                <option key={p.id} value={p.id}>{p.nombre}</option>
                            ))}
                        </select>
                        {pizza1 && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex items-center gap-4 bg-black/50 p-3 rounded-xl border border-white/5">
                                <img src={pizza1.imagen} alt={pizza1.nombre} className="w-16 h-16 rounded-lg object-cover" />
                                <span className="text-sm text-gray-300 font-medium italic leading-tight">{pizza1.descripcion}</span>
                            </motion.div>
                        )}
                    </div>

                    {/* Pizza 2 */}
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <span className="bg-capriccio-gold text-capriccio-dark w-8 h-8 rounded-full flex items-center justify-center font-black text-lg">3</span>
                            <h3 className="text-xl font-black text-white uppercase italic">Tu Pizza 2</h3>
                        </div>
                        <select
                            value={pizza2?.id || ''}
                            onChange={(e) => {
                                const p = pizzasOnly.find(p => p.id === Number(e.target.value));
                                setPizza2(p || null);
                            }}
                            disabled={!isValidDay}
                            className={cn(
                                "w-full bg-black border-2 border-white/10 text-white rounded-xl p-4 font-bold outline-none transition-all appearance-none cursor-pointer",
                                !isValidDay ? "opacity-50 cursor-not-allowed" : "focus:border-capriccio-gold"
                            )}
                        >
                            <option value="" disabled>Selecciona una pizza...</option>
                            {pizzasOnly.map(p => (
                                <option key={p.id} value={p.id}>{p.nombre}</option>
                            ))}
                        </select>
                        {pizza2 && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex items-center gap-4 bg-black/50 p-3 rounded-xl border border-white/5">
                                <img src={pizza2.imagen} alt={pizza2.nombre} className="w-16 h-16 rounded-lg object-cover" />
                                <span className="text-sm text-gray-300 font-medium italic leading-tight">{pizza2.descripcion}</span>
                            </motion.div>
                        )}
                    </div>
                </div>

                {/* Paso 4: Orilla */}
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <span className="bg-capriccio-gold text-capriccio-dark w-8 h-8 rounded-full flex items-center justify-center font-black text-lg">4</span>
                        <h3 className="text-xl font-black text-white uppercase italic">Orilla Rellena (opcional)</h3>
                    </div>
                    <div className="space-y-3">
                        {PROMO_CRUST_OPTIONS.map(crust => {
                            const sizeKey = selectedSize.id.includes('grande') ? 'grande' : 'mediana';
                            const crustP = crust.prices[sizeKey as keyof typeof crust.prices] ?? 0;
                            return (
                                <div key={crust.id} onClick={() => setSelectedCrust(crust)}
                                    className={cn("flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all",
                                        selectedCrust.id === crust.id
                                            ? "border-capriccio-gold bg-capriccio-gold/10"
                                            : "border-white/10 bg-black/40 hover:bg-black hover:border-white/20")}>
                                    <span className={cn("font-bold uppercase italic text-sm", selectedCrust.id === crust.id ? "text-capriccio-gold" : "text-white")}>
                                        {crust.label}
                                    </span>
                                    <span className={cn("font-black", selectedCrust.id === crust.id ? "text-white" : "text-gray-400")}>
                                        {crustP > 0 ? `+$${crustP}` : 'Sin cargo'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Paso 5: Botón Gigante */}
                <div className="pt-4 border-t border-white/10">
                    {!isValidDay ? (
                        <div className="bg-red-900/20 border border-red-500/50 p-6 rounded-2xl text-center">
                            <p className="text-red-400 font-black italic uppercase tracking-widest text-lg">
                                ESTA PROMO SOLO ES VÁLIDA LUNES, MIÉRCOLES Y VIERNES
                            </p>
                            <p className="text-gray-400 font-bold text-sm mt-2 uppercase italic">
                                ¡Vuelve pronto para aprovecharla!
                            </p>
                        </div>
                    ) : (
                        <button
                            onClick={handleAdd}
                            disabled={!isComplete}
                            className={cn(
                                "w-full py-6 rounded-2xl font-black text-2xl md:text-3xl italic uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-4",
                                !isComplete
                                    ? "bg-white/5 text-gray-600 cursor-not-allowed border border-white/5"
                                    : "bg-[#22c55e] hover:bg-[#16a34a] text-white shadow-[0_0_40px_rgba(34,197,94,0.4)] hover:scale-[1.02] active:scale-95"
                            )}
                        >
                            {isComplete ? (
                                <>
                                    <Check className="w-8 h-8 md:w-10 md:h-10" strokeWidth={4} />
                                    ¡AGREGAR PROMO!
                                </>
                            ) : (
                                <span>SELECCIONA TUS PIZZAS</span>
                            )}
                        </button>
                    )}
                    
                    {isValidDay && (() => {
                        const sizeKey = selectedSize.id.includes('grande') ? 'grande' : 'mediana';
                        const crustP = selectedCrust.prices[sizeKey as keyof typeof selectedCrust.prices] ?? 0;
                        return (
                            <p className="text-center text-gray-500 font-bold mt-4 italic text-sm">
                                Total a sumar al carrito: <span className="text-white">${selectedSize.price + crustP}</span>
                                {crustP > 0 && <span className="text-capriccio-gold ml-1">(+${crustP} orilla)</span>}
                            </p>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
}
