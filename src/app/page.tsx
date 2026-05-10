'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { pizzas as initialPizzas, Pizza } from '@/data/menu';
import { ExtraOption } from '@/data/options';
import { CartItem } from '@/data/cart';
import PizzaCard from '@/components/pizza/PizzaCard';
import FloatingCart from '@/components/cart/FloatingCart';
import ProductModal from '@/components/pizza/ProductModal';
import CheckoutModal from '@/components/cart/CheckoutModal';
import PromoSlider from '@/components/layout/PromoSlider';
import NotificationToast, { NotificationType } from '@/components/ui/NotificationToast';
import { Pizza as PizzaIcon, Phone, MapPin, Clock } from 'lucide-react';
import { getSocket, API_URL } from '@/lib/socket';
import { cn } from '@/lib/utils';
import BrandHeader from '@/components/layout/BrandHeader';
import PromoBuilder from '@/components/pizza/PromoBuilder';
import InvitaModal from '@/components/layout/InvitaModal';
import CookieBanner from '@/components/layout/CookieBanner';
import FacebookFeed from '@/components/layout/FacebookFeed';
import InstallPrompt from '@/components/layout/InstallPrompt';
import ExtrasModal, { ExtraItem } from '@/components/pizza/ExtrasModal';


export default function Home() {
  const CATEGORIES = ["🔥 Promos", "🍕 Pizzas", "🍔 Hamburguesas", "Snacks & Más", "🥤 Bebidas"];
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[1]); // Pizzas por defecto
  const [menu, setMenu] = useState<Pizza[]>(initialPizzas);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedPizza, setSelectedPizza] = useState<Pizza | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<{
    pizza: Pizza;
    sizeInfo: any;
    crustInfo: any;
    finalPrice: number;
  } | null>(null);
  const [isExtrasModalOpen, setIsExtrasModalOpen] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);
  const [cartForceOpen, setCartForceOpen] = useState(false);
  const [horarioModal, setHorarioModal] = useState<'antes' | 'despues' | 'emergencia' | null>(null);
  const [storeStatus, setStoreStatus] = useState<{ opening_time: string; closing_time: string; orders_enabled: boolean } | null>(null);

  const getHoraMexico = () => {
    const now = new Date();
    const partes = new Intl.DateTimeFormat('es-MX', {
      timeZone: 'America/Mexico_City',
      hour: 'numeric', minute: 'numeric', hour12: false
    }).formatToParts(now);
    const h = parseInt(partes.find(p => p.type === 'hour')!.value);
    const m = parseInt(partes.find(p => p.type === 'minute')!.value);
    return h * 60 + m;
  };

  const handleOpenCheckout = () => {
    const status = storeStatus ?? { opening_time: '10:00', closing_time: '21:30', orders_enabled: true };
    if (!status.orders_enabled) { setHorarioModal('emergencia'); return; }
    const mins = getHoraMexico();
    const [oh, om] = status.opening_time.split(':').map(Number);
    const [ch, cm] = status.closing_time.split(':').map(Number);
    if (mins < oh * 60 + om) { setHorarioModal('antes'); return; }
    if (mins >= ch * 60 + cm) { setHorarioModal('despues'); return; }
    setIsCheckoutOpen(true);
  };

  useEffect(() => {
    fetch(`${API_URL}/api/store-status`)
      .then(r => r.json())
      .then(setStoreStatus)
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Escuchar actualizaciones globales del menú (ej. cuando el admin apaga una pizza) y carga inicial
    const fetchMenu = async () => {
      try {
        const res = await fetch(`${API_URL}/api/productos`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const parsedData = data.map((item: any) => ({
              ...item,
              precios: typeof item.precios === 'string' ? JSON.parse(item.precios) : item.precios,
              ingredientes: typeof item.ingredientes === 'string'
                ? (() => { try { return JSON.parse(item.ingredientes); } catch { return []; } })()
                : (Array.isArray(item.ingredientes) ? item.ingredientes : []),
              activo: item.activo === 1 || item.activo === true
            }));
            // Sort to make Jumbo first
            parsedData.sort((a: any, b: any) => {
              if (a.nombre.toLowerCase().trim() === 'jumbo') return -1;
              if (b.nombre.toLowerCase().trim() === 'jumbo') return 1;
              return 0;
            });
            setMenu(parsedData);
          }
        }
      } catch (err) {
        console.error("Error fetching menu:", err);
      }
    };

    fetchMenu();

    const socket = getSocket();
    if (!socket) return;

    socket.on('menu_actualizado', (updatedMenu: any[]) => {
      console.log("Menú actualizado recibido en cliente:", updatedMenu);
      const parsedData = updatedMenu.map((item: any) => ({
        ...item,
        precios: typeof item.precios === 'string' ? JSON.parse(item.precios) : item.precios,
        ingredientes: typeof item.ingredientes === 'string'
          ? (() => { try { return JSON.parse(item.ingredientes); } catch { return []; } })()
          : (Array.isArray(item.ingredientes) ? item.ingredientes : []),
        activo: item.activo === 1 || item.activo === true
      }));
      parsedData.sort((a: any, b: any) => {
        if (a.nombre.toLowerCase().trim() === 'jumbo') return -1;
        if (b.nombre.toLowerCase().trim() === 'jumbo') return 1;
        return 0;
      });
      setMenu(parsedData);
    });

    return () => {
      socket.off('menu_actualizado');
    };
  }, []);

  // Notification state
  const [notification, setNotification] = useState<{
    isVisible: boolean;
    message: string;
    type: NotificationType;
  }>({
    isVisible: false,
    message: '',
    type: 'success'
  });

  const showNotification = (message: string, type: NotificationType = 'success') => {
    setNotification({ isVisible: true, message, type });
  };

  const handleOpenModal = (pizza: Pizza) => {
    setSelectedPizza(pizza);
    setIsModalOpen(true);
  };

  const finalizeAddToCart = (
    pizza: Pizza,
    selectedSizeInfo: any,
    selectedCrustInfo: any,
    finalPrice: number,
    extras: ExtraItem[]
  ) => {
    const baseCartId = `${pizza.id}-${selectedSizeInfo.id}-${selectedCrustInfo.id}`;
    const extrasTotal = extras.reduce((s, e) => s + e.precio * e.cantidad, 0);
    const totalWithExtras = finalPrice + extrasTotal;

    // Expand each extra by cantidad so the server can insert one row per unit
    const expandedExtras = extras.flatMap(e =>
      Array.from({ length: e.cantidad }, () => ({ id: e.id, nombre: e.nombre, precio: e.precio }))
    );

    // Items with extras always get a unique cartId to avoid merging with a "plain" version
    const cartId = expandedExtras.length > 0 ? `${baseCartId}-${Date.now()}` : baseCartId;

    const existing = expandedExtras.length === 0 ? cart.find(item => item.cartId === cartId) : null;
    if (existing) {
      setCart(cart.map(item =>
        item.cartId === cartId ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart(prev => [...prev, {
        ...pizza,
        size: selectedSizeInfo.label,
        crust: selectedCrustInfo.label !== 'Sin Orilla Rellena' ? selectedCrustInfo.label : undefined,
        extras: expandedExtras,
        totalItemPrice: totalWithExtras,
        quantity: 1,
        cartId,
        nota: selectedSizeInfo.nota || undefined,
        sauce: selectedSizeInfo.sauce || undefined,
      }]);
    }

    setIsModalOpen(false);
    setIsExtrasModalOpen(false);
    setPendingProduct(null);
    showNotification(`¡${pizza.nombre} agregado al carrito! 🍕`);
  };

  const addToCart = (pizza: Pizza, selectedSizeInfo: any, selectedCrustInfo: any, finalPrice: number) => {
    const ingredientes: string[] = Array.isArray(pizza.ingredientes) ? pizza.ingredientes : [];
    if (ingredientes.length > 0) {
      // Guardar para después del modal de extras
      setPendingProduct({ pizza, sizeInfo: selectedSizeInfo, crustInfo: selectedCrustInfo, finalPrice });
      setIsModalOpen(false);
      setIsExtrasModalOpen(true);
      return;
    }
    // Sin ingredientes configurados → agregar directo
    finalizeAddToCart(pizza, selectedSizeInfo, selectedCrustInfo, finalPrice, []);
  };

  const handleExtrasConfirm = (extras: ExtraItem[]) => {
    if (!pendingProduct) return;
    finalizeAddToCart(
      pendingProduct.pizza,
      pendingProduct.sizeInfo,
      pendingProduct.crustInfo,
      pendingProduct.finalPrice,
      extras
    );
  };

  const handleExtrasSkip = () => {
    if (!pendingProduct) return;
    finalizeAddToCart(
      pendingProduct.pizza,
      pendingProduct.sizeInfo,
      pendingProduct.crustInfo,
      pendingProduct.finalPrice,
      []
    );
  };

  const addPromoToCart = (promoItem: any) => {
    const existing = cart.find(item => item.cartId === promoItem.cartId);
    if (existing) {
      setCart(cart.map(item =>
        item.cartId === promoItem.cartId ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart([...cart, promoItem]);
    }
    showNotification("¡Promo agregada al carrito!");
  };

  const updateCartQuantity = (cartId: string, delta: number) => {
    setCart(prev => {
      const item = prev.find(i => i.cartId === cartId);
      if (!item) return prev;
      if (item.quantity + delta <= 0) return prev.filter(i => i.cartId !== cartId);
      return prev.map(i => i.cartId === cartId ? { ...i, quantity: i.quantity + delta } : i);
    });
  };

  const removeFromCart = (cartId: string) => {
    setCart(prev => prev.filter(i => i.cartId !== cartId));
  };

  const addComplementoToCart = (item: Pizza) => {
    const cartId = `comp-${item.id}`;
    const existing = cart.find(c => c.cartId === cartId);
    if (existing) {
      setCart(cart.map(c => 
        c.cartId === cartId ? { ...c, quantity: c.quantity + 1 } : c
      ));
    } else {
      setCart([...cart, {
        ...item,
        size: 'Unico',
        extras: [],
        totalItemPrice: item.precio || 0,
        quantity: 1,
        cartId
      }]);
    }
    showNotification(`¡${item.nombre} agregado!`);
  };

  const sendToOrderChannel = async (userData: any) => {
    if (isOrdering) return;
    setIsOrdering(true);
    const totalPrice = cart.reduce((acc, item) => acc + (item.totalItemPrice * item.quantity), 0);

    // Si el cliente está logueado, vincular el pedido a su cuenta
    const clienteTelefono = localStorage.getItem('capriccio_cliente_telefono');
    const clienteNombre = localStorage.getItem('capriccio_cliente_nombre');

    const pedido = {
      items: cart,
      total: totalPrice,
      createdAt: new Date().toISOString(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      cliente_nombre: userData.nombre,
      direccion: userData.direccion,
      telefono: userData.telefono,
      referencias: userData.referencias,
      lat: userData.lat,
      lng: userData.lng,
      metodo_entrega: userData.metodo_entrega || 'domicilio',
      // Pago seleccionado por el cliente
      payment_method: userData.payment_method || 'efectivo',
      monto_pago: userData.monto_pago || 0,
      // Vincula el pedido a la cuenta del cliente registrado
      telefono_cliente: clienteTelefono || userData.telefono,
    };

    let cocinaSuccess = false;

    // Enviar pedido al API local (server.js envía WhatsApp al cliente y negocio)
    try {
      const response = await fetch(`${API_URL}/api/pedidos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pedido)
      });

      if (response.ok) {
        cocinaSuccess = true;
        const data = await response.json();
        const finalOrderId = data.order_id || 'procesado';
        const displayId = finalOrderId.includes('-') ? finalOrderId.split('-')[1] : finalOrderId;
        const clienteLogueado = !!localStorage.getItem('capriccio_cliente_telefono');
        showNotification(
          clienteLogueado
            ? `¡Pedido #${displayId} recibido! Rastréalo en "Mis Pedidos" 📦`
            : `¡Pedido #${displayId} recibido! Preparando tu pizza... 🍕`,
          'success'
        );
      }
    } catch (error) {
      console.error("Error enviando a cocina local:", error);
    }

    setIsOrdering(false);

    if (!cocinaSuccess) {
      showNotification("No pudimos procesar tu pedido. Intenta nuevamente.", 'error');
      return;
    }

    setCart([]);
    setIsCheckoutOpen(false);
  };

return (
  <div className="bg-[#fafafa] min-h-screen selection:bg-yellow-200">
    <BrandHeader />
    {/* <InvitaModal onAuthSuccess={() => window.location.reload()} /> */}
    {/* Dynamic Header / Hero */}
    <section className="relative h-[85vh] flex items-center justify-center overflow-hidden bg-black">
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/80 z-10" />
        <motion.img
          initial={{ scale: 1.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.6 }}
          transition={{ duration: 1.5 }}
          src="https://images.unsplash.com/photo-1571997478779-2adcbbe9ab2f?q=80&w=2070"
          className="w-full h-full object-cover"
          alt="Wood Fired Oven"
        />
      </div>

      <div className="relative z-20 container mx-auto px-6 text-center pt-32 pb-24 flex flex-col items-center justify-center min-h-full">
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col items-center justify-center mb-12"
        >
          <div className="flex justify-center mb-0">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="relative"
            >
              <div className="absolute inset-0 bg-capriccio-gold/10 blur-[100px] rounded-full" />
              <img
                src="/logohd.png"
                alt="Capriccio Logo"
                className="relative w-64 md:w-[28rem] h-auto object-contain drop-shadow-[0_20px_50px_rgba(234,179,8,0.3)]"
              />
            </motion.div>
          </div>
          <p className="text-base md:text-xl text-gray-200 font-medium italic mb-10 tracking-wide max-w-2xl mx-auto px-4 drop-shadow-lg">
            Sabor tradicional al horno de leña en el corazón de Pánuco. Ingredientes premium, pasión artesanal.
          </p>
          <motion.a
            href="#menu"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-capriccio-gold hover:bg-capriccio-gold/90 text-capriccio-dark px-10 py-5 md:px-12 md:py-6 rounded-[2rem] font-brand font-black text-lg md:text-xl italic uppercase tracking-widest shadow-2xl transition-all inline-block"
          >
            ORDENAR AHORA
          </motion.a>
        </motion.div>

      </div>
    </section>


    {/* Promotions Slider */}
    <PromoSlider />

    {/* Menu Section */}
    <main id="menu" className="container mx-auto px-6 py-10 pb-40">

      {/* Sticky Tabs Nav */}
      <div className="sticky top-0 z-40 bg-[#18181B] pt-4 pb-4 -mx-6 px-6 mb-10 overflow-x-auto whitespace-nowrap scrollbar-hide border-b border-white/5 shadow-2xl">
        <div className="flex gap-4">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "px-6 py-3 rounded-full font-black italic uppercase tracking-widest text-sm transition-all duration-300",
                activeCategory === cat
                  ? "bg-capriccio-gold text-capriccio-dark shadow-[0_0_20px_rgba(250,204,21,0.3)]"
                  : "bg-capriccio-card text-gray-400 hover:bg-white/10 hover:text-white"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {activeCategory === "🔥 Promos" ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <PromoBuilder onAddPromo={addPromoToCart} menu={menu} />
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {menu.filter(p => p.categoria === activeCategory).map(pizza => (
            <PizzaCard
              key={pizza.id}
              pizza={pizza}
              onAddToCart={() => handleOpenModal(pizza)}
            />
          ))}
          {menu.filter(p => p.categoria === activeCategory).length === 0 && (
            <div className="col-span-full py-20 text-center text-gray-500 font-bold italic">
              <p>No hay artículos disponibles en esta categoría por ahora.</p>
            </div>
          )}
        </motion.div>
      )}
    </main>

    {/* Facebook Feed */}
    <FacebookFeed />

    {/* Footer */}
    <footer className="bg-slate-950 py-20 border-t border-slate-800">
      <div className="container mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-12">
        <div>
          <img src="/logohd.png" alt="Capriccio Logo" className="h-16 w-auto mb-6 drop-shadow-xl" />
          <p className="text-slate-400 font-medium">Las mejores pizzas de la ciudad, elaboradas con ingredientes frescos y el amor que solo nosotros sabemos ponerle.</p>
        </div>
        <div>
          <h4 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-8">Horarios</h4>
          <div className="space-y-2">
            <p className="font-bold text-white flex justify-between"><span>Lun - Dom:</span> <span className="text-slate-400">10:00 AM - 10:00 PM</span></p>
          </div>
        </div>
        <div>
          <h4 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-8">Ubicación</h4>
          <p className="font-bold text-white uppercase italic">Pánuco, Veracruz, México</p>
          <p className="text-slate-500 text-[10px] font-bold mt-1">Sabor artesanal directo a tu puerta.</p>
          <a href="https://maps.app.goo.gl/bDTf52FA1bJgxnUt5" target="_blank" rel="noopener noreferrer" className="text-capriccio-gold font-bold mt-2 underline decoration-2 underline-offset-4 hover:text-yellow-400 transition-colors inline-block">Ver en Mapa</a>
        </div>
      </div>
      <div className="container mx-auto px-6 mt-20 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-600 text-xs font-bold uppercase tracking-widest">
        <span>© {new Date().getFullYear()} Capriccio Pizzería. Todos los derechos reservados.</span>
        <a href="/privacidad" className="text-slate-500 hover:text-capriccio-gold transition-colors underline underline-offset-4">
          Aviso de Privacidad
        </a>
      </div>
    </footer>

    {/* Overlays */}
    <ProductModal
      pizza={selectedPizza}
      isOpen={isModalOpen}
      onClose={() => setIsModalOpen(false)}
      onConfirm={addToCart}
      pizzasList={menu}
    />
    <ExtrasModal
      isOpen={isExtrasModalOpen}
      pizzaNombre={pendingProduct?.pizza.nombre ?? ''}
      pizzaIngredientes={pendingProduct?.pizza.ingredientes ?? []}
      sizeId={pendingProduct?.sizeInfo.id ?? 'mediana'}
      sizeLabel={pendingProduct?.sizeInfo.label ?? ''}
      onConfirm={handleExtrasConfirm}
      onSkip={handleExtrasSkip}
      onClose={handleExtrasSkip}
    />
    <CheckoutModal
      isOpen={isCheckoutOpen}
      onClose={() => setIsCheckoutOpen(false)}
      onEditCart={() => setCartForceOpen(true)}
      onConfirm={sendToOrderChannel}
      total={cart.reduce((acc, item) => acc + (item.totalItemPrice * item.quantity), 0)}
      cart={cart}
      menu={menu}
      onAddComplemento={addComplementoToCart}
    />
    <FloatingCart
      cart={cart}
      onOrder={handleOpenCheckout}
      forceOpen={cartForceOpen}
      onForceOpenHandled={() => setCartForceOpen(false)}
      onUpdateQuantity={updateCartQuantity}
      onRemoveItem={removeFromCart}
    />
    <CookieBanner />
    <InstallPrompt />

    {/* Modal fuera de horario */}
    {horarioModal && (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
          {horarioModal === 'emergencia' ? (
            <>
              <div className="text-5xl mb-4">🚫</div>
              <h2 className="text-white font-black italic text-2xl uppercase tracking-tight mb-3">
                ¡Pedidos pausados!
              </h2>
              <p className="text-slate-400 font-medium leading-relaxed mb-2">
                Por el momento no estamos recibiendo pedidos en línea.
              </p>
              <p className="text-capriccio-gold font-bold text-lg">
                Disculpa los inconvenientes.<br />
                <span className="text-base font-medium text-slate-300">¡Volvemos muy pronto!</span>
              </p>
            </>
          ) : horarioModal === 'antes' ? (
            <>
              <div className="text-5xl mb-4">🌅</div>
              <h2 className="text-white font-black italic text-2xl uppercase tracking-tight mb-3">
                ¡Muy temprano, amigo!
              </h2>
              <p className="text-slate-400 font-medium leading-relaxed mb-2">
                Todavía estamos preparando todo con mucho cariño para ti.
              </p>
              <p className="text-capriccio-gold font-bold text-lg">
                Recibimos pedidos a partir de las<br />
                <span className="text-2xl">{storeStatus?.opening_time ?? '10:00'}</span>
              </p>
              <p className="text-slate-500 text-sm mt-2">¡Te esperamos pronto!</p>
            </>
          ) : (
            <>
              <div className="text-5xl mb-4">🌙</div>
              <h2 className="text-white font-black italic text-2xl uppercase tracking-tight mb-3">
                ¡Ya cerramos por hoy!
              </h2>
              <p className="text-slate-400 font-medium leading-relaxed mb-2">
                Gracias por tu preferencia. La cocina ya cerró pedidos por hoy.
              </p>
              <p className="text-capriccio-gold font-bold text-lg">
                Mañana te atendemos desde las<br />
                <span className="text-2xl">{storeStatus?.opening_time ?? '10:00'}</span>
              </p>
              <p className="text-slate-500 text-sm mt-2">¡Hasta pronto! 🍕</p>
            </>
          )}
          <button
            onClick={() => setHorarioModal(null)}
            className="mt-6 w-full bg-capriccio-gold text-slate-950 font-black uppercase tracking-widest py-3 rounded-xl hover:bg-yellow-400 transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    )}

    {/* Notifications */}
    <NotificationToast
      isVisible={notification.isVisible}
      message={notification.message}
      type={notification.type}
      onClose={() => setNotification({ ...notification, isVisible: false })}
    />
  </div>
);
};
