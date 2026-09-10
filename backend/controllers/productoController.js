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

    if (tipo === 'bebida' && !insumo_id) {
      return res.status(400).json({ error: 'Las bebidas deben estar ligadas a un insumo' });
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
    const producto = await pool.query(
      'SELECT * FROM productos WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (producto.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const updated = await pool.query(
      `UPDATE productos
       SET nombre = COALESCE($1, nombre), precio = COALESCE($2, precio)
       WHERE id = $3
       RETURNING *`,
      [nombre, precio, id]
    );

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

  if (!insumos || insumos.length === 0) {
    return res.status(400).json({ error: 'Debes incluir al menos un insumo' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const productoCheck = await client.query(
      'SELECT * FROM productos WHERE id = $1 AND user_id = $2',
      [producto_id, userId]
    );

    if (productoCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Producto no encontrado' });
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
    const producto = await pool.query(
      'SELECT * FROM productos WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (producto.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    await pool.query('DELETE FROM productos WHERE id = $1', [id]);

    res.json({ message: 'Producto eliminado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar el producto' });
  }
};

module.exports = { createProducto, getProductos, asignarInsumos, deleteProducto, updateProducto };