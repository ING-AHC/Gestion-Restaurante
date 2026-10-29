class ErrorNegocio extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.status = status;
  }
}

const METODOS_PAGO = ['efectivo', 'transferencia', 'mixto'];

// Lee cómo se pagó: { metodo_pago, monto_efectivo } -> { metodo, montoEfectivo }
// En "mixto" el monto en efectivo debe ser mayor que 0 y menor que el total (el resto es transferencia).
const leerPago = (body = {}, total = null) => {
  const metodo = body.metodo_pago ? String(body.metodo_pago) : 'efectivo';
  if (!METODOS_PAGO.includes(metodo)) {
    throw new ErrorNegocio(400, 'Método de pago no válido: usa efectivo, transferencia o mixto');
  }
  if (metodo !== 'mixto') return { metodo, montoEfectivo: null };

  const montoEfectivo = Number(body.monto_efectivo);
  if (!Number.isFinite(montoEfectivo) || montoEfectivo <= 0) {
    throw new ErrorNegocio(400, 'En un pago mixto escribe cuánto se pagó en efectivo');
  }
  if (total !== null && montoEfectivo >= total) {
    throw new ErrorNegocio(400, 'En un pago mixto el efectivo debe ser menor que el total');
  }
  return { metodo, montoEfectivo };
};

const TIPOS_CON_RECETA = ['especial', 'rapida', 'ejecutivo', 'sopa', 'principio'];

// Descuenta del inventario lo que lleva la receta de un producto
const descontarReceta = async (client, userId, productoId, cantidad) => {
  const receta = await client.query('SELECT * FROM plato_insumos WHERE producto_id = $1', [productoId]);

  for (const recetaItem of receta.rows) {
    const cantidadADescontar = Math.round(recetaItem.cantidad_usada * cantidad * 100) / 100;
    await client.query(
      `UPDATE insumos SET cantidad_actual = cantidad_actual - $1 WHERE id = $2 AND user_id = $3`,
      [cantidadADescontar, recetaItem.insumo_id, userId]
    );
  }
};

// Registra una venta dentro de una transacción que ya está abierta.
// No hace BEGIN ni COMMIT: eso lo decide quien la llama.
//
// Cada línea es una de dos cosas:
//  - un producto del menú: { producto_id, cantidad, adicion_descripcion, adicion_valor, consumos_extra }
//    "consumos_extra" son productos que se gastan sin cobrarse aparte (la sopa y el principio de un ejecutivo)
//  - un servicio que no es un producto: { concepto, precio, cantidad }. No toca el inventario.
const registrarVenta = async (client, userId, { tipo, fecha, items, pago }) => {
  // El consumo interno no mueve plata: no lleva método de pago
  const { metodo, montoEfectivo } =
    tipo === 'consumo_interno' ? { metodo: 'efectivo', montoEfectivo: null } : pago || { metodo: 'efectivo', montoEfectivo: null };

  const ventaResult = await client.query(
    `INSERT INTO ventas (tipo, fecha, user_id, metodo_pago, monto_efectivo)
     VALUES ($1, COALESCE($2, (NOW() AT TIME ZONE 'America/Bogota')::date), $3, $4, $5)
     RETURNING *`,
    [tipo, fecha, userId, metodo, montoEfectivo]
  );
  const ventaId = ventaResult.rows[0].id;

  for (const item of items) {
    const cantidadVendida = item.cantidad === undefined ? 1 : Number(item.cantidad);

    // Servicio libre: solo se anota con su nombre y su valor
    if (item.producto_id === undefined || item.producto_id === null || item.producto_id === '') {
      await client.query(
        `INSERT INTO venta_detalle (venta_id, producto_id, concepto, cantidad, precio_unitario, adicion_descripcion, adicion_valor)
         VALUES ($1, NULL, $2, $3, $4, NULL, 0)`,
        [ventaId, item.concepto, cantidadVendida, item.precio]
      );
      continue;
    }

    const productoResult = await client.query(
      'SELECT * FROM productos WHERE id = $1 AND user_id = $2',
      [item.producto_id, userId]
    );

    if (productoResult.rows.length === 0) {
      throw new ErrorNegocio(404, `Producto ${item.producto_id} no encontrado`);
    }

    const producto = productoResult.rows[0];

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

    if (TIPOS_CON_RECETA.includes(producto.tipo)) {
      await descontarReceta(client, userId, item.producto_id, cantidadVendida);
    } else if (producto.tipo === 'bebida' && producto.insumo_id) {
      // La bebida solo descuenta inventario si tiene un insumo ligado (es opcional)
      await client.query(
        `UPDATE insumos SET cantidad_actual = cantidad_actual - $1 WHERE id = $2 AND user_id = $3`,
        [cantidadVendida, producto.insumo_id, userId]
      );
    }

    // La sopa y el principio de un ejecutivo gastan sus propios insumos
    for (const extraId of item.consumos_extra || []) {
      const extra = await client.query(
        'SELECT tipo FROM productos WHERE id = $1 AND user_id = $2',
        [extraId, userId]
      );
      if (extra.rows.length > 0 && TIPOS_CON_RECETA.includes(extra.rows[0].tipo)) {
        await descontarReceta(client, userId, extraId, cantidadVendida);
      }
    }
  }

  // En un pago mixto, el efectivo no puede ser igual o mayor al total de la venta
  if (metodo === 'mixto') {
    const total = await client.query(
      `SELECT COALESCE(SUM(cantidad * precio_unitario + COALESCE(adicion_valor, 0)), 0) AS total
       FROM venta_detalle WHERE venta_id = $1`,
      [ventaId]
    );
    if (montoEfectivo >= Number(total.rows[0].total)) {
      throw new ErrorNegocio(400, 'En un pago mixto el efectivo debe ser menor que el total');
    }
  }

  return ventaResult.rows[0];
};

module.exports = { ErrorNegocio, registrarVenta, leerPago };