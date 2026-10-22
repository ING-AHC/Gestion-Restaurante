-- La bebida puede crearse sin insumo ligado (no descuenta inventario).
ALTER TABLE productos ALTER COLUMN insumo_id DROP NOT NULL;