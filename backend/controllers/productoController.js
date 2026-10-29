const pool = require('../config/db');

const TIPOS_VALIDOS = ['especial', 'rapida', 'ejecutivo', 'bebida', 'sopa', 'principio'];

// Dos productos no pueden llamarse igual en un mismo restaurante (sin importar mayúsculas ni espacios)
const mensajeRepetido = (nombre) => `Ya existe un producto llamado "${nombre}"`;

const existeNombre = async (userId, nombre, exceptoId = null) => {
  const { rows } = await pool.query(
    `SELECT id FROM productos
     WHERE user_id = $1 AND LOWER(BTRIM(nombre)) = LOWER($2) AND ($3::int IS NULL OR id <> $3)`,
    [userId, nombre, exceptoId]
  );
  return rows.length > 0;
};

const createProducto = async (req, res) => {
  const { tipo, precio, insumo_id } = req.body;
  const nombre = String(req.body.nombre ?? '').trim();
  const userId = req.userId;

  try {
    if (!nombre || !tipo || !precio) {
      return res.status(400).json({ error: 'Nombre, tipo y precio son obligatorios' });
    }

    if (nombre.length > 100) {
      return res.status(400).json({ error: 'El nombre puede tener máximo 100 caracteres' });
    }

    if (await existeNombre(userId, nombre)) {
      return res.status(409).json({ error: mensajeRepetido(nombre) });
    }

    if (!TIPOS_VALIDOS.includes(tipo)) {
      return res.status(400).json({ error: 'El tipo debe ser: especial, rapida, ejecutivo, sopa, principio o bebida' });
    }

    // En las bebidas el insumo es opcional: si no se envía, no descuenta inventario
    const insumoLigado = tipo === 'bebida' && insumo_id ? Number(insumo_id) : null;

    if (insumoLigado !== null) {
      if (!Number.isInteger(insumoLigado) || insumoLigado <= 0) {
        return res.status(400).json({ error: 'Insumo no válido' });
      }

      const insumoCheck = await pool.query(
        'SELECT id FROM insumos WHERE id = $1 AND user_id = $2',
        [insumoLigado, userId]
      );

      if (insumoCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Insumo no encontrado' });
      }
    }

    const newProducto = await pool.query(
      `INSERT INTO productos (nombre, tipo, precio, insumo_id, es_sopa, user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [nombre, tipo, precio, insumoLigado, tipo === 'sopa', userId]
    );

    res.status(201).json(newProducto.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: mensajeRepetido(nombre) });
    }
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

const getProductos = async (req, res) => {
  const userId = req.userId;

  try {
    const productos = await pool.query(
      `SELECT
         p.*,
         COALESCE(
           json_agg(
             json_build_object(
               'insumo_id', pi.insumo_id,
               'insumo_nombre', i.nombre,
               'cantidad_usada', pi.cantidad_usada
             )
           ) FILTER (WHERE pi.id IS NOT NULL),
           '[]'
         ) AS receta
       FROM productos p
       LEFT JOIN plato_insumos pi ON pi.producto_id = p.id
       LEFT JOIN insumos i ON pi.insumo_id = i.id
       WHERE p.user_id = $1
       GROUP BY p.id
       ORDER BY p.tipo, p.nombre`,
      [userId]
    );

    res.json(productos.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

const updateProducto = async (req, res) => {
  const { id } = req.params;
  const { precio } = req.body;
  const cambiaInsumo = Object.prototype.hasOwnProperty.call(req.body, 'insumo_id');
  const nombre = req.body.nombre === undefined || req.body.nombre === null ? null : String(req.body.nombre).trim();
  const userId = req.userId;

  if (!Number.isInteger(Number(id))) {
    return res.status(400).json({ error: 'Identificador no válido' });
  }

  if (nombre !== null && (!nombre || nombre.length > 100)) {
    return res.status(400).json({ error: 'El nombre es obligatorio (máximo 100 caracteres)' });
  }

  try {
    if (nombre !== null && (await existeNombre(userId, nombre, Number(id)))) {
      return res.status(409).json({ error: mensajeRepetido(nombre) });
    }

    // El insumo que descuenta una bebida se puede ligar, cambiar o quitar (null) al editar
    let insumoNuevo = null;
    if (cambiaInsumo) {
      const actual = await pool.query('SELECT tipo FROM productos WHERE id = $1 AND user_id = $2', [id, userId]);
      if (actual.rows.length === 0) {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }
      if (actual.rows[0].tipo !== 'bebida') {
        return res.status(400).json({ error: 'Solo las bebidas se ligan a un insumo; los platos usan receta' });
      }
      if (req.body.insumo_id) {
        insumoNuevo = Number(req.body.insumo_id);
        const insumoCheck = Number.isInteger(insumoNuevo)
          ? await pool.query('SELECT id FROM insumos WHERE id = $1 AND user_id = $2', [insumoNuevo, userId])
          : { rows: [] };
        if (insumoCheck.rows.length === 0) {
          return res.status(404).json({ error: 'Insumo no encontrado' });
        }
      }
    }

    const updated = await pool.query(
      `UPDATE productos
       SET nombre = COALESCE($1, nombre),
           precio = COALESCE($2, precio),
           insumo_id = CASE WHEN $5::boolean THEN $6::int ELSE insumo_id END
       WHERE id = $3 AND user_id = $4
       RETURNING *`,
      [nombre, precio, id, userId, cambiaInsumo, insumoNuevo]
    );

    if (updated.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json(updated.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: mensajeRepetido(nombre) });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el producto' });
  }
};

const asignarInsumos = async (req, res) => {
  const { producto_id } = req.params;
  const { insumos } = req.body;
  const userId = req.userId;

  if (!Array.isArray(insumos) || insumos.length === 0) {
    return res.status(400).json({ error: 'Debes incluir al menos un insumo' });
  }

  const ids = [...new Set(insumos.map((i) => Number(i.insumo_id)))];
  const datosValidos =
    ids.every((n) => Number.isInteger(n)) &&
    insumos.every((i) => Number(i.cantidad_usada) > 0);

  if (!datosValidos) {
    return res.status(400).json({ error: 'Insumos o cantidades no válidos' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const productoCheck = await client.query(
      'SELECT id FROM productos WHERE id = $1 AND user_id = $2',
      [producto_id, userId]
    );

    if (productoCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const insumosCheck = await client.query(
      'SELECT id FROM insumos WHERE id = ANY($1::int[]) AND user_id = $2',
      [ids, userId]
    );

    if (insumosCheck.rows.length !== ids.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Insumo no encontrado' });
    }

    for (const item of insumos) {
      await client.query(
        `INSERT INTO plato_insumos (producto_id, insumo_id, cantidad_usada)
         VALUES ($1, $2, $3)`,
        [producto_id, item.insumo_id, item.cantidad_usada]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({ message: 'Receta asignada correctamente' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Error al asignar insumos al producto' });
  } finally {
    client.release();
  }
};

const deleteProducto = async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  try {
    const deleted = await pool.query(
      'DELETE FROM productos WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (deleted.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json({ message: 'Producto eliminado correctamente' });
  } catch (error) {
    // 23503: el producto ya está en algún pedido y la base no deja borrarlo
    if (error.code === '23503') {
      return res.status(409).json({
        error:
          'Este producto ya se usó en pedidos o ventas y no se puede eliminar. Puedes editarlo o quitarlo del menú de hoy.',
      });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar el producto' });
  }
};

module.exports = { createProducto, getProductos, asignarInsumos, deleteProducto, updateProducto };