const pool = require('../config/db');

const createProveedores = async (req, res) => {
  const { nombre, telefono } = req.body;
  const userId = req.userId;

  try {
    if (!nombre || !String(nombre).trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    const existente = await pool.query(
      'SELECT id FROM proveedores WHERE LOWER(nombre) = LOWER($1) AND user_id = $2',
      [nombre.trim(), userId]
    );

    if (existente.rows.length > 0) {
      return res.status(400).json({ error: `Ya existe un proveedor llamado "${nombre.trim()}"` });
    }

    const newProveedores = await pool.query(
      `INSERT INTO proveedores (nombre, telefono, user_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [nombre.trim(), telefono || null, userId]
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

const deleteProveedor = async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  if (!Number.isInteger(Number(id))) {
    return res.status(400).json({ error: 'Identificador no válido' });
  }

  try {
    const proveedor = await pool.query(
      'SELECT id FROM proveedores WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (proveedor.rows.length === 0) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }

    const enUso = await pool.query(
      'SELECT id FROM compras WHERE proveedor_id = $1 LIMIT 1',
      [id]
    );

    if (enUso.rows.length > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar: este proveedor tiene compras registradas',
      });
    }

    await pool.query('DELETE FROM proveedores WHERE id = $1 AND user_id = $2', [id, userId]);

    res.json({ message: 'Proveedor eliminado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar el proveedor' });
  }
};

module.exports = { createProveedores, getProveedores, deleteProveedor };