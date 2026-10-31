-- Precio abierto: el precio del producto es el mínimo y el mesero escribe cuánto cobrar (picada, carne a la mamona).
-- Lleva sopa y principio: los ejecutivos lo traen activado; se apaga en los que no la llevan (frijolada).
-- precio_unitario en el pedido: valor escogido al pedir un producto de precio abierto (vacío = precio del producto).
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS precio_abierto BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS lleva_sopa BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE pedido_detalle
  ADD COLUMN IF NOT EXISTS precio_unitario NUMERIC(12,2);
