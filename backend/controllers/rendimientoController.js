const pool = require('../config/db');

const createRendimiento = async (req, res) => {
  const { insumo_id, porciones_por_unidad } = req.body;
  const userId = req.userId;

  try {
    if (!insumo_id || !porciones_por_unidad) {
      return res.status(400).json({ error: 'insumo_id y porciones_por_unidad son obligatorios' });
    }

    const insumoId = Number(insumo_id);
    const porciones = Number(porciones_por_unidad);

    if (!Number.isInteger(insumoId) || !Number.isFinite(porciones) || porciones <= 0) {
      return res.status(400).json({ error: 'Insumo o porciones no válidos' });
    }

    // Verificamos que el insumo exista y sea del usuario logueado
    const insumoCheck = await pool.query(
      'SELECT id FROM insumos WHERE id = $1 AND user_id = $2',
      [insumoId, userId]
    );

    if (insumoCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Insumo no encontrado' });
    }

    const newRendimiento = await pool.query(
      `INSERT INTO rendimientos (insumo_id, porciones_por_unidad)
       VALUES ($1, $2)
       RETURNING *`,
      [insumoId, porciones]
    );

    res.status(201).json(newRendimiento.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

const getRendimientos = async (req, res) => {
  const userId = req.userId;

  try {
    const rendimientos = await pool.query(
      `SELECT r.*, i.nombre AS insumo_nombre, i.unidad_medida
       FROM rendimientos r
       JOIN insumos i ON r.insumo_id = i.id
       WHERE i.user_id = $1`,
      [userId]
    );

    res.json(rendimientos.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

module.exports = { createRendimiento, getRendimientos };