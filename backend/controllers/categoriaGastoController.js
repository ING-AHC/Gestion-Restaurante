const pool = require('../config/db');

const createcategoriaGasto = async (req, res) => {
  const { nombre } = req.body;
  const userId = req.userId;

  try {
    if (!nombre) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    const newcategoriaGasto = await pool.query(
      `INSERT INTO categorias_gasto (nombre, user_id)
       VALUES ($1, $2)
       RETURNING *`,
      [nombre, userId]
    );

    res.status(201).json(newcategoriaGasto.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

const getcategoriaGasto = async (req, res) => {
  const userId = req.userId;

  try {
    const categoriaGasto = await pool.query(
      'SELECT * FROM categorias_gasto WHERE user_id = $1 ORDER BY nombre',
      [userId]
    );

    res.json(categoriaGasto.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

module.exports = { createcategoriaGasto, getcategoriaGasto };