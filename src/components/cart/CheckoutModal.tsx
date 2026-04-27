'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Phone, User, MessageSquare, ArrowRight, LocateFixed, Loader2, Edit2, Package, Bike, Store } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CartItem } from '@/data/cart';

interface UserData {
    nombre: string;
    telefono: string;
    direccion: string;
    referencias: string;
    lat?: number;
    lng?: number;
    metodo_entrega?: 'domicilio' | 'sucursal' | 'para_llevar';
}

interface CheckoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    onEditCart?: () => void;
    onConfirm: (userData: UserData) => void;
    total: number;
    cart?: CartItem[];
    menu?: any[];
    onAddComplemento?: (item: any) => void;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, onEditCart, onConfirm, total, cart = [], menu = [], onAddComplemento }) => {
    const [userData, setUserData] = useState<UserData>({
        nombre: '',
        telefono: '',
        direccion: '',
        referencias: ''
    });
    const [isSaved, setIsSaved] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [privacidadAceptada, setPrivacidadAceptada] = useState(false);
    const [clienteLogueado, setClienteLogueado] = useState(false);
    const [metodoEntrega, setMetodoEntrega] = useState<'domicilio' | 'para_llevar'>('domicilio');

    useEffect(() => {
        setClienteLogueado(!!localStorage.getItem('capriccio_cliente_telefono'));
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const savedData = localStorage.getItem('pizza_user_data');
        if (savedData) {
            setUserData(JSON.parse(savedData));
            setIsSaved(true);
        } else {
            // Pre-llenar con datos del cliente logueado si no hay datos guardados
            const clienteNombre = localStorage.getItem('capriccio_cliente_nombre');
            const clienteTelefono = localStorage.getItem('capriccio_cliente_telefono');
            if (clienteNombre || clienteTelefono) {
                setUserData(prev => ({
                    ...prev,
                    nombre: clienteNombre || prev.nombre,
                    telefono: clienteTelefono || prev.telefono,
                }));
            }
        }
    }, [isOpen]);

    const handleLocate = () => {
        if (!navigator.geolocation) {
            alert("Tu navegador no soporta geolocalización.");
            return;
        }

        setIsLocating(true);

        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;

            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
                );
                const data = await response.json();

                // Extraer dirección simplificada
                const address = data.display_name;
                setUserData(prev => ({
                    ...prev,
                    direccion: address,
                    lat: latitude,
                    lng: longitude
                }));
            } catch (error) {
                console.error("Error geocoding:", error);
                alert("No pudimos traducir las coordenadas a una dirección.");
            } finally {
                setIsLocating(false);
            }
        }, (error) => {
            setIsLocating(false);
            alert("No pudimos obtener tu ubicación exacta.");
        }, { enableHighAccuracy: true });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const dataToSend = {
            ...userData,
            metodo_entrega: metodoEntrega,
            // Si para_llevar, limpiar dirección
            direccion: metodoEntrega === 'para_llevar' ? 'Recoger en sucursal' : userData.direccion,
        };
        localStorage.setItem('pizza_user_data', JSON.stringify(userData));
        onConfirm(dataToSend);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100]"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="fixed inset-x-4 bottom-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 w-full max-w-lg bg-capriccio-dark rounded-[3rem] shadow-[0_0_50px_rgba(234,179,8,0.1)] z-[110] overflow-hidden border border-white/5"
                    >
                        <div className="p-8 pb-4 max-h-[90vh] overflow-y-auto scrollbar-hide">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h2 className="text-3xl font-title font-black italic uppercase tracking-tighter text-white leading-none mb-2">Finalizar Pedido</h2>
                                    <p className="text-gray-400 font-bold italic text-sm">Verifica tu pedido y envía.</p>
                                </div>
                                <button onClick={onClose} className="p-2 hover:bg-white/10 text-gray-400 hover:text-white rounded-full transition-colors flex-shrink-0">
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Order Summary Section */}
                            {cart && cart.length > 0 && (
                                <div className="bg-black/50 rounded-2xl p-5 mb-8 border border-white/5">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-[10px] font-black text-capriccio-gold uppercase tracking-[0.2em]">Resumen de tu Pedido</h3>
                                        <button
                                            onClick={() => { onClose(); onEditCart?.(); }}
                                            className="text-[10px] text-gray-400 hover:text-white uppercase font-bold tracking-widest flex items-center gap-1 transition-colors"
                                        >
                                            <Edit2 size={10} /> Editar Carrito
                                        </button>
                                    </div>
                                    <div className="space-y-4 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                        {cart.map(item => (
                                            <div key={item.cartId} className="flex justify-between items-start text-sm">
                                                <div className="flex-1">
                                                    <p className="font-bold text-white leading-tight">
                                                        <span className="text-capriccio-gold mr-2">{item.quantity}x</span> 
                                                        {item.nombre}
                                                    </p>
                                                    <div className="text-gray-400 text-xs ml-6 mt-1 space-y-0.5">
                                                        {item.size && <p>• Tamaño {item.size}</p>}
                                                        {item.crust && <p>• {item.crust}</p>}
                                                        {item.extras && item.extras.length > 0 && item.extras.map(e => (
                                                            <p key={e.id}>• + {e.nombre}</p>
                                                        ))}
                                                    </div>
                                                </div>
                                                <span className="font-black text-white ml-4 flex-shrink-0">${item.totalItemPrice * item.quantity}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Upselling Section */}
                            {menu && onAddComplemento && (
                                <div className="mb-8">
                                    <h3 className="text-sm font-black text-white italic mb-3">¿Se te antojó algo más?</h3>
                                    <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide snap-x">
                                        {menu
                                            .filter(item => ["Burritos rellenos", "Papas", "Boneless"].includes(item.nombre))
                                            .map(item => (
                                                <div 
                                                    key={item.id} 
                                                    className="min-w-[140px] bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col items-center text-center cursor-pointer hover:bg-white/10 hover:border-capriccio-gold/40 transition-all snap-start group"
                                                    onClick={() => onAddComplemento(item)}
                                                >
                                                    <div className="w-12 h-12 rounded-full overflow-hidden mb-2 border-2 border-transparent group-hover:border-capriccio-gold/50 transition-colors">
                                                        <img src={item.imagen} alt={item.nombre} className="w-full h-full object-cover" />
                                                    </div>
                                                    <h4 className="text-white font-bold text-xs leading-tight mb-1">{item.nombre}</h4>
                                                    <span className="text-capriccio-gold font-black text-sm">${item.precio}</span>
                                                    <div className="mt-2 text-[10px] bg-black/40 text-gray-300 font-bold px-2 py-1 rounded-full group-hover:bg-capriccio-gold group-hover:text-black transition-colors">
                                                        + Agregar
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">¿Quién recibe?</label>
                                    <div className="relative">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                        <input
                                            required
                                            type="text"
                                            placeholder="Nombre completo"
                                            className="w-full pl-12 pr-4 py-4 bg-capriccio-card border-none focus:ring-2 focus:ring-capriccio-gold rounded-2xl outline-none font-bold transition-all text-white placeholder-gray-600"
                                            value={userData.nombre}
                                            onChange={(e) => setUserData({ ...userData, nombre: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Teléfono de contacto</label>
                                        <div className="relative">
                                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                            <input
                                                required
                                                type="tel"
                                                placeholder="10 dígitos"
                                                className="w-full pl-12 pr-4 py-4 bg-capriccio-card border-none focus:ring-2 focus:ring-capriccio-gold rounded-2xl outline-none font-bold transition-all text-white placeholder-gray-600"
                                                value={userData.telefono}
                                                onChange={(e) => setUserData({ ...userData, telefono: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Total</label>
                                        <div className="w-full px-6 py-4 bg-black text-capriccio-gold rounded-2xl font-black text-xl italic flex items-center justify-between shadow-inner">
                                            <span>$</span>
                                            <span>{total}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Selector de Método de Entrega */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Metodo de Entrega</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setMetodoEntrega('domicilio')}
                                            className={cn(
                                                "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                                                metodoEntrega === 'domicilio'
                                                    ? "border-capriccio-gold bg-capriccio-gold/10 text-capriccio-gold"
                                                    : "border-white/10 bg-white/5 text-gray-400 hover:border-white/20"
                                            )}
                                        >
                                            <Bike size={24} strokeWidth={2.5} />
                                            <span className="text-xs font-black uppercase tracking-widest">A Domicilio</span>
                                            <span className="text-[9px] font-bold opacity-60">Te lo llevamos</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setMetodoEntrega('para_llevar')}
                                            className={cn(
                                                "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                                                metodoEntrega === 'para_llevar'
                                                    ? "border-capriccio-gold bg-capriccio-gold/10 text-capriccio-gold"
                                                    : "border-white/10 bg-white/5 text-gray-400 hover:border-white/20"
                                            )}
                                        >
                                            <Store size={24} strokeWidth={2.5} />
                                            <span className="text-xs font-black uppercase tracking-widest">En Sucursal</span>
                                            <span className="text-[9px] font-bold opacity-60">Paso por el</span>
                                        </button>
                                    </div>
                                </div>

                                {metodoEntrega === 'domicilio' && (
                                <>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Direccion de Entrega</label>
                                    <div className="relative group">
                                        <MapPin className="absolute left-4 top-4 text-gray-500 group-focus-within:text-capriccio-gold transition-colors" size={18} />
                                        <textarea
                                            required
                                            placeholder="Calle, numero, colonia..."
                                            rows={2}
                                            className="w-full pl-12 pr-14 py-4 bg-capriccio-card border-none focus:ring-2 focus:ring-capriccio-gold rounded-2xl outline-none font-bold transition-all text-white placeholder-gray-600 resize-none"
                                            value={userData.direccion}
                                            onChange={(e) => setUserData({ ...userData, direccion: e.target.value })}
                                        />
                                        <button
                                            type="button"
                                            onClick={handleLocate}
                                            disabled={isLocating}
                                            className="absolute right-3 top-3 p-3 bg-black hover:bg-black/70 text-white rounded-xl shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                                            title="Usar mi ubicacion actual"
                                        >
                                            {isLocating ? (
                                                <Loader2 size={18} className="animate-spin text-capriccio-gold" />
                                            ) : (
                                                <LocateFixed size={18} className="text-capriccio-gold" />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Referencias (Opcional)</label>
                                    <div className="relative">
                                        <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                        <input
                                            type="text"
                                            placeholder="Ej: Porton verde, timbre descompuesto"
                                            className="w-full pl-12 pr-4 py-4 bg-capriccio-card border-none focus:ring-2 focus:ring-capriccio-gold rounded-2xl outline-none font-bold transition-all text-white placeholder-gray-600"
                                            value={userData.referencias}
                                            onChange={(e) => setUserData({ ...userData, referencias: e.target.value })}
                                        />
                                    </div>
                                </div>
                                </>
                                )}

                                {metodoEntrega === 'para_llevar' && (
                                    <div className="bg-capriccio-gold/10 border border-capriccio-gold/20 rounded-2xl p-4 text-center">
                                        <Store size={28} className="mx-auto text-capriccio-gold mb-2" />
                                        <p className="text-white font-black italic text-sm uppercase">Recoge en sucursal</p>
                                        <p className="text-gray-400 text-xs font-bold mt-1">Tu pedido estara listo para que pases por el. Te notificaremos cuando este preparado.</p>
                                    </div>
                                )}

                                {isSaved && (
                                    <motion.p
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="text-[10px] text-green-500 font-black uppercase tracking-widest text-center"
                                    >
                                        ✓ Datos recordados de tu última pizza
                                    </motion.p>
                                )}

                                {clienteLogueado && (
                                    <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-2xl px-4 py-3">
                                        <Package size={14} className="text-green-400 shrink-0" />
                                        <p className="text-green-400 text-[10px] font-black uppercase tracking-wider">
                                            Este pedido quedará vinculado a tu cuenta — rastréalo en <span className="underline">Mis Pedidos</span>
                                        </p>
                                    </div>
                                )}

                                {/* Consentimiento de privacidad */}
                                <label className="flex items-start gap-3 cursor-pointer group mt-6">
                                    <div className="relative mt-0.5 shrink-0">
                                        <input
                                            type="checkbox"
                                            checked={privacidadAceptada}
                                            onChange={e => setPrivacidadAceptada(e.target.checked)}
                                            className="sr-only"
                                            required
                                        />
                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${privacidadAceptada ? 'bg-capriccio-gold border-capriccio-gold' : 'border-white/30 bg-white/5 group-hover:border-capriccio-gold/50'}`}>
                                            {privacidadAceptada && (
                                                <svg className="w-3 h-3 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        He leído y acepto el{' '}
                                        <a href="/privacidad" target="_blank" className="text-capriccio-gold hover:underline font-bold">
                                            Aviso de Privacidad
                                        </a>
                                        {' '}y autorizo el uso de mis datos (nombre, teléfono y dirección) para procesar y entregar mi pedido.
                                    </p>
                                </label>

                                <button
                                    type="submit"
                                    disabled={!privacidadAceptada}
                                    className="w-full bg-capriccio-gold hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed text-capriccio-dark py-6 rounded-[2rem] font-black text-xl italic uppercase tracking-widest shadow-[var(--shadow-neon-yellow)] active:scale-95 transition-all flex items-center justify-center gap-4 mt-4 group"
                                >
                                    ¡PEDIR AHORA!
                                    <ArrowRight className="group-hover:translate-x-2 transition-transform" strokeWidth={3} />
                                </button>
                            </form>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default CheckoutModal;
