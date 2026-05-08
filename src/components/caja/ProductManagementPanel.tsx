'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCcw, Search, Package, TrendingUp,
  ToggleLeft, ToggleRight, Plus, Edit2, Trash2,
  X, Save, Loader2, ChevronDown,
} from 'lucide-react';
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
  precios?: Record<string, number> | string;
  ingredientes?: string[] | string;
}

const CATEGORY_ICONS: Record<string, string> = {
  pizzas: '🍕', bebidas: '🥤', entradas: '🥗', postres: '🍰',
  complementos: '🧂', promociones: '🎉', hamburguesa: '🍔',
  hamburguesas: '🍔', snack: '🍟', snacks: '🍟', alitas: '🍗',
  boneless: '🍗', orilla: '🥖', orillas: '🥖', otros: '📦',
};

const getCategoryIcon = (cat: string): string => {
  const lower = cat.toLowerCase().replace(/[^a-z]/g, '');
  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return '📦';
};

const SIZE_KEYS = ['mini', 'chica', 'mediana', 'grande', 'jumbo'] as const;
const SIZE_LABELS: Record<string, string> = {
  mini: 'Mini', chica: 'Chica', mediana: 'Mediana', grande: 'Grande', jumbo: 'Jumbo',
};

const CATEGORY_OPTIONS = [
  '🍕 Pizzas', '🍔 Hamburguesas', '🥤 Bebidas', '🍟 Snacks',
  '🍰 Postres', '🥗 Entradas', '🍗 Alitas', '⭐ Especiales',
  '🥖 Orillas', '📦 Otros',
];

/* ── JWT role helper ─── */
function getTokenRole(): string {
  try {
    const token = localStorage.getItem('capriccio_token_caja');
    if (!token) return '';
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded.role || '';
  } catch { return ''; }
}

/* ── Parse precios from DB row ─── */
function parsePrecios(raw: any): Record<string, number> {
  if (!raw) return {};
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return {}; } }
  return raw as Record<string, number>;
}

/* ── Default form state ─── */
type FormState = {
  nombre: string; descripcion: string; precio: string; imagen: string;
  categoria: string; activo: boolean; precios: Record<string, string>;
};

const blankForm = (): FormState => ({
  nombre: '', descripcion: '', precio: '', imagen: '',
  categoria: '🍕 Pizzas', activo: true,
  precios: { mini: '', chica: '', mediana: '', grande: '', jumbo: '' },
});

/* ═══════════════════════════════════════════════════════ */
const ProductManagementPanel: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('todos');
  const [toggling, setToggling] = useState<number | null>(null);
  const [notif, setNotif] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  /* Role */
  const [userRole, setUserRole] = useState('');
  useEffect(() => { setUserRole(getTokenRole()); }, []);
  const canEdit = userRole === 'admin' || userRole === 'responsable';

  /* Modal */
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState<FormState>(blankForm());

  const hasSizes =
    formData.categoria === '🍕 Pizzas' ||
    formData.categoria.toLowerCase().includes('orilla');

  /* ── Notification ─── */
  const showNotif = (msg: string, type: 'ok' | 'err') => {
    setNotif({ msg, type });
    setTimeout(() => setNotif(null), 2500);
  };

  /* ── Fetch ─── */
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('capriccio_token_caja');
      const res = await fetch(`${API_URL}/api/caja/productos-mgmt`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProducts(Array.isArray(data) ? data : []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  /* ── Toggle active ─── */
  const handleToggle = async (product: Product) => {
    setToggling(product.id);
    try {
      const token = localStorage.getItem('capriccio_token_caja');
      const res = await fetch(`${API_URL}/api/caja/productos/${product.id}/toggle-activo`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProducts(prev =>
          prev.map(p => p.id === product.id ? { ...p, activo: data.activo } : p)
        );
        showNotif(data.activo ? `✅ ${product.nombre} activado` : `⏸️ ${product.nombre} desactivado`, 'ok');
      } else showNotif('Error al cambiar estado', 'err');
    } catch { showNotif('Error de conexión', 'err'); }
    finally { setToggling(null); }
  };

  /* ── Open modals ─── */
  const openCreateModal = () => {
    setEditingProduct(null);
    setFormData(blankForm());
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    const raw = parsePrecios(product.precios);
    const preciosStr: Record<string, string> = {};
    for (const k of SIZE_KEYS) preciosStr[k] = raw[k] != null ? String(raw[k]) : '';
    setFormData({
      nombre: product.nombre,
      descripcion: product.descripcion || '',
      precio: String(product.precio),
      imagen: product.imagen || '',
      categoria: product.categoria,
      activo: product.activo,
      precios: preciosStr,
    });
    setIsModalOpen(true);
  };

  /* ── Save ─── */
  const handleSave = async () => {
    if (!formData.nombre.trim()) { showNotif('El nombre es obligatorio', 'err'); return; }
    setIsSaving(true);
    try {
      const token = localStorage.getItem('capriccio_token_caja');
      const method = editingProduct ? 'PATCH' : 'POST';
      const url = editingProduct
        ? `${API_URL}/api/productos/${editingProduct.id}`
        : `${API_URL}/api/productos`;

      let preciosPayload: Record<string, number> | null = null;
      if (hasSizes) {
        const built: Record<string, number> = {};
        for (const k of SIZE_KEYS) {
          const v = formData.precios[k];
          if (v !== '' && !isNaN(Number(v))) built[k] = Number(v);
        }
        if (Object.keys(built).length > 0) preciosPayload = built;
      }

      const body: Record<string, any> = {
        nombre: formData.nombre.trim(),
        descripcion: formData.descripcion.trim(),
        imagen: formData.imagen.trim() || null,
        categoria: formData.categoria,
        activo: formData.activo,
        ingredientes: [],
      };

      if (hasSizes && preciosPayload) {
        body.precio = (preciosPayload.mini ?? preciosPayload.chica ?? preciosPayload.mediana) ?? (Number(formData.precio) || 0);
        body.precios = JSON.stringify(preciosPayload);
      } else {
        body.precio = Number(formData.precio) || 0;
        body.precios = null;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setIsModalOpen(false);
        showNotif(editingProduct ? `✅ "${formData.nombre}" actualizado` : `✅ "${formData.nombre}" creado`, 'ok');
        fetchProducts();
      } else {
        const err = await res.json().catch(() => ({}));
        showNotif(err.error || 'Error al guardar', 'err');
      }
    } catch { showNotif('Error de conexión', 'err'); }
    finally { setIsSaving(false); }
  };

  /* ── Delete ─── */
  const handleDelete = async () => {
    if (!editingProduct) return;
    if (!window.confirm(`¿Eliminar "${editingProduct.nombre}"?\nEsta acción no se puede deshacer.`)) return;
    setIsDeleting(true);
    try {
      const token = localStorage.getItem('capriccio_token_caja');
      const res = await fetch(`${API_URL}/api/productos/${editingProduct.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setIsModalOpen(false);
        showNotif(`🗑️ "${editingProduct.nombre}" eliminado`, 'ok');
        fetchProducts();
      } else showNotif('Error al eliminar', 'err');
    } catch { showNotif('Error de conexión', 'err'); }
    finally { setIsDeleting(false); }
  };

  /* ── Derived ─── */
  const categories = ['todos', ...Array.from(new Set(products.map(p => p.categoria || 'Otros'))).sort()];
  const topSellers = [...products].filter(p => p.veces_pedido > 0)
    .sort((a, b) => b.veces_pedido - a.veces_pedido).slice(0, 10).map(p => p.id);

  const filtered = products.filter(p => {
    const matchSearch = search === '' ||
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      (p.descripcion || '').toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === 'todos' || (p.categoria || 'Otros') === categoryFilter;
    return matchSearch && matchCat;
  });

  const activeCount = products.filter(p => p.activo).length;
  const inactiveCount = products.filter(p => !p.activo).length;

  /* ── Render ─── */
  if (loading) return (
    <div className="flex items-center justify-center py-20 text-gray-400">
      <RefreshCcw size={24} className="animate-spin mr-3" />
      <span className="font-bold text-sm uppercase tracking-widest">Cargando productos...</span>
    </div>
  );

  return (
    <div className="space-y-5 relative">

      {/* Notif */}
      {notif && (
        <div className={cn(
          'fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full font-black text-sm text-white shadow-xl transition-all',
          notif.type === 'ok' ? 'bg-gray-900' : 'bg-red-600'
        )}>
          {notif.msg}
        </div>
      )}

      {/* Header + Create button */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-gray-900 leading-tight">Productos</h2>
          <p className="text-xs text-gray-400 font-semibold mt-0.5">
            {activeCount} activos · {inactiveCount} inactivos
          </p>
        </div>
        {canEdit && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-sm transition active:scale-95 shadow-sm"
          >
            <Plus size={18} strokeWidth={3} /> Nuevo Producto
          </button>
        )}
      </div>

      {/* Stats */}
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

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre o descripción..."
          className="w-full pl-11 pr-4 py-3.5 border-2 border-gray-200 rounded-xl outline-none text-gray-900 bg-white font-semibold text-sm focus:border-red-600 transition"
        />
        {search && (
          <button onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg">×</button>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {categories.map(cat => {
          const count = cat === 'todos' ? products.length
            : products.filter(p => (p.categoria || 'Otros') === cat).length;
          return (
            <button key={cat} onClick={() => setCategoryFilter(cat)}
              className={cn(
                'px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap flex-shrink-0 flex items-center gap-1.5',
                categoryFilter === cat
                  ? 'bg-red-600 text-white shadow-lg'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-red-300'
              )}
            >
              {cat === 'todos' ? '🗂️' : getCategoryIcon(cat)}
              {cat === 'todos' ? 'Todos' : cat}
              <span className={cn(
                'ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-black',
                categoryFilter === cat ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
              )}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Product grid */}
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
            const catIcon = getCategoryIcon(product.categoria || 'otros');
            const isToggling = toggling === product.id;

            return (
              <div key={product.id} className={cn(
                'bg-white rounded-2xl border overflow-hidden transition-all shadow-sm',
                product.activo ? 'border-gray-200' : 'border-dashed border-gray-300 opacity-60'
              )}>
                {/* Image */}
                <div className={cn('h-24 flex items-center justify-center text-5xl relative',
                  product.activo ? 'bg-gray-50' : 'bg-gray-100'
                )}>
                  {product.imagen ? (
                    <img src={product.imagen} alt={product.nombre}
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
                        <TrendingUp size={9} /> TOP
                      </span>
                    )}
                    {!product.activo && (
                      <span className="bg-gray-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
                        INACTIVO
                      </span>
                    )}
                  </div>

                  {/* Edit button */}
                  {canEdit && (
                    <button onClick={() => openEditModal(product)}
                      className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center bg-white/90 hover:bg-white rounded-lg shadow text-gray-600 hover:text-red-600 transition"
                    >
                      <Edit2 size={13} />
                    </button>
                  )}
                </div>

                {/* Info */}
                <div className="p-3">
                  <p className={cn('font-black text-sm leading-tight uppercase italic',
                    product.activo ? 'text-gray-900' : 'text-gray-400'
                  )}>
                    {product.nombre}
                  </p>
                  <div className="flex items-center justify-between mt-1.5">
                    <div>
                      <p className="text-red-600 font-black text-sm">${Number(product.precio).toLocaleString()}</p>
                      <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
                        {catIcon} {product.categoria}
                        {product.veces_pedido > 0 && (
                          <span className="ml-1 text-amber-500">· {product.veces_pedido}× vendido</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Toggle */}
                <div className="px-3 pb-3">
                  <button onClick={() => handleToggle(product)} disabled={isToggling}
                    className={cn(
                      'w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2',
                      isToggling && 'opacity-50 cursor-not-allowed',
                      product.activo
                        ? 'bg-green-50 border-2 border-green-300 text-green-700 hover:bg-red-50 hover:border-red-300 hover:text-red-700'
                        : 'bg-gray-100 border-2 border-gray-300 text-gray-600 hover:bg-green-50 hover:border-green-300 hover:text-green-700'
                    )}
                  >
                    {isToggling ? <RefreshCcw size={14} className="animate-spin" />
                      : product.activo
                        ? <><ToggleRight size={16} className="text-green-600" /> Activo</>
                        : <><ToggleLeft size={16} className="text-gray-400" /> Inactivo</>}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Refresh */}
      <div className="flex justify-end">
        <button onClick={fetchProducts}
          className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50 transition">
          <RefreshCcw size={14} /> Actualizar lista
        </button>
      </div>

      {/* ═══ MODAL CREAR / EDITAR ═══ */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[92vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center gap-3 p-5 border-b flex-shrink-0">
              <div className="flex-1">
                <h2 className="text-lg font-black text-gray-900">
                  {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                </h2>
                {editingProduct && (
                  <p className="text-xs text-gray-400 font-semibold mt-0.5">{editingProduct.nombre}</p>
                )}
              </div>
              {editingProduct && userRole === 'admin' && (
                <button onClick={handleDelete} disabled={isDeleting}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-black text-xs transition disabled:opacity-50">
                  {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Eliminar
                </button>
              )}
              <button onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-700"><X size={22} /></button>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">

              {/* Nombre */}
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1.5">
                  Nombre *
                </label>
                <input type="text" value={formData.nombre}
                  onChange={e => setFormData(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="Ej: Hawaiana, Coca-Cola, Alitas..."
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 font-bold text-sm focus:border-red-500 outline-none transition"
                />
              </div>

              {/* Descripcion */}
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1.5">
                  Descripción
                </label>
                <input type="text" value={formData.descripcion}
                  onChange={e => setFormData(p => ({ ...p, descripcion: e.target.value }))}
                  placeholder="Ej: Piña, jamón y queso sobre base de tomate..."
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 font-bold text-sm focus:border-red-500 outline-none transition"
                />
              </div>

              {/* Categoría */}
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1.5">
                  Categoría
                </label>
                <div className="relative">
                  <select
                    value={formData.categoria}
                    onChange={e => setFormData(p => ({ ...p, categoria: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 font-bold text-sm focus:border-red-500 outline-none appearance-none bg-white transition"
                  >
                    {CATEGORY_OPTIONS.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    {/* Also include any existing category not in default list */}
                    {editingProduct && !CATEGORY_OPTIONS.includes(editingProduct.categoria) && (
                      <option value={editingProduct.categoria}>{editingProduct.categoria}</option>
                    )}
                  </select>
                  <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Precios por tamaño (Pizzas / Orillas) */}
              {hasSizes ? (
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">
                    Precio por Tamaño
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {SIZE_KEYS.map(key => (
                      <div key={key}>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                          {SIZE_LABELS[key]}
                        </p>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">$</span>
                          <input
                            type="number" min="0"
                            value={formData.precios[key] ?? ''}
                            onChange={e => setFormData(p => ({
                              ...p, precios: { ...p.precios, [key]: e.target.value }
                            }))}
                            placeholder="0"
                            className="w-full pl-7 pr-3 py-2.5 border-2 border-gray-200 rounded-xl text-gray-900 font-bold text-sm focus:border-red-500 outline-none transition"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1.5 font-semibold">
                    Deja en blanco los tamaños que no apliquen. Para Orillas, usa 0 si no tiene costo en ese tamaño.
                  </p>
                </div>
              ) : (
                /* Precio único */
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1.5">
                    Precio
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                    <input type="number" min="0" value={formData.precio}
                      onChange={e => setFormData(p => ({ ...p, precio: e.target.value }))}
                      placeholder="0"
                      className="w-full pl-8 pr-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 font-bold text-sm focus:border-red-500 outline-none transition"
                    />
                  </div>
                </div>
              )}

              {/* Imagen URL */}
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1.5">
                  URL de imagen (opcional)
                </label>
                <input type="url" value={formData.imagen}
                  onChange={e => setFormData(p => ({ ...p, imagen: e.target.value }))}
                  placeholder="https://..."
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 font-bold text-sm focus:border-red-500 outline-none transition"
                />
              </div>

              {/* Activo toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div>
                  <p className="font-black text-sm text-gray-800">¿Disponible?</p>
                  <p className="text-xs text-gray-400 font-semibold mt-0.5">
                    {formData.activo ? 'Visible en el menú y POS' : 'Oculto — no aparece en el menú'}
                  </p>
                </div>
                <button
                  onClick={() => setFormData(p => ({ ...p, activo: !p.activo }))}
                  className={cn(
                    'w-14 h-7 rounded-full transition-all relative',
                    formData.activo ? 'bg-green-500' : 'bg-gray-300'
                  )}
                >
                  <div className={cn(
                    'w-5 h-5 bg-white rounded-full shadow absolute top-1 transition-all',
                    formData.activo ? 'left-8' : 'left-1'
                  )} />
                </button>
              </div>

            </div>

            {/* Footer */}
            <div className="p-5 border-t flex gap-3 flex-shrink-0">
              <button onClick={() => setIsModalOpen(false)}
                className="px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-black text-sm transition">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={isSaving || !formData.nombre.trim()}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-xl font-black text-sm transition flex items-center justify-center gap-2">
                {isSaving ? <><Loader2 size={16} className="animate-spin" /> Guardando...</>
                  : <><Save size={16} /> {editingProduct ? 'Guardar Cambios' : 'Crear Producto'}</>}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default ProductManagementPanel;
