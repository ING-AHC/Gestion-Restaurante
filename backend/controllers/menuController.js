const pool = require('../config/db');

// "Incluye sopa" no se guarda por plato: todo ejecutivo la incluye.
// El descuento por no llevar sopa es siempre de mil pesos.
const DESCUENTO_SIN_SOPA = 1000;

const SELECT_MENU = `
  SELECT p.id, p.nombre, p.tipo, p.precio, p.disponible_hoy, p.es_sopa,
         (p.tipo = 'ejecutivo') AS incluye_sopa,
         ${DESCUENTO_SIN_SOPA}::int AS descuento_sin_sopa
  FROM productos p`;

const soloAdmin = (req, res) => {
  if (req.rol !== 'admin') {
    res.status(403).json({ error: 'Solo el administrador puede configurar el menú' });
    return false;
  }
  return true;
};

// Cuántas porciones se pueden servir todavía de cada producto, según el inventario.
// Se descuenta lo que ya está pedido y aún no se cobra, porque el inventario solo baja al cobrar.
// Devuelve un Map producto_id -> porciones. Los productos sin receta (ni insumo ligado) no entran:
// de esos no se sabe cuántos quedan.
const calcularDisponibles = async (userId) => {
  const recetas = await pool.query(
    `SELECT pi.producto_id, pi.insumo_id, pi.cantidad_usada
     FROM plato_insumos pi
     JOIN productos p ON p.id = pi.producto_id
     WHERE p.user_id = $1`,
    [userId]
  );
  const stock = await pool.query(
    'SELECT id, cantidad_actual FROM insumos WHERE user_id = $1',
    [userId]
  );
  const ligados = await pool.query(
    `SELECT id, insumo_id FROM productos
     WHERE user_id = $1 AND tipo = 'bebida' AND insumo_id IS NOT NULL`,
    [userId]
  );

  // Lo que ya está comprometido en pedidos abiertos: el plato, su sopa y su principio
  const comprometido = await pool.query(
    `SELECT consumo.insumo_id, SUM(consumo.cantidad) AS cantidad
     FROM (
       SELECT pi.insumo_id, d.cantidad * pi.cantidad_usada AS cantidad
       FROM pedido_detalle d
       JOIN pedidos pe ON pe.id = d.pedido_id
       JOIN plato_insumos pi ON pi.producto_id = d.producto_id
       WHERE pe.user_id = $1 AND pe.venta_id IS NULL
         AND pe.estado IN ('pendiente', 'en_preparacion', 'listo')
       UNION ALL
       SELECT pi.insumo_id, d.cantidad * pi.cantidad_usada
       FROM pedido_detalle d
       JOIN pedidos pe ON pe.id = d.pedido_id
       JOIN plato_insumos pi ON pi.producto_id = d.sopa_id
       WHERE pe.user_id = $1 AND pe.venta_id IS NULL
         AND pe.estado IN ('pendiente', 'en_preparacion', 'listo')
       UNION ALL
       SELECT pi.insumo_id, d.cantidad * pi.cantidad_usada
       FROM pedido_detalle d
       JOIN pedidos pe ON pe.id = d.pedido_id
       JOIN plato_insumos pi ON pi.producto_id = d.principio_id
       WHERE pe.user_id = $1 AND pe.venta_id IS NULL
         AND pe.estado IN ('pendiente', 'en_preparacion', 'listo')
       UNION ALL
       SELECT pr.insumo_id, d.cantidad
       FROM pedido_detalle d
       JOIN pedidos pe ON pe.id = d.pedido_id
       JOIN productos pr ON pr.id = d.producto_id
       WHERE pe.user_id = $1 AND pe.venta_id IS NULL
         AND pe.estado IN ('pendiente', 'en_preparacion', 'listo')
         AND pr.tipo = 'bebida' AND pr.insumo_id IS NOT NULL
     ) consumo
     GROUP BY consumo.insumo_id`,
    [userId]
  );

  const libre = new Map(stock.rows.map((i) => [i.id, Number(i.cantidad_actual)]));
  for (const c of comprometido.rows) {
    libre.set(c.insumo_id, (libre.get(c.insumo_id) ?? 0) - Number(c.cantidad));
  }

  const disponibles = new Map();
  for (const r of recetas.rows) {
    const alcanza = Math.floor(Math.round((libre.get(r.insumo_id) ?? 0) * 100) / Math.round(Number(r.cantidad_usada) * 100));
    const porciones = Math.max(0, alcanza);
    const previo = disponibles.get(r.producto_id);
    disponibles.set(r.producto_id, previo === undefined ? porciones : Math.min(previo, porciones));
  }
  for (const b of ligados.rows) {
    if (!disponibles.has(b.id)) {
      disponibles.set(b.id, Math.max(0, Math.floor(libre.get(b.insumo_id) ?? 0)));
    }
  }
  return disponibles;
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

// Mesero, caja y admin: solo lo disponible hoy, con cuántas porciones quedan (null si no se sabe)
const getMenuHoy = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `${SELECT_MENU} WHERE p.user_id = $1 AND p.disponible_hoy ORDER BY p.tipo, p.nombre`,
      [req.userId]
    );
    const disponibles = await calcularDisponibles(req.userId);
    res.json(rows.map((p) => ({ ...p, disponibles: disponibles.has(p.id) ? disponibles.get(p.id) : null })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al cargar el menú de hoy' });
  }
};

// Admin: activa/desactiva un producto hoy
const updateMenuItem = async (req, res) => {
  if (!soloAdmin(req, res)) return;

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Producto no válido' });
  }

  const { disponible_hoy } = req.body;

  if (typeof disponible_hoy !== 'boolean') {
    return res.status(400).json({ error: 'El campo disponible_hoy debe ser verdadero o falso' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE productos SET disponible_hoy = $1
       WHERE id = $2 AND user_id = $3
       RETURNING id`,
      [disponible_hoy, id, req.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
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

module.exports = {
  DESCUENTO_SIN_SOPA,
  getMenuAdmin,
  getMenuHoy,
  updateMenuItem,
  reiniciarMenu,
};