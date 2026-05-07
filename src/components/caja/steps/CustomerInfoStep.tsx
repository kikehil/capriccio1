'use client';

import React, { useState, useCallback } from 'react';
import { CajaTurno } from '@/data/caja-types';
import { API_URL } from '@/lib/socket';

interface StepProps {
  formData: any;
  updateFormData: (data: any) => void;
  turno: CajaTurno;
  onNext: () => void;
  onPrev: () => void;
}

type LookupState = 'idle' | 'searching' | 'found' | 'new';

interface FoundCustomer {
  cliente_nombre: string;
  telefono: string;
  direccion?: string;
  referencias?: string;
  pedidos_count: number;
  last_order_date?: string;
  source?: string;
}

const CustomerInfoStep: React.FC<StepProps> = ({
  formData,
  updateFormData,
  turno,
  onNext,
  onPrev,
}) => {
  const [lookupState, setLookupState] = useState<LookupState>('idle');
  const [foundCustomer, setFoundCustomer] = useState<FoundCustomer | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [addressMode, setAddressMode] = useState<'manual' | 'gps'>('manual');
  const [isLocating, setIsLocating] = useState(false);
  const [calleNumero, setCalleNumero] = useState(formData.calleNumero || '');
  const [colonia, setColonia] = useState(formData.colonia || '');
  const [entreCalles, setEntreCalles] = useState(formData.entreCalles || '');

  const isDomicilio = formData.metodo_entrega === 'domicilio';

  /* ── Phone lookup ───────────────────────────────────── */
  const lookupPhone = useCallback(async (digits: string) => {
    setLookupState('searching');
    try {
      const token = localStorage.getItem('capriccio_token_caja');
      const res = await fetch(
        `${API_URL}/api/caja/buscar-cliente?telefono=${encodeURIComponent(digits)}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data.found) {
        setFoundCustomer(data);
        setLookupState('found');
        setIsEditing(false);
        updateFormData({
          cliente_nombre: data.cliente_nombre || '',
          telefono: digits,
          direccion: data.direccion || '',
          referencias: data.referencias || '',
        });
        if (data.calleNumero) setCalleNumero(data.calleNumero);
        if (data.colonia) setColonia(data.colonia);
      } else {
        setFoundCustomer(null);
        setLookupState('new');
        updateFormData({ cliente_nombre: '', direccion: '', referencias: '' });
      }
    } catch {
      setFoundCustomer(null);
      setLookupState('new');
    }
  }, [updateFormData]);

  /* ── Phone input handler ────────────────────────────── */
  const handlePhoneChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    updateFormData({ telefono: digits });
    if (digits.length === 10) {
      lookupPhone(digits);
    } else {
      setLookupState('idle');
      setFoundCustomer(null);
      setIsEditing(false);
    }
  };

  /* ── Generic field change ───────────────────────────── */
  const handleChange = (field: string, value: string) => {
    updateFormData({ [field]: value });
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  /* ── GPS locate ─────────────────────────────────────── */
  const handleLocate = () => {
    if (!navigator.geolocation) { alert('Geolocalización no soportada'); return; }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`
          );
          const data = await res.json();
          updateFormData({ direccion: data.display_name });
        } catch { alert('No se pudo obtener la dirección.'); }
        finally { setIsLocating(false); }
      },
      () => { setIsLocating(false); alert('No se pudo obtener ubicación.'); },
      { enableHighAccuracy: true }
    );
  };

  /* ── Validation ─────────────────────────────────────── */
  const validate = () => {
    const errs: Record<string, string> = {};
    if (!formData.cliente_nombre?.trim()) errs.cliente_nombre = 'El nombre es requerido';
    if (!formData.telefono?.trim()) errs.telefono = 'El teléfono es requerido';
    if (isDomicilio) {
      // Si el cliente fue encontrado (y no está editando), formData.direccion ya viene
      // poblado desde la BD — omitir validación de calleNumero en ese caso.
      const hasFullAddress = !!formData.direccion?.trim();
      if (addressMode === 'manual' && !calleNumero.trim() && !hasFullAddress)
        errs.direccion = 'La calle es requerida';
      if (addressMode === 'gps' && !formData.direccion?.trim())
        errs.direccion = 'La dirección es requerida';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /* ── Next step handler ──────────────────────────────── */
  const handleNext = () => {
    if (!validate()) return;
    if (isDomicilio && addressMode === 'manual') {
      const parts = [
        calleNumero,
        colonia && `Col. ${colonia}`,
        entreCalles && `Entre: ${entreCalles}`,
      ].filter(Boolean);
      updateFormData({ direccion: parts.join(', '), calleNumero, colonia, entreCalles });
    }
    onNext();
  };

  const showFormFields = lookupState === 'new' || isEditing || lookupState === 'idle';

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-black text-gray-900">Datos del Cliente</h2>
        <p className="text-sm text-gray-500 mt-1">El teléfono busca clientes anteriores automáticamente</p>
      </div>

      {/* ── PHONE LOOKUP CARD ──────────────────────────── */}
      <div className="bg-white border-2 border-gray-200 rounded-2xl p-5 shadow-sm">
        <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2.5">
          📞 Número de teléfono *
        </label>
        <input
          type="tel"
          value={formData.telefono || ''}
          onChange={e => handlePhoneChange(e.target.value)}
          className={`w-full px-4 py-4 text-2xl sm:text-3xl font-bold tracking-widest border-2 rounded-xl outline-none transition bg-white text-gray-900 ${
            errors.telefono ? 'border-red-500' : 'border-gray-300 focus:border-red-600 focus:shadow-[0_0_0_3px_rgba(220,38,38,0.12)]'
          }`}
          placeholder="833 000 0000"
          maxLength={10}
          autoFocus
          inputMode="numeric"
        />
        <p className="text-xs text-gray-400 font-semibold mt-2">Ingresa 10 dígitos para buscar el cliente</p>
        {errors.telefono && <p className="text-red-600 text-xs mt-1 font-semibold">{errors.telefono}</p>}

        {/* Searching spinner */}
        {lookupState === 'searching' && (
          <div className="mt-3 flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
            <div className="w-5 h-5 border-[3px] border-gray-200 border-t-red-600 rounded-full animate-spin flex-shrink-0" />
            <p className="text-sm font-semibold text-gray-600">Buscando cliente en la base de datos...</p>
          </div>
        )}

        {/* Customer FOUND */}
        {lookupState === 'found' && foundCustomer && !isEditing && (
          <div className="mt-3 border-2 border-green-400 rounded-xl overflow-hidden">
            <div className="bg-green-500 text-white px-4 py-2.5 flex items-center gap-2">
              <span className="text-base leading-none">✅</span>
              <span className="font-black text-sm">¡Cliente encontrado! — Datos cargados automáticamente</span>
            </div>
            <div className="p-4 bg-green-50 space-y-2.5">
              <div className="flex items-start gap-3">
                <span className="text-xl leading-none flex-shrink-0">👤</span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Nombre</p>
                  <p className="font-black text-base text-gray-900">{foundCustomer.cliente_nombre}</p>
                </div>
              </div>
              {foundCustomer.direccion && (
                <div className="flex items-start gap-3">
                  <span className="text-xl leading-none flex-shrink-0">📍</span>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Dirección</p>
                    <p className="font-semibold text-sm text-gray-800">{foundCustomer.direccion}</p>
                  </div>
                </div>
              )}
              {foundCustomer.referencias && (
                <div className="flex items-start gap-3">
                  <span className="text-xl leading-none flex-shrink-0">🏷️</span>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Referencia</p>
                    <p className="font-semibold text-sm text-gray-800">{foundCustomer.referencias}</p>
                  </div>
                </div>
              )}
              <p className="text-xs font-bold text-green-600 pt-1">
                🛒 {foundCustomer.pedidos_count} pedido{foundCustomer.pedidos_count !== 1 ? 's' : ''} anteriores
                {foundCustomer.source === 'portal' && ' · Registrado en el portal'}
              </p>
            </div>
            <div className="flex gap-2 p-3 bg-white border-t border-green-100">
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition"
              >
                ✏️ Editar datos
              </button>
              <button
                onClick={handleNext}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-sm transition active:scale-95"
              >
                Confirmar y continuar →
              </button>
            </div>
          </div>
        )}

        {/* NEW customer notice */}
        {lookupState === 'new' && (
          <div className="mt-3 flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
            <span className="text-lg leading-none">👤</span>
            <p className="text-sm font-semibold text-gray-500">Cliente nuevo — completa los datos abajo</p>
          </div>
        )}
      </div>

      {/* ── FORM FIELDS (new or editing) ───────────────── */}
      {showFormFields && (
        <div className="bg-white border-2 border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
          {isEditing && (
            <div className="flex items-center gap-2 text-sm font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              ✏️ Editando datos del cliente encontrado
            </div>
          )}

          {/* Nombre */}
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">
              👤 Nombre completo *
            </label>
            <input
              type="text"
              value={formData.cliente_nombre || ''}
              onChange={e => handleChange('cliente_nombre', e.target.value)}
              className={`w-full px-4 py-3.5 border-2 rounded-xl outline-none text-gray-900 bg-white text-base font-semibold transition ${
                errors.cliente_nombre ? 'border-red-500' : 'border-gray-300 focus:border-red-600'
              }`}
              placeholder="Ej: Carlos Gómez"
            />
            {errors.cliente_nombre && (
              <p className="text-red-600 text-xs mt-1 font-semibold">{errors.cliente_nombre}</p>
            )}
          </div>

          {/* Address (domicilio only) */}
          {isDomicilio && (
            <div className="space-y-3">
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500">
                📍 Dirección de entrega *
              </label>

              {/* Manual / GPS toggle */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAddressMode('manual')}
                  className={`py-3 rounded-xl border-2 text-sm font-black transition ${
                    addressMode === 'manual'
                      ? 'border-red-600 bg-red-50 text-red-700'
                      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                  }`}
                >
                  📍 Ingresar dirección
                </button>
                <button
                  type="button"
                  onClick={() => { setAddressMode('gps'); handleLocate(); }}
                  className={`py-3 rounded-xl border-2 text-sm font-black transition ${
                    addressMode === 'gps'
                      ? 'border-red-600 bg-red-50 text-red-700'
                      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {isLocating ? '⌛ Obteniendo...' : '🌐 Obtener ubicación'}
                </button>
              </div>

              {/* Manual fields */}
              {addressMode === 'manual' && (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Calle y número *"
                    value={calleNumero}
                    onChange={e => setCalleNumero(e.target.value)}
                    className={`w-full px-4 py-3 border-2 rounded-xl outline-none text-gray-900 bg-white text-sm font-medium transition ${
                      errors.direccion ? 'border-red-500' : 'border-gray-300 focus:border-red-600'
                    }`}
                  />
                  <input
                    type="text"
                    placeholder="Colonia"
                    value={colonia}
                    onChange={e => setColonia(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl outline-none text-gray-900 bg-white text-sm font-medium focus:border-red-600 transition"
                  />
                  <input
                    type="text"
                    placeholder="Entre calles (opcional)"
                    value={entreCalles}
                    onChange={e => setEntreCalles(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl outline-none text-gray-900 bg-white text-sm font-medium focus:border-red-600 transition"
                  />
                </div>
              )}

              {/* GPS field */}
              {addressMode === 'gps' && (
                <textarea
                  value={formData.direccion || ''}
                  onChange={e => handleChange('direccion', e.target.value)}
                  placeholder={isLocating ? 'Obteniendo ubicación...' : 'Dirección detectada (editable)'}
                  rows={2}
                  className={`w-full px-4 py-3 border-2 rounded-xl outline-none text-gray-900 bg-white text-sm font-medium resize-none transition ${
                    errors.direccion ? 'border-red-500' : 'border-gray-300 focus:border-red-600'
                  }`}
                />
              )}

              {errors.direccion && (
                <p className="text-red-600 text-xs font-semibold">{errors.direccion}</p>
              )}

              {/* Referencias */}
              <textarea
                value={formData.referencias || ''}
                onChange={e => handleChange('referencias', e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl outline-none text-gray-900 bg-white text-sm font-medium resize-none focus:border-red-600 transition"
                placeholder="Referencia: portón verde, casa blanca, entre calles..."
                rows={2}
              />
            </div>
          )}
        </div>
      )}

      {/* ── NAV BUTTONS ────────────────────────────────── */}
      {/* Show back+next when in form mode (new/editing/idle) */}
      {(lookupState !== 'found' || isEditing) && (
        <div className="flex gap-3 mt-1">
          <button
            onClick={() => { if (isEditing) { setIsEditing(false); } else { onPrev(); } }}
            className="px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-black text-sm transition-all active:scale-95"
          >
            ← Atrás
          </button>
          <button
            onClick={handleNext}
            className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-sm transition active:scale-95"
          >
            Siguiente →
          </button>
        </div>
      )}
      {/* Only back button when customer is confirmed (found, not editing) */}
      {lookupState === 'found' && !isEditing && (
        <button
          onClick={onPrev}
          className="px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-black text-sm transition-all active:scale-95 self-start"
        >
          ← Atrás
        </button>
      )}
    </div>
  );
};

export default CustomerInfoStep;
