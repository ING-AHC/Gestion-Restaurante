CREATE TABLE pedidos (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mesa VARCHAR(30) NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'en_preparacion', 'listo', 'entregado', 'cancelado')),
  notas TEXT,
  venta_id INTEGER REFERENCES ventas(id) ON DELETE SET NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE pedido_detalle (
  id SERIAL PRIMARY KEY,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  nota TEXT
);

CREATE INDEX idx_pedidos_user_estado ON pedidos (user_id, estado);
CREATE INDEX idx_pedido_detalle_pedido ON pedido_detalle (pedido_id);