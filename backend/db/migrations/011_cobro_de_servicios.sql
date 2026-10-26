-- Una línea de venta puede ser un servicio que no es un producto del menú
-- (por ejemplo "Asado de carne"). En ese caso producto_id queda vacío y el nombre va en "concepto".
ALTER TABLE venta_detalle ADD COLUMN IF NOT EXISTS concepto VARCHAR(150);