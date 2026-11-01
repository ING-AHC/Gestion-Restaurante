-- Precio cuando el plato se pide sin sopa. Vacío = el descuento fijo de siempre (mil pesos), como en los ejecutivos.
ALTER TABLE productos ADD COLUMN IF NOT EXISTS precio_sin_sopa NUMERIC(10,2);
