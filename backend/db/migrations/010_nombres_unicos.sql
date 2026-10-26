-- Dos cosas con el mismo nombre no pueden existir en un mismo restaurante
-- (sin importar mayúsculas ni espacios al inicio o al final).
--
-- Paso 1: si ya hay nombres repetidos, al segundo, tercero... se le agrega (2), (3)...
-- No se borra nada ni se pierde ninguna venta: solo cambia el nombre para que lo revises.
DO $$
DECLARE
  repetido record;
BEGIN
  FOR repetido IN
    SELECT * FROM (VALUES
      ('productos', 'user_id', 'nombre'),
      ('insumos', 'user_id', 'nombre'),
      ('proveedores', 'user_id', 'nombre'),
      ('categorias_gasto', 'user_id', 'nombre')
    ) AS t(tabla, dueno, columna)
  LOOP
    EXECUTE format(
      $f$
      UPDATE %1$I d
      SET %3$I = LEFT(BTRIM(d.%3$I), 40) || ' (' || r.n || ')'
      FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY %2$I, LOWER(BTRIM(%3$I)) ORDER BY id) AS n
        FROM %1$I
      ) r
      WHERE d.id = r.id AND r.n > 1
      $f$,
      repetido.tabla, repetido.dueno, repetido.columna
    );
  END LOOP;

  -- Personal: el nombre no se puede repetir dentro del mismo restaurante
  UPDATE users d
  SET name = LEFT(BTRIM(d.name), 40) || ' (' || r.n || ')'
  FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY owner_id, LOWER(BTRIM(name)) ORDER BY id) AS n
    FROM users
    WHERE owner_id IS NOT NULL
  ) r
  WHERE d.id = r.id AND r.n > 1;
END $$;

-- Paso 2: la base de datos misma impide que vuelvan a repetirse
CREATE UNIQUE INDEX IF NOT EXISTS productos_nombre_unico ON productos (user_id, LOWER(BTRIM(nombre)));
CREATE UNIQUE INDEX IF NOT EXISTS insumos_nombre_unico ON insumos (user_id, LOWER(BTRIM(nombre)));
CREATE UNIQUE INDEX IF NOT EXISTS proveedores_nombre_unico ON proveedores (user_id, LOWER(BTRIM(nombre)));
CREATE UNIQUE INDEX IF NOT EXISTS categorias_gasto_nombre_unico ON categorias_gasto (user_id, LOWER(BTRIM(nombre)));
CREATE UNIQUE INDEX IF NOT EXISTS personal_nombre_unico ON users (owner_id, LOWER(BTRIM(name))) WHERE owner_id IS NOT NULL;