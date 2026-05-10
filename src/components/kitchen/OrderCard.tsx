'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Clock, ChefHat, Store } from 'lucide-react';
import { useTimer } from '@/hooks/useTimer';
import { CartItem } from '@/data/cart';
import { cn } from '@/lib/utils';

interface OrderCardProps {
    order: {
        id: string;
        items: CartItem[];
        createdAt: string;
        timestamp: string;
        status?: string;
        total?: number;
        telefono_cliente?: string;
        nombre_cliente?: string;
        metodo_entrega?: string;
        direccion?: string;
        notas?: string;
    };
    onComplete: (id: string) => void;
    onCompleteInStore: (id: string) => void;
    onStartPreparation: (id: string) => void;
}

const OrderCard: React.FC<OrderCardProps> = ({ order, onComplete, onCompleteInStore, onStartPreparation }) => {
    const { days, hours, minutes, seconds, totalSeconds } = useTimer(order.createdAt);

    // Dynamic styles based on time
    let statusColor = "bg-slate-900 border-slate-800";
    let timerColor = "text-yellow-400";
    let accentColor = "text-white";
    let isCritical = false;

    if (totalSeconds > 600 && totalSeconds <= 900) {
        statusColor = "bg-yellow-400 border-yellow-500";
        timerColor = "text-black";
        accentColor = "text-black";
    } else if (totalSeconds > 900) {
        statusColor = "bg-red-600 border-red-700 animate-pulse";
        timerColor = "text-white";
        accentColor = "text-white";
        isCritical = true;
    }

    const formatTime = () => {
        if (days > 0) return `${days}d ${hours}h ${minutes}m`;
        if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
        return `${minutes}:${seconds < 10 ? `0${seconds}` : seconds}`;
    };

    const isDelivery = order.metodo_entrega === 'domicilio' || order.metodo_entrega === 'delivery';

    return (
        <motion.div
            layout
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.1, opacity: 0 }}
            className="bg-white rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col border-2 border-slate-100 relative"
        >
            <div className={cn("p-6 flex justify-between items-center transition-colors duration-500", statusColor)}>
                <div>
                    <span className={cn("text-[10px] uppercase font-black tracking-[0.2em] opacity-60", accentColor)}>Pedido</span>
                    <p className={cn("text-2xl font-black italic uppercase leading-none", accentColor)}>
                        #{order.id ? (order.id.split('-')[1] || order.id.slice(-4)) : '???'}
                    </p>
                </div>
                <div className="flex flex-col items-end">
                    <div className={cn("flex items-center gap-2", timerColor)}>
                        <Clock className={cn("w-5 h-5", isCritical && "animate-spin-slow")} />
                        <span className={cn("font-black tabular-nums italic leading-none",
                            totalSeconds > 3600 ? "text-xl" : "text-3xl"
                        )}>
                            {formatTime()}
                        </span>
                    </div>
                </div>
            </div>

            <div className="p-8 space-y-6">
                {order.items.map((item, idx) => (
                    <div key={idx} className="relative pl-6 border-l-4 border-slate-100 font-title">
                        <p className="text-2xl font-black italic text-slate-900 uppercase leading-none tracking-tighter mb-2">
                            {item.quantity}x {item.nombre}
                        </p>
                        
                        {(item as any).size && (
                            <p className="text-sm font-bold text-slate-500 uppercase italic mb-1">
                                • {(item as any).size}
                            </p>
                        )}
                        
                        {(item as any).crust && (
                            <p className="text-sm font-bold text-red-600 uppercase italic mb-2">
                                • {(item as any).crust}
                            </p>
                        )}

                        {item.extras && item.extras.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {item.extras.map((extra: any, eIdx: number) => (
                                    <span key={eIdx} className="text-[10px] font-black bg-red-50 text-red-600 px-2 py-1 rounded-lg uppercase italic flex items-center gap-1">
                                        <Check className="w-2 h-2 stroke-[4px]" />
                                        {extra.nombre}
                                    </span>
                                ))}
                            </div>
                        )}

                        {(item as any).sauce && (
                            <p className="text-sm font-bold text-blue-600 uppercase italic mt-1">
                                🥣 Salsa: {(item as any).sauce}
                            </p>
                        )}

                        {(item as any).nota && (
                            <div className="mt-2 bg-yellow-50 border border-yellow-300 rounded-xl px-3 py-2">
                                <p className="text-sm font-black text-yellow-800 uppercase tracking-wide">
                                    📝 {(item as any).nota}
                                </p>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="p-6 pt-0 space-y-2">
                {order.status !== 'preparing' ? (
                    <button
                        onClick={() => onStartPreparation(order.id)}
                        className="w-full bg-amber-500 hover:bg-amber-400 text-white py-5 rounded-[1.5rem] font-black text-xl italic uppercase tracking-widest transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3"
                    >
                        <ChefHat className="w-7 h-7" />
                        En Preparación
                    </button>
                ) : (
                    <>
                        <button
                            onClick={() => onComplete(order.id)}
                            className="w-full bg-green-600 hover:bg-green-500 text-white py-5 rounded-[1.5rem] font-black text-xl italic uppercase tracking-widest transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3"
                        >
                            <Check className="w-7 h-7 stroke-[4px]" />
                            {isDelivery ? 'LISTO PARA ENTREGA' : 'LISTO'}
                        </button>
                        {!isDelivery && (
                            <button
                                onClick={() => onCompleteInStore(order.id)}
                                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-[1.5rem] font-black text-xs italic uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                            >
                                <Store className="w-4 h-4" />
                                Entregado en Sucursal
                            </button>
                        )}
                    </>
                )}
            </div>
        </motion.div>
    );
};

export default OrderCard;
