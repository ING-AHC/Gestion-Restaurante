-- Un ejecutivo puede pedirse sin principio, igual que sin sopa.
-- No cambia el precio: solo queda anotado para cocina y para la venta.
ALTER TABLE pedido_detalle ADD COLUMN IF NOT EXISTS sin_principio BOOLEAN NOT NULL DEFAULT FALSE;