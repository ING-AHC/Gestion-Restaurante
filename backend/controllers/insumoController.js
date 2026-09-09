const pool = require('../config/db');

// Crear un nuevo insumo
const createInsumo = async (req, res) => {
  const { nombre, unidad_medida, cantidad_actual } = req.body;
  const userId = req.userId;

  try {
    if (!nombre || !unidad_medida) {
      return res.status(400).json({ error: 'Nombre y unidad de medida son obligatorios' });
    }

    const newInsumo = await pool.query(
      `INSERT INTO insumos (nombre, unidad_medida, cantidad_actual, user_id)
       VALUES ($1, $2, COALESCE($3, 0), $4)
       RETURNING *`,
      [nombre, unidad_medida, cantidad_actual, userId]
    );

    res.status(201).json(newInsumo.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Obtener todos los insumos del usuario logueado
const getInsumos = async (req, res) => {
  const userId = req.userId;

  try {
    const insumos = await pool.query(
      'SELECT * FROM insumos WHERE user_id = $1 ORDER BY nombre',
      [userId]
    );

    res.json(insumos.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
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

    // Verificamos si el insumo está siendo usado en alguna receta
    const enUso = await pool.query(
      'SELECT * FROM plato_insumos WHERE insumo_id = $1',
      [id]
    );

    if (enUso.rows.length > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar: este insumo está siendo usado en la receta de uno o más platos',
      });
    }

    await pool.query('DELETE FROM insumos WHERE id = $1', [id]);

    res.json({ message: 'Insumo eliminado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar el insumo' });
  }
};
module.exports = { createInsumo, getInsumos, deleteInsumo };