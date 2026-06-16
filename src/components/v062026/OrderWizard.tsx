'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ChevronLeft, ArrowRight, User, Phone, MapPin, MessageSquare,
  LocateFixed, Loader2, Bike, Store, Banknote, Smartphone,
  Copy, CheckCheck, Package, LogIn, Star, Edit2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { API_URL } from '@/lib/socket';
import { CartItem } from '@/data/cart';
import { Pizza } from '@/data/menu';
import CustomerAuthModal from '@/components/customer/CustomerAuthModal';
import PizzaCard from '@/components/pizza/PizzaCard';
import ProductModal from '@/components/pizza/ProductModal';
import ExtrasModal, { ExtraItem } from '@/components/pizza/ExtrasModal';

// ─── Types ────────────────────────────────────────────────────────────────────

type WizardStep = 'datos' | 'entrega' | 'pedido' | 'pago';

interface CustomerData {
  nombre: string;
  telefono: string;
}

interface EntregaData {
  metodo: 'domicilio' | 'para_llevar';
  calleNumero: string;
  colonia: string;
  entreCalles: string;
  referencia: string;
  addressMode: 'manual' | 'gps';
  direccionGps: string;
  lat?: number;
  lng?: number;
}

interface OrderWizardProps {
  isOpen: boolean;
  onClose: () => void;
  menu: Pizza[];
  onOrderPlaced: (msg: string) => void;
  storeStatus: { opening_time: string; closing_time: string; orders_enabled: boolean } | null;
}

const TRANSFER_PHONE = '8462617472';

const CATEGORIES = ["🔥 Promos", "🍕 Pizzas", "🍔 Hamburguesas", "Snacks & Más", "🥤 Bebidas"];

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS: { id: WizardStep; label: string }[] = [
  { id: 'datos',   label: 'Datos' },
  { id: 'entrega', label: 'Entrega' },
  { id: 'pedido',  label: 'Pedido' },
  { id: 'pago',    label: 'Pago' },
];

function StepDots({ current }: { current: WizardStep }) {
  const idx = STEPS.findIndex(s => s.id === current);
  return (
    <div className="flex items-center gap-2 justify-center mb-6">
      {STEPS.map((s, i) => (
        <React.Fragment key={s.id}>
          <div className={cn(
            "flex items-center gap-1.5 transition-all",
            i <= idx ? "opacity-100" : "opacity-30"
          )}>
            <div className={cn(
              "w-2 h-2 rounded-full transition-all",
              i === idx ? "w-6 bg-capriccio-gold" : i < idx ? "bg-capriccio-gold/60" : "bg-white/20"
            )} />
            <span className={cn(
              "text-[10px] font-black uppercase tracking-widest hidden sm:block",
              i === idx ? "text-capriccio-gold" : "text-white/30"
            )}>{s.label}</span>
          </div>
          {i < STEPS.length - 1 && <div className="w-4 h-px bg-white/10" />}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OrderWizard({ isOpen, onClose, menu, onOrderPlaced, storeStatus }: OrderWizardProps) {
  const [step, setStep] = useState<WizardStep>('datos');

  // Session
  const [clienteLogueado, setClienteLogueado] = useState(false);
  const [clienteNombreSession, setClienteNombreSession] = useState('');
  const [showAuth, setShowAuth] = useState(false);

  // Step 1 — datos
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [privacidad, setPrivacidad] = useState(false);

  // Step 2 — entrega
  const [metodo, setMetodo] = useState<'domicilio' | 'para_llevar'>('domicilio');
  const [addressMode, setAddressMode] = useState<'manual' | 'gps'>('manual');
  const [calleNumero, setCalleNumero] = useState('');
  const [colonia, setColonia] = useState('');
  const [entreCalles, setEntreCalles] = useState('');
  const [referencia, setReferencia] = useState('');
  const [direccionGps, setDireccionGps] = useState('');
  const [gpsLat, setGpsLat] = useState<number | undefined>();
  const [gpsLng, setGpsLng] = useState<number | undefined>();
  const [isLocating, setIsLocating] = useState(false);

  // Step 3 — pedido
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[1]);
  const [selectedPizza, setSelectedPizza] = useState<Pizza | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<{
    pizza: Pizza; sizeInfo: any; crustInfo: any; finalPrice: number;
  } | null>(null);
  const [isExtrasModalOpen, setIsExtrasModalOpen] = useState(false);

  // Step 4 — pago
  const [paymentMethod, setPaymentMethod] = useState<'transferencia' | 'efectivo' | null>(null);
  const [montoEfectivo, setMontoEfectivo] = useState('');
  const [copied, setCopied] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);

  const total = cart.reduce((acc, item) => acc + item.totalItemPrice * item.quantity, 0);
  const cambio = paymentMethod === 'efectivo' ? Math.max(0, (parseFloat(montoEfectivo) || 0) - total) : 0;
  const canConfirmPayment =
    paymentMethod === 'transferencia' ||
    (paymentMethod === 'efectivo' && parseFloat(montoEfectivo) >= total);

  // Load session on open
  useEffect(() => {
    if (!isOpen) return;
    const token = localStorage.getItem('capriccio_cliente_token');
    const nom = localStorage.getItem('capriccio_cliente_nombre');
    const tel = localStorage.getItem('capriccio_cliente_telefono');
    if (token && nom && tel) {
      setClienteLogueado(true);
      setClienteNombreSession(nom);
      setNombre(nom);
      setTelefono(tel);
    }
    // Pre-fill from saved data
    const saved = localStorage.getItem('pizza_user_data');
    if (saved) {
      try {
        const d = JSON.parse(saved);
        if (!nombre) setNombre(d.nombre || '');
        if (!telefono) setTelefono(d.telefono || '');
      } catch {}
    }
  }, [isOpen]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setStep('datos');
      setCart([]);
      setPaymentMethod(null);
      setMontoEfectivo('');
      setIsOrdering(false);
    }
  }, [isOpen]);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const handleAuthSuccess = (data: { nombre: string; telefono: string; puntos: number; token: string }) => {
    localStorage.setItem('capriccio_cliente_token', data.token);
    localStorage.setItem('capriccio_cliente_nombre', data.nombre);
    localStorage.setItem('capriccio_cliente_telefono', data.telefono);
    localStorage.setItem('capriccio_cliente_puntos', String(data.puntos || 0));
    setClienteLogueado(true);
    setClienteNombreSession(data.nombre);
    setNombre(data.nombre);
    setTelefono(data.telefono);
    setShowAuth(false);
  };

  const handleLocate = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`
        );
        const data = await res.json();
        setDireccionGps(data.display_name || '');
        setGpsLat(pos.coords.latitude);
        setGpsLng(pos.coords.longitude);
      } catch {}
      setIsLocating(false);
    }, () => setIsLocating(false), { enableHighAccuracy: true });
  };

  const addToCart = (pizza: Pizza, sizeInfo: any, crustInfo: any, finalPrice: number) => {
    const ingredientes: string[] = Array.isArray(pizza.ingredientes) ? pizza.ingredientes : [];
    if (ingredientes.length > 0) {
      setPendingProduct({ pizza, sizeInfo, crustInfo, finalPrice });
      setIsProductModalOpen(false);
      setIsExtrasModalOpen(true);
      return;
    }
    finalizeAddToCart(pizza, sizeInfo, crustInfo, finalPrice, []);
  };

  const finalizeAddToCart = (pizza: Pizza, sizeInfo: any, crustInfo: any, finalPrice: number, extras: ExtraItem[]) => {
    const baseCartId = `${pizza.id}-${sizeInfo.id}-${crustInfo.id}`;
    const extrasTotal = extras.reduce((s, e) => s + e.precio * e.cantidad, 0);
    const totalWithExtras = finalPrice + extrasTotal;
    const expandedExtras = extras.flatMap(e =>
      Array.from({ length: e.cantidad }, () => ({ id: e.id, nombre: e.nombre, precio: e.precio }))
    );
    const cartId = expandedExtras.length > 0 ? `${baseCartId}-${Date.now()}` : baseCartId;
    const existing = expandedExtras.length === 0 ? cart.find(i => i.cartId === cartId) : null;
    if (existing) {
      setCart(prev => prev.map(i => i.cartId === cartId ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setCart(prev => [...prev, {
        ...pizza,
        size: sizeInfo.label,
        crust: crustInfo.label !== 'Sin Orilla Rellena' ? crustInfo.label : undefined,
        extras: expandedExtras,
        totalItemPrice: totalWithExtras,
        quantity: 1,
        cartId,
        nota: sizeInfo.nota || undefined,
        sauce: sizeInfo.sauce || undefined,
      }]);
    }
    setIsProductModalOpen(false);
    setIsExtrasModalOpen(false);
    setPendingProduct(null);
  };

  const updateQty = (cartId: string, delta: number) => {
    setCart(prev => {
      const item = prev.find(i => i.cartId === cartId);
      if (!item) return prev;
      if (item.quantity + delta <= 0) return prev.filter(i => i.cartId !== cartId);
      return prev.map(i => i.cartId === cartId ? { ...i, quantity: i.quantity + delta } : i);
    });
  };

  const removeItem = (cartId: string) => setCart(prev => prev.filter(i => i.cartId !== cartId));

  const copyNumber = () => {
    navigator.clipboard.writeText(TRANSFER_PHONE).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleConfirmOrder = async () => {
    if (isOrdering || !paymentMethod) return;
    setIsOrdering(true);

    let direccionFinal = 'Recoger en sucursal';
    if (metodo === 'domicilio') {
      if (addressMode === 'gps') {
        direccionFinal = direccionGps;
      } else {
        const parts = [calleNumero, colonia && `Col. ${colonia}`, entreCalles && `Entre: ${entreCalles}`].filter(Boolean);
        direccionFinal = parts.join(', ');
      }
    }

    localStorage.setItem('pizza_user_data', JSON.stringify({ nombre, telefono }));

    const pedido = {
      items: cart,
      total,
      createdAt: new Date().toISOString(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      cliente_nombre: nombre,
      direccion: direccionFinal,
      telefono,
      referencias: referencia,
      lat: gpsLat,
      lng: gpsLng,
      metodo_entrega: metodo,
      payment_method: paymentMethod,
      monto_pago: paymentMethod === 'efectivo' ? parseFloat(montoEfectivo) || 0 : 0,
      telefono_cliente: localStorage.getItem('capriccio_cliente_telefono') || telefono,
    };

    try {
      const res = await fetch(`${API_URL}/api/pedidos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pedido),
      });
      if (res.ok) {
        const data = await res.json();
        const id = data.order_id || 'procesado';
        const displayId = id.includes('-') ? id.split('-')[1] : id;
        onOrderPlaced(
          clienteLogueado
            ? `¡Pedido #${displayId} recibido! Rastréalo en "Mis Pedidos" 📦`
            : `¡Pedido #${displayId} recibido! Preparando tu pizza... 🍕`
        );
        onClose();
      } else {
        onOrderPlaced('No pudimos procesar tu pedido. Intenta nuevamente.');
      }
    } catch {
      onOrderPlaced('No pudimos procesar tu pedido. Intenta nuevamente.');
    }
    setIsOrdering(false);
  };

  // ─── Slide direction ──────────────────────────────────────────────────────

  const stepOrder: WizardStep[] = ['datos', 'entrega', 'pedido', 'pago'];
  const [prevStep, setPrevStep] = useState<WizardStep>('datos');
  const direction = stepOrder.indexOf(step) > stepOrder.indexOf(prevStep) ? 1 : -1;

  const goTo = (next: WizardStep) => { setPrevStep(step); setStep(next); };
  const goBack = () => goTo(stepOrder[stepOrder.indexOf(step) - 1]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[150]"
              onClick={onClose}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 60 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 w-full md:max-w-lg bg-capriccio-dark rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl z-[160] border border-white/5 flex flex-col"
              style={{ maxHeight: '92dvh' }}
            >
              {/* Fixed header */}
              <div className="px-8 pt-7 pb-0 flex-shrink-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-3">
                    {step !== 'datos' && (
                      <button onClick={goBack} className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white transition-colors">
                        <ChevronLeft size={18} />
                      </button>
                    )}
                    <img src="/logohd.png" alt="Capriccio" className="h-7 w-auto drop-shadow" />
                  </div>
                  <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                    <X size={20} />
                  </button>
                </div>
                <StepDots current={step} />
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto scrollbar-hide px-8 pb-8">
                <AnimatePresence mode="wait" custom={direction}>
                  {/* ═══ PASO 1: DATOS ═══ */}
                  {step === 'datos' && (
                    <motion.div
                      key="datos"
                      custom={direction}
                      initial={{ opacity: 0, x: direction * 40 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: direction * -40 }}
                      transition={{ duration: 0.25 }}
                    >
                      <h2 className="text-3xl font-title font-black italic uppercase tracking-tighter text-white leading-none mb-1">
                        ¡Vamos a pedir!
                      </h2>
                      <p className="text-gray-400 text-sm font-bold mb-6">Cuéntanos quién eres</p>

                      {/* Banner login/registro */}
                      {!clienteLogueado ? (
                        <button
                          onClick={() => setShowAuth(true)}
                          className="w-full mb-6 flex items-center gap-4 bg-capriccio-gold/10 border border-capriccio-gold/30 rounded-2xl px-5 py-4 hover:bg-capriccio-gold/20 transition-all group text-left"
                        >
                          <div className="w-10 h-10 rounded-xl bg-capriccio-gold/20 flex items-center justify-center shrink-0">
                            <Star size={18} className="text-capriccio-gold" fill="currentColor" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-capriccio-gold font-black text-sm uppercase tracking-wide leading-tight">
                              ¡Inicia sesión o regístrate!
                            </p>
                            <p className="text-gray-400 text-xs font-bold mt-0.5 leading-tight">
                              Acumula puntos, rastrea tus pedidos y pide más rápido
                            </p>
                          </div>
                          <LogIn size={18} className="text-capriccio-gold/60 group-hover:text-capriccio-gold transition-colors shrink-0" />
                        </button>
                      ) : (
                        <div className="w-full mb-6 flex items-center gap-4 bg-green-500/10 border border-green-500/20 rounded-2xl px-5 py-4">
                          <Package size={18} className="text-green-400 shrink-0" />
                          <div>
                            <p className="text-green-400 font-black text-sm uppercase tracking-wide">
                              ¡Hola, {clienteNombreSession.split(' ')[0]}!
                            </p>
                            <p className="text-green-400/60 text-xs font-bold">
                              Sesión activa · tus pedidos quedan en tu cuenta
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Nombre completo</label>
                          <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={17} />
                            <input
                              type="text"
                              placeholder="¿Cómo te llamamos?"
                              required
                              value={nombre}
                              onChange={e => setNombre(e.target.value)}
                              className="w-full pl-12 pr-4 py-4 bg-capriccio-card rounded-2xl outline-none font-bold text-white placeholder-gray-600 focus:ring-2 focus:ring-capriccio-gold transition-all"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Teléfono de contacto</label>
                          <div className="relative">
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={17} />
                            <input
                              type="tel"
                              placeholder="10 dígitos"
                              required
                              value={telefono}
                              onChange={e => setTelefono(e.target.value)}
                              className="w-full pl-12 pr-4 py-4 bg-capriccio-card rounded-2xl outline-none font-bold text-white placeholder-gray-600 focus:ring-2 focus:ring-capriccio-gold transition-all"
                            />
                          </div>
                        </div>

                        {/* Privacidad */}
                        <label className="flex items-start gap-3 cursor-pointer group mt-2">
                          <div className="relative mt-0.5 shrink-0">
                            <input type="checkbox" checked={privacidad} onChange={e => setPrivacidad(e.target.checked)} className="sr-only" />
                            <div className={cn(
                              "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
                              privacidad ? "bg-capriccio-gold border-capriccio-gold" : "border-white/30 bg-white/5 group-hover:border-capriccio-gold/50"
                            )}>
                              {privacidad && (
                                <svg className="w-3 h-3 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            He leído y acepto el{' '}
                            <a href="/privacidad" target="_blank" className="text-capriccio-gold hover:underline font-bold">Aviso de Privacidad</a>
                            {' '}y autorizo el uso de mis datos para procesar mi pedido.
                          </p>
                        </label>

                        <button
                          onClick={() => nombre.trim() && telefono.trim() && privacidad && goTo('entrega')}
                          disabled={!nombre.trim() || !telefono.trim() || !privacidad}
                          className="w-full bg-capriccio-gold hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed text-capriccio-dark py-5 rounded-[2rem] font-black text-lg italic uppercase tracking-widest shadow-[var(--shadow-neon-yellow)] active:scale-95 transition-all flex items-center justify-center gap-3 mt-2 group"
                        >
                          Siguiente
                          <ArrowRight className="group-hover:translate-x-1 transition-transform" strokeWidth={3} size={20} />
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* ═══ PASO 2: MÉTODO DE ENTREGA ═══ */}
                  {step === 'entrega' && (
                    <motion.div
                      key="entrega"
                      custom={direction}
                      initial={{ opacity: 0, x: direction * 40 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: direction * -40 }}
                      transition={{ duration: 0.25 }}
                    >
                      <h2 className="text-3xl font-title font-black italic uppercase tracking-tighter text-white leading-none mb-1">
                        ¿Cómo lo quieres?
                      </h2>
                      <p className="text-gray-400 text-sm font-bold mb-6">Elige tu método de entrega</p>

                      {/* Cards de método */}
                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <button
                          onClick={() => setMetodo('domicilio')}
                          className={cn(
                            "flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all",
                            metodo === 'domicilio'
                              ? "border-capriccio-gold bg-capriccio-gold/10 text-capriccio-gold"
                              : "border-white/10 bg-white/5 text-gray-400 hover:border-white/20"
                          )}
                        >
                          <Bike size={36} strokeWidth={2} />
                          <div className="text-center">
                            <p className="font-black text-sm uppercase tracking-wide leading-tight">A Domicilio</p>
                            <p className="text-[10px] font-bold opacity-60 mt-1">Te lo llevamos</p>
                          </div>
                        </button>
                        <button
                          onClick={() => setMetodo('para_llevar')}
                          className={cn(
                            "flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all",
                            metodo === 'para_llevar'
                              ? "border-capriccio-gold bg-capriccio-gold/10 text-capriccio-gold"
                              : "border-white/10 bg-white/5 text-gray-400 hover:border-white/20"
                          )}
                        >
                          <Store size={36} strokeWidth={2} />
                          <div className="text-center">
                            <p className="font-black text-sm uppercase tracking-wide leading-tight">Recoger en tienda</p>
                            <p className="text-[10px] font-bold opacity-60 mt-1">Paso por él</p>
                          </div>
                        </button>
                      </div>

                      {/* Dirección — solo si domicilio */}
                      <AnimatePresence>
                        {metodo === 'domicilio' && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-3 overflow-hidden mb-6"
                          >
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1 block">Dirección de entrega</label>

                            {/* Toggle manual/GPS */}
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setAddressMode('manual')}
                                className={cn(
                                  "flex items-center justify-center gap-2 py-3 rounded-2xl border-2 text-xs font-black uppercase tracking-widest transition-all",
                                  addressMode === 'manual'
                                    ? "border-capriccio-gold bg-capriccio-gold/10 text-capriccio-gold"
                                    : "border-white/10 bg-white/5 text-gray-400 hover:border-white/20"
                                )}
                              >
                                <MapPin size={14} /> Ingresar
                              </button>
                              <button
                                type="button"
                                onClick={() => { setAddressMode('gps'); handleLocate(); }}
                                className={cn(
                                  "flex items-center justify-center gap-2 py-3 rounded-2xl border-2 text-xs font-black uppercase tracking-widest transition-all",
                                  addressMode === 'gps'
                                    ? "border-capriccio-gold bg-capriccio-gold/10 text-capriccio-gold"
                                    : "border-white/10 bg-white/5 text-gray-400 hover:border-white/20"
                                )}
                              >
                                {isLocating ? <Loader2 size={14} className="animate-spin" /> : <LocateFixed size={14} />}
                                Mi ubicación
                              </button>
                            </div>

                            {addressMode === 'manual' && (
                              <>
                                <div className="relative">
                                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
                                  <input
                                    type="text" placeholder="Calle y número *" required
                                    value={calleNumero} onChange={e => setCalleNumero(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3.5 bg-capriccio-card rounded-2xl outline-none font-bold text-sm text-white placeholder-gray-600 focus:ring-2 focus:ring-capriccio-gold"
                                  />
                                </div>
                                <input
                                  type="text" placeholder="Colonia *" required
                                  value={colonia} onChange={e => setColonia(e.target.value)}
                                  className="w-full px-4 py-3.5 bg-capriccio-card rounded-2xl outline-none font-bold text-sm text-white placeholder-gray-600 focus:ring-2 focus:ring-capriccio-gold"
                                />
                                <input
                                  type="text" placeholder="Entre calles (opcional)"
                                  value={entreCalles} onChange={e => setEntreCalles(e.target.value)}
                                  className="w-full px-4 py-3.5 bg-capriccio-card rounded-2xl outline-none font-bold text-sm text-white placeholder-gray-600 focus:ring-2 focus:ring-capriccio-gold"
                                />
                              </>
                            )}

                            {addressMode === 'gps' && (
                              <div className="relative">
                                <LocateFixed className="absolute left-4 top-4 text-capriccio-gold" size={15} />
                                <textarea
                                  rows={2}
                                  placeholder={isLocating ? "Obteniendo ubicación..." : "Dirección detectada..."}
                                  value={direccionGps}
                                  onChange={e => setDireccionGps(e.target.value)}
                                  className="w-full pl-11 pr-4 py-3.5 bg-capriccio-card rounded-2xl outline-none font-bold text-sm text-white placeholder-gray-600 resize-none focus:ring-2 focus:ring-capriccio-gold"
                                />
                              </div>
                            )}

                            <div className="relative">
                              <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
                              <input
                                type="text" placeholder="Referencia: portón verde, entre calles..."
                                value={referencia} onChange={e => setReferencia(e.target.value)}
                                className="w-full pl-11 pr-4 py-3.5 bg-capriccio-card rounded-2xl outline-none font-bold text-sm text-white placeholder-gray-600 focus:ring-2 focus:ring-capriccio-gold"
                              />
                            </div>
                          </motion.div>
                        )}

                        {metodo === 'para_llevar' && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden mb-6"
                          >
                            <div className="bg-capriccio-gold/10 border border-capriccio-gold/20 rounded-2xl p-5 text-center">
                              <Store size={28} className="mx-auto text-capriccio-gold mb-2" />
                              <p className="text-white font-black italic text-sm uppercase">Recoge en sucursal</p>
                              <p className="text-gray-400 text-xs font-bold mt-1">Te avisamos por WhatsApp cuando esté listo.</p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <button
                        onClick={() => {
                          const addressOk = metodo === 'para_llevar' ||
                            (addressMode === 'manual' ? calleNumero.trim() && colonia.trim() : direccionGps.trim());
                          if (addressOk) goTo('pedido');
                        }}
                        disabled={metodo === 'domicilio' && (addressMode === 'manual' ? !calleNumero.trim() || !colonia.trim() : !direccionGps.trim())}
                        className="w-full bg-capriccio-gold hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed text-capriccio-dark py-5 rounded-[2rem] font-black text-lg italic uppercase tracking-widest shadow-[var(--shadow-neon-yellow)] active:scale-95 transition-all flex items-center justify-center gap-3 group"
                      >
                        Siguiente: Mi Pedido
                        <ArrowRight className="group-hover:translate-x-1 transition-transform" strokeWidth={3} size={20} />
                      </button>
                    </motion.div>
                  )}

                  {/* ═══ PASO 3: PEDIDO ═══ */}
                  {step === 'pedido' && (
                    <motion.div
                      key="pedido"
                      custom={direction}
                      initial={{ opacity: 0, x: direction * 40 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: direction * -40 }}
                      transition={{ duration: 0.25 }}
                    >
                      <h2 className="text-3xl font-title font-black italic uppercase tracking-tighter text-white leading-none mb-1">
                        Tu Pedido
                      </h2>
                      <p className="text-gray-400 text-sm font-bold mb-4">Elige lo que se te antoja</p>

                      {/* Category tabs */}
                      <div className="flex gap-2 overflow-x-auto pb-3 mb-5 scrollbar-hide -mx-1 px-1">
                        {CATEGORIES.map(cat => (
                          <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={cn(
                              "px-4 py-2 rounded-full font-black italic uppercase tracking-widest text-xs whitespace-nowrap transition-all shrink-0",
                              activeCategory === cat
                                ? "bg-capriccio-gold text-capriccio-dark"
                                : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                            )}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>

                      {/* Product grid */}
                      <div className="space-y-3 mb-6">
                        {menu.filter(p => p.categoria === activeCategory && p.activo).map(pizza => (
                          <div
                            key={pizza.id}
                            onClick={() => { setSelectedPizza(pizza); setIsProductModalOpen(true); }}
                            className="flex items-center gap-4 bg-capriccio-card rounded-2xl p-3 cursor-pointer hover:bg-white/10 transition-all border border-transparent hover:border-white/10 group"
                          >
                            {pizza.imagen && (
                              <img src={pizza.imagen} alt={pizza.nombre} className="w-16 h-16 object-cover rounded-xl shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-black text-white text-sm leading-tight">{pizza.nombre}</p>
                              {pizza.descripcion && (
                                <p className="text-gray-500 text-xs font-medium mt-0.5 truncate">{pizza.descripcion}</p>
                              )}
                              <p className="text-capriccio-gold font-black text-sm mt-1">
                                desde ${typeof pizza.precios === 'object' ? Object.values(pizza.precios as Record<string, number>)[0] : pizza.precio}
                              </p>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-capriccio-gold/10 group-hover:bg-capriccio-gold group-hover:text-capriccio-dark text-capriccio-gold flex items-center justify-center transition-all shrink-0 font-black text-lg">
                              +
                            </div>
                          </div>
                        ))}
                        {menu.filter(p => p.categoria === activeCategory && p.activo).length === 0 && (
                          <p className="text-center text-gray-500 font-bold italic py-10">
                            No hay artículos disponibles aquí por ahora.
                          </p>
                        )}
                      </div>

                      {/* Cart summary */}
                      {cart.length > 0 && (
                        <div className="bg-black/50 rounded-2xl p-5 mb-5 border border-white/5">
                          <div className="flex justify-between items-center mb-3">
                            <p className="text-[10px] font-black text-capriccio-gold uppercase tracking-[0.2em]">
                              Carrito ({cart.reduce((s, i) => s + i.quantity, 0)} items)
                            </p>
                            <span className="text-white font-black text-lg">${total}</span>
                          </div>
                          <div className="space-y-3">
                            {cart.map(item => (
                              <div key={item.cartId} className="flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-white text-xs leading-tight truncate">
                                    <span className="text-capriccio-gold mr-1">{item.quantity}x</span>{item.nombre}
                                  </p>
                                  {item.size && <p className="text-gray-500 text-[10px]">{item.size}</p>}
                                </div>
                                <span className="text-white font-black text-xs shrink-0">${item.totalItemPrice * item.quantity}</span>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button onClick={() => updateQty(item.cartId, -1)} className="w-6 h-6 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors text-xs font-black flex items-center justify-center">−</button>
                                  <button onClick={() => updateQty(item.cartId, 1)} className="w-6 h-6 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors text-xs font-black flex items-center justify-center">+</button>
                                  <button onClick={() => removeItem(item.cartId)} className="w-6 h-6 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-xs flex items-center justify-center">
                                    <X size={10} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => cart.length > 0 && goTo('pago')}
                        disabled={cart.length === 0}
                        className="w-full bg-capriccio-gold hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed text-capriccio-dark py-5 rounded-[2rem] font-black text-lg italic uppercase tracking-widest shadow-[var(--shadow-neon-yellow)] active:scale-95 transition-all flex items-center justify-center gap-3 group"
                      >
                        {cart.length === 0 ? 'Agrega algo al carrito' : `Pagar $${total}`}
                        {cart.length > 0 && <ArrowRight className="group-hover:translate-x-1 transition-transform" strokeWidth={3} size={20} />}
                      </button>
                    </motion.div>
                  )}

                  {/* ═══ PASO 4: PAGO ═══ */}
                  {step === 'pago' && (
                    <motion.div
                      key="pago"
                      custom={direction}
                      initial={{ opacity: 0, x: direction * 40 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: direction * -40 }}
                      transition={{ duration: 0.25 }}
                      className="space-y-6"
                    >
                      <div>
                        <h2 className="text-3xl font-title font-black italic uppercase tracking-tighter text-white leading-none mb-1">
                          ¿Cómo vas a pagar?
                        </h2>
                        <p className="text-capriccio-gold font-black text-base">
                          Total: <span className="text-2xl">${total}</span>
                        </p>
                      </div>

                      {/* Resumen rápido */}
                      <div className="bg-black/40 rounded-2xl px-5 py-4 border border-white/5 text-xs">
                        <div className="flex justify-between text-gray-400 font-bold mb-2">
                          <span className="uppercase tracking-widest">Entrega</span>
                          <span className="text-white">{metodo === 'domicilio' ? 'A domicilio' : 'Recoger en tienda'}</span>
                        </div>
                        <div className="flex justify-between text-gray-400 font-bold">
                          <span className="uppercase tracking-widest">Cliente</span>
                          <span className="text-white">{nombre}</span>
                        </div>
                      </div>

                      {/* Métodos de pago */}
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

                      <AnimatePresence mode="wait">
                        {paymentMethod === 'transferencia' && (
                          <motion.div
                            key="transfer"
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                            className="bg-black/40 border border-capriccio-gold/30 rounded-2xl p-6 space-y-4"
                          >
                            <p className="text-gray-300 text-sm font-bold text-center">
                              Envía tu comprobante al siguiente número de WhatsApp:
                            </p>
                            <div className="flex items-center justify-between bg-capriccio-gold/10 rounded-xl px-5 py-4 border border-capriccio-gold/20">
                              <span className="text-capriccio-gold font-black text-2xl tracking-widest">{TRANSFER_PHONE}</span>
                              <button onClick={copyNumber} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white">
                                {copied ? <CheckCheck size={20} className="text-green-400" /> : <Copy size={20} />}
                              </button>
                            </div>
                            <p className="text-gray-500 text-[11px] text-center leading-relaxed">
                              📸 Confirmaremos tu pedido en cuanto recibamos el comprobante.
                            </p>
                          </motion.div>
                        )}

                        {paymentMethod === 'efectivo' && (
                          <motion.div
                            key="cash"
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                            className="bg-black/40 border border-white/10 rounded-2xl p-6 space-y-4"
                          >
                            <p className="text-gray-300 text-sm font-bold text-center">
                              ¿Con cuánto vas a pagar? (para llevar cambio exacto)
                            </p>
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-capriccio-gold font-black text-xl">$</span>
                              <input
                                type="number" min={total} step="10" placeholder={String(total)}
                                value={montoEfectivo} onChange={e => setMontoEfectivo(e.target.value)}
                                className="w-full pl-10 pr-4 py-4 bg-capriccio-card text-white font-black text-2xl rounded-2xl outline-none focus:ring-2 focus:ring-capriccio-gold placeholder-gray-600"
                              />
                            </div>
                            {montoEfectivo && parseFloat(montoEfectivo) >= total && (
                              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                className="flex justify-between items-center bg-green-500/10 border border-green-500/20 rounded-xl px-5 py-3">
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
                        onClick={handleConfirmOrder}
                        disabled={!canConfirmPayment || isOrdering}
                        className="w-full bg-capriccio-gold hover:bg-yellow-400 disabled:opacity-30 disabled:cursor-not-allowed text-capriccio-dark py-6 rounded-[2rem] font-black text-xl italic uppercase tracking-widest shadow-[var(--shadow-neon-yellow)] active:scale-95 transition-all flex items-center justify-center gap-4 group"
                      >
                        {isOrdering
                          ? <><Loader2 size={20} className="animate-spin" /> Enviando...</>
                          : <><span>¡Confirmar Pedido!</span><ArrowRight className="group-hover:translate-x-1 transition-transform" strokeWidth={3} size={20} /></>
                        }
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Auth modal — fuera del z-stack del wizard para no tapar */}
      <CustomerAuthModal
        open={showAuth}
        onClose={() => setShowAuth(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* Product modal */}
      <ProductModal
        pizza={selectedPizza}
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        onConfirm={addToCart}
        pizzasList={menu}
      />

      {/* Extras modal */}
      <ExtrasModal
        isOpen={isExtrasModalOpen}
        pizzaNombre={pendingProduct?.pizza.nombre ?? ''}
        pizzaIngredientes={pendingProduct?.pizza.ingredientes ?? []}
        sizeId={pendingProduct?.sizeInfo.id ?? 'mediana'}
        sizeLabel={pendingProduct?.sizeInfo.label ?? ''}
        onConfirm={(extras) => pendingProduct && finalizeAddToCart(
          pendingProduct.pizza, pendingProduct.sizeInfo, pendingProduct.crustInfo, pendingProduct.finalPrice, extras
        )}
        onSkip={() => pendingProduct && finalizeAddToCart(
          pendingProduct.pizza, pendingProduct.sizeInfo, pendingProduct.crustInfo, pendingProduct.finalPrice, []
        )}
        onClose={() => pendingProduct && finalizeAddToCart(
          pendingProduct.pizza, pendingProduct.sizeInfo, pendingProduct.crustInfo, pendingProduct.finalPrice, []
        )}
      />
    </>
  );
}
