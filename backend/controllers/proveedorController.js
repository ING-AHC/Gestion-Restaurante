const pool = require('../config/db');

const createProveedores = async (req, res) => {
  const { nombre, telefono } = req.body;
  const userId = req.userId;

  try {
    if (!nombre) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    const newProveedores = await pool.query(
      `INSERT INTO proveedores (nombre, telefono, user_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [nombre, telefono, userId]
    );

    res.status(201).json(newProveedores.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

const getProveedores = async (req, res) => {
  const userId = req.userId;

  try {
    const proveedores = await pool.query(
      'SELECT * FROM proveedores WHERE user_id = $1 ORDER BY nombre',
      [userId]
    );

    res.json(proveedores.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

module.exports = { createProveedores, getProveedores };