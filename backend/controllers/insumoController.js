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

module.exports = { createInsumo, getInsumos };