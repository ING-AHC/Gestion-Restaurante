const pool = require('../config/db');

const createInsumo = async (req, res) => {
  const { nombre, unidad_medida, cantidad_actual, categoria_id } = req.body;
  const userId = req.userId;

  try {
    const nombreLimpio = String(nombre || '').trim();

    if (!nombreLimpio || !unidad_medida || !categoria_id) {
      return res.status(400).json({ error: 'Nombre, unidad de medida y categoría son obligatorios' });
    }

    const categoriaId = Number(categoria_id);
    if (!Number.isInteger(categoriaId)) {
      return res.status(400).json({ error: 'Categoría no válida' });
    }

    const cantidad =
      cantidad_actual === undefined || cantidad_actual === null || cantidad_actual === ''
        ? 0
        : Number(cantidad_actual);

    if (!Number.isFinite(cantidad) || cantidad < 0) {
      return res.status(400).json({ error: 'La cantidad inicial no es válida' });
    }

    const categoriaCheck = await pool.query(
      'SELECT id FROM categorias_gasto WHERE id = $1 AND user_id = $2',
      [categoriaId, userId]
    );

    if (categoriaCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    const existente = await pool.query(
      'SELECT id FROM insumos WHERE LOWER(nombre) = LOWER($1) AND user_id = $2',
      [nombreLimpio, userId]
    );

    if (existente.rows.length > 0) {
      return res.status(400).json({ error: `Ya existe un insumo llamado "${nombreLimpio}"` });
    }

    const newInsumo = await pool.query(
      `INSERT INTO insumos (nombre, unidad_medida, cantidad_actual, categoria_id, user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [nombreLimpio, unidad_medida, cantidad, categoriaId, userId]
    );

    res.status(201).json(newInsumo.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

const getInsumos = async (req, res) => {
  const userId = req.userId;

  try {
    const insumos = await pool.query(
      `SELECT i.*, cg.nombre AS categoria_nombre
       FROM insumos i
       LEFT JOIN categorias_gasto cg ON i.categoria_id = cg.id
       WHERE i.user_id = $1
       ORDER BY i.nombre`,
      [userId]
    );

    res.json(insumos.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

const updateInsumo = async (req, res) => {
  const { id } = req.params;
  const { cantidad_actual } = req.body;
  const userId = req.userId;

  if (!Number.isInteger(Number(id))) {
    return res.status(400).json({ error: 'Identificador no válido' });
  }

  const cantidad = Number(cantidad_actual);
  if (
    cantidad_actual === undefined ||
    cantidad_actual === null ||
    cantidad_actual === '' ||
    !Number.isFinite(cantidad) ||
    cantidad < 0
  ) {
    return res.status(400).json({ error: 'La cantidad no es válida' });
  }

  try {
    const updated = await pool.query(
      `UPDATE insumos SET cantidad_actual = $1
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [cantidad, id, userId]
    );

    if (updated.rows.length === 0) {
      return res.status(404).json({ error: 'Insumo no encontrado' });
    }

    res.json(updated.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el insumo' });
  }
};

const deleteInsumo = async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  if (!Number.isInteger(Number(id))) {
    return res.status(400).json({ error: 'Identificador no válido' });
  }

  try {
    const insumo = await pool.query(
      'SELECT id FROM insumos WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (insumo.rows.length === 0) {
      return res.status(404).json({ error: 'Insumo no encontrado' });
    }

    const enReceta = await pool.query(
      'SELECT id FROM plato_insumos WHERE insumo_id = $1 LIMIT 1',
      [id]
    );

    if (enReceta.rows.length > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar: este insumo está siendo usado en la receta de uno o más productos',
      });
    }

    const enBebida = await pool.query(
      'SELECT id FROM productos WHERE insumo_id = $1 AND user_id = $2 LIMIT 1',
      [id, userId]
    );

    if (enBebida.rows.length > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar: este insumo está ligado a una bebida del menú',
      });
    }

    await pool.query('DELETE FROM insumos WHERE id = $1 AND user_id = $2', [id, userId]);

    res.json({ message: 'Insumo eliminado correctamente' });
  } catch (error) {
    // 23503 = violación de clave foránea (el insumo tiene registros asociados)
    if (error.code === '23503') {
      return res.status(400).json({
        error: 'No se puede eliminar: este insumo tiene registros asociados (por ejemplo compras)',
      });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar el insumo' });
  }
};

module.exports = { createInsumo, getInsumos, updateInsumo, deleteInsumo };