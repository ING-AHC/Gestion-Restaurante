-- Productos agregados a un pedido que ya estaba abierto (la misma mesa pide más cosas)
ALTER TABLE pedido_detalle ADD COLUMN IF NOT EXISTS agregado BOOLEAN NOT NULL DEFAULT FALSE;