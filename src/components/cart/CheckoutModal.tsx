'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Phone, User, MessageSquare, ArrowRight, LocateFixed, Loader2, Edit2, Package, Bike, Store, Banknote, Smartphone, ChevronLeft, Copy, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CartItem } from '@/data/cart';

const TRANSFER_PHONE = '8462617472';

interface UserData {
    nombre: string;
    telefono: string;
    direccion: string;
    referencias: string;
    lat?: number;
    lng?: number;
    metodo_entrega?: 'domicilio' | 'sucursal' | 'para_llevar';
    payment_method?: 'transferencia' | 'efectivo';
    monto_pago?: number;
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

type Step = 'info' | 'payment';

const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, onEditCart, onConfirm, total, cart = [], menu = [], onAddComplemento }) => {
    const [step, setStep] = useState<Step>('info');
    const [userData, setUserData] = useState<UserData>({
        nombre: '',
        telefono: '',
        direccion: '',
        referencias: ''
    });
    const [pendingData, setPendingData] = useState<UserData | null>(null);
    const [isSaved, setIsSaved] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [privacidadAceptada, setPrivacidadAceptada] = useState(false);
    const [clienteLogueado, setClienteLogueado] = useState(false);
    const [metodoEntrega, setMetodoEntrega] = useState<'domicilio' | 'para_llevar'>('domicilio');
    // Dirección estructurada
    const [addressMode, setAddressMode] = useState<'manual' | 'gps'>('manual');
    const [calleNumero, setCalleNumero] = useState('');
    const [colonia, setColonia] = useState('');
    const [entreCalles, setEntreCalles] = useState('');
    const [referencia, setReferencia] = useState('');

    // Payment step state
    const [paymentMethod, setPaymentMethod] = useState<'transferencia' | 'efectivo' | null>(null);
    const [montoEfectivo, setMontoEfectivo] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        setClienteLogueado(!!localStorage.getItem('capriccio_cliente_telefono'));
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) {
            // Reset al cerrar
            setStep('info');
            setPaymentMethod(null);
            setMontoEfectivo('');
            return;
        }
        const savedData = localStorage.getItem('pizza_user_data');
        if (savedData) {
            setUserData(JSON.parse(savedData));
            setIsSaved(true);
        } else {
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
                setUserData(prev => ({
                    ...prev,
                    direccion: data.display_name,
                    lat: latitude,
                    lng: longitude
                }));
            } catch {
                alert("No pudimos traducir las coordenadas a una dirección.");
            } finally {
                setIsLocating(false);
            }
        }, () => {
            setIsLocating(false);
            alert("No pudimos obtener tu ubicación exacta.");
        }, { enableHighAccuracy: true });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        let direccionFinal = userData.direccion;
        if (metodoEntrega === 'para_llevar') {
            direccionFinal = 'Recoger en sucursal';
        } else if (addressMode === 'manual') {
            const parts = [calleNumero, colonia && `Col. ${colonia}`, entreCalles && `Entre: ${entreCalles}`].filter(Boolean);
            direccionFinal = parts.join(', ');
        }
        const dataToSave = {
            ...userData,
            metodo_entrega: metodoEntrega,
            direccion: direccionFinal,
            referencias: referencia || userData.referencias,
        };
        localStorage.setItem('pizza_user_data', JSON.stringify(userData));
        setPendingData(dataToSave);
        setStep('payment');
        setPaymentMethod(null);
        setMontoEfectivo('');
    };

    const handlePaymentConfirm = () => {
        if (!paymentMethod || !pendingData) return;
        const monto = paymentMethod === 'efectivo' ? parseFloat(montoEfectivo) || 0 : 0;
        onConfirm({
            ...pendingData,
            payment_method: paymentMethod,
            monto_pago: monto,
        });
    };

    const copyNumber = () => {
        navigator.clipboard.writeText(TRANSFER_PHONE).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const cambio = paymentMethod === 'efectivo'
        ? Math.max(0, (parseFloat(montoEfectivo) || 0) - total)
        : 0;

    const canConfirmPayment =
        paymentMethod === 'transferencia' ||
        (paymentMethod === 'efectivo' && parseFloat(montoEfectivo) >= total);

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

                            {/* ─── PASO 1: DATOS DEL PEDIDO ─── */}
                            <AnimatePresence mode="wait">
                            {step === 'info' && (
                                <motion.div
                                    key="info"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                >
                                    <div className="flex justify-between items-center mb-6">
                                        <div>
                                            <h2 className="text-3xl font-title font-black italic uppercase tracking-tighter text-white leading-none mb-2">Finalizar Pedido</h2>
                                            <p className="text-gray-400 font-bold italic text-sm">Verifica tu pedido y envía.</p>
                                        </div>
                                        <button onClick={onClose} className="p-2 hover:bg-white/10 text-gray-400 hover:text-white rounded-full transition-colors flex-shrink-0">
                                            <X size={24} />
                                        </button>
                                    </div>

                                    {/* Resumen del carrito */}
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
                                                                {(item as any).sauce && <p>• 🥣 Salsa: {(item as any).sauce}</p>}
                                                                {item.extras && item.extras.length > 0 && item.extras.map(e => (
                                                                    <p key={e.id}>• + {e.nombre}</p>
                                                                ))}
                                                                {(item as any).nota && <p className="text-yellow-500/80">• 📝 {(item as any).nota}</p>}
                                                            </div>
                                                        </div>
                                                        <span className="font-black text-white ml-4 flex-shrink-0">${item.totalItemPrice * item.quantity}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Upselling */}
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
                                                <input required type="text" placeholder="Nombre completo"
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
                                                    <input required type="tel" placeholder="10 dígitos"
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

                                        {/* Método de Entrega */}
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Método de Entrega</label>
                                            <div className="grid grid-cols-2 gap-3">
                                                <button type="button" onClick={() => setMetodoEntrega('domicilio')}
                                                    className={cn("flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                                                        metodoEntrega === 'domicilio' ? "border-capriccio-gold bg-capriccio-gold/10 text-capriccio-gold" : "border-white/10 bg-white/5 text-gray-400 hover:border-white/20")}>
                                                    <Bike size={24} strokeWidth={2.5} />
                                                    <span className="text-xs font-black uppercase tracking-widest">A Domicilio</span>
                                                    <span className="text-[9px] font-bold opacity-60">Te lo llevamos</span>
                                                </button>
                                                <button type="button" onClick={() => setMetodoEntrega('para_llevar')}
                                                    className={cn("flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                                                        metodoEntrega === 'para_llevar' ? "border-capriccio-gold bg-capriccio-gold/10 text-capriccio-gold" : "border-white/10 bg-white/5 text-gray-400 hover:border-white/20")}>
                                                    <Store size={24} strokeWidth={2.5} />
                                                    <span className="text-xs font-black uppercase tracking-widest">En Sucursal</span>
                                                    <span className="text-[9px] font-bold opacity-60">Paso por él</span>
                                                </button>
                                            </div>
                                        </div>

                                        {metodoEntrega === 'domicilio' && (
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Dirección de Entrega</label>
                                                {/* Toggle manual / GPS */}
                                                <div className="grid grid-cols-2 gap-2">
                                                    <button type="button" onClick={() => setAddressMode('manual')}
                                                        className={cn("flex items-center justify-center gap-2 py-3 rounded-2xl border-2 text-xs font-black uppercase tracking-widest transition-all",
                                                            addressMode === 'manual' ? "border-capriccio-gold bg-capriccio-gold/10 text-capriccio-gold" : "border-white/10 bg-white/5 text-gray-400 hover:border-white/20")}>
                                                        <MapPin size={14} /> Ingresar dirección
                                                    </button>
                                                    <button type="button" onClick={() => { setAddressMode('gps'); handleLocate(); }}
                                                        className={cn("flex items-center justify-center gap-2 py-3 rounded-2xl border-2 text-xs font-black uppercase tracking-widest transition-all",
                                                            addressMode === 'gps' ? "border-capriccio-gold bg-capriccio-gold/10 text-capriccio-gold" : "border-white/10 bg-white/5 text-gray-400 hover:border-white/20")}>
                                                        {isLocating ? <Loader2 size={14} className="animate-spin" /> : <LocateFixed size={14} />}
                                                        Obtener ubicación
                                                    </button>
                                                </div>

                                                {/* Modo manual: campos estructurados */}
                                                {addressMode === 'manual' && (
                                                    <>
                                                        <div className="relative">
                                                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                                                            <input required type="text" placeholder="Calle y número *"
                                                                className="w-full pl-11 pr-4 py-3.5 bg-capriccio-card border-none focus:ring-2 focus:ring-capriccio-gold rounded-2xl outline-none font-bold text-sm text-white placeholder-gray-600"
                                                                value={calleNumero} onChange={e => setCalleNumero(e.target.value)} />
                                                        </div>
                                                        <input type="text" placeholder="Colonia *" required
                                                            className="w-full px-4 py-3.5 bg-capriccio-card border-none focus:ring-2 focus:ring-capriccio-gold rounded-2xl outline-none font-bold text-sm text-white placeholder-gray-600"
                                                            value={colonia} onChange={e => setColonia(e.target.value)} />
                                                        <input type="text" placeholder="Entre calles (opcional)"
                                                            className="w-full px-4 py-3.5 bg-capriccio-card border-none focus:ring-2 focus:ring-capriccio-gold rounded-2xl outline-none font-bold text-sm text-white placeholder-gray-600"
                                                            value={entreCalles} onChange={e => setEntreCalles(e.target.value)} />
                                                    </>
                                                )}

                                                {/* Modo GPS: dirección obtenida + editable */}
                                                {addressMode === 'gps' && (
                                                    <div className="relative">
                                                        <LocateFixed className="absolute left-4 top-4 text-capriccio-gold" size={16} />
                                                        <textarea rows={2} placeholder={isLocating ? "Obteniendo ubicación..." : "Dirección detectada..."}
                                                            className="w-full pl-11 pr-4 py-3.5 bg-capriccio-card border-none focus:ring-2 focus:ring-capriccio-gold rounded-2xl outline-none font-bold text-sm text-white placeholder-gray-600 resize-none"
                                                            value={userData.direccion}
                                                            onChange={e => setUserData({ ...userData, direccion: e.target.value })} />
                                                    </div>
                                                )}

                                                {/* Referencia (siempre visible) */}
                                                <div className="relative">
                                                    <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                                                    <input type="text" placeholder="Referencia: portón verde, entre calles..."
                                                        className="w-full pl-11 pr-4 py-3.5 bg-capriccio-card border-none focus:ring-2 focus:ring-capriccio-gold rounded-2xl outline-none font-bold text-sm text-white placeholder-gray-600"
                                                        value={referencia} onChange={e => setReferencia(e.target.value)} />
                                                </div>
                                            </div>
                                        )}

                                        {metodoEntrega === 'para_llevar' && (
                                            <div className="bg-capriccio-gold/10 border border-capriccio-gold/20 rounded-2xl p-4 text-center">
                                                <Store size={28} className="mx-auto text-capriccio-gold mb-2" />
                                                <p className="text-white font-black italic text-sm uppercase">Recoge en sucursal</p>
                                                <p className="text-gray-400 text-xs font-bold mt-1">Te notificaremos cuando esté listo.</p>
                                            </div>
                                        )}

                                        {isSaved && (
                                            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                                className="text-[10px] text-green-500 font-black uppercase tracking-widest text-center">
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

                                        {/* Privacidad */}
                                        <label className="flex items-start gap-3 cursor-pointer group mt-6">
                                            <div className="relative mt-0.5 shrink-0">
                                                <input type="checkbox" checked={privacidadAceptada}
                                                    onChange={e => setPrivacidadAceptada(e.target.checked)}
                                                    className="sr-only" required />
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
                                                <a href="/privacidad" target="_blank" className="text-capriccio-gold hover:underline font-bold">Aviso de Privacidad</a>
                                                {' '}y autorizo el uso de mis datos para procesar y entregar mi pedido.
                                            </p>
                                        </label>

                                        <button type="submit" disabled={!privacidadAceptada}
                                            className="w-full bg-capriccio-gold hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed text-capriccio-dark py-6 rounded-[2rem] font-black text-xl italic uppercase tracking-widest shadow-[var(--shadow-neon-yellow)] active:scale-95 transition-all flex items-center justify-center gap-4 mt-4 group">
                                            Siguiente: Método de Pago
                                            <ArrowRight className="group-hover:translate-x-2 transition-transform" strokeWidth={3} />
                                        </button>
                                    </form>
                                </motion.div>
                            )}

                            {/* ─── PASO 2: MÉTODO DE PAGO ─── */}
                            {step === 'payment' && (
                                <motion.div
                                    key="payment"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="space-y-6"
                                >
                                    <div className="flex items-center gap-3 mb-6">
                                        <button onClick={() => setStep('info')}
                                            className="p-2 hover:bg-white/10 text-gray-400 hover:text-white rounded-full transition-colors">
                                            <ChevronLeft size={22} />
                                        </button>
                                        <div>
                                            <h2 className="text-3xl font-title font-black italic uppercase tracking-tighter text-white leading-none">¿Cómo vas a pagar?</h2>
                                            <p className="text-capriccio-gold font-black text-sm mt-1">Total: <span className="text-xl">${total}</span></p>
                                        </div>
                                    </div>

                                    {/* Opciones de pago */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            onClick={() => { setPaymentMethod('transferencia'); setMontoEfectivo(''); }}
                                            className={cn(
                                                "flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all",
                                                paymentMethod === 'transferencia'
                                                    ? "border-capriccio-gold bg-capriccio-gold/10 text-capriccio-gold"
                                                    : "border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:bg-white/10"
                                            )}
                                        >
                                            <Smartphone size={32} strokeWidth={2} />
                                            <div className="text-center">
                                                <p className="font-black text-sm uppercase tracking-wide">Transferencia</p>
                                                <p className="text-[10px] font-bold opacity-60 mt-0.5">Pago en línea</p>
                                            </div>
                                        </button>
                                        <button
                                            onClick={() => setPaymentMethod('efectivo')}
                                            className={cn(
                                                "flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all",
                                                paymentMethod === 'efectivo'
                                                    ? "border-capriccio-gold bg-capriccio-gold/10 text-capriccio-gold"
                                                    : "border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:bg-white/10"
                                            )}
                                        >
                                            <Banknote size={32} strokeWidth={2} />
                                            <div className="text-center">
                                                <p className="font-black text-sm uppercase tracking-wide">Efectivo</p>
                                                <p className="text-[10px] font-bold opacity-60 mt-0.5">Al recibir</p>
                                            </div>
                                        </button>
                                    </div>

                                    {/* Detalle según método */}
                                    <AnimatePresence mode="wait">
                                        {paymentMethod === 'transferencia' && (
                                            <motion.div
                                                key="transfer"
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 10 }}
                                                className="bg-black/40 border border-capriccio-gold/30 rounded-2xl p-6 space-y-4"
                                            >
                                                <p className="text-gray-300 text-sm font-bold text-center">
                                                    Envía tu comprobante de pago al siguiente número de WhatsApp:
                                                </p>
                                                <div className="flex items-center justify-between bg-capriccio-gold/10 rounded-xl px-5 py-4 border border-capriccio-gold/20">
                                                    <span className="text-capriccio-gold font-black text-2xl tracking-widest">{TRANSFER_PHONE}</span>
                                                    <button onClick={copyNumber}
                                                        className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white">
                                                        {copied ? <CheckCheck size={20} className="text-green-400" /> : <Copy size={20} />}
                                                    </button>
                                                </div>
                                                <p className="text-gray-500 text-[11px] text-center leading-relaxed">
                                                    📸 Una vez que recibamos tu comprobante, confirmaremos tu pedido y comenzaremos a prepararlo.
                                                </p>
                                            </motion.div>
                                        )}

                                        {paymentMethod === 'efectivo' && (
                                            <motion.div
                                                key="cash"
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 10 }}
                                                className="bg-black/40 border border-white/10 rounded-2xl p-6 space-y-4"
                                            >
                                                <p className="text-gray-300 text-sm font-bold text-center">
                                                    ¿Con cuánto vas a pagar? (para llevar el cambio exacto)
                                                </p>
                                                <div className="relative">
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-capriccio-gold font-black text-xl">$</span>
                                                    <input
                                                        type="number"
                                                        min={total}
                                                        step="10"
                                                        placeholder={String(total)}
                                                        value={montoEfectivo}
                                                        onChange={e => setMontoEfectivo(e.target.value)}
                                                        className="w-full pl-10 pr-4 py-4 bg-capriccio-card text-white font-black text-2xl rounded-2xl outline-none focus:ring-2 focus:ring-capriccio-gold border-none placeholder-gray-600"
                                                    />
                                                </div>

                                                {montoEfectivo && parseFloat(montoEfectivo) >= total && (
                                                    <motion.div
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        className="flex justify-between items-center bg-green-500/10 border border-green-500/20 rounded-xl px-5 py-3"
                                                    >
                                                        <span className="text-green-400 font-bold text-sm">Tu cambio será:</span>
                                                        <span className="text-green-400 font-black text-xl">${cambio}</span>
                                                    </motion.div>
                                                )}

                                                {montoEfectivo && parseFloat(montoEfectivo) < total && (
                                                    <p className="text-red-400 text-xs font-bold text-center">
                                                        ⚠️ El monto debe ser igual o mayor al total (${total})
                                                    </p>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <button
                                        onClick={handlePaymentConfirm}
                                        disabled={!canConfirmPayment}
                                        className="w-full bg-capriccio-gold hover:bg-yellow-400 disabled:opacity-30 disabled:cursor-not-allowed text-capriccio-dark py-6 rounded-[2rem] font-black text-xl italic uppercase tracking-widest shadow-[var(--shadow-neon-yellow)] active:scale-95 transition-all flex items-center justify-center gap-4 group"
                                    >
                                        ¡CONFIRMAR PEDIDO!
                                        <ArrowRight className="group-hover:translate-x-2 transition-transform" strokeWidth={3} />
                                    </button>
                                </motion.div>
                            )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default CheckoutModal;
