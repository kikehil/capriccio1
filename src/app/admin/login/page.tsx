'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Lock, Loader2 } from 'lucide-react';
import { API_URL } from '@/lib/socket';

export default function AdminLoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('capriccio_token_admin');
        if (!token) { setChecking(false); return; }

        fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
            .then(res => {
                if (res.ok) {
                    router.replace('/admin');
                } else {
                    localStorage.removeItem('capriccio_token_admin');
                    localStorage.removeItem('capriccio_user_role');
                    localStorage.removeItem('capriccio_username');
                    setChecking(false);
                }
            })
            .catch(() => {
                // Sin conexión: si hay token, dejar pasar
                router.replace('/admin');
            });
    }, [router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');

        try {
            const res = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, role_request: 'admin' }),
            });

            if (res.ok) {
                const data = await res.json();
                localStorage.setItem('capriccio_token_admin', data.token);
                localStorage.setItem('capriccio_user_plan', data.plan);
                localStorage.setItem('capriccio_user_role', data.role);
                localStorage.setItem('capriccio_username', data.username || '');
                localStorage.setItem('capriccio_negocio_nombre', data.negocio || 'Admin Demo');
                router.replace('/admin');
            } else {
                setError('Usuario o contraseña incorrectos');
            }
        } catch {
            setError('Error de conexión. Intenta de nuevo.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (checking) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950">
                <Loader2 className="animate-spin text-capriccio-gold" size={40} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-[3rem] p-10 w-full max-w-md shadow-2xl text-center"
            >
                <div className="w-20 h-20 bg-capriccio-gold rounded-3xl flex items-center justify-center mx-auto mb-6 text-slate-900 shadow-xl shadow-capriccio-gold/20">
                    <Lock size={40} strokeWidth={2.5} />
                </div>

                <img src="/logohd.png" alt="Capriccio" className="h-14 mx-auto mb-4 object-contain" />

                <h2 className="text-3xl font-black italic tracking-tighter text-slate-900 mb-1">
                    Administración
                </h2>
                <p className="text-slate-400 font-bold italic text-sm mb-8">
                    Ingresa tus credenciales para acceder al sistema.
                </p>

                <form onSubmit={handleLogin} className="space-y-4">
                    <input
                        type="text"
                        placeholder="USUARIO"
                        required
                        autoFocus
                        className="w-full bg-slate-50 text-slate-900 p-6 rounded-2xl font-black italic outline-none border-2 border-transparent focus:border-capriccio-gold focus:bg-white transition-all text-center placeholder:text-slate-300"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                    />
                    <input
                        type="password"
                        placeholder="CONTRASEÑA"
                        required
                        className="w-full bg-slate-50 text-slate-900 p-6 rounded-2xl font-black italic outline-none border-2 border-transparent focus:border-capriccio-gold focus:bg-white transition-all text-center placeholder:text-slate-300"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                    />

                    {error && (
                        <p className="text-red-500 font-bold text-xs uppercase bg-red-50 py-2 rounded-lg">
                            {error}
                        </p>
                    )}

                    <button
                        disabled={isSubmitting}
                        className="w-full bg-slate-950 text-white py-6 rounded-2xl font-black italic uppercase tracking-widest shadow-xl hover:bg-black transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
                    >
                        {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : 'ENTRAR'}
                    </button>
                </form>
            </motion.div>
        </div>
    );
}
