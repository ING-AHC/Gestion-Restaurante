class ErrorNegocio extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.status = status;
  }
}

// Registra una venta dentro de una transacción que ya está abierta.
// No hace BEGIN ni COMMIT: eso lo decide quien la llama.
const registrarVenta = async (client, userId, { tipo, fecha, items }) => {
  const ventaResult = await client.query(
    `INSERT INTO ventas (tipo, fecha, user_id)
     VALUES ($1, COALESCE($2, (NOW() AT TIME ZONE 'America/Bogota')::date), $3)
     RETURNING *`,
    [tipo, fecha, userId]
  );
  const ventaId = ventaResult.rows[0].id;

  for (const item of items) {
    const productoResult = await client.query(
      'SELECT * FROM productos WHERE id = $1 AND user_id = $2',
      [item.producto_id, userId]
    );

    if (productoResult.rows.length === 0) {
      throw new ErrorNegocio(404, `Producto ${item.producto_id} no encontrado`);
    }

    const producto = productoResult.rows[0];
    const cantidadVendida = item.cantidad === undefined ? 1 : Number(item.cantidad);

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

    if (producto.tipo === 'especial' || producto.tipo === 'rapida' || producto.tipo === 'ejecutivo' || producto.tipo === 'sopa' || producto.tipo === 'principio') {
      const receta = await client.query(
        'SELECT * FROM plato_insumos WHERE producto_id = $1',
        [item.producto_id]
      );

      for (const recetaItem of receta.rows) {
        const cantidadADescontar = Math.round(recetaItem.cantidad_usada * cantidadVendida * 100) / 100;
        await client.query(
          `UPDATE insumos SET cantidad_actual = cantidad_actual - $1 WHERE id = $2 AND user_id = $3`,
          [cantidadADescontar, recetaItem.insumo_id, userId]
        );
      }
    } else if (producto.tipo === 'bebida' && producto.insumo_id) {
      // La bebida solo descuenta inventario si tiene un insumo ligado (es opcional)
      await client.query(
        `UPDATE insumos SET cantidad_actual = cantidad_actual - $1 WHERE id = $2 AND user_id = $3`,
        [cantidadVendida, producto.insumo_id, userId]
      );
    }
  }

  return ventaResult.rows[0];
};

module.exports = { ErrorNegocio, registrarVenta };