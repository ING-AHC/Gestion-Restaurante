const pool = require('../config/db');

const TIPOS_VALIDOS = ['especial', 'rapida', 'ejecutivo'];

const createPlato = async (req, res) => {
  const { nombre, tipo, precio } = req.body;
  const userId = req.userId;

  try {
    if (!nombre || !tipo || !precio) {
      return res.status(400).json({ error: 'Nombre, tipo y precio son obligatorios' });
    }

    if (!TIPOS_VALIDOS.includes(tipo)) {
      return res.status(400).json({ error: 'El tipo debe ser: especial, rapida o ejecutivo' });
    }

    const newPlato = await pool.query(
      `INSERT INTO platos (nombre, tipo, precio, user_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [nombre, tipo, precio, userId]
    );

    res.status(201).json(newPlato.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

const getPlatos = async (req, res) => {
  const userId = req.userId;

  try {
    const platos = await pool.query(
      'SELECT * FROM platos WHERE user_id = $1 ORDER BY tipo, nombre',
      [userId]
    );

    res.json(platos.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};
const asignarInsumos = async (req, res) => {
  const { plato_id } = req.params;
  const { insumos } = req.body;
  const userId = req.userId;

  if (!insumos || insumos.length === 0) {
    return res.status(400).json({ error: 'Debes incluir al menos un insumo' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const platoCheck = await client.query(
      'SELECT * FROM platos WHERE id = $1 AND user_id = $2',
      [plato_id, userId]
    );

    if (platoCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Plato no encontrado' });
    }

    for (const item of insumos) {
      await client.query(
        `INSERT INTO plato_insumos (plato_id, insumo_id, cantidad_usada)
         VALUES ($1, $2, $3)`,
        [plato_id, item.insumo_id, item.cantidad_usada]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({ message: 'Receta asignada correctamente' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Error al asignar insumos al plato' });
  } finally {
    client.release();
  }
};
module.exports = { createPlato, getPlatos, asignarInsumos };