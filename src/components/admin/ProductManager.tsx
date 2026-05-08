'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pizza } from '@/data/menu';
import { Edit2, Trash2, Plus, Search, X, Loader2, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { API_URL } from '@/lib/socket';

interface ProductManagerProps {
    products: Pizza[];
    onUpdate: (id: number, updates: Partial<Pizza>) => void;
    onRefresh?: () => void;
}

const PIZZA_SIZES = [
    { key: 'mini',    label: 'Mini' },
    { key: 'chica',   label: 'Chica' },
    { key: 'mediana', label: 'Mediana' },
    { key: 'grande',  label: 'Grande' },
    { key: 'jumbo',   label: 'Jumbo' },
];

const ProductManager: React.FC<ProductManagerProps> = ({ products, onUpdate, onRefresh }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState<number | null>(null);
    const [editingProduct, setEditingProduct] = useState<Pizza | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        nombre: '',
        descripcion: '',
        precio: '',
        imagen: '',
        categoria: '🍕 Pizzas',
        activo: true,
        precios: { mini: '', chica: '', mediana: '', grande: '', jumbo: '' } as Record<string, string>,
        ingredientes: [] as string[],
    });
    const [ingredienteInput, setIngredienteInput] = useState('');

    const hasSizes = formData.categoria === '🍕 Pizzas' || formData.categoria.toLowerCase().includes('orilla');

    const categories = ['all', ...Array.from(new Set(products.map(p => p.categoria)))];

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              p.categoria.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = activeCategoryFilter === 'all' || p.categoria === activeCategoryFilter;
        return matchesSearch && matchesCategory;
    });

    const openCreateModal = () => {
        setEditingProduct(null);
        setIngredienteInput('');
        setFormData({
            nombre: '',
            descripcion: '',
            precio: '',
            imagen: '',
            categoria: '🍕 Pizzas',
            activo: true,
            precios: { mini: '', chica: '', mediana: '', grande: '', jumbo: '' },
            ingredientes: [],
        });
        setIsModalOpen(true);
    };

    const openEditModal = (product: Pizza) => {
        setEditingProduct(product);
        // Parse precios — can be a JSON string or an object
        let preciosObj: Record<string, string> = { mini: '', chica: '', mediana: '', grande: '', jumbo: '' };
        if (product.precios) {
            const raw = typeof product.precios === 'string' ? JSON.parse(product.precios) : product.precios;
            preciosObj = {
                mini:    raw.mini    != null ? String(raw.mini)    : '',
                chica:   raw.chica   != null ? String(raw.chica)   : '',
                mediana: raw.mediana != null ? String(raw.mediana) : '',
                grande:  raw.grande  != null ? String(raw.grande)  : '',
                jumbo:   raw.jumbo   != null ? String(raw.jumbo)   : '',
            };
        }
        // Parse ingredientes
        let ingArr: string[] = [];
        if (product.ingredientes) {
            ingArr = Array.isArray(product.ingredientes)
                ? product.ingredientes
                : JSON.parse(product.ingredientes as any);
        }
        setIngredienteInput('');
        setFormData({
            nombre:       product.nombre,
            descripcion:  product.descripcion,
            precio:       String(product.precio),
            imagen:       product.imagen,
            categoria:    product.categoria,
            activo:       product.activo,
            precios:      preciosObj,
            ingredientes: ingArr,
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Estás seguro de que deseas eliminar este producto?')) return;
        setIsDeleting(id);
        try {
            const token = localStorage.getItem('capriccio_token_admin');
            const res = await fetch(`${API_URL}/api/productos/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok && onRefresh) {
                onRefresh();
            } else {
                alert("Error al borrar el producto.");
            }
        } catch (error) {
            console.error(error);
            alert("Error de conexión.");
        } finally {
            setIsDeleting(null);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const token = localStorage.getItem('capriccio_token_admin');
            const method = editingProduct ? 'PATCH' : 'POST';
            const url = editingProduct
                ? `${API_URL}/api/productos/${editingProduct.id}`
                : `${API_URL}/api/productos`;

            // Build precios object — only for pizza categories, ignore empty fields
            let preciosPayload: Record<string, number> | null = null;
            if (hasSizes) {
                const built: Record<string, number> = {};
                for (const { key } of PIZZA_SIZES) {
                    const val = formData.precios[key];
                    if (val !== '' && !isNaN(Number(val))) built[key] = Number(val);
                }
                if (Object.keys(built).length > 0) preciosPayload = built;
            }

            const body: Record<string, any> = {
                nombre:       formData.nombre,
                descripcion:  formData.descripcion,
                imagen:       formData.imagen,
                categoria:    formData.categoria,
                activo:       formData.activo,
                ingredientes: formData.ingredientes,
            };

            if (hasSizes && preciosPayload) {
                // For pizzas use smallest size as base precio, store all in precios
                const firstPrice = preciosPayload.mini ?? preciosPayload.chica ?? preciosPayload.mediana ?? preciosPayload.grande ?? Number(formData.precio);
                body.precio  = firstPrice;
                body.precios = JSON.stringify(preciosPayload);
            } else {
                body.precio  = Number(formData.precio);
                body.precios = null;
            }

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                setIsModalOpen(false);
                if (onRefresh) onRefresh();
            } else {
                alert("Error al guardar el producto.");
            }
        } catch (error) {
            console.error(error);
            alert("Error de conexión.");
        } finally {
            setIsSaving(false);
        }
    };

    const addIngrediente = () => {
        const val = ingredienteInput.trim();
        if (!val) return;
        if (formData.ingredientes.map(i => i.toLowerCase()).includes(val.toLowerCase())) {
            setIngredienteInput('');
            return;
        }
        setFormData(prev => ({ ...prev, ingredientes: [...prev.ingredientes, val] }));
        setIngredienteInput('');
    };

    const removeIngrediente = (ing: string) => {
        setFormData(prev => ({ ...prev, ingredientes: prev.ingredientes.filter(i => i !== ing) }));
    };

    // Helper: display price summary in list
    const getPriceDisplay = (product: Pizza) => {
        if (product.precios) {
            const raw = typeof product.precios === 'string' ? JSON.parse(product.precios) : product.precios;
            const vals = Object.values(raw as Record<string, number>).filter(v => v > 0);
            if (vals.length > 0) {
                const min = Math.min(...vals);
                const max = Math.max(...vals);
                return min === max ? `$${min}` : `$${min} – $${max}`;
            }
        }
        return `$${product.precio}`;
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 relative">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                <div className="flex flex-col">
                    <h3 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 leading-none mb-1">Gestión de Menú</h3>
                    <p className="text-slate-400 font-bold italic text-sm">Controla la disponibilidad en tiempo real.</p>
                </div>

                <div className="flex gap-3 w-full md:w-auto">
                    <div className="relative flex-grow md:w-64">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar producto..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 text-slate-900 border-none rounded-2xl outline-none focus:ring-2 focus:ring-red-600/20 font-bold text-sm transition-all placeholder:text-slate-400"
                        />
                    </div>
                    <button
                        onClick={openCreateModal}
                        className="bg-red-600 text-white p-3 rounded-2xl hover:bg-red-700 shadow-lg shadow-red-600/20 transition-all active:scale-95"
                    >
                        <Plus size={24} strokeWidth={3} />
                    </button>
                </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1 mb-2 scrollbar-hide snap-x">
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setActiveCategoryFilter(cat)}
                        className={cn(
                            "px-5 py-2.5 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-[0.2em] whitespace-nowrap transition-all snap-start shadow-sm border",
                            activeCategoryFilter === cat
                                ? "bg-slate-900 text-white border-slate-900 shadow-slate-900/20"
                                : "bg-white text-slate-500 hover:bg-slate-100 border-slate-200"
                        )}
                    >
                        {cat === 'all' ? 'Todos' : cat}
                    </button>
                ))}
            </div>

            {/* Product List */}
            <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-50 overflow-hidden">
                <div className="grid grid-cols-1 divide-y divide-slate-50">
                    <AnimatePresence mode="popLayout">
                        {filteredProducts.map(product => (
                            <motion.div
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                key={product.id}
                                className="p-6 flex flex-col sm:flex-row items-center justify-between hover:bg-slate-50/50 transition-colors gap-6"
                            >
                                <div className="flex items-center gap-6 w-full sm:w-auto">
                                    <div className="relative group overflow-hidden rounded-2xl">
                                        <img
                                            src={product.imagen}
                                            className={cn(
                                                "w-20 h-20 object-cover transition-all duration-500",
                                                !product.activo && "grayscale brightness-50"
                                            )}
                                            alt={product.nombre}
                                        />
                                        {!product.activo && (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className="bg-white/90 text-black text-[8px] font-black uppercase px-2 py-1 rounded-full italic shadow-sm">Agotado</span>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-red-600 opacity-60">{product.categoria}</span>
                                        </div>
                                        <p className="font-black text-xl italic text-slate-900 uppercase leading-none mb-1">{product.nombre}</p>
                                        <p className="text-lg font-black text-slate-400 italic leading-none">{getPriceDisplay(product)}</p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between w-full sm:w-auto gap-8 sm:gap-12">
                                    {/* Availability Switch */}
                                    <div className="flex flex-col items-end gap-2">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Status</span>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={product.activo}
                                                onChange={() => onUpdate(product.id, { activo: !product.activo })}
                                            />
                                            <div className="w-14 h-8 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-500 transition-colors"></div>
                                        </label>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => openEditModal(product)}
                                            className="p-3 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-950 transition-all"
                                        >
                                            <Edit2 size={20} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(product.id)}
                                            disabled={isDeleting === product.id}
                                            className="p-3 hover:bg-red-50 rounded-xl text-slate-400 hover:text-red-600 transition-all disabled:opacity-50"
                                        >
                                            {isDeleting === product.id ? <Loader2 className="animate-spin" size={20} /> : <Trash2 size={20} />}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {filteredProducts.length === 0 && (
                        <div className="p-20 text-center">
                            <p className="text-slate-300 font-black italic uppercase text-2xl">No se encontraron productos</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
                        >
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <div>
                                    <h3 className="text-2xl font-black italic uppercase text-slate-900 leading-none">
                                        {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                                    </h3>
                                    <p className="text-slate-400 font-bold text-sm italic mt-1">
                                        {editingProduct ? 'Modifica los detalles del producto' : 'Añade un nuevo producto al menú'}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="p-2 rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto">
                                <form id="productForm" onSubmit={handleSave} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-black uppercase text-slate-500 mb-2 tracking-wider">Nombre del Producto</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.nombre}
                                            onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                                            className="w-full p-4 bg-slate-50 rounded-2xl border-none text-slate-900 font-bold focus:ring-2 focus:ring-capriccio-gold outline-none"
                                            placeholder="Ej. Pizza Pepperoni"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black uppercase text-slate-500 mb-2 tracking-wider">Categoría</label>
                                        <select
                                            value={formData.categoria}
                                            onChange={e => setFormData({ ...formData, categoria: e.target.value })}
                                            className="w-full p-4 bg-slate-50 rounded-2xl border-none text-slate-900 font-bold focus:ring-2 focus:ring-capriccio-gold outline-none"
                                        >
                                            <option value="🍕 Pizzas">🍕 Pizzas</option>
                                            <option value="🍔 Hamburguesas">🍔 Hamburguesas</option>
                                            <option value="Snacks & Más">Snacks & Más</option>
                                            <option value="🥤 Bebidas">🥤 Bebidas</option>
                                        </select>
                                    </div>

                                    {/* PRICES — sizes for pizzas, single price for others */}
                                    {hasSizes ? (
                                        <div>
                                            <label className="block text-xs font-black uppercase text-slate-500 mb-3 tracking-wider">
                                                Precios por Tamaño ($)
                                            </label>
                                            <div className="grid grid-cols-2 gap-3">
                                                {PIZZA_SIZES.map(({ key, label }) => (
                                                    <div key={key} className="relative">
                                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase tracking-widest text-slate-400 pointer-events-none">
                                                            {label}
                                                        </span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={formData.precios[key]}
                                                            onChange={e => setFormData({
                                                                ...formData,
                                                                precios: { ...formData.precios, [key]: e.target.value }
                                                            })}
                                                            className="w-full pl-16 pr-4 py-4 bg-slate-50 rounded-2xl border-none text-slate-900 font-black focus:ring-2 focus:ring-capriccio-gold outline-none"
                                                            placeholder="0"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-bold mt-2 italic">Deja en blanco los tamaños que no apliquen.</p>
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="block text-xs font-black uppercase text-slate-500 mb-2 tracking-wider">Precio ($)</label>
                                            <input
                                                type="number"
                                                required
                                                min="0"
                                                step="0.01"
                                                value={formData.precio}
                                                onChange={e => setFormData({ ...formData, precio: e.target.value })}
                                                className="w-full p-4 bg-slate-50 rounded-2xl border-none text-slate-900 font-bold focus:ring-2 focus:ring-capriccio-gold outline-none"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-xs font-black uppercase text-slate-500 mb-2 tracking-wider">Imagen (Archivo)</label>
                                        <div className="flex flex-col gap-2">
                                            {formData.imagen && (
                                                <img src={formData.imagen} alt="Preview" className="w-16 h-16 object-cover rounded-xl shadow-sm mb-2" />
                                            )}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onloadend = () => {
                                                            setFormData({ ...formData, imagen: reader.result as string });
                                                        };
                                                        reader.readAsDataURL(file);
                                                    }
                                                }}
                                                className="w-full p-3 bg-slate-50 rounded-2xl border-none text-slate-900 font-bold focus:ring-2 focus:ring-capriccio-gold outline-none text-sm cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-capriccio-gold file:text-slate-900 hover:file:bg-yellow-400"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black uppercase text-slate-500 mb-2 tracking-wider">Descripción</label>
                                        <textarea
                                            required
                                            value={formData.descripcion}
                                            onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
                                            className="w-full p-4 bg-slate-50 rounded-2xl border-none text-slate-900 font-bold focus:ring-2 focus:ring-capriccio-gold outline-none resize-none h-24"
                                            placeholder="Breve descripción del producto..."
                                        />
                                    </div>

                                    {/* ── Ingredientes (tags) — para sugerir extras al cliente ── */}
                                    <div>
                                        <label className="block text-xs font-black uppercase text-slate-500 mb-1 tracking-wider">
                                            Ingredientes{' '}
                                            <span className="text-slate-400 text-[10px] normal-case font-bold">
                                                (se sugieren como extras al cliente)
                                            </span>
                                        </label>

                                        {/* Tags actuales */}
                                        {formData.ingredientes.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mb-2">
                                                {formData.ingredientes.map(ing => (
                                                    <span
                                                        key={ing}
                                                        className="flex items-center gap-1 bg-capriccio-gold/20 text-slate-800 text-xs font-bold px-3 py-1.5 rounded-full"
                                                    >
                                                        {ing}
                                                        <button
                                                            type="button"
                                                            onClick={() => removeIngrediente(ing)}
                                                            className="text-slate-400 hover:text-red-600 transition-colors ml-0.5"
                                                        >
                                                            <X size={11} strokeWidth={3} />
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Input para agregar */}
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={ingredienteInput}
                                                onChange={e => setIngredienteInput(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        addIngrediente();
                                                    }
                                                }}
                                                className="flex-1 p-3 bg-slate-50 rounded-2xl border-none text-slate-900 font-bold focus:ring-2 focus:ring-capriccio-gold outline-none text-sm"
                                                placeholder="Ej: Pepperoni, Champiñón, Tocino..."
                                            />
                                            <button
                                                type="button"
                                                onClick={addIngrediente}
                                                className="p-3 bg-capriccio-gold rounded-2xl text-slate-900 hover:bg-yellow-400 transition-colors"
                                            >
                                                <Plus size={18} strokeWidth={3} />
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-bold mt-1.5 italic">
                                            Presiona Enter o + para agregar cada ingrediente.
                                        </p>
                                    </div>
                                </form>
                            </div>

                            <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-6 py-3 rounded-2xl font-black text-slate-500 italic uppercase hover:bg-slate-200 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    form="productForm"
                                    disabled={isSaving}
                                    className="px-6 py-3 rounded-2xl font-black italic uppercase bg-capriccio-gold text-slate-900 hover:bg-yellow-400 transition-colors shadow-lg shadow-capriccio-gold/20 flex items-center gap-2"
                                >
                                    {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                    {isSaving ? 'Guardando...' : 'Guardar Producto'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ProductManager;
