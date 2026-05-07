'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Lock, Loader2, User } from 'lucide-react';
import { API_URL } from '@/lib/socket';
import { cn } from '@/lib/utils';

interface ProtectedRouteProps {
    children: React.ReactNode;
    role: 'admin' | 'cocina' | 'repartidor';
}

export default function ProtectedRoute({ children, role }: ProtectedRouteProps) {
    const router = useRouter();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem(`capriccio_token_${role}`);
        if (!token) {
            setIsLoading(false);
            if (role === 'admin') router.replace('/admin/login');
            return;
        }

        // Validar el token con el servidor antes de dar acceso
        fetch(`${API_URL}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(async res => {
                if (res.ok) {
                    // Guardar siempre username y nombre para que los módulos lo lean al iniciar
                    try {
                        const data = await res.json();
                        const uname = (data.username || '').trim();
                        const nombre = (data.nombre || '').trim();
                        if (uname) localStorage.setItem('capriccio_username', uname);
                        if (role === 'repartidor') {
                            // Siempre actualizar — garantiza que el nombre quede guardado
                            const nombreRepartidor = nombre || uname;
                            if (nombreRepartidor) {
                                localStorage.setItem('capriccio_repartidor_nombre', nombreRepartidor);
                            }
                        }
                    } catch { /* ignorar si falla el parse */ }
                    setIsAuthenticated(true);
                } else {
                    // Token inválido o expirado → intentar renovar PRIMERO
                    try {
                        const refreshRes = await fetch(`${API_URL}/api/auth/refresh`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (refreshRes.ok) {
                            const data = await refreshRes.json();
                            localStorage.setItem(`capriccio_token_${role}`, data.token);
                            setIsAuthenticated(true);
                            return;
                        }
                    } catch { /* si refresh falla por red, caemos al else */ }
                    // Solo limpiar si el refresh también falló
                    localStorage.removeItem(`capriccio_token_${role}`);
                    localStorage.removeItem('capriccio_user_role');
                    localStorage.removeItem('capriccio_username');
                    if (role === 'admin') router.replace('/admin/login');
                }
            })
            .catch(() => {
                // Sin conexión: permitir acceso con token local para no bloquear operaciones
                setIsAuthenticated(true);
            })
            .finally(() => setIsLoading(false));
    }, [role, router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');

        const loginUser = username || role;

        try {
            const res = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: loginUser, password, role_request: role })
            });

            if (res.ok) {
                const data = await res.json();
                
                // Verificar si el plan permite este módulo
                if ((role === 'cocina' || role === 'repartidor') && data.plan === 'basico') {
                    setError('Tu plan actual no incluye este módulo.');
                    setIsSubmitting(false);
                    return;
                }

                localStorage.setItem(`capriccio_token_${role}`, data.token);
                localStorage.setItem(`capriccio_user_plan`, data.plan);
                localStorage.setItem(`capriccio_user_role`, data.role);
                localStorage.setItem(`capriccio_username`, data.username || '');
                localStorage.setItem(`capriccio_negocio_nombre`, data.negocio || 'Admin Demo');
                
                // Si es repartidor, guardamos su nombre para el socket
                if (role === 'repartidor') {
                    localStorage.setItem('capriccio_repartidor_nombre', data.nombre || username);
                }
                setIsAuthenticated(true);
            } else {
                setError('Credenciales inválidas');
            }
        } catch (err) {
            setError('Error de conexión');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-950"><Loader2 className="animate-spin text-capriccio-gold" size={40} /></div>;

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[3rem] p-10 w-full max-w-md shadow-2xl text-center">
                    <div className="w-20 h-20 bg-capriccio-gold rounded-3xl flex items-center justify-center mx-auto mb-6 text-slate-900 shadow-xl shadow-capriccio-gold/20">
                        {role === 'repartidor' ? <User size={40} strokeWidth={2.5} /> : <Lock size={40} strokeWidth={2.5} />}
                    </div>
                    <h2 className="text-3xl font-black italic tracking-tighter text-slate-900 mb-2">
                        {role === 'admin' ? 'Administración' : role === 'cocina' ? 'Cocina' : 'Repartidor'}
                    </h2>
                    <p className="text-slate-400 font-bold italic text-sm mb-8">
                        Ingresa tus credenciales para acceder al sistema.
                    </p>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <input
                            type="text"
                            placeholder={role === 'repartidor' ? "TU NOMBRE (Ej: Juan)" : "USUARIO"}
                            required
                            className="w-full bg-slate-50 text-slate-900 p-6 rounded-2xl font-black italic outline-none border-2 border-transparent focus:border-capriccio-gold focus:bg-white transition-all text-center placeholder:text-slate-300"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                        <input
                            type="password"
                            placeholder="CONTRASEÑA"
                            required
                            className="w-full bg-slate-50 text-slate-900 p-6 rounded-2xl font-black italic outline-none border-2 border-transparent focus:border-capriccio-gold focus:bg-white transition-all text-center placeholder:text-slate-300"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />

                        {error && <p className="text-red-500 font-bold text-xs uppercase bg-red-50 py-2 rounded-lg">{error}</p>}

                        <button disabled={isSubmitting} className="w-full bg-slate-950 text-white py-6 rounded-2xl font-black italic uppercase tracking-widest shadow-xl hover:bg-black transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 mt-4">
                            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : 'ENTRAR'}
                        </button>
                    </form>
                </motion.div>
            </div>
        );
    }

    return <>{children}</>;
}
