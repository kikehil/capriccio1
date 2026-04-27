'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, ArrowRight, X, Plus, Minus, ChevronDown } from 'lucide-react';
import { CartItem } from '@/data/cart';

interface FloatingCartProps {
    cart: CartItem[];
    onOrder?: (items: CartItem[]) => void;
    forceOpen?: boolean;
    onForceOpenHandled?: () => void;
    onUpdateQuantity?: (cartId: string, delta: number) => void;
    onRemoveItem?: (cartId: string) => void;
}

const FloatingCart: React.FC<FloatingCartProps> = ({
    cart,
    onOrder,
    forceOpen = false,
    onForceOpenHandled,
    onUpdateQuantity,
    onRemoveItem,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
    const totalPrice = cart.reduce((acc, item) => acc + (item.totalItemPrice * item.quantity), 0);

    // Abrir panel cuando CheckoutModal pide editar
    useEffect(() => {
        if (forceOpen) {
            setIsExpanded(true);
            onForceOpenHandled?.();
        }
    }, [forceOpen, onForceOpenHandled]);

    // Cerrar si carrito queda vacío
    useEffect(() => {
        if (totalItems === 0) setIsExpanded(false);
    }, [totalItems]);

    const handleOrder = () => {
        setIsExpanded(false);
        if (onOrder) onOrder(cart);
    };

    if (totalItems === 0) return null;

    return (
        <AnimatePresence>
            <motion.div
                key="floating-cart"
                initial={{ y: 100, opacity: 0, x: "-50%" }}
                animate={{ y: 0, opacity: 1, x: "-50%" }}
                exit={{ y: 100, opacity: 0, x: "-50%" }}
                className="fixed bottom-6 left-1/2 w-[92%] max-w-lg z-[90]"
            >
                <div className="bg-capriccio-dark text-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.4)] border border-white/10 backdrop-blur-xl overflow-hidden">

                    {/* Panel expandible de items */}
                    <AnimatePresence>
                        {isExpanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25 }}
                                className="overflow-hidden"
                            >
                                <div className="px-5 pt-4 pb-2 border-b border-white/10">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="text-[10px] font-black text-capriccio-gold uppercase tracking-[0.2em]">Tu Carrito</span>
                                        <button
                                            onClick={() => setIsExpanded(false)}
                                            className="text-gray-400 hover:text-white transition-colors"
                                        >
                                            <ChevronDown size={16} />
                                        </button>
                                    </div>
                                    <div className="space-y-3 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
                                        {cart.map(item => (
                                            <div key={item.cartId} className="flex items-center gap-3">
                                                {/* Info del item */}
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-white text-sm leading-tight truncate">{item.nombre}</p>
                                                    <p className="text-gray-400 text-xs">
                                                        {item.size && `${item.size}`}{item.crust && ` · ${item.crust}`}
                                                    </p>
                                                </div>

                                                {/* Controles cantidad */}
                                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                                    <button
                                                        onClick={() => onUpdateQuantity?.(item.cartId, -1)}
                                                        className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                                                    >
                                                        <Minus size={10} />
                                                    </button>
                                                    <span className="text-sm font-black w-5 text-center">{item.quantity}</span>
                                                    <button
                                                        onClick={() => onUpdateQuantity?.(item.cartId, 1)}
                                                        className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                                                    >
                                                        <Plus size={10} />
                                                    </button>
                                                </div>

                                                {/* Precio */}
                                                <span className="text-sm font-black text-white w-14 text-right flex-shrink-0">
                                                    ${item.totalItemPrice * item.quantity}
                                                </span>

                                                {/* Eliminar */}
                                                <button
                                                    onClick={() => onRemoveItem?.(item.cartId)}
                                                    className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Barra inferior siempre visible */}
                    <div className="p-3 pl-6 md:pl-8 flex items-center justify-between">
                        {/* Total + toggle expandir */}
                        <button
                            className="flex items-center gap-3 md:gap-6 text-left"
                            onClick={() => setIsExpanded(prev => !prev)}
                        >
                            <div className="relative flex-shrink-0">
                                <ShoppingBag className="w-6 h-6 md:w-8 md:h-8 text-capriccio-gold" />
                                <span className="absolute -top-1.5 -right-1.5 bg-capriccio-accent text-white text-[9px] md:text-[10px] font-black w-4 h-4 md:w-5 md:h-5 rounded-full flex items-center justify-center border-2 border-capriccio-dark">
                                    {totalItems}
                                </span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[8px] md:text-[10px] uppercase text-gray-400 font-bold tracking-[0.1em] md:tracking-[0.2em]">
                                    {isExpanded ? 'Cerrar' : 'Tu Pedido'}
                                </span>
                                <span className="text-xl md:text-2xl font-black text-white italic leading-none">
                                    ${totalPrice}
                                </span>
                            </div>
                        </button>

                        <button
                            onClick={handleOrder}
                            className="bg-capriccio-gold hover:bg-yellow-400 text-capriccio-dark px-3 md:px-8 py-3 md:py-4 rounded-[1.5rem] md:rounded-[2rem] font-black italic flex items-center gap-2 md:gap-3 transition-all hover:scale-[1.02] active:scale-95 shadow-[var(--shadow-neon-yellow)] group flex-shrink-0"
                        >
                            <span className="text-xs md:text-base tracking-tighter">CONFIRMAR <span className="hidden sm:inline">PEDIDO</span></span>
                            <ArrowRight className="w-4 h-4 md:w-5 md:h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default FloatingCart;
