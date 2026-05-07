'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Clock, Plus, Eye, BarChart3, LogOut, Search, Package, ChevronUp, ChevronDown } from 'lucide-react';
import NewOrderForm from './NewOrderForm';
import ActiveOrdersList from './ActiveOrdersList';
import CashRegisterPanel from './CashRegisterPanel';
import ShiftReportModal from './ShiftReportModal';
import BuscarPedidoModal from './BuscarPedidoModal';
import ProductManagementPanel from './ProductManagementPanel';
import { CajaTurno } from '@/data/caja-types';
import { API_URL } from '@/lib/socket';

type TabId = 'nuevo' | 'ordenes' | 'caja' | 'productos' | 'cerrar';

interface TabConfig {
  id: TabId;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  emoji: string;
}

const tabs: TabConfig[] = [
  { id: 'nuevo',    label: 'Nuevo Pedido',    shortLabel: 'Nuevo',     icon: <Plus size={20} />,    emoji: '➕' },
  { id: 'ordenes',  label: 'Órdenes Activas', shortLabel: 'Órdenes',   icon: <Eye size={20} />,     emoji: '📋' },
  { id: 'caja',     label: 'Caja & Reportes', shortLabel: 'Caja',      icon: <BarChart3 size={20} />, emoji: '💰' },
  { id: 'productos',label: 'Productos',        shortLabel: 'Productos', icon: <Package size={20} />, emoji: '🛍️' },
  { id: 'cerrar',   label: 'Cerrar Turno',    shortLabel: 'Cerrar',    icon: <Clock size={20} />,   emoji: '🔒' },
];

interface CajaDashboardProps {
  turno: CajaTurno | null;
  onTurnoCreated: (turno: CajaTurno) => void;
  onLogout: () => void;
}

/* ── Floating Scroll Buttons ─────────────────────── */
const ScrollButtons: React.FC = () => {
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const update = useCallback(() => {
    const scrollY = window.scrollY;
    const viewH   = window.innerHeight;
    const docH    = document.documentElement.scrollHeight;
    setCanScrollUp(scrollY > 120);
    setCanScrollDown(scrollY + viewH < docH - 40);
  }, []);

  useEffect(() => {
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [update]);

  if (!canScrollUp && !canScrollDown) return null;

  const scrollBy = (dir: 'up' | 'down') => {
    window.scrollBy({ top: dir === 'up' ? -320 : 320, behavior: 'smooth' });
  };

  return (
    <div className="fixed right-3 bottom-[72px] sm:bottom-6 z-50 flex flex-col gap-2">
      {canScrollUp && (
        <button
          onClick={() => scrollBy('up')}
          aria-label="Subir"
          className="w-11 h-11 flex items-center justify-center bg-white border-2 border-gray-200 rounded-full shadow-lg text-gray-600 hover:bg-red-600 hover:text-white hover:border-red-600 active:scale-90 transition-all"
        >
          <ChevronUp size={22} strokeWidth={2.5} />
        </button>
      )}
      {canScrollDown && (
        <button
          onClick={() => scrollBy('down')}
          aria-label="Bajar"
          className="w-11 h-11 flex items-center justify-center bg-white border-2 border-gray-200 rounded-full shadow-lg text-gray-600 hover:bg-red-600 hover:text-white hover:border-red-600 active:scale-90 transition-all"
        >
          <ChevronDown size={22} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
};

const CajaDashboard: React.FC<CajaDashboardProps> = ({ turno, onTurnoCreated, onLogout }) => {
  const [activeTab, setActiveTab] = useState<TabId>('nuevo');
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showBuscarModal, setShowBuscarModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const [currentTime, setCurrentTime] = useState(() =>
    new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true })
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleOpenShift = async (efectivo_inicial: number) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/caja/turno/abrir`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('capriccio_token_caja')}`,
        },
        body: JSON.stringify({ efectivo_inicial }),
      });
      if (!response.ok) throw new Error('Error al abrir turno');
      const newTurno = await response.json();
      onTurnoCreated(newTurno);
      setActiveTab('nuevo');
    } catch (error) {
      console.error('Error:', error);
      alert('Error al abrir turno');
    } finally {
      setLoading(false);
    }
  };

  /* ── No turno: abrir turno screen ──────────────── */
  if (!turno) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 max-w-md w-full border border-gray-100">
          <div className="text-center mb-6">
            <div className="text-6xl mb-3">🍕</div>
            <h2 className="text-2xl font-black text-gray-900">Iniciar Turno</h2>
            <p className="text-sm text-gray-500 mt-1">Capriccio POS</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">
                💵 Efectivo Inicial ($)
              </label>
              <input
                type="number"
                id="efectivo_inicial"
                className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-red-600 outline-none text-gray-900 bg-white text-xl font-bold transition"
                placeholder="0"
                defaultValue="0"
                inputMode="numeric"
              />
              <p className="text-xs text-gray-400 mt-1.5 font-medium">Dinero para dar cambio (caja chica)</p>
            </div>
            <button
              onClick={() => {
                const val = (document.getElementById('efectivo_inicial') as HTMLInputElement)?.value || '0';
                handleOpenShift(parseFloat(val));
              }}
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black py-4 rounded-xl transition text-base active:scale-95"
            >
              {loading ? '⌛ Abriendo...' : '🚀 Abrir Turno'}
            </button>
            <button
              onClick={onLogout}
              className="w-full text-gray-500 font-semibold py-2.5 border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition text-sm"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Main dashboard ─────────────────────────────── */
  return (
    <div className="min-h-screen bg-gray-50 pb-16 sm:pb-0">

      {/* ── MOBILE HEADER (< sm) ─────────────────────── */}
      <div className="sm:hidden bg-white border-b-2 border-gray-200 sticky top-0 z-40 flex items-center gap-2 px-3 py-2">
        <img src="/logohd.png" alt="Capriccio" className="h-8 w-auto flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-gray-800 truncate leading-tight">POS Capriccio</p>
          <p className="text-[10px] text-gray-500 leading-tight truncate">
            {turno.cajero_nombre} &bull; <span className="font-mono text-red-600">{currentTime}</span>
          </p>
        </div>
        <button
          onClick={() => setShowBuscarModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl transition text-xs flex-shrink-0 active:scale-95"
        >
          <Search size={15} />
          <span className="hidden xs:inline">Buscar</span>
        </button>
        <button
          onClick={onLogout}
          className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl transition flex-shrink-0"
          title="Cerrar sesión"
        >
          <LogOut size={18} />
        </button>
      </div>

      {/* ── DESKTOP TOPBAR (≥ sm) ───────────────────── */}
      <div className="hidden sm:flex bg-white border-b-2 border-gray-200 sticky top-0 z-40 items-stretch h-[62px]">
        {/* Tabs */}
        <div className="flex items-stretch">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center gap-0.5 px-5 lg:px-6 min-w-[80px] border-r border-gray-200 font-black text-xs uppercase tracking-wide transition-all ${
                activeTab === tab.id
                  ? 'bg-red-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="text-lg leading-none">{tab.emoji}</span>
              <span>{tab.shortLabel}</span>
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Brand + info + actions */}
        <div className="flex items-center gap-2 lg:gap-3 px-4 border-l border-gray-200">
          <img src="/logohd.png" alt="Capriccio" className="h-8 w-auto hidden md:block" />
          <div className="hidden md:block">
            <p className="text-sm font-black text-gray-800 leading-tight">🍕 Capriccio POS</p>
            <p className="text-xs text-gray-500 leading-tight">
              <span className="font-bold text-gray-700">{turno.cajero_nombre}</span>
              {' · '}
              <span className="font-mono text-red-600">{currentTime}</span>
            </p>
          </div>
          <button
            onClick={() => setShowBuscarModal(true)}
            className="flex items-center gap-1.5 px-3 lg:px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl transition text-sm active:scale-95"
          >
            <Search size={16} />
            <span className="hidden lg:inline">Buscar Pedido</span>
          </button>
          <button
            onClick={onLogout}
            className="flex items-center gap-1 px-2 lg:px-3 py-2 text-gray-500 hover:bg-gray-100 rounded-xl transition text-sm"
          >
            <LogOut size={18} />
            <span className="hidden lg:inline text-sm font-semibold">Salir</span>
          </button>
        </div>
      </div>

      {/* ── CONTENT ──────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-3 sm:py-6 lg:py-8">

        {activeTab === 'nuevo'     && <NewOrderForm turno={turno} />}
        {activeTab === 'ordenes'   && <ActiveOrdersList turno={turno} />}
        {activeTab === 'caja'      && <CashRegisterPanel turno={turno} />}
        {activeTab === 'productos' && <ProductManagementPanel />}

        {activeTab === 'cerrar' && (
          <div className="flex flex-col items-center justify-center py-16 gap-5 max-w-sm mx-auto text-center">
            <span className="text-7xl">🔒</span>
            <div>
              <h2 className="text-2xl font-black text-gray-900">¿Cerrar el turno?</h2>
              <p className="text-gray-500 text-sm mt-2">
                Asegúrate de haber cobrado todos los pedidos pendientes antes de cerrar.
              </p>
            </div>
            <button
              onClick={() => setShowShiftModal(true)}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 px-10 rounded-2xl text-base transition active:scale-95"
            >
              📊 Abrir Reporte de Cierre
            </button>
          </div>
        )}
      </div>

      {/* ── MOBILE BOTTOM TAB BAR ────────────────────── */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t-2 border-gray-200 flex shadow-[0_-2px_10px_rgba(0,0,0,0.08)]">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors relative ${
              activeTab === tab.id ? 'text-red-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <span className={`text-lg leading-none transition-transform ${activeTab === tab.id ? 'scale-110' : ''}`}>
              {tab.emoji}
            </span>
            <span className="text-[9px] font-black uppercase tracking-wide leading-tight">{tab.shortLabel}</span>
            {activeTab === tab.id && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-red-600 rounded-b-full" />
            )}
          </button>
        ))}
      </div>

      {/* ── MODALS ───────────────────────────────────── */}
      {showShiftModal && (
        <ShiftReportModal turno={turno} onClose={() => setShowShiftModal(false)} />
      )}
      {showBuscarModal && (
        <BuscarPedidoModal turno={turno} onClose={() => setShowBuscarModal(false)} />
      )}

      {/* ── SCROLL BUTTONS (POS only) ─────────────────── */}
      <ScrollButtons />
    </div>
  );
};

export default CajaDashboard;
