'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Heart, MessageCircle, Share2, ExternalLink, Facebook } from 'lucide-react';
import { API_URL } from '@/lib/socket';

interface FBPost {
    id: string;
    message: string;
    full_picture: string | null;
    created_time: string;
    permalink_url: string;
}

const MOCK_POSTS: FBPost[] = [
    {
        id: '1',
        message: '🍕 ¡Nueva pizza en el menú! Probaste nuestra HAWAIANA ESPECIAL con jamón artesanal, piña natural y queso extra derretido. Disponible toda la semana. ¡Pide la tuya ahora!',
        full_picture: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80',
        created_time: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        permalink_url: 'https://www.facebook.com',
    },
    {
        id: '2',
        message: '🔥 PROMOCIÓN DE VIERNES\n2 pizzas medianas + refresco 2L = $199\nSolo válido hoy viernes. Pide en línea o llama. ¡No te quedes sin la tuya! 🍕❤️',
        full_picture: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&q=80',
        created_time: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        permalink_url: 'https://www.facebook.com',
    },
    {
        id: '3',
        message: '✨ Gracias por su preferencia. ¡Los queremos mucho! Recuerden que tenemos servicio de lunes a domingo 10am a 10pm. 🙏',
        full_picture: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&q=80',
        created_time: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        permalink_url: 'https://www.facebook.com',
    },
];

function timeAgo(iso: string) {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 3600)  return `Hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
    if (diff < 604800) return `Hace ${Math.floor(diff / 86400)} días`;
    return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

function PostCard({ post, index }: { post: FBPost; index: number }) {
    const [liked, setLiked] = useState(false);
    const lines = post.message.split('\n');

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1, duration: 0.5 }}
            className="bg-[#0f172a] border border-white/5 rounded-[2rem] overflow-hidden hover:border-capriccio-gold/20 transition-all duration-300 group"
        >
            {post.full_picture && (
                <div className="relative aspect-[4/3] overflow-hidden">
                    <img
                        src={post.full_picture}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-transparent to-transparent" />
                </div>
            )}

            <div className="p-5">
                <div className="text-slate-300 text-sm font-medium leading-relaxed mb-4 space-y-1">
                    {lines.map((line, i) => (
                        <p key={i}>{line}</p>
                    ))}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setLiked(v => !v)}
                            className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${liked ? 'text-red-400' : 'text-slate-500 hover:text-red-400'}`}
                        >
                            <Heart size={14} fill={liked ? 'currentColor' : 'none'} />
                        </button>
                        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                            <MessageCircle size={14} />
                        </span>
                        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                            <Share2 size={14} />
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-[10px] text-slate-600 font-bold">{timeAgo(post.created_time)}</span>
                        <a
                            href={post.permalink_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-capriccio-gold hover:text-yellow-400 transition-colors"
                        >
                            <ExternalLink size={13} />
                        </a>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

export default function FacebookFeed() {
    const [posts, setPosts] = useState<FBPost[]>([]);
    const [isReal, setIsReal] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${API_URL}/api/facebook/posts`)
            .then(r => r.json())
            .then(data => {
                if (data.posts && data.posts.length > 0) {
                    setPosts(data.posts);
                    setIsReal(true);
                } else {
                    setPosts(MOCK_POSTS);
                }
            })
            .catch(() => setPosts(MOCK_POSTS))
            .finally(() => setLoading(false));
    }, []);

    const displayPosts = loading ? [] : posts;

    return (
        <section className="py-20 bg-slate-950">
            <div className="container mx-auto px-6">

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-12">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 bg-[#1877F2] rounded-xl flex items-center justify-center shrink-0">
                                <Facebook size={16} className="text-white" fill="white" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Síguenos</span>
                        </div>
                        <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white leading-none">
                            Lo Último de <span className="text-capriccio-gold">Capriccio</span>
                        </h2>
                        <p className="text-slate-500 text-sm font-bold mt-2">Promos, novedades y más directo desde nuestro Facebook</p>
                    </div>
                    <a
                        href="https://www.facebook.com/pizzeriacapriccio"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 bg-[#1877F2]/10 hover:bg-[#1877F2]/20 border border-[#1877F2]/30 text-[#1877F2] px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all whitespace-nowrap"
                    >
                        <Facebook size={14} fill="currentColor" />
                        Ver página
                    </a>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1,2,3].map(i => (
                            <div key={i} className="bg-[#0f172a] border border-white/5 rounded-[2rem] h-72 animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {displayPosts.map((post, i) => (
                            <PostCard key={post.id} post={post} index={i} />
                        ))}
                    </div>
                )}

                {!isReal && !loading && (
                    <div className="mt-8 flex justify-center">
                        <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full">
                            Vista previa — conectar con Facebook para ver posts reales
                        </span>
                    </div>
                )}

            </div>
        </section>
    );
}
