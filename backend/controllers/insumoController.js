const pool = require('../config/db');

const createInsumo = async (req, res) => {
  const { nombre, unidad_medida, cantidad_actual, categoria_id } = req.body;
  const userId = req.userId;

  try {
    if (!nombre || !unidad_medida || !categoria_id) {
      return res.status(400).json({ error: 'Nombre, unidad de medida y categoría son obligatorios' });
    }

    const existente = await pool.query(
      'SELECT * FROM insumos WHERE LOWER(nombre) = LOWER($1) AND user_id = $2',
      [nombre, userId]
    );

    if (existente.rows.length > 0) {
      return res.status(400).json({ error: `Ya existe un insumo llamado "${nombre}"` });
    }

    const newInsumo = await pool.query(
      `INSERT INTO insumos (nombre, unidad_medida, cantidad_actual, categoria_id, user_id)
       VALUES ($1, $2, COALESCE($3, 0), $4, $5)
       RETURNING *`,
      [nombre, unidad_medida, cantidad_actual, categoria_id, userId]
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

  try {
    const insumo = await pool.query(
      'SELECT * FROM insumos WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (insumo.rows.length === 0) {
      return res.status(404).json({ error: 'Insumo no encontrado' });
    }

    const updated = await pool.query(
      `UPDATE insumos SET cantidad_actual = $1 WHERE id = $2 RETURNING *`,
      [cantidad_actual, id]
    );

    res.json(updated.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el insumo' });
  }
};

const deleteInsumo = async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  try {
    const insumo = await pool.query(
      'SELECT * FROM insumos WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (insumo.rows.length === 0) {
      return res.status(404).json({ error: 'Insumo no encontrado' });
    }

    const enUso = await pool.query(
      'SELECT * FROM plato_insumos WHERE insumo_id = $1',
      [id]
    );

    if (enUso.rows.length > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar: este insumo está siendo usado en la receta de uno o más productos',
      });
    }

    await pool.query('DELETE FROM insumos WHERE id = $1', [id]);

    res.json({ message: 'Insumo eliminado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar el insumo' });
  }
};

module.exports = { createInsumo, getInsumos, updateInsumo, deleteInsumo };