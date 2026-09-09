const pool = require('../config/db');

const createVenta = async (req, res) => {
  const { tipo, items } = req.body;
  // items = [
  //   { plato_id: 2, cantidad: 2 },
  //   { plato_id: 3, cantidad: 1, insumos_ejecutivo: [{ insumo_id: 2, porciones: 1 }] }
  // ]

  const userId = req.userId;
  const tipoVenta = tipo || 'venta';

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Debes incluir al menos un plato en la venta' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Creamos el encabezado de la venta
    const ventaResult = await client.query(
      `INSERT INTO ventas (tipo, user_id) VALUES ($1, $2) RETURNING *`,
      [tipoVenta, userId]
    );
    const ventaId = ventaResult.rows[0].id;

    // 2. Procesamos cada plato de la venta
    for (const item of items) {
      const platoResult = await client.query(
        'SELECT * FROM platos WHERE id = $1 AND user_id = $2',
        [item.plato_id, userId]
      );

      if (platoResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `Plato ${item.plato_id} no encontrado` });
      }

      const plato = platoResult.rows[0];
      const cantidadVendida = item.cantidad || 1;

      // Insertamos la fila de detalle para este plato
      await client.query(
        `INSERT INTO venta_detalle (venta_id, plato_id, cantidad, precio_unitario)
         VALUES ($1, $2, $3, $4)`,
        [ventaId, item.plato_id, cantidadVendida, plato.precio]
      );

      // Descontamos inventario, según el tipo de plato (misma lógica de siempre)
      if (plato.tipo === 'especial' || plato.tipo === 'rapida') {
        const receta = await client.query(
          'SELECT * FROM plato_insumos WHERE plato_id = $1',
          [item.plato_id]
        );

        for (const receta_item of receta.rows) {
         const cantidadADescontar = Math.round((porcionesUsadas / porcionesPorUnidad) * 100) / 100;
          await client.query(
            `UPDATE insumos SET cantidad_actual = cantidad_actual - $1 WHERE id = $2`,
            [cantidadADescontar, receta_item.insumo_id]
          );
        }
      } else if (plato.tipo === 'ejecutivo') {
        if (!item.insumos_ejecutivo || item.insumos_ejecutivo.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Debes indicar los insumos usados para el ejecutivo' });
        }

        for (const insumoItem of item.insumos_ejecutivo) {
          const rendimientoResult = await client.query(
            'SELECT * FROM rendimientos WHERE insumo_id = $1',
            [insumoItem.insumo_id]
          );

          if (rendimientoResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `No hay rendimiento configurado para el insumo ${insumoItem.insumo_id}` });
          }

          const porcionesPorUnidad = rendimientoResult.rows[0].porciones_por_unidad;
          const porcionesUsadas = insumoItem.porciones * cantidadVendida;
          const cantidadADescontar = porcionesUsadas / porcionesPorUnidad;

          await client.query(
            `UPDATE insumos SET cantidad_actual = cantidad_actual - $1 WHERE id = $2`,
            [cantidadADescontar, insumoItem.insumo_id]
          );
        }
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
             'plato_nombre', p.nombre,
             'cantidad', vd.cantidad,
             'precio_unitario', vd.precio_unitario
           )
         ) AS items,
         SUM(vd.cantidad * vd.precio_unitario) AS total
       FROM ventas v
       JOIN venta_detalle vd ON vd.venta_id = v.id
       LEFT JOIN platos p ON vd.plato_id = p.id
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