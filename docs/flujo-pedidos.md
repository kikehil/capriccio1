# Flujo de Pedidos — Capriccio Pizzería

> Documento técnico-operativo que describe el ciclo completo de cada tipo de pedido,
> desde que el cliente lo solicita hasta que se entrega y se cobra.

---

## Tipos de pedido y orígenes

| Método de entrega | Valor en sistema     | Descripción                          |
|-------------------|----------------------|--------------------------------------|
| A domicilio       | `domicilio`          | Repartidor lleva el pedido al cliente |
| Para llevar       | `para_llevar`        | Cliente retira en el local           |
| Comer en sucursal | `sucursal`           | Cliente come en el local             |

| Canal de origen | Valor en sistema | ¿Quién crea el pedido?               |
|-----------------|------------------|--------------------------------------|
| Portal web      | `web`            | El propio cliente desde la app       |
| Caja / llamada  | `llamada`        | El cajero, pedido por teléfono       |
| Caja / presencial | `presencial`   | El cajero, cliente está en el local  |
| WhatsApp        | `whatsapp`       | Sistema automático vía bot           |

---

## Estados posibles de un pedido

```
recibido → en_preparacion → preparando → listo → en_reparto → entregado
                                                               cancelado
```

| Estado          | Quién lo asigna            | Descripción                                  |
|-----------------|----------------------------|----------------------------------------------|
| `recibido`      | Sistema al crear el pedido | Pedido registrado, aún no visto por cocina   |
| `en_preparacion`| Módulo Cocina              | Cocina tomó el pedido, está en el horno      |
| `preparando`    | Módulo Cocina              | Etapa intermedia de preparación              |
| `listo`         | Módulo Cocina              | Pizza lista, esperando repartidor o entrega  |
| `en_reparto`    | Módulo Repartidor          | Repartidor tomó el pedido, en camino         |
| `entregado`     | Módulo Repartidor          | Entregado al cliente                         |
| `cancelado`     | Admin / Cajero             | Pedido anulado                               |

---

## Campos de pago

| Campo            | Valor posible                   | Significado                          |
|------------------|---------------------------------|--------------------------------------|
| `payment_method` | `efectivo` / `tarjeta`         | Cobrado en caja o en entrega         |
| `payment_method` | `no_pago`                      | Pendiente de cobro (domicilio)       |
| `liquidado`      | `0` / `1`                      | 0 = sin cobrar, 1 = cobrado          |
| `liquidado_at`   | timestamp                       | Momento en que caja lo liquidó       |

---

## 1. Domicilio — Portal Web

**¿Quién interviene?** Cliente → Cocina → Repartidor → Caja

```
Cliente (app web)
  │
  ├─ Llena formulario: nombre, teléfono, dirección, artículos
  ├─ Selecciona método de entrega: DOMICILIO
  ├─ Envía pedido → POST /api/pedidos
  │
  │   ← Sistema responde con #ID de pedido
  │   ← WhatsApp automático al cliente: "Tu pedido fue recibido"
  │   ← WhatsApp automático al negocio: "Nuevo pedido web"
  │   ← Socket.io emite: nuevo_pedido → todos los módulos conectados
  │
[Status: recibido | payment_method: no_pago | liquidado: 0]
  │
Módulo Cocina
  ├─ Ve el pedido en la pantalla
  ├─ Lo acepta → status: en_preparacion
  │   ← Push notification al cliente: "Tu pizza está en el horno"
  ├─ Lo marca como preparando (opcional)
  ├─ Pizza lista → status: listo
  │   ← Push notification al cliente: "Tu pizza está lista"
  │   ← Socket.io emite: pedido_listo_reparto → Módulo Repartidor
  │
[Status: listo | en espera de repartidor]
  │
Módulo Repartidor
  ├─ Ve el pedido disponible en su lista
  ├─ Se auto-asigna al pedido → status: en_reparto
  │   ← Push notification al cliente: "Tu pizza va en camino"
  ├─ Entrega en domicilio del cliente → status: entregado
  │   ← Push notification al cliente: "Tu pizza fue entregada"
  │
[Status: entregado | payment_method: no_pago | liquidado: 0]
  │
Módulo Caja (Pendientes del turno)
  ├─ Ve el pedido en la lista de "Entregados sin cobrar"
  ├─ El repartidor entrega el dinero cobrado en puerta
  ├─ Cajero presiona COBRAR → PATCH /api/caja/cobrar-pedido/:id
  │   body: { payment_method, monto_recibido, turno_id, cajero_nombre }
  │
[Status: entregado | payment_method: efectivo | liquidado: 1]
  └─ Pedido desaparece de pendientes → queda en reporte del turno
```

---

## 2. Domicilio — Caja (llamada telefónica o presencial con entrega a domicilio)

**¿Quién interviene?** Cajero → Cocina → Repartidor → Caja

```
Cajero (Módulo Caja / POS)
  │
  ├─ Paso 1: ¿Cómo llega el pedido?
  │   └─ Selecciona: LLAMADA TELEFÓNICA o PRESENCIAL
  ├─ Paso 2: ¿Cómo se entrega?
  │   └─ Selecciona: A DOMICILIO
  ├─ Paso 3: Datos del cliente
  │   └─ Nombre, teléfono, dirección, referencias
  ├─ Paso 4: Artículos
  │   └─ Agrega productos del catálogo
  ├─ Paso 5: Pago
  │   └─ "Este pedido se pagará al momento de la entrega" → no_pago
  ├─ Paso 6: Confirmación
  │   └─ Cajero confirma → POST /api/caja/pedidos
  │       Se imprimen 2 tickets: CLIENTE + COCINA
  │
[Status: recibido | payment_method: no_pago | liquidado: 0]
  │
  ↓  (mismo flujo que Domicilio Web desde aquí)
Cocina → Repartidor → Caja cobra al final del turno
```

**Nota de pago:** El repartidor cobra en puerta (efectivo). Al regresar entrega el dinero al cajero. El cajero registra el cobro desde "Pendientes del turno".

---

## 3. Para Llevar — Portal Web

**¿Quién interviene?** Cliente → Cocina → Cliente recoge en local → Caja

```
Cliente (app web)
  │
  ├─ Llena formulario: nombre, teléfono, artículos
  ├─ Selecciona: PARA LLEVAR
  ├─ Envía pedido → POST /api/pedidos
  │   ← WhatsApp: "Tu pedido fue recibido, tiempo estimado 20-25 min"
  │
[Status: recibido | liquidado: 0]
  │
Módulo Cocina
  ├─ Acepta → en_preparacion
  │   ← Push notification: "Tu pizza está en el horno"
  ├─ Lista → listo
  │   ← Push notification: "Tu pizza está lista, pasa a recogerla"
  │
[Status: listo | cliente llega a la sucursal]
  │
Módulo Caja
  ├─ Cliente llega a recoger
  ├─ Cajero busca el pedido por nombre o ID (BuscarPedidoModal)
  ├─ Presiona COBRAR → registra el pago
  │
[Status: listo → entregado | payment_method: efectivo/tarjeta | liquidado: 1]
```

---

## 4. Para Llevar — Caja

**¿Quién interviene?** Cajero → Cocina → Cliente recoge

```
Cajero (Módulo Caja / POS)
  │
  ├─ Paso 1: Origen → LLAMADA o PRESENCIAL
  ├─ Paso 2: Método → PARA LLEVAR
  ├─ Paso 3: Datos del cliente (nombre, teléfono)
  ├─ Paso 4: Artículos
  ├─ Paso 5: Pago
  │   └─ Se cobra EN CAJA inmediatamente
  │       Efectivo → ingresa monto → calcula cambio
  │       Tarjeta → se registra y se procesa aparte
  ├─ Paso 6: Confirmación → POST /api/caja/pedidos
  │   Se imprimen 2 tickets: CLIENTE + COCINA
  │
[Status: recibido | payment_method: efectivo/tarjeta | liquidado: 1]
  │
Módulo Cocina
  ├─ Ve el pedido y lo prepara
  ├─ Marca como listo
  │
Cliente pasa a recoger → le entregan su pedido
(Ya está cobrado, no requiere acción adicional en caja)
```

---

## 5. Comer en Sucursal — Caja

**¿Quién interviene?** Cajero → Cocina → (servicio en mesa)

```
Cajero (Módulo Caja / POS)
  │
  ├─ Paso 1: Origen → PRESENCIAL (cliente está en el local)
  ├─ Paso 2: Método → COMER EN SUCURSAL
  ├─ Paso 3: Datos del cliente (nombre, mesa si aplica)
  ├─ Paso 4: Artículos
  ├─ Paso 5: Pago
  │   └─ Se cobra EN CAJA inmediatamente (o al final de la comida)
  │       Efectivo o Tarjeta
  ├─ Paso 6: Confirmación → POST /api/caja/pedidos
  │   Se imprimen 2 tickets: CLIENTE + COCINA
  │
[Status: recibido | payment_method: efectivo/tarjeta | liquidado: 1]
  │
Módulo Cocina
  ├─ Ve el pedido, lo prepara
  ├─ Marca como listo → personal lleva a la mesa
  │
(No hay módulo repartidor involucrado)
```

**Nota:** Para comer en sucursal el pago se puede registrar antes de preparar (cobro al ordenar) o al finalizar. El sistema lo marca como cobrado en el momento que el cajero confirma el pedido.

---

## 6. Notificaciones automáticas por cambio de estado

| Estado nuevo    | Push Notification al cliente       | WhatsApp         |
|-----------------|------------------------------------|------------------|
| `recibido`      | —                                  | ✅ Al crear      |
| `en_preparacion`| ✅ "Tu pizza está en el horno"     | —                |
| `listo`         | ✅ "Tu pizza está lista"           | —                |
| `en_reparto`    | ✅ "Tu pizza va en camino"         | —                |
| `entregado`     | ✅ "Tu pizza fue entregada"        | —                |

> Las push notifications solo llegan a clientes suscritos desde la app web.
> El WhatsApp de creación se envía siempre que el pedido tenga número de teléfono.

---

## 7. Visibilidad por módulo

| Módulo      | Qué ve                                                                 |
|-------------|------------------------------------------------------------------------|
| **Cocina**  | Todos los pedidos activos (recibido, en_preparacion, preparando, listo)|
| **Repartidor** | Pedidos en estado `listo`, `en_reparto`, `entregado` con `metodo_entrega = domicilio` |
| **Caja**    | Pedidos del turno activo con `liquidado = 0` y status ≠ cancelado     |
| **Admin**   | Todos los pedidos, todos los estados, todos los orígenes               |

---

## 8. Resumen visual del ciclo completo

```
PORTAL WEB                    CAJA / POS
──────────                    ──────────
Cliente crea pedido           Cajero crea pedido
    │                             │
    └──────────┬──────────────────┘
               ▼
        [recibido]
               │
               ▼
        MÓDULO COCINA
        en_preparacion
        preparando
        listo
               │
    ┌──────────┴────────────┐
    │ domicilio              │ sucursal / para_llevar
    ▼                        ▼
MÓDULO REPARTIDOR        Cliente recoge o se sirve
en_reparto               en la sucursal
entregado                      │
    │                          │
    ▼                          ▼
MÓDULO CAJA             (ya cobrado en caja)
Cobrar pedido
liquidado = 1
```

---

*Generado: Mayo 2026 — Capriccio Pizzería Sistema v2*
