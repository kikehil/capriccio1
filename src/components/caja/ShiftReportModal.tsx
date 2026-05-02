'use client';

import React, { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { CajaTurno } from '@/data/caja-types';
import { API_URL } from '@/lib/socket';

interface ShiftReportModalProps {
  turno: CajaTurno;
  onClose: () => void;
}

const ShiftReportModal: React.FC<ShiftReportModalProps> = ({ turno, onClose }) => {
  const [efectivoReportado, setEfectivoReportado] = useState<string>('');
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  // Estadísticas de ventas del turno
  const [totalEfectivoVentas, setTotalEfectivoVentas] = useState<number>(0);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${API_URL}/api/caja/reporte/turno/${turno.id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('capriccio_token_caja')}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setTotalEfectivoVentas(data.resumen?.total_efectivo || 0);
        }
      } catch (err) {
        console.error('Error cargando stats del turno:', err);
      } finally {
        setLoadingStats(false);
      }
    };
    fetchStats();
  }, [turno.id]);

  const handleCloseTurno = async () => {
    if (!efectivoReportado) {
      setError('Ingresa el efectivo contado');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/caja/turno/${turno.id}/cerrar`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('capriccio_token_caja')}`,
        },
        body: JSON.stringify({
          efectivo_reportado: parseFloat(efectivoReportado),
          notas,
        }),
      });

      if (!response.ok) {
        throw new Error('Error al cerrar turno');
      }

      setSuccess(true);
      setTimeout(() => {
        window.location.reload(); // Refrescar la página
      }, 2000);
    } catch (err) {
      console.error('Error:', err);
      setError('Error al cerrar turno. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">¡Turno Cerrado!</h2>
          <p className="text-gray-600 mb-4">El turno se ha finalizado correctamente.</p>
          <p className="text-gray-500 text-sm">Redirigiendo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6 sticky top-0 bg-white pb-4 border-b">
          <h2 className="text-2xl font-bold text-gray-800">Reporte de Cierre de Turno</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={28} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg flex gap-3">
            <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {/* INFORMACIÓN DEL TURNO */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="font-bold text-gray-800 mb-3">Información del Turno</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Cajero</p>
              <p className="font-semibold text-gray-800">{turno.cajero_nombre}</p>
            </div>
            <div>
              <p className="text-gray-600">Hora de Apertura</p>
              <p className="font-semibold text-gray-800">
                {(() => {
                  const t = turno as any;
                  if (t.hora_apertura_utc) return t.hora_apertura_utc + ' UTC';
                  return turno.abierto_at ? turno.abierto_at.split(' ')[1] || turno.abierto_at : '—';
                })()}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Efectivo Inicial</p>
              <p className="font-semibold text-gray-800">
                ${Number(turno.efectivo_inicial).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Hora Actual</p>
              <p className="font-semibold text-gray-800">
                {new Date().toLocaleTimeString('es-CL')}
              </p>
            </div>
          </div>
        </div>

        {/* CONTEO DE EFECTIVO */}
        <div className="bg-blue-50 border border-blue-300 rounded-lg p-4 mb-6">
          <h3 className="font-bold text-blue-900 mb-3">Conteo de Efectivo</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Efectivo Contado ($) *
              </label>
              <input
                type="number"
                value={efectivoReportado}
                onChange={(e) => setEfectivoReportado(e.target.value)}
                className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 bg-white"
                placeholder="0"
                autoFocus
              />
              <p className="text-xs text-gray-600 mt-1">
                Ingresa el total de dinero que cuentas en la caja
              </p>
            </div>

            {/* CÁLCULO DE DIFERENCIA */}
            {efectivoReportado && (
              <div className="bg-white p-4 rounded border-2 border-blue-300">
                {loadingStats ? (
                  <p className="text-sm text-gray-500 text-center py-2">Calculando...</p>
                ) : (() => {
                  const contado = parseFloat(efectivoReportado || '0');
                  const esperado = Number(turno.efectivo_inicial) + Number(totalEfectivoVentas);
                  const diferencia = contado - esperado;
                  return (
                    <div className="space-y-2 text-sm">
                      <p className="font-bold text-gray-700 mb-3">Resumen del turno:</p>
                      <div className="flex justify-between text-gray-600">
                        <span>Efectivo Inicial:</span>
                        <span className="font-semibold">${Number(turno.efectivo_inicial).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>+ Ventas en Efectivo:</span>
                        <span className="font-semibold text-green-700">+${totalEfectivoVentas.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between font-bold text-gray-800 border-t pt-2">
                        <span>= Esperado en Caja:</span>
                        <span>${esperado.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Efectivo Contado:</span>
                        <span className="font-semibold">${contado.toLocaleString()}</span>
                      </div>
                      <div className={`border-t-2 pt-2 flex justify-between font-bold text-lg ${
                        diferencia > 0 ? 'text-green-600' : diferencia < 0 ? 'text-red-600' : 'text-gray-800'
                      }`}>
                        <span>Diferencia:</span>
                        <span>{diferencia >= 0 ? '+' : ''}{diferencia.toLocaleString()}</span>
                      </div>
                      {diferencia !== 0 && (
                        <p className="text-xs text-gray-500 italic">
                          {diferencia > 0
                            ? '↑ Sobrante en caja'
                            : '↓ Faltante en caja'}
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* NOTAS */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notas (Opcional)
              </label>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 bg-white"
                placeholder="Ej: Diferencia debido a cambio redondeado..."
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* ADVERTENCIA */}
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-6">
          <p className="text-yellow-800 font-semibold mb-2">⚠️ Importante</p>
          <ul className="text-yellow-700 text-sm space-y-1">
            <li>• Asegúrate de haber contado todo el efectivo</li>
            <li>• Revisa los recibos impresos</li>
            <li>• Verifica las devoluciones y cambios entregados</li>
          </ul>
        </div>

        {/* BUTTONS */}
        <div className="flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-semibold transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleCloseTurno}
            disabled={loading}
            className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-semibold transition"
          >
            {loading ? 'Cerrando...' : '✓ Cerrar Turno'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShiftReportModal;
