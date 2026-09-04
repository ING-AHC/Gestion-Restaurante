const pool = require('../config/db');

const createVenta = async (req, res) => {
  const { plato_id, tipo, cantidad, insumos_ejecutivo } = req.body;
  // insumos_ejecutivo solo aplica si el plato es "ejecutivo":
  // [{ insumo_id: 1, porciones: 2 }]

  const userId = req.userId;
  const cantidadVendida = cantidad || 1;
  const tipoVenta = tipo || 'venta'; // 'venta' o 'consumo_interno'

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Verificamos que el plato exista y sea del usuario
    const platoResult = await client.query(
      'SELECT * FROM platos WHERE id = $1 AND user_id = $2',
      [plato_id, userId]
    );

    if (platoResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Plato no encontrado' });
    }

    const plato = platoResult.rows[0];

    // 2. Registramos la venta
    const ventaResult = await client.query(
      `INSERT INTO ventas (plato_id, tipo, cantidad, precio_unitario, user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [plato_id, tipoVenta, cantidadVendida, plato.precio, userId]
    );

    // 3. Descontamos inventario, según el tipo de plato
    if (plato.tipo === 'especial' || plato.tipo === 'rapida') {
      // Traemos la receta exacta del plato
      const receta = await client.query(
        'SELECT * FROM plato_insumos WHERE plato_id = $1',
        [plato_id]
      );

      for (const item of receta.rows) {
        const cantidadADescontar = item.cantidad_usada * cantidadVendida;

        await client.query(
          `UPDATE insumos SET cantidad_actual = cantidad_actual - $1 WHERE id = $2`,
          [cantidadADescontar, item.insumo_id]
        );
      }
    } else if (plato.tipo === 'ejecutivo') {
      if (!insumos_ejecutivo || insumos_ejecutivo.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Debes indicar qué insumos se usaron para este ejecutivo' });
      }

      for (const item of insumos_ejecutivo) {
        // Buscamos el rendimiento configurado para ese insumo
        const rendimientoResult = await client.query(
          'SELECT * FROM rendimientos WHERE insumo_id = $1',
          [item.insumo_id]
        );

        if (rendimientoResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `No hay rendimiento configurado para el insumo ${item.insumo_id}` });
        }

        const porcionesPorUnidad = rendimientoResult.rows[0].porciones_por_unidad;
        const porcionesUsadas = item.porciones * cantidadVendida;
        const cantidadADescontar = porcionesUsadas / porcionesPorUnidad;

        await client.query(
          `UPDATE insumos SET cantidad_actual = cantidad_actual - $1 WHERE id = $2`,
          [cantidadADescontar, item.insumo_id]
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
      `SELECT v.*, p.nombre AS plato_nombre
       FROM ventas v
       JOIN platos p ON v.plato_id = p.id
       WHERE v.user_id = $1
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