const pool = require('../config/db');

const createVenta = async (req, res) => {
  const { tipo, items, fecha } = req.body;
  const userId = req.userId;
  const tipoVenta = tipo || 'venta';

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Debes incluir al menos un producto en la venta' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const ventaResult = await client.query(
      `INSERT INTO ventas (tipo, fecha, user_id) VALUES ($1, COALESCE($2, CURRENT_DATE), $3) RETURNING *`,
      [tipoVenta, fecha, userId]
    );
    const ventaId = ventaResult.rows[0].id;

    for (const item of items) {
      const productoResult = await client.query(
        'SELECT * FROM productos WHERE id = $1 AND user_id = $2',
        [item.producto_id, userId]
      );

      if (productoResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `Producto ${item.producto_id} no encontrado` });
      }

      const producto = productoResult.rows[0];
      const cantidadVendida = item.cantidad || 1;

      await client.query(
        `INSERT INTO venta_detalle (venta_id, producto_id, cantidad, precio_unitario, adicion_descripcion, adicion_valor)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          ventaId,
          item.producto_id,
          cantidadVendida,
          producto.precio,
          item.adicion_descripcion || null,
          item.adicion_valor || 0,
        ]
      );

      if (producto.tipo === 'especial' || producto.tipo === 'rapida' || producto.tipo === 'ejecutivo') {
        const receta = await client.query(
          'SELECT * FROM plato_insumos WHERE producto_id = $1',
          [item.producto_id]
        );

        for (const receta_item of receta.rows) {
          const cantidadADescontar = Math.round((receta_item.cantidad_usada * cantidadVendida) * 100) / 100;
          await client.query(
            `UPDATE insumos SET cantidad_actual = cantidad_actual - $1 WHERE id = $2`,
            [cantidadADescontar, receta_item.insumo_id]
          );
        }
      } else if (producto.tipo === 'bebida') {
        await client.query(
          `UPDATE insumos SET cantidad_actual = cantidad_actual - $1 WHERE id = $2`,
          [cantidadVendida, producto.insumo_id]
        );
      }
    }

    await client.query('COMMIT');

    res.status(201).json(ventaResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
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