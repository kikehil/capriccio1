'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Tabla de precios de extras por tamaño ───────────────────────────────────
export const EXTRA_PRICE_BY_SIZE: Record<string, number> = {
    mini:    10,
    chica:   10,
    mediana: 25,
    grande:  30,
    jumbo:   50,
    unica:   10,
};

// Aderezo siempre $10, sin importar tamaño
const ADEREZO_PRICE = 10;

// Ingredientes que se pueden pedir como extra
const INGREDIENTE_LABELS: Record<string, string> = {
    'champiñon':    'Champiñón',
    'champiñón':    'Champiñón',
    'mushroom':     'Champiñón',
    'peperoni':     'Peperoni',
    'pepperoni':    'Peperoni',
    'piña':         'Piña',
    'pineapple':    'Piña',
    'salchicha':    'Salchicha',
    'tocino':       'Tocino',
    'bacon':        'Tocino',
    'queso':        'Doble Queso',
    'quesos':       'Doble Queso',
    'doble queso':  'Doble Queso',
    'mozzarella':   'Doble Queso',
    'jamón':        'Jamón Extra',
    'jamon':        'Jamón Extra',
    'chorizo':      'Chorizo Extra',
    'jalapeño':     'Jalapeño Extra',
    'jalapeños':    'Jalapeño Extra',
    'jalapeno':     'Jalapeño Extra',
    'pollo':        'Pollo Extra',
    'salami':       'Salami Extra',
    'cebolla':      'Cebolla Extra',
    'pimiento':     'Pimiento Extra',
};

export interface ExtraItem {
    id: string;
    nombre: string;
    precio: number;
    cantidad: number;
}

interface ExtrasModalProps {
    isOpen: boolean;
    pizzaNombre: string;
    pizzaIngredientes: string[];
    sizeId: string;          // 'mini' | 'chica' | 'mediana' | 'grande' | 'jumbo'
    sizeLabel: string;
    onConfirm: (extras: ExtraItem[]) => void;
    onSkip: () => void;
    onClose: () => void;
}

// Construye la lista de extras disponibles según los ingredientes de la pizza
function buildExtrasFromIngredientes(ingredientes: string[], sizeId: string): ExtraItem[] {
    const seen = new Set<string>();
    const result: ExtraItem[] = [];
    const precio = EXTRA_PRICE_BY_SIZE[sizeId] ?? 10;

    for (const ing of ingredientes) {
        const key = ing.toLowerCase().trim();
        const label = INGREDIENTE_LABELS[key];
        if (label && !seen.has(label)) {
            seen.add(label);
            result.push({ id: `extra-${label.toLowerCase().replace(/\s+/g, '-')}`, nombre: `EXT ${label}`, precio, cantidad: 1 });
        }
    }

    // Aderezo siempre disponible
    result.push({ id: 'aderezo-extra', nombre: 'Aderezo Extra', precio: ADEREZO_PRICE, cantidad: 1 });

    return result;
}

const ExtrasModal: React.FC<ExtrasModalProps> = ({
    isOpen, pizzaNombre, pizzaIngredientes, sizeId, sizeLabel,
    onConfirm, onSkip, onClose
}) => {
    const availableExtras = buildExtrasFromIngredientes(pizzaIngredientes, sizeId);
    const [selected, setSelected] = useState<Record<string, number>>({});

    useEffect(() => {
        if (isOpen) setSelected({});
    }, [isOpen]);

    const toggle = (extra: ExtraItem) => {
        setSelected(prev => {
            if (prev[extra.id]) {
                const next = { ...prev };
                delete next[extra.id];
                return next;
            }
            return { ...prev, [extra.id]: 1 };
        });
    };

    const setCantidad = (extra: ExtraItem, delta: number) => {
        setSelected(prev => {
            const cur = prev[extra.id] ?? 0;
            const next = Math.max(0, cur + delta);
            if (next === 0) {
                const r = { ...prev }; delete r[extra.id]; return r;
            }
            return { ...prev, [extra.id]: next };
        });
    };

    const selectedExtras: ExtraItem[] = availableExtras
        .filter(e => selected[e.id])
        .map(e => ({ ...e, cantidad: selected[e.id] }));

    const extrasTotal = selectedExtras.reduce((s, e) => s + e.precio * e.cantidad, 0);

    const handleConfirm = () => {
        onConfirm(selectedExtras);
    };

    if (availableExtras.length === 0) {
        onSkip();
        return null;
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.92, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.92, y: 30 }}
                        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                        className="relative bg-capriccio-dark rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-[0_0_60px_rgba(250,204,21,0.15)] border border-white/5 flex flex-col max-h-[85vh]"
                    >
                        {/* Header */}
                        <div className="p-6 pb-4 border-b border-white/5">
                            <button
                                onClick={onClose}
                                className="absolute top-5 right-5 p-2 hover:bg-white/10 text-gray-400 hover:text-white rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>
                            <div className="pr-10">
                                <p className="text-[10px] font-black text-capriccio-gold uppercase tracking-[0.3em] mb-1">
                                    ¡Hazla tuya!
                                </p>
                                <h2 className="text-2xl font-title font-black italic uppercase text-white leading-tight">
                                    ¿Algo extra para tu<br />
                                    <span className="text-capriccio-gold">{pizzaNombre}</span>?
                                </h2>
                                <p className="text-gray-500 text-xs font-bold mt-1">
                                    Tamaño {sizeLabel} — precio por extra: <span className="text-gray-300">${EXTRA_PRICE_BY_SIZE[sizeId] ?? 10}</span>
                                </p>
                            </div>
                        </div>

                        {/* Lista de extras */}
                        <div className="overflow-y-auto flex-1 p-6 pt-4 space-y-3 scrollbar-hide">
                            {availableExtras.map(extra => {
                                const qty = selected[extra.id] ?? 0;
                                const isSelected = qty > 0;
                                return (
                                    <motion.div
                                        key={extra.id}
                                        whileTap={{ scale: 0.98 }}
                                        className={cn(
                                            "flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-200",
                                            isSelected
                                                ? "border-capriccio-gold bg-capriccio-gold/10"
                                                : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8"
                                        )}
                                    >
                                        <div
                                            className="flex items-center gap-3 flex-1 cursor-pointer"
                                            onClick={() => toggle(extra)}
                                        >
                                            <div className={cn(
                                                "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0",
                                                isSelected ? "bg-capriccio-gold border-capriccio-gold" : "border-gray-600 bg-black/20"
                                            )}>
                                                {isSelected && <Check className="w-4 h-4 text-capriccio-dark stroke-[3px]" />}
                                            </div>
                                            <div>
                                                <p className={cn(
                                                    "font-bold text-sm transition-colors",
                                                    isSelected ? "text-white" : "text-gray-300"
                                                )}>{extra.nombre}</p>
                                                <p className={cn(
                                                    "text-xs font-black",
                                                    isSelected ? "text-capriccio-gold" : "text-gray-500"
                                                )}>+${extra.precio} c/u</p>
                                            </div>
                                        </div>

                                        {/* Contador de cantidad */}
                                        {isSelected && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="flex items-center gap-2 ml-3"
                                            >
                                                <button
                                                    onClick={() => setCantidad(extra, -1)}
                                                    className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                                                >
                                                    <Minus size={14} />
                                                </button>
                                                <span className="text-white font-black text-sm w-4 text-center">{qty}</span>
                                                <button
                                                    onClick={() => setCantidad(extra, 1)}
                                                    className="w-7 h-7 rounded-full bg-capriccio-gold/20 hover:bg-capriccio-gold/30 flex items-center justify-center text-capriccio-gold transition-colors"
                                                >
                                                    <Plus size={14} />
                                                </button>
                                            </motion.div>
                                        )}

                                        {!isSelected && (
                                            <span className="text-gray-600 text-xs font-bold ml-3 shrink-0">
                                                +${extra.precio}
                                            </span>
                                        )}
                                    </motion.div>
                                );
                            })}
                        </div>

                        {/* Footer */}
                        <div className="p-6 pt-4 border-t border-white/5 space-y-3">
                            {extrasTotal > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex justify-between items-center text-sm px-1"
                                >
                                    <span className="text-gray-400 font-bold">
                                        {selectedExtras.length} extra{selectedExtras.length !== 1 ? 's' : ''} seleccionado{selectedExtras.length !== 1 ? 's' : ''}
                                    </span>
                                    <span className="text-capriccio-gold font-black text-lg">+${extrasTotal}</span>
                                </motion.div>
                            )}

                            <button
                                onClick={handleConfirm}
                                className="w-full bg-capriccio-gold hover:bg-yellow-400 text-capriccio-dark py-4 rounded-2xl font-black text-base uppercase tracking-widest shadow-[var(--shadow-neon-yellow)] active:scale-95 transition-all"
                            >
                                {selectedExtras.length > 0
                                    ? `Agregar al Pedido (+$${extrasTotal})`
                                    : 'Agregar al Pedido'
                                }
                            </button>
                            <button
                                onClick={onSkip}
                                className="w-full py-3 text-gray-500 hover:text-gray-300 font-bold text-sm transition-colors"
                            >
                                No gracias, solo mi pizza
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default ExtrasModal;
