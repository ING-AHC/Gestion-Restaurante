const pool = require('../config/db');

const createCompra = async (req, res) => {
  const { proveedor_id, categoria_id, estado_pago, items } = req.body;
  const userId = req.userId;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Debes incluir al menos un insumo en la compra' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

   const montoTotal = items.reduce((total, item) => total + item.valor_unitario, 0);

    const compraResult = await client.query(
      `INSERT INTO compras (proveedor_id, categoria_id, monto_total, estado_pago, user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [proveedor_id, categoria_id, montoTotal, estado_pago || 'pendiente', userId]
    );

    const compraId = compraResult.rows[0].id;

    for (const item of items) {
      await client.query(
        `INSERT INTO compra_detalle (compra_id, insumo_id, cantidad, valor_unitario)
         VALUES ($1, $2, $3, $4)`,
        [compraId, item.insumo_id, item.cantidad, item.valor_unitario]
      );

      await client.query(
        `UPDATE insumos SET cantidad_actual = cantidad_actual + $1 WHERE id = $2`,
        [item.cantidad, item.insumo_id]
      );
    }

    await client.query('COMMIT');

    res.status(201).json(compraResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Error al registrar la compra' });
  } finally {
    client.release();
  }
};
const getCompras = async (req, res) => {
  const userId = req.userId;

  try {
    const compras = await pool.query(
      `SELECT
         c.id,
         c.proveedor_id,
         c.categoria_id,
         c.monto_total,
         c.estado_pago,
         c.fecha,
         p.nombre AS proveedor_nombre,
         cg.nombre AS categoria_nombre,
         json_agg(
           json_build_object(
             'insumo_nombre', i.nombre,
             'cantidad', cd.cantidad,
             'valor', cd.valor_unitario
           )
         ) AS items
       FROM compras c
       LEFT JOIN proveedores p ON c.proveedor_id = p.id
       LEFT JOIN categorias_gasto cg ON c.categoria_id = cg.id
       LEFT JOIN compra_detalle cd ON cd.compra_id = c.id
       LEFT JOIN insumos i ON cd.insumo_id = i.id
       WHERE c.user_id = $1
       GROUP BY c.id, p.nombre, cg.nombre
       ORDER BY c.fecha DESC`,
      [userId]
    );

    res.json(compras.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};
const marcarComoPagada = async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  try {
    const compra = await pool.query(
      'SELECT * FROM compras WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (compra.rows.length === 0) {
      return res.status(404).json({ error: 'Compra no encontrada' });
    }

    const updated = await pool.query(
      `UPDATE compras SET estado_pago = 'pagado' WHERE id = $1 RETURNING *`,
      [id]
    );

    res.json(updated.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

module.exports = { createCompra, getCompras, marcarComoPagada };