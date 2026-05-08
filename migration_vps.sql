-- Migration: nota/sauce columns + orillas products
ALTER TABLE detalle_pedidos ADD COLUMN IF NOT EXISTS nota TEXT;
ALTER TABLE detalle_pedidos ADD COLUMN IF NOT EXISTS sauce TEXT;

INSERT INTO productos (nombre, descripcion, precio, categoria, activo, precios, ingredientes)
SELECT 'Sin Orilla Rellena', 'sin-orilla', 0, '🥖 Orillas', 1, '{"chica":0,"mediana":0,"grande":0,"jumbo":0}', '[]'
WHERE NOT EXISTS (SELECT 1 FROM productos WHERE descripcion = 'sin-orilla');

INSERT INTO productos (nombre, descripcion, precio, categoria, activo, precios, ingredientes)
SELECT '🧀 Orilla Rellena de Queso', 'orilla-queso', 0, '🥖 Orillas', 1, '{"chica":10,"mediana":25,"grande":35,"jumbo":50}', '[]'
WHERE NOT EXISTS (SELECT 1 FROM productos WHERE descripcion = 'orilla-queso');

INSERT INTO productos (nombre, descripcion, precio, categoria, activo, precios, ingredientes)
SELECT '🥖 Orilla Dedos de Queso', 'dedos-queso', 0, '🥖 Orillas', 1, '{"chica":0,"mediana":35,"grande":45,"jumbo":65}', '[]'
WHERE NOT EXISTS (SELECT 1 FROM productos WHERE descripcion = 'dedos-queso');

SELECT 'Migration complete' AS status;
