DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'productos'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%tipo%'
      AND pg_get_constraintdef(oid) NOT ILIKE '%es_sopa%'
  LOOP
    EXECUTE format('ALTER TABLE productos DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE productos ADD CONSTRAINT productos_tipo_check
  CHECK (tipo IN ('especial', 'rapida', 'ejecutivo', 'bebida', 'sopa', 'principio'));

UPDATE productos SET tipo = 'sopa', es_sopa = TRUE
WHERE es_sopa AND tipo <> 'ejecutivo';