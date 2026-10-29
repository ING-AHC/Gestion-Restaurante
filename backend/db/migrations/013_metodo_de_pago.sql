-- Cómo se pagó cada venta y cada compra: efectivo, transferencia o mixto.
-- En un pago mixto, "monto_efectivo" guarda la parte en efectivo y el resto fue transferencia.
-- Lo que ya estaba registrado queda como efectivo.
ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(20) NOT NULL DEFAULT 'efectivo'
    CHECK (metodo_pago IN ('efectivo', 'transferencia', 'mixto')),
  ADD COLUMN IF NOT EXISTS monto_efectivo NUMERIC(12,2);

ALTER TABLE compras
  ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(20) NOT NULL DEFAULT 'efectivo'
    CHECK (metodo_pago IN ('efectivo', 'transferencia', 'mixto')),
  ADD COLUMN IF NOT EXISTS monto_efectivo NUMERIC(12,2);