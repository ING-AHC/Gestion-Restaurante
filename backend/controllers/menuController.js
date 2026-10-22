const pool = require('../config/db');

// "Incluye sopa" ya no se guarda por plato: todo ejecutivo la incluye.
// El descuento es uno solo por restaurante (1000 si no se ha configurado).
const SELECT_MENU = `
  SELECT p.id, p.nombre, p.tipo, p.precio, p.disponible_hoy, p.es_sopa,
         (p.tipo = 'ejecutivo') AS incluye_sopa,
         COALESCE(a.descuento_sin_sopa, 1000) AS descuento_sin_sopa
  FROM productos p
  LEFT JOIN ajustes_menu a ON a.user_id = p.user_id`;

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
      `${SELECT_MENU} WHERE p.user_id = $1 ORDER BY p.tipo, p.nombre`,
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
      `${SELECT_MENU} WHERE p.user_id = $1 AND p.disponible_hoy ORDER BY p.tipo, p.nombre`,
      [req.userId]
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al cargar el menú de hoy' });
  }
};

// Admin: activa/desactiva un producto hoy, o lo marca como sopa
const updateMenuItem = async (req, res) => {
  if (!soloAdmin(req, res)) return;

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Producto no válido' });
  }

  const { disponible_hoy, es_sopa } = req.body;

  for (const [nombre, valor] of Object.entries({ disponible_hoy, es_sopa })) {
    if (valor !== undefined && typeof valor !== 'boolean') {
      return res.status(400).json({ error: `El campo ${nombre} debe ser verdadero o falso` });
    }
  }

  try {
    const { rows } = await pool.query(
      `UPDATE productos SET
         disponible_hoy = COALESCE($1, disponible_hoy),
         es_sopa = COALESCE($2, es_sopa)
       WHERE id = $3 AND user_id = $4
         AND NOT (COALESCE($2, FALSE) AND tipo = 'ejecutivo')
       RETURNING id`,
      [disponible_hoy ?? null, es_sopa ?? null, id, req.userId]
    );

    if (rows.length === 0) {
      const existe = await pool.query(
        'SELECT id FROM productos WHERE id = $1 AND user_id = $2',
        [id, req.userId]
      );
      if (existe.rows.length === 0) {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }
      return res.status(400).json({ error: 'Un plato ejecutivo no puede ser una sopa' });
    }

    const actualizado = await pool.query(`${SELECT_MENU} WHERE p.id = $1`, [id]);
    res.json(actualizado.rows[0]);
  } catch (error) {
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

// Admin: descuento general por no llevar sopa
const getAjustes = async (req, res) => {
  if (!soloAdmin(req, res)) return;
  try {
    const { rows } = await pool.query(
      'SELECT descuento_sin_sopa FROM ajustes_menu WHERE user_id = $1',
      [req.userId]
    );
    res.json({ descuento_sin_sopa: rows[0] ? Number(rows[0].descuento_sin_sopa) : 1000 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al cargar los ajustes' });
  }
};

const updateAjustes = async (req, res) => {
  if (!soloAdmin(req, res)) return;

  const descuento = Number(req.body.descuento_sin_sopa);
  if (!Number.isFinite(descuento) || descuento < 0 || descuento > 1000000) {
    return res.status(400).json({ error: 'El descuento no es válido' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO ajustes_menu (user_id, descuento_sin_sopa) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET descuento_sin_sopa = EXCLUDED.descuento_sin_sopa
       RETURNING descuento_sin_sopa`,
      [req.userId, descuento]
    );
    res.json({ descuento_sin_sopa: Number(rows[0].descuento_sin_sopa) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al guardar los ajustes' });
  }
};

module.exports = {
  getMenuAdmin,
  getMenuHoy,
  updateMenuItem,
  reiniciarMenu,
  getAjustes,
  updateAjustes,
};