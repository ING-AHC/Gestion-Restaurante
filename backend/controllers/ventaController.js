const pool = require('../config/db');
const { ErrorNegocio, registrarVenta } = require('../services/ventaService');

const createVenta = async (req, res) => {
  const { tipo, items, fecha } = req.body;
  const userId = req.userId;
  const tipoVenta = tipo || 'venta';

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Debes incluir al menos un producto en la venta' });
  }

  for (const item of items) {
    const cantidad = item.cantidad === undefined ? 1 : Number(item.cantidad);
    if (!Number.isInteger(Number(item.producto_id)) || !Number.isFinite(cantidad) || cantidad <= 0) {
      return res.status(400).json({ error: 'Producto o cantidad no válidos en la venta' });
    }
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const venta = await registrarVenta(client, userId, { tipo: tipoVenta, fecha, items });
    await client.query('COMMIT');

    res.status(201).json(venta);
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof ErrorNegocio) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al registrar la venta' });
  } finally {
    client.release();
  }
};

const getVentas = async (req, res) => {
  const userId = req.userId;

  try {
    const ventas = await pool.query(
      `SELECT
         v.id,
         v.tipo,
         v.fecha,
         json_agg(
           json_build_object(
             'producto_nombre', p.nombre,
             'cantidad', vd.cantidad,
             'precio_unitario', vd.precio_unitario,
             'adicion_descripcion', vd.adicion_descripcion,
             'adicion_valor', vd.adicion_valor
           )
         ) AS items,
         SUM(vd.cantidad * vd.precio_unitario + COALESCE(vd.adicion_valor, 0)) AS total
       FROM ventas v
       JOIN venta_detalle vd ON vd.venta_id = v.id
       LEFT JOIN productos p ON vd.producto_id = p.id
       WHERE v.user_id = $1
       GROUP BY v.id
       ORDER BY v.fecha DESC, v.id DESC`,
      [userId]
    );

    res.json(ventas.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

module.exports = { createVenta, getVentas };