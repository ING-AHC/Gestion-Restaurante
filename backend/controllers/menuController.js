const pool = require('../config/db');

const COLUMNAS =
  'id, nombre, tipo, precio, disponible_hoy, es_sopa, incluye_sopa, descuento_sin_sopa';

const soloAdmin = (req, res) => {
  if (req.rol !== 'admin') {
    res.status(403).json({ error: 'Solo el administrador puede configurar el menú' });
    return false;
  }
  return true;
};

// Admin: todos los productos con sus ajustes de menú
const getMenuAdmin = async (req, res) => {
  if (!soloAdmin(req, res)) return;
  try {
    const { rows } = await pool.query(
      `SELECT ${COLUMNAS} FROM productos WHERE user_id = $1 ORDER BY tipo, nombre`,
      [req.userId]
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al cargar el menú' });
  }
};

// Mesero, caja y admin: solo lo disponible hoy
const getMenuHoy = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${COLUMNAS} FROM productos
       WHERE user_id = $1 AND disponible_hoy ORDER BY tipo, nombre`,
      [req.userId]
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al cargar el menú de hoy' });
  }
};

// Admin: cambia uno o varios ajustes de un producto
const updateMenuItem = async (req, res) => {
  if (!soloAdmin(req, res)) return;

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Producto no válido' });
  }

  const { disponible_hoy, es_sopa, incluye_sopa, descuento_sin_sopa } = req.body;

  for (const [nombre, valor] of Object.entries({ disponible_hoy, es_sopa, incluye_sopa })) {
    if (valor !== undefined && typeof valor !== 'boolean') {
      return res.status(400).json({ error: `El campo ${nombre} debe ser verdadero o falso` });
    }
  }

  let descuento = null;
  if (descuento_sin_sopa !== undefined) {
    descuento = Number(descuento_sin_sopa);
    if (!Number.isFinite(descuento) || descuento < 0 || descuento > 1000000) {
      return res.status(400).json({ error: 'El descuento no es válido' });
    }
  }

  try {
    const { rows } = await pool.query(
      `UPDATE productos SET
         disponible_hoy = COALESCE($1, disponible_hoy),
         es_sopa = COALESCE($2, es_sopa),
         incluye_sopa = COALESCE($3, incluye_sopa),
         descuento_sin_sopa = COALESCE($4, descuento_sin_sopa)
       WHERE id = $5 AND user_id = $6
       RETURNING ${COLUMNAS}`,
      [
        disponible_hoy ?? null,
        es_sopa ?? null,
        incluye_sopa ?? null,
        descuento,
        id,
        req.userId,
      ]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json(rows[0]);
  } catch (error) {
    // 23514 = un producto no puede ser sopa y a la vez incluir sopa
    if (error.code === '23514') {
      return res.status(400).json({ error: 'Un producto no puede ser sopa e incluir sopa a la vez' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el menú' });
  }
};

// Admin: activa o desactiva todos los productos (o solo los de un tipo)
const reiniciarMenu = async (req, res) => {
  if (!soloAdmin(req, res)) return;

  const { disponible_hoy, tipo } = req.body;
  if (typeof disponible_hoy !== 'boolean') {
    return res.status(400).json({ error: 'disponible_hoy debe ser verdadero o falso' });
  }

  try {
    const { rowCount } = await pool.query(
      `UPDATE productos SET disponible_hoy = $1
       WHERE user_id = $2 AND ($3::text IS NULL OR tipo = $3)`,
      [disponible_hoy, req.userId, tipo ? String(tipo) : null]
    );
    res.json({ actualizados: rowCount });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el menú' });
  }
};

module.exports = { getMenuAdmin, getMenuHoy, updateMenuItem, reiniciarMenu };