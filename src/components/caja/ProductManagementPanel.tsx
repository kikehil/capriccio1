'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCcw, Search, Package, TrendingUp, ToggleLeft, ToggleRight } from 'lucide-react';
import { API_URL } from '@/lib/socket';
import { cn } from '@/lib/utils';

interface Product {
  id: number;
  nombre: string;
  descripcion?: string;
  precio: number;
  categoria: string;
  activo: boolean;
  imagen?: string;
  veces_pedido: number;
}

const CATEGORY_ICONS: Record<string, string> = {
  pizzas:      '🍕',
  bebidas:     '🥤',
  entradas:    '🥗',
  postres:     '🍰',
  complementos:'🧂',
  promociones: '🎉',
  otros:       '📦',
};

const CATEGORY_LABELS: Record<string, string> = {
  pizzas:       'Pizzas',
  bebidas:      'Bebidas',
  entradas:     'Entradas',
  postres:      'Postres',
  complementos: 'Complementos',
  promociones:  'Promociones',
  otros:        'Otros',
};

const ProductManagementPanel: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('todos');
  const [toggling, setToggling] = useState<number | null>(null);
  const [notification, setNotification] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  /* ── Fetch products ─────────────────────────────── */
  const fetchProducts = useCallback(async () => {
    try {
      const token = localStorage.getItem('capriccio_token_caja');
      const res = await fetch(`${API_URL}/api/caja/productos-mgmt`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProducts(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Error fetching products:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  /* ── Toggle activo ──────────────────────────────── */
  const handleToggle = async (product: Product) => {
    setToggling(product.id);
    try {
      const token = localStorage.getItem('capriccio_token_caja');
      const res = await fetch(`${API_URL}/api/caja/productos/${product.id}/toggle-activo`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProducts(prev =>
          prev.map(p => p.id === product.id ? { ...p, activo: data.activo } : p)
        );
        showNotif(
          data.activo
            ? `✅ ${product.nombre} activado`
            : `⏸️ ${product.nombre} desactivado`,
          'ok'
        );
      } else {
        showNotif('Error al cambiar estado', 'err');
      }
    } catch {
      showNotif('Error de conexión', 'err');
    } finally {
      setToggling(null);
    }
  };

  /* ── Notification helper ────────────────────────── */
  const showNotif = (msg: string, type: 'ok' | 'err') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 2500);
  };

  /* ── Derived data ───────────────────────────────── */
  const categories = ['todos', ...Array.from(new Set(products.map(p => p.categoria || 'otros'))).sort()];

  // Top sellers (ABC analysis) — top 10 by veces_pedido
  const topSellers = [...products]
    .filter(p => p.veces_pedido > 0)
    .sort((a, b) => b.veces_pedido - a.veces_pedido)
    .slice(0, 10)
    .map(p => p.id);

  const filtered = products.filter(p => {
    const matchesSearch = search === '' ||
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      (p.descripcion || '').toLowerCase().includes(search.toLowerCase());
    const matchesCat = categoryFilter === 'todos' || (p.categoria || 'otros') === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const activeCount  = products.filter(p => p.activo).length;
  const inactiveCount = products.filter(p => !p.activo).length;

  /* ── Render ─────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <RefreshCcw size={24} className="animate-spin mr-3" />
        <span className="font-bold text-sm uppercase tracking-widest">Cargando productos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5 relative">

      {/* ── Floating notification ───────────────────── */}
      {notification && (
        <div
          className={cn(
            'fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full font-black text-sm text-white shadow-xl transition-all',
            notification.type === 'ok' ? 'bg-gray-900' : 'bg-red-600'
          )}
        >
          {notification.msg}
        </div>
      )}

      {/* ── Stats ───────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center shadow-sm">
          <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">Total</p>
          <p className="text-3xl font-black text-gray-900">{products.length}</p>
          <p className="text-xs text-gray-400 font-semibold mt-1">productos</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center shadow-sm">
          <p className="text-xs font-black uppercase tracking-widest text-green-500 mb-1">Activos</p>
          <p className="text-3xl font-black text-green-700">{activeCount}</p>
          <p className="text-xs text-green-400 font-semibold mt-1">disponibles</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center shadow-sm">
          <p className="text-xs font-black uppercase tracking-widest text-red-400 mb-1">Inactivos</p>
          <p className="text-3xl font-black text-red-600">{inactiveCount}</p>
          <p className="text-xs text-red-400 font-semibold mt-1">desactivados</p>
        </div>
      </div>

      {/* ── Search ──────────────────────────────────── */}
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar producto por nombre..."
          className="w-full pl-11 pr-4 py-3.5 border-2 border-gray-200 rounded-xl outline-none text-gray-900 bg-white font-semibold text-sm focus:border-red-600 transition"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg"
          >
            ×
          </button>
        )}
      </div>

      {/* ── Category tabs ───────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {categories.map(cat => {
          const count = cat === 'todos'
            ? products.length
            : products.filter(p => (p.categoria || 'otros') === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={cn(
                'px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap flex-shrink-0 flex items-center gap-1.5',
                categoryFilter === cat
                  ? 'bg-red-600 text-white shadow-lg'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-red-300'
              )}
            >
              {cat === 'todos' ? '🗂️' : (CATEGORY_ICONS[cat] || '📦')}
              {cat === 'todos' ? 'Todos' : (CATEGORY_LABELS[cat] || cat)}
              <span className={cn(
                'ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-black',
                categoryFilter === cat ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
              )}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Product grid ────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
          <Package className="mx-auto text-gray-200 mb-3" size={48} />
          <p className="font-black text-gray-400 uppercase tracking-widest text-sm">
            {search ? 'No hay productos con ese nombre' : 'Sin productos en esta categoría'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(product => {
            const isABC = topSellers.includes(product.id);
            const catIcon = CATEGORY_ICONS[product.categoria || 'otros'] || '📦';
            const isToggling = toggling === product.id;

            return (
              <div
                key={product.id}
                className={cn(
                  'bg-white rounded-2xl border overflow-hidden transition-all shadow-sm',
                  product.activo ? 'border-gray-200' : 'border-dashed border-gray-300 opacity-60'
                )}
              >
                {/* Product image / emoji */}
                <div
                  className={cn(
                    'h-24 flex items-center justify-center text-5xl relative',
                    product.activo ? 'bg-gray-50' : 'bg-gray-100'
                  )}
                >
                  {product.imagen ? (
                    <img
                      src={product.imagen}
                      alt={product.nombre}
                      className={cn('w-full h-full object-cover', !product.activo && 'grayscale')}
                      onError={e => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <span className={product.imagen ? 'hidden' : ''}>{catIcon}</span>

                  {/* Badges */}
                  <div className="absolute top-2 left-2 flex gap-1">
                    {isABC && (
                      <span className="bg-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-0.5">
                        <TrendingUp size={9} /> ABC
                      </span>
                    )}
                    {!product.activo && (
                      <span className="bg-gray-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
                        INACTIVO
                      </span>
                    )}
                  </div>
                </div>

                {/* Product info */}
                <div className="p-3">
                  <p className={cn(
                    'font-black text-sm leading-tight uppercase italic',
                    product.activo ? 'text-gray-900' : 'text-gray-400'
                  )}>
                    {product.nombre}
                  </p>
                  <div className="flex items-center justify-between mt-1.5">
                    <div>
                      <p className="text-red-600 font-black text-sm">${Number(product.precio).toLocaleString()}</p>
                      <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
                        {catIcon} {CATEGORY_LABELS[product.categoria || 'otros'] || product.categoria}
                        {product.veces_pedido > 0 && (
                          <span className="ml-1 text-amber-500">· {product.veces_pedido}× vendido</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Toggle button */}
                <div className="px-3 pb-3">
                  <button
                    onClick={() => handleToggle(product)}
                    disabled={isToggling}
                    className={cn(
                      'w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2',
                      isToggling && 'opacity-50 cursor-not-allowed',
                      product.activo
                        ? 'bg-green-50 border-2 border-green-300 text-green-700 hover:bg-red-50 hover:border-red-300 hover:text-red-700'
                        : 'bg-gray-100 border-2 border-gray-300 text-gray-600 hover:bg-green-50 hover:border-green-300 hover:text-green-700'
                    )}
                  >
                    {isToggling ? (
                      <RefreshCcw size={14} className="animate-spin" />
                    ) : product.activo ? (
                      <>
                        <ToggleRight size={16} className="text-green-600" />
                        Activo — toca para desactivar
                      </>
                    ) : (
                      <>
                        <ToggleLeft size={16} className="text-gray-400" />
                        Inactivo — toca para activar
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Refresh button ──────────────────────────── */}
      <div className="flex justify-end">
        <button
          onClick={fetchProducts}
          className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50 transition"
        >
          <RefreshCcw size={14} />
          Actualizar lista
        </button>
      </div>
    </div>
  );
};

export default ProductManagementPanel;
