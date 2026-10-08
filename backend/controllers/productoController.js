const pool = require('../config/db');

const TIPOS_VALIDOS = ['especial', 'rapida', 'ejecutivo', 'bebida'];

const createProducto = async (req, res) => {
  const { nombre, tipo, precio, insumo_id } = req.body;
  const userId = req.userId;

  try {
    if (!nombre || !tipo || !precio) {
      return res.status(400).json({ error: 'Nombre, tipo y precio son obligatorios' });
    }

    if (!TIPOS_VALIDOS.includes(tipo)) {
      return res.status(400).json({ error: 'El tipo debe ser: especial, rapida, ejecutivo o bebida' });
    }

    if (tipo === 'bebida') {
      if (!insumo_id) {
        return res.status(400).json({ error: 'Las bebidas deben estar ligadas a un insumo' });
      }

      const insumoCheck = await pool.query(
        'SELECT id FROM insumos WHERE id = $1 AND user_id = $2',
        [insumo_id, userId]
      );

      if (insumoCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Insumo no encontrado' });
      }
    }

    const newProducto = await pool.query(
      `INSERT INTO productos (nombre, tipo, precio, insumo_id, user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [nombre, tipo, precio, tipo === 'bebida' ? insumo_id : null, userId]
    );

    res.status(201).json(newProducto.rows[0]);
  } catch (error) {
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
  const { nombre, precio } = req.body;
  const userId = req.userId;

  try {
    const updated = await pool.query(
      `UPDATE productos
       SET nombre = COALESCE($1, nombre), precio = COALESCE($2, precio)
       WHERE id = $3 AND user_id = $4
       RETURNING *`,
      [nombre, precio, id, userId]
    );

    if (updated.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json(updated.rows[0]);
  } catch (error) {
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
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar el producto' });
  }
};

module.exports = { createProducto, getProductos, asignarInsumos, deleteProducto, updateProducto };