'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { Pizza } from '@/data/menu';
import { cn } from '@/lib/utils';
import { ExtraOption } from '@/data/options';

// Opciones de tamaños fijadas por el requerimiento
const SIZE_OPTIONS = [
    { id: 'mini', label: 'Mini', price: 50 },
    { id: 'chica', label: 'Chica', price: 65 },
    { id: 'mediana', label: 'Mediana', price: 195 },
    { id: 'grande', label: 'Grande', price: 255 }
];

// Opciones de Orillas — fallback hardcodeado (se sobreescribe con datos de la API via pizzasList)
const DEFAULT_CRUST_OPTIONS = [
    { id: 'normal',  label: 'Sin Orilla Rellena',         prices: { chica: 0,  mediana: 0,  grande: 0,  jumbo: 0  } as Record<string, number> },
    { id: 'rellena', label: '🧀 Orilla Rellena de Queso', prices: { chica: 10, mediana: 25, grande: 35, jumbo: 50 } as Record<string, number> },
    { id: 'dedos',   label: '🥖 Orilla Dedos de Queso',   prices: { chica: 0,  mediana: 35, grande: 45, jumbo: 65 } as Record<string, number> },
];

const getCrustPrice = (crust: { prices: Record<string, number> }, sizeId: string): number =>
    crust.prices[sizeId] ?? 0;

export interface ProductModalProps {
    pizza: Pizza | null;
    isOpen: boolean;
    onClose: () => void;
    // Updated signature: passing size and crust
    onConfirm: (pizza: Pizza, selectedSizeInfo: any, selectedCrustInfo: any, finalPrice: number) => void;
    pizzasList?: Pizza[];
}

const ProductModal: React.FC<ProductModalProps> = ({ pizza, isOpen, onClose, onConfirm, pizzasList = [] }) => {
    const availableSizes = React.useMemo(() => {
        if (!pizza) return SIZE_OPTIONS;
        
        const isPizzaCategory = pizza.categoria?.toLowerCase().includes('pizza');
        
        if (pizza.precios && Object.keys(pizza.precios).length > 0) {
            const sizes = [];
            if (pizza.precios.mini) sizes.push({ id: 'mini', label: 'Mini', price: pizza.precios.mini });
            if (pizza.precios.chica) sizes.push({ id: 'chica', label: 'Chica', price: pizza.precios.chica });
            if (pizza.precios.mediana) sizes.push({ id: 'mediana', label: 'Mediana', price: pizza.precios.mediana });
            if (pizza.precios.grande) sizes.push({ id: 'grande', label: 'Grande', price: pizza.precios.grande });
            if (pizza.precios.jumbo) sizes.push({ id: 'jumbo', label: 'Jumbo', price: pizza.precios.jumbo });
            return sizes.length > 0 ? sizes : (isPizzaCategory ? SIZE_OPTIONS : [{ id: 'unica', label: 'Unico', price: pizza.precio || 0 }]);
        }
        
        if (isPizzaCategory) {
            return SIZE_OPTIONS;
        }
        
        return [{ id: 'unica', label: 'Unico', price: pizza.precio || 0 }];
    }, [pizza]);

    // Build crust options dynamically from pizzasList (products with "Orilla" category)
    const CRUST_OPTIONS = React.useMemo(() => {
        const orillas = pizzasList.filter(p =>
            p.categoria?.toLowerCase().includes('orilla')
        );
        if (orillas.length > 0) {
            const dynamic = orillas.map(p => ({
                id: (p.descripcion?.trim() || p.nombre.toLowerCase().replace(/[^a-z0-9]/g, '-')),
                label: p.nombre,
                prices: (typeof p.precios === 'object' && p.precios ? p.precios : {}) as Record<string, number>,
            }));
            if (!dynamic.find(c => c.id === 'normal' || c.label.toLowerCase().includes('sin'))) {
                dynamic.unshift({ id: 'normal', label: 'Sin Orilla Rellena', prices: { chica: 0, mediana: 0, grande: 0, jumbo: 0 } });
            }
            return dynamic;
        }
        return DEFAULT_CRUST_OPTIONS;
    }, [pizzasList]);

    const [selectedSize, setSelectedSize] = useState(availableSizes.find(s => s.id === 'mediana') || availableSizes[0] || SIZE_OPTIONS[2]);
    const [selectedCrust, setSelectedCrust] = useState(CRUST_OPTIONS[0]); // Default Sin Orilla

    const isJumbo = pizza?.nombre?.toLowerCase().trim() === 'jumbo';
    const [numEspecialidades, setNumEspecialidades] = useState(1);
    
    const especialidadesDisponibles = React.useMemo(() => {
        return pizzasList.filter(p => !p.nombre.toLowerCase().includes('jumbo') && p.categoria.includes("Pizza"));
    }, [pizzasList]);

    const defaultEspecialidad = especialidadesDisponibles.length > 0 ? especialidadesDisponibles[0].nombre : "";
    const [selectedEspecialidades, setSelectedEspecialidades] = useState<string[]>([defaultEspecialidad, defaultEspecialidad, defaultEspecialidad, defaultEspecialidad]);
    
    // Mitad y mitad variables
    const [isMitadYMitad, setIsMitadYMitad] = useState(false);
    const [segundaMitad, setSegundaMitad] = useState("");
    // Nota adicional y salsa
    const [notaAdicional, setNotaAdicional] = useState('');
    const [selectedSauce, setSelectedSauce] = useState('');

    const SAUCE_OPTIONS = ['BBQ', 'Hot BBQ', 'Mango Habanero', 'Búfalo', 'Ranch Habanero', 'Tamarindo'];
    const needsSauce = pizza?.categoria?.toLowerCase().includes('hamburguesa') ||
        pizza?.nombre?.toLowerCase().includes('boneless');

    useEffect(() => {
        if (isOpen && availableSizes.length > 0) {
            const defaultSize = availableSizes.find(s => s.id === 'mediana') || availableSizes[0];
            setSelectedSize(defaultSize);
            setSelectedCrust(prev => CRUST_OPTIONS.find(c => c.id === prev.id) || CRUST_OPTIONS[0]);
            setNumEspecialidades(1);
            setSelectedEspecialidades([defaultEspecialidad, defaultEspecialidad, defaultEspecialidad, defaultEspecialidad]);
            setIsMitadYMitad(false);
            setSegundaMitad("");
            setNotaAdicional('');
            setSelectedSauce('');
        }
    }, [isOpen, pizza, availableSizes, defaultEspecialidad]);

    if (!pizza) return null;

    // Solo mostrar orillas si es Pizza y de tamaño mediano o grande
    const isPizzaCategory = pizza.categoria?.toLowerCase().includes('pizza');
    const showCrustOptions = isPizzaCategory && (selectedSize?.id === 'chica' || selectedSize?.id === 'mediana' || selectedSize?.id === 'grande' || selectedSize?.id === 'jumbo');
    const canHalfAndHalf = !isJumbo && isPizzaCategory && (selectedSize?.id === 'mediana' || selectedSize?.id === 'grande');

    const appliedCrust = showCrustOptions ? selectedCrust : CRUST_OPTIONS[0];
    const appliedCrustPrice = getCrustPrice(appliedCrust, selectedSize?.id || 'mediana');

    // Precio Jumbo: siempre fijo (315) sin importar cuántas especialidades se elijan
    const jumboBasePrice = pizza.precio || selectedSize?.price || 0;

    // Precio mitad y mitad: se cobra el más alto de las dos especialidades
    const segundaMitadPizza = isMitadYMitad && segundaMitad
        ? especialidadesDisponibles.find(p => p.nombre === segundaMitad)
        : null;
    const primeraMitadPrice = selectedSize?.price || 0;
    const segundaMitadPrice = segundaMitadPizza?.precios?.[selectedSize?.id as keyof typeof segundaMitadPizza.precios]
        ? Number(segundaMitadPizza.precios[selectedSize?.id as keyof typeof segundaMitadPizza.precios])
        : primeraMitadPrice;
    const mitadBasePrice = isMitadYMitad && segundaMitad
        ? Math.max(primeraMitadPrice, segundaMitadPrice)
        : primeraMitadPrice;

    // Si es Jumbo → precio fijo de la pizza; si no → lógica de mitad/tamaño
    const basePrice = isJumbo ? jumboBasePrice : mitadBasePrice;
    const finalPrice = basePrice + appliedCrustPrice;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="relative bg-capriccio-dark rounded-[2rem] w-full max-w-3xl overflow-hidden shadow-[0_0_50px_rgba(250,204,21,0.1)] flex flex-col md:flex-row max-h-[90vh]"
                    >
                        {/* Image Section */}
                        <div className="relative w-full md:w-1/2 h-56 md:h-auto bg-black overflow-hidden shrink-0">
                            <img
                                src={pizza.imagen}
                                alt={pizza.nombre}
                                className="w-full h-full object-cover opacity-90 transition-transform duration-700 hover:scale-110"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-capriccio-dark via-capriccio-dark/80 to-transparent md:to-transparent" />
                            
                            <div className="absolute top-4 left-4 z-10">
                                <span className="bg-capriccio-card/80 backdrop-blur-md text-capriccio-gold px-3 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase border border-white/5">
                                    {pizza.categoria}
                                </span>
                            </div>

                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full transition-all md:hidden z-10"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            
                            <div className="absolute bottom-6 left-6 text-white md:hidden">
                                <h4 className="text-3xl font-title font-black italic uppercase leading-none text-white">{pizza.nombre}</h4>
                                <p className="text-sm text-gray-400 mt-2 line-clamp-2">{pizza.descripcion}</p>
                            </div>
                        </div>

                        {/* Content Section */}
                        <div className="flex-1 flex flex-col min-h-0 bg-capriccio-card">
                            <div className="p-6 pb-2 hidden md:flex justify-between items-start">
                                <div>
                                    <h2 className="text-3xl font-title font-black text-white italic uppercase leading-tight tracking-tighter mb-1">
                                        {pizza.nombre}
                                    </h2>
                                    <p className="text-gray-400 text-sm leading-relaxed">{pizza.descripcion}</p>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 ml-4 bg-white/5 hover:bg-white/10 rounded-full transition-all text-gray-400 hover:text-white shrink-0"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto space-y-8 scrollbar-hide">
                                {/* Size Selection or Jumbo Selection */}
                                {isJumbo ? (
                                    <div>
                                        <h4 className="text-xs font-black text-capriccio-gold uppercase tracking-[0.2em] mb-4">Elige de 1 a 4 Especialidades para tu pizza</h4>
                                        <div className="flex flex-col gap-4">
                                            <div className="flex gap-2">
                                                {[1, 2, 3, 4].map(num => (
                                                    <button
                                                        key={num}
                                                        onClick={() => setNumEspecialidades(num)}
                                                        className={cn(
                                                            "flex-1 py-2 rounded-xl font-black italic text-sm transition-all border",
                                                            num === numEspecialidades
                                                                ? "bg-capriccio-gold text-capriccio-dark border-capriccio-gold shadow-[0_0_15px_rgba(250,204,21,0.3)]"
                                                                : "bg-white/5 text-gray-300 border-white/10 hover:border-capriccio-gold/50"
                                                        )}
                                                    >
                                                        {num} {num === 1 ? 'Esp.' : 'Esp.'}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                {Array.from({ length: numEspecialidades }).map((_, index) => (
                                                    <div key={index} className="flex items-center gap-3">
                                                        <span className="text-capriccio-gold font-black text-sm w-4">{index + 1}.</span>
                                                        <select
                                                            value={selectedEspecialidades[index] || ""}
                                                            onChange={(e) => {
                                                                const newEspecialidades = [...selectedEspecialidades];
                                                                newEspecialidades[index] = e.target.value;
                                                                setSelectedEspecialidades(newEspecialidades);
                                                            }}
                                                            className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-capriccio-gold transition-colors font-medium text-sm appearance-none"
                                                        >
                                                            {especialidadesDisponibles.map(esp => (
                                                                <option key={esp.id} value={esp.nombre} className="bg-capriccio-dark text-white">
                                                                    {esp.nombre}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <h4 className="text-xs font-black text-capriccio-gold uppercase tracking-[0.2em] mb-4">
                                            {availableSizes.length > 1 ? "Selecciona el Tamaño" : "Confirmar Selección"}
                                        </h4>
                                        <div className="flex flex-wrap gap-3">
                                            {availableSizes.map(size => (
                                                <button
                                                    key={size.id}
                                                    onClick={() => setSelectedSize(size)}
                                                    className={cn(
                                                        "px-5 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border",
                                                        selectedSize?.id === size.id
                                                            ? "bg-capriccio-gold text-capriccio-dark border-capriccio-gold shadow-[0_0_15px_rgba(250,204,21,0.3)]"
                                                            : "bg-white/5 text-gray-300 border-white/10 hover:border-capriccio-gold/50 hover:bg-white/10"
                                                    )}
                                                >
                                                    <span>{size.label}</span>
                                                    <span className={cn(
                                                        "text-xs px-2 py-0.5 rounded-full ml-1 font-black",
                                                        selectedSize?.id === size.id ? "bg-black/20 text-black" : "bg-black/40 text-gray-400"
                                                    )}>${size.price}</span>
                                                </button>
                                            ))}
                                        </div>
                                        
                                        {canHalfAndHalf && (
                                            <div className="mt-6 border-t border-white/10 pt-6">
                                                <h4 className="text-xs font-black text-capriccio-gold uppercase tracking-[0.2em] mb-4">¿Mitad y Mitad?</h4>
                                                <div 
                                                    className="flex items-center gap-4 cursor-pointer group"
                                                    onClick={() => {
                                                        const newVal = !isMitadYMitad;
                                                        setIsMitadYMitad(newVal);
                                                        // Fallback si no tiene segunda mitad
                                                        if (newVal && !segundaMitad) {
                                                            const options = especialidadesDisponibles.filter(e => e.nombre !== pizza.nombre);
                                                            if (options.length > 0) {
                                                                setSegundaMitad(options[0].nombre);
                                                            }
                                                        }
                                                    }}
                                                >
                                                    <div className={cn(
                                                        "w-6 h-6 rounded-md border flex items-center justify-center transition-all",
                                                        isMitadYMitad ? "bg-capriccio-gold border-capriccio-gold" : "border-gray-500 bg-black/20 group-hover:border-capriccio-gold/50"
                                                    )}>
                                                        {isMitadYMitad && <Check className="w-4 h-4 text-capriccio-dark stroke-[4px]" />}
                                                    </div>
                                                    <span className="text-sm font-bold text-gray-300 select-none leading-tight">
                                                        Quiero mi pizza Mitad {pizza.nombre} y Mitad otra especialidad
                                                    </span>
                                                </div>
                                                
                                                <AnimatePresence>
                                                    {isMitadYMitad && (
                                                        <motion.div
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: 'auto' }}
                                                            exit={{ opacity: 0, height: 0 }}
                                                            className="overflow-hidden mt-4 pl-[40px]"
                                                        >
                                                            <div className="flex flex-col gap-2">
                                                                <span className="text-capriccio-gold font-black text-xs uppercase tracking-widest whitespace-nowrap">Selecciona la 2da Mitad:</span>
                                                                <select
                                                                    value={segundaMitad}
                                                                    onChange={(e) => setSegundaMitad(e.target.value)}
                                                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-capriccio-gold transition-colors font-medium text-sm appearance-none"
                                                                >
                                                                    {especialidadesDisponibles.filter(e => e.nombre !== pizza.nombre).map((esp, i) => (
                                                                        <option key={i} value={esp.nombre} className="bg-capriccio-dark text-white">
                                                                            {esp.nombre}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Crust Selection (Up-selling) */}
                                <AnimatePresence mode="popLayout">
                                    {showCrustOptions && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <h4 className="text-xs font-black text-capriccio-gold uppercase tracking-[0.2em] mb-4">¡Mejora tu pizza!</h4>
                                            <div className="space-y-3">
                                                {CRUST_OPTIONS.filter(crust =>
                                                    crust.id === 'normal' || getCrustPrice(crust, selectedSize?.id || 'mediana') > 0
                                                ).map(crust => {
                                                    const crustPrice = getCrustPrice(crust, selectedSize?.id || 'mediana');
                                                    return (
                                                    <div
                                                        key={crust.id}
                                                        onClick={() => setSelectedCrust(crust)}
                                                        className={cn(
                                                            "flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all duration-300",
                                                            selectedCrust.id === crust.id
                                                                ? "border-capriccio-gold bg-capriccio-gold/10"
                                                                : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className={cn(
                                                                "w-5 h-5 rounded-md border flex items-center justify-center transition-all",
                                                                selectedCrust.id === crust.id ? "bg-capriccio-gold border-capriccio-gold" : "border-gray-500 bg-black/20"
                                                            )}>
                                                                {selectedCrust.id === crust.id && <Check className="w-3.5 h-3.5 text-capriccio-dark stroke-[4px]" />}
                                                            </div>
                                                            <span className={cn(
                                                                "font-medium text-sm transition-colors",
                                                                selectedCrust.id === crust.id ? "text-white" : "text-gray-300"
                                                            )}>{crust.label}</span>
                                                        </div>
                                                        {crustPrice > 0 && (
                                                            <span className={cn(
                                                                "font-black text-sm",
                                                                selectedCrust.id === crust.id ? "text-capriccio-gold" : "text-gray-400"
                                                            )}>+${crustPrice}</span>
                                                        )}
                                                    </div>
                                                    );
                                                })}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Selector de salsa (hamburguesas/boneless) — dentro del área scrollable */}
                                {needsSauce && (
                                    <div>
                                        <h4 className="text-xs font-black text-capriccio-gold uppercase tracking-[0.2em] mb-3">🥣 Tipo de Salsa</h4>
                                        <div className="grid grid-cols-3 gap-2">
                                            {SAUCE_OPTIONS.map(s => (
                                                <button key={s} type="button" onClick={() => setSelectedSauce(s)}
                                                    className={cn("py-2 px-2 rounded-xl border-2 text-xs font-bold transition-all",
                                                        selectedSauce === s
                                                            ? "border-capriccio-gold bg-capriccio-gold/15 text-white"
                                                            : "border-white/10 bg-black/20 text-gray-400 hover:border-white/20")}>
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Nota adicional — dentro del área scrollable */}
                                <div>
                                    <h4 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mb-2">📝 Nota adicional (opcional)</h4>
                                    <input type="text" placeholder="Ej: sin cebolla, extra jalapeño..."
                                        value={notaAdicional}
                                        onChange={e => setNotaAdicional(e.target.value)}
                                        className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white text-sm font-bold placeholder-gray-600 outline-none focus:border-capriccio-gold/50 transition-colors"
                                    />
                                </div>
                            </div>

                            {/* Sticky Footer */}
                            <div className="p-6 bg-capriccio-dark border-t border-white/5 flex items-center gap-6 mt-auto">
                                <div className="flex flex-col shrink-0">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Total a Pagar</span>
                                    <span className="text-3xl font-black text-white italic leading-none">${finalPrice}</span>
                                </div>
                                <button
                                    onClick={() => {
                                        let finalSizeItem: any = { ...selectedSize };
                                        if (isJumbo) {
                                            const activeEspecialidades = selectedEspecialidades.slice(0, numEspecialidades).join(", ");
                                            finalSizeItem.label = `Jumbo (${numEspecialidades} Esp: ${activeEspecialidades})`;
                                            finalSizeItem.id = `jumbo-${numEspecialidades}-${activeEspecialidades.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)}`;
                                        } else if (canHalfAndHalf && isMitadYMitad && segundaMitad) {
                                            finalSizeItem.label = `${selectedSize?.label || ''} (Mitad ${pizza.nombre}, Mitad ${segundaMitad})`;
                                            finalSizeItem.id = `${selectedSize?.id || 'id'}-mitad-${segundaMitad.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)}`;
                                        }
                                        if (notaAdicional.trim()) finalSizeItem.nota = notaAdicional.trim();
                                        if (selectedSauce) finalSizeItem.sauce = selectedSauce;
                                        onConfirm(pizza, finalSizeItem, appliedCrust, finalPrice);
                                    }}
                                    className="flex-1 bg-capriccio-gold text-capriccio-dark py-4 rounded-xl font-black text-lg uppercase tracking-widest shadow-[var(--shadow-neon-yellow)] hover:bg-yellow-400 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
                                >
                                    AGREGAR
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default ProductModal;
