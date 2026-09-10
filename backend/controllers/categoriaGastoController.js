const pool = require('../config/db');

const createcategoriaGasto = async (req, res) => {
  const { nombre } = req.body;
  const userId = req.userId;

  try {
    if (!nombre) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    const existente = await pool.query(
      'SELECT * FROM categorias_gasto WHERE LOWER(nombre) = LOWER($1) AND user_id = $2',
      [nombre, userId]
    );

    if (existente.rows.length > 0) {
      return res.status(400).json({ error: `Ya existe una categoría llamada "${nombre}"` });
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

const deletecategoriaGasto = async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  try {
    const categoria = await pool.query(
      'SELECT * FROM categorias_gasto WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (categoria.rows.length === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    const enUso = await pool.query(
      'SELECT * FROM compras WHERE categoria_id = $1',
      [id]
    );

    if (enUso.rows.length > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar: esta categoría tiene compras registradas',
      });
    }

    await pool.query('DELETE FROM categorias_gasto WHERE id = $1', [id]);

    res.json({ message: 'Categoría eliminada correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar la categoría' });
  }
};

module.exports = { createcategoriaGasto, getcategoriaGasto, deletecategoriaGasto };