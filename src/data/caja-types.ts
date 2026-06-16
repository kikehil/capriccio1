// Tipos para el módulo de Caja/POS

export type OrderOrigin = 'web' | 'llamada' | 'presencial' | 'whatsapp';
export type DeliveryMethod = 'sucursal' | 'domicilio' | 'para_llevar';
export type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia' | 'mixto' | 'no_pago';

export interface CajaItem {
  pizza_nombre: string;
  cantidad: number;
  precio_unitario: number;
  size?: string;
  crust?: string;
  extras?: CajaExtra[];
  nota?: string;   // Nota adicional (sin cebolla, etc.)
  sauce?: string;  // Tipo de salsa (hamburguesas / boneless)
}

export interface CajaExtra {
  nombre: string;
  precio: number;
}

export interface NewOrderRequest {
  cliente_nombre: string;
  telefono: string;
  direccion?: string;
  referencias?: string;
  items: CajaItem[];
  order_origin: OrderOrigin;
  metodo_entrega: DeliveryMethod;
  payment_method: PaymentMethod;
  monto_recibido?: number;
  turno_id?: number;
  descuento_porcentaje?: number;
}

export interface CajaTurno {
  id: number;
  cajero_id: number;
  cajero_nombre: string;
  negocio_id: number;
  abierto_at: string;
  cerrado_at?: string;
  efectivo_inicial: number;
  efectivo_recibido?: number;
  efectivo_reportado?: number;
  diferencia?: number;
  total_ordenes_caja?: number;
  total_efectivo_esperado?: number;
  liquidado: number;
  liquidado_at?: string;
  created_at: string;
}

export interface CajaPedido {
  id: number;
  order_id: string;
  cliente_nombre: string;
  telefono?: string;
  direccion?: string;
  referencias?: string;
  total: number;
  status: string;
  order_origin: OrderOrigin;
  payment_method: PaymentMethod;
  monto_recibido?: number;
  pagado_at?: string;
  cajero_nombre: string;
  metodo_entrega: DeliveryMethod;
  created_at: string;
}

export interface TurnoResumen {
  total_ordenes: number;
  ordenes_pagadas: number;
  total_efectivo: number;
  total_tarjeta: number;
  ordenes_llamada: number;
  ordenes_presencial: number;
  ordenes_web: number;
}

export interface TurnoReporte {
  turno: CajaTurno;
  ordenes: CajaPedido[];
  resumen: TurnoResumen;
}
