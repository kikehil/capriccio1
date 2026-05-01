'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame } from 'lucide-react';
import io from 'socket.io-client';

import AdminLayout from './AdminLayout';
import ProductManager from './ProductManager';
import PromotionManager from './PromotionManager';
import ReportsModule from './ReportsModule';
import UserManager from './UserManager';
import SettlementManager from './SettlementManager';
import PlatformDashboard from './PlatformDashboard';
import CapriccioDashboard from './CapriccioDashboard';
import Login from './Login';
import { pizzas as initialPizzas, Pizza } from '@/data/menu';
import BasicOrdersList from './BasicOrdersList';
import PushManager from './PushManager';
import POSManager from './POSManager';
import SettingsModule from './SettingsModule';

import { getSocket, API_URL } from '@/lib/socket';

const AdminDashboard = () => {
    const getInitialTab = () => {
        if (typeof window === 'undefined') return 'stats';
        const role = localStorage.getItem('capriccio_user_role');
        if (role === 'marketing') return 'products';
        if (role === 'platform') return 'platform';
        return 'stats';
    };
    const [activeTab, setActiveTab] = React.useState<'stats' | 'products' | 'promos' | 'settings' | 'reports' | 'users' | 'corte' | 'caja' | 'platform' | 'dashboard' | 'notifications'>(getInitialTab());
    const [plan, setPlan] = React.useState<string>('basico');
    const [userRole, setUserRole] = React.useState<string>('admin');
    const [isAuth, setIsAuth] = React.useState(false);
    const [checkingAuth, setCheckingAuth] = React.useState(true);
    const [products, setProducts] = React.useState<Pizza[]>(initialPizzas);
    const [dailyRevenue, setDailyRevenue] = React.useState(0);
    const [orderCount, setOrderCount] = React.useState(0);
    const [recentOrders, setRecentOrders] = React.useState<any[]>([]);
    const [chartData, setChartData] = React.useState([
        { dia: 'Lun', ventas: 0 },
        { dia: 'Mar', ventas: 0 },
        { dia: 'Mie', ventas: 0 },
        { dia: 'Jue', ventas: 0 },
        { dia: 'Vie', ventas: 0 },
        { dia: 'Sab', ventas: 0 },
        { dia: 'Hoy', ventas: 0 },
    ]);
    const [liquidatedRevenue, setLiquidatedRevenue] = React.useState(0);
    // Estados para roles caja/responsable (stats post-corte)
    const [pendingRevenue, setPendingRevenue] = React.useState(0);
    const [liquidatedAfterCorte, setLiquidatedAfterCorte] = React.useState(0);
    const [ultimoCorte, setUltimoCorte] = React.useState<string | null>(null);
    const [doingCorte, setDoingCorte] = React.useState(false);

    React.useEffect(() => {
        const token = localStorage.getItem('capriccio_token_admin');
        const storedPlan = localStorage.getItem('capriccio_user_plan');
        const storedRole = localStorage.getItem('capriccio_user_role');
        const storedUsername = localStorage.getItem('capriccio_username');
        if (token) {
            setIsAuth(true);
            if (storedPlan) setPlan(storedPlan);
            if (storedRole) setUserRole(storedRole);
            // Si no hay username guardado, intentar obtenerlo del servidor
            if (!storedUsername) {
                fetch(`${API_URL}/api/auth/me`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }).then(r => r.ok ? r.json() : null).then(data => {
                    if (data?.username) {
                        localStorage.setItem('capriccio_username', data.username);
                        localStorage.setItem('capriccio_negocio_nombre', data.negocio || '');
                        localStorage.setItem('capriccio_user_plan', data.plan || 'basico');
                        localStorage.setItem('capriccio_user_role', data.role || 'admin');
                        setPlan(data.plan || 'basico');
                        setUserRole(data.role || 'admin');
                        // Forzar re-render del layout
                        window.location.reload();
                    }
                }).catch(() => {});
            }
        }
        setCheckingAuth(false);
    }, []);

    const fetchStats = async () => {
        try {
            const token = localStorage.getItem('capriccio_token_admin');
            const res = await fetch(`${API_URL}/api/admin/stats`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.revenueToday !== undefined) {
                setDailyRevenue(data.revenueToday);
                setOrderCount(data.totalOrders || data.order_count || data.orderCount || 0);
                setLiquidatedRevenue(data.liquidatedToday || 0);
                setRecentOrders(data.recentOrders || []);
                setChartData(prev => prev.map(d => d.dia === 'Hoy' ? { ...d, ventas: data.revenueToday } : d));
                // Stats para caja/responsable
                setPendingRevenue(data.pendingRevenue || 0);
                setLiquidatedAfterCorte(data.liquidatedAfterCorte || 0);
                setUltimoCorte(data.ultimoCorte || null);
            }
        } catch (e) {
            console.error("❌ [Admin] Error al cargar estadísticas:", e);
        }
    };

    const handleCorteTurno = async () => {
        if (!confirm('¿Confirmar Corte de Turno? Esto reiniciará los contadores del turno actual.')) return;
        setDoingCorte(true);
        try {
            const token = localStorage.getItem('capriccio_token_admin');
            const res = await fetch(`${API_URL}/api/admin/corte-turno`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                await fetchStats();
                alert('✅ Corte de Turno registrado correctamente.');
            }
        } catch (e) {
            console.error('Error en corte de turno:', e);
        } finally {
            setDoingCorte(false);
        }
    };

    const formatTime = (dateStr: string) => {
        if (!dateStr) return '---';
        try {
            const safeStr = dateStr.includes(' ') && !dateStr.includes('T') 
                ? dateStr.replace(' ', 'T') 
                : dateStr;
            const date = new Date(safeStr);
            if (isNaN(date.getTime())) return '---';
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return '---';
        }
    };

    const fetchProducts = async () => {
        try {
            const res = await fetch(`${API_URL}/api/productos`);
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) setProducts(data);
        } catch (error) {
            console.error("Error fetching products:", error);
        }
    };

    React.useEffect(() => {
        if (!isAuth) return;
        const socket = getSocket();

        fetchStats();
        fetchProducts();

        if (!socket) return;

        socket.on('nuevo_pedido', (pedido: any) => {
            setDailyRevenue(prev => prev + (pedido.total || 0));
            setOrderCount(prev => prev + 1);
            setRecentOrders(prev => [pedido, ...prev].slice(0, 5));
            setChartData(prev => prev.map(d =>
                d.dia === 'Hoy' ? { ...d, ventas: d.ventas + (pedido.total || 0) } : d
            ));
        });

        socket.on('menu_actualizado', (updatedProducts: Pizza[]) => {
            setProducts(updatedProducts);
        });

        socket.on('pedidos_liquidados', () => {
            fetchStats();
        });

        socket.on('corte_turno', () => {
            fetchStats();
        });

        return () => {
            socket.off('nuevo_pedido');
            socket.off('menu_actualizado');
            socket.off('pedidos_liquidados');
            socket.off('corte_turno');
        };
    }, [isAuth]);

    const updateProduct = async (id: number, updates: Partial<Pizza>) => {
        try {
            const token = localStorage.getItem('capriccio_token_admin');
            const res = await fetch(`${API_URL}/api/productos/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(updates)
            });
            if (res.ok) {
                const newProducts = products.map(p => p.id === id ? { ...p, ...updates } : p);
                setProducts(newProducts);
                const socket = getSocket();
                if (socket) socket.emit('actualizar_menu', newProducts);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const refreshProducts = async () => {
        try {
            const res = await fetch(`${API_URL}/api/productos`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setProducts(data);
                const socket = getSocket();
                if (socket) socket.emit('actualizar_menu', data);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleLoginSuccess = () => {
        const storedPlan = localStorage.getItem('capriccio_user_plan');
        if (storedPlan) setPlan(storedPlan);
        setIsAuth(true);
    };

    if (checkingAuth) return null;
    // Removido Login redundante aquí, ya controlado por ProtectedRoute.

    const renderContent = () => {
        // ROL MARKETING: Productos, Promociones y Notificaciones
        if (userRole === 'marketing') {
            if (activeTab === 'promos') return <PromotionManager />;
            if (activeTab === 'notifications') return <PushManager />;
            return <ProductManager products={products} onUpdate={updateProduct} onRefresh={refreshProducts} />;
        }

        if (activeTab === 'dashboard') {
            return <CapriccioDashboard />;
        }
        if (activeTab === 'products') {
            return <ProductManager products={products} onUpdate={updateProduct} onRefresh={refreshProducts} />;
        }
        if (activeTab === 'users') {
            return <UserManager />;
        }
        if (activeTab === 'promos') {
            return <PromotionManager />;
        }
        if (activeTab === 'corte') {
            return <SettlementManager />;
        }
        if (activeTab === 'caja') {
            return <POSManager />;
        }
        if (activeTab === 'platform') {
            return <PlatformDashboard />;
        }
        if (activeTab === 'stats') {
            // Vista para roles caja y responsable
            if (userRole === 'caja' || userRole === 'responsable') {
                const ultimoCorteLabel = ultimoCorte
                    ? new Date(ultimoCorte).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
                    : 'Sin corte previo';
                return (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                            {/* Total recibidos hoy */}
                            <div className="bg-blue-600 p-6 rounded-[2.5rem] shadow-2xl shadow-blue-600/30 text-white relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-1000" />
                                <p className="text-[10px] uppercase font-black tracking-[0.3em] opacity-80 mb-2">Total Recibidos</p>
                                <h4 className="text-4xl font-black italic leading-none transition-all">${dailyRevenue.toLocaleString()}</h4>
                                <p className="text-[9px] opacity-60 mt-3 font-bold uppercase tracking-wider">{orderCount} pedidos hoy</p>
                            </div>

                            {/* Liquidados */}
                            <div className="bg-green-600 p-6 rounded-[2.5rem] shadow-2xl shadow-green-600/30 text-white relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-1000" />
                                <p className="text-[10px] uppercase font-black tracking-[0.3em] opacity-80 mb-2">Total Liquidados</p>
                                <h4 className="text-4xl font-black italic leading-none transition-all">${liquidatedRevenue.toLocaleString()}</h4>
                                <p className="text-[9px] opacity-60 mt-3 font-bold uppercase tracking-wider">Cobrado hoy</p>
                            </div>

                            {/* Pendiente por liquidar */}
                            <div className="bg-red-600 p-6 rounded-[2.5rem] shadow-2xl shadow-red-600/30 text-white relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-1000" />
                                <p className="text-[10px] uppercase font-black tracking-[0.3em] opacity-80 mb-2">Pendiente</p>
                                <h4 className="text-4xl font-black italic leading-none transition-all">${(dailyRevenue - liquidatedRevenue).toLocaleString()}</h4>
                                <p className="text-[9px] opacity-60 mt-3 font-bold uppercase tracking-wider">Por liquidar</p>
                            </div>

                            {/* Corte info + botón para responsable */}
                            <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-50 flex flex-col justify-between">
                                <div>
                                    <p className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-400 mb-2">Último Corte</p>
                                    <p className="text-2xl font-black italic text-slate-900 leading-none">{ultimoCorteLabel}</p>
                                </div>
                                {userRole === 'responsable' && (
                                    <button
                                        onClick={handleCorteTurno}
                                        disabled={doingCorte}
                                        className="mt-4 w-full bg-slate-900 hover:bg-black text-white py-4 rounded-2xl font-black italic uppercase text-xs tracking-widest transition-all shadow-xl active:scale-95 disabled:opacity-50"
                                    >
                                        {doingCorte ? 'Procesando...' : '⚡ Corte de Turno'}
                                    </button>
                                )}
                            </div>
                        </div>
                        <BasicOrdersList onStatusChange={fetchStats} />
                    </div>
                );
            }

            if (plan === 'basico') {
                return (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {/* Stats Summary Cards for Basic Plan */}
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                            <div className="bg-blue-600 p-6 rounded-[2.5rem] shadow-2xl shadow-blue-600/30 text-white relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-1000" />
                                <p className="text-[10px] uppercase font-black tracking-[0.3em] opacity-80 mb-2">Total Recibidos</p>
                                <h4 className="text-4xl font-black italic leading-none transition-all">${dailyRevenue.toLocaleString()}</h4>
                                <p className="text-[9px] opacity-60 mt-3 font-bold uppercase tracking-wider">{orderCount} pedidos hoy</p>
                            </div>

                            <div className="bg-green-600 p-6 rounded-[2.5rem] shadow-2xl shadow-green-600/30 text-white relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-1000" />
                                <p className="text-[10px] uppercase font-black tracking-[0.3em] opacity-80 mb-2">Total Liquidados</p>
                                <h4 className="text-4xl font-black italic leading-none transition-all">${liquidatedRevenue.toLocaleString()}</h4>
                                <p className="text-[9px] opacity-60 mt-3 font-bold uppercase tracking-wider">Cobrado hoy</p>
                            </div>

                            <div className="bg-red-600 p-6 rounded-[2.5rem] shadow-2xl shadow-red-600/30 text-white relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-1000" />
                                <p className="text-[10px] uppercase font-black tracking-[0.3em] opacity-80 mb-2">Pendiente</p>
                                <h4 className="text-4xl font-black italic leading-none transition-all">${(dailyRevenue - liquidatedRevenue).toLocaleString()}</h4>
                                <p className="text-[9px] opacity-60 mt-3 font-bold uppercase tracking-wider">Por liquidar</p>
                            </div>

                            <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-50 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-400 mb-2">Pedidos Hoy</p>
                                    <p className="text-4xl font-black italic text-slate-900 leading-none">{orderCount}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-400 mb-2">Plan</p>
                                    <span className="bg-slate-900 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest italic">Básico</span>
                                </div>
                            </div>
                        </div>

                        {/* Full Detailed Orders List */}
                        <BasicOrdersList onStatusChange={fetchStats} />
                    </div>
                );
            }

            return (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Main Chart */}
                        <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-[3rem] shadow-xl shadow-slate-200/50 border border-slate-50">
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="text-xl font-black uppercase italic tracking-wider">Flujo de Caja</h3>
                                <div className="flex items-center gap-2">
                                    <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">En Vivo</span>
                                </div>
                            </div>
                            <div className="h-[350px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData}>
                                        <XAxis
                                            dataKey="dia"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }}
                                            dy={10}
                                        />
                                        <YAxis hide />
                                        <Tooltip
                                            cursor={{ fill: '#f1f5f9', radius: 10 }}
                                            contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 50px -12px rgb(0 0 0 / 0.1)' }}
                                        />
                                        <Bar dataKey="ventas" radius={[10, 10, 10, 10]} barSize={40}>
                                            {chartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={index === 6 ? '#dc2626' : '#0f172a'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Stats Cards */}
                        <div className="space-y-6">
                            <div className="bg-red-600 p-8 rounded-[3rem] shadow-2xl shadow-red-600/30 text-white relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-1000" />
                                <p className="text-xs uppercase font-black tracking-[0.3em] opacity-80 mb-2">Ingresos del Día</p>
                                <h4 className="text-6xl font-black italic leading-none transition-all">
                                    ${dailyRevenue.toLocaleString()}
                                </h4>
                                <p className="text-[10px] font-black mt-6 flex items-center gap-2">
                                    <span className="bg-white/20 px-3 py-1 rounded-full tracking-widest uppercase">Actualización Instantánea</span>
                                </p>
                            </div>

                            <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-50">
                                <p className="text-xs uppercase font-black tracking-[0.2em] text-slate-400 mb-6">Eficiencia Operativa</p>
                                <div className="space-y-6">
                                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ticket Promedio</p>
                                        <p className="text-2xl font-black text-slate-900 italic">${orderCount > 0 ? (dailyRevenue / orderCount).toFixed(2) : 0}</p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pedidos Totales</p>
                                        <p className="text-2xl font-black text-slate-900 italic">{orderCount}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-slate-900 p-8 rounded-[3rem] shadow-2xl text-white">
                            <div className="flex justify-between items-center mb-8">
                                <p className="text-xs uppercase font-black tracking-[0.3em] text-slate-500 font-bold">Últimos Movimientos</p>
                                <span className="text-[10px] font-black bg-white/5 px-2 py-1 rounded-lg">LIVE</span>
                            </div>
                            <div className="space-y-4">
                                {recentOrders.length === 0 ? (
                                    <div className="p-12 text-center border-2 border-dashed border-white/5 rounded-[2rem]">
                                        <p className="text-slate-600 font-black italic text-sm uppercase tracking-widest">Esperando órdenes...</p>
                                    </div>
                                ) : (
                                    recentOrders.map((order, idx) => (
                                        <motion.div
                                            initial={{ x: -20, opacity: 0 }}
                                            animate={{ x: 0, opacity: 1 }}
                                            key={idx}
                                            className="flex justify-between items-center p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-all cursor-default"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center font-black text-xs text-yellow-400">#{String(order.id)?.split('-')[1] || String(order.id)?.slice(-4) || '---'}</div>
                                                <div>
                                                    <p className="text-sm font-black italic uppercase leading-none mb-1">{order.items?.[0]?.nombre || 'Pedido'} {order.items?.length > 1 && `+${order.items.length - 1}`}</p>
                                                    <p className="text-[10px] text-slate-500 font-bold tracking-widest">{formatTime(order.created_at || order.timestamp)}</p>
                                                </div>
                                            </div>
                                            <p className="text-yellow-400 font-black italic text-lg leading-none">${order.total}</p>
                                        </motion.div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="bg-white p-8 rounded-[3rem] border border-slate-50 shadow-xl flex flex-col justify-center items-center text-center">
                            <Flame className="text-red-600 mb-4" size={48} />
                            <h4 className="text-2xl font-black italic uppercase tracking-tighter mb-2">Monitor Alpha 1</h4>
                            <p className="text-slate-400 font-bold italic text-sm max-w-xs">{plan === 'basico' ? 'Plan Básico: Monitor de ventas activo.' : 'Plan Full: Canal de comunicación con cocina y reparto al 100%.'}</p>
                        </div>
                    </div>
                </div>
            );
        }

        if (activeTab === 'notifications') {
            return <PushManager />;
        }
        if (activeTab === 'reports') {
            return <ReportsModule />;
        }
        if (activeTab === 'settings') {
            return <SettingsModule />;
        }

        return (
            <div className="p-20 text-center">
                <p className="text-slate-300 font-black italic uppercase text-2xl">Módulo en Desarrollo</p>
            </div>
        );
    };

    return (
        <AdminLayout activeTab={activeTab} setActiveTab={setActiveTab} plan={plan}>
            <div className="animate-in fade-in duration-700">
                {renderContent()}
            </div>
        </AdminLayout>
    );
};

export default AdminDashboard;
